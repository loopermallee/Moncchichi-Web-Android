
import { BLE_UUIDS } from "../constants";
import { LogEntry } from "../types";

// Helper for Base64 encoding (Native Bridge communication)
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper for Base64 decoding (Native Bridge communication)
function base64ToBytes(base64: string): Uint8Array {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

// Type Definitions for Web Bluetooth
interface BluetoothDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: string, listener: (event: any) => void): void;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  readValue(): Promise<DataView>;
  writeValueWithoutResponse(data: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  addEventListener(type: string, listener: (event: any) => void): void;
}

// Type definition for the Android Native Bridge (Moncchichi Hub Wrapper)
interface AndroidBridge {
    connect(): void;
    disconnect(): void;
    write(base64Data: string): void;
    // Optional permission checks
    checkPermissions?(): boolean;
    requestPermissions?(): void;
}

export class BleDriver {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private rxChar: BluetoothRemoteGATTCharacteristic | null = null; // Write to this
  private txChar: BluetoothRemoteGATTCharacteristic | null = null; // Read from this
  
  private onDataCallback: ((data: Uint8Array) => void) | null = null;

  // Native Bridge State
  private androidBridge: AndroidBridge | null = null;
  private nativeConnected: boolean = false;
  private connectPromiseResolver: ((val: boolean) => void) | null = null;

  constructor(private logCallback: (level: LogEntry['level'], tag: string, msg: string) => void) {
      // Check for Android Interface injection
      if ((window as any).Android) {
          this.androidBridge = (window as any).Android;
          this.logCallback('INFO', 'SYS', 'Android Native Bridge detected');
          this.setupNativeListeners();
      }
  }

  public setDataCallback(cb: (data: Uint8Array) => void) {
      this.onDataCallback = cb;
  }

  private setupNativeListeners() {
      // Define global callbacks for the Android wrapper to invoke
      (window as any).onBleConnected = () => {
          this.logCallback('INFO', 'BLE', 'Native: Connected to G1');
          this.nativeConnected = true;
          if (this.connectPromiseResolver) {
              this.connectPromiseResolver(true);
              this.connectPromiseResolver = null;
          }
      };

      (window as any).onBleConnectError = (err: string) => {
          this.logCallback('ERROR', 'BLE', `Native: Connection Error - ${err}`);
          this.nativeConnected = false;
          if (this.connectPromiseResolver) {
              this.connectPromiseResolver(false);
              this.connectPromiseResolver = null;
          }
      };

      (window as any).onBleDisconnected = () => {
          this.logCallback('WARN', 'BLE', 'Native: Disconnected');
          this.nativeConnected = false;
      };

      (window as any).onBleDataReceived = (base64Data: string) => {
          try {
              const data = base64ToBytes(base64Data);
              const hex = Array.from(data).map(b => b.toString(16).padStart(2,'0')).join(' ').toUpperCase();
              this.logCallback('INFO', 'RX', `[${data.length}] ${hex}`);
              if (this.onDataCallback) this.onDataCallback(data);
          } catch (e) {
              console.error("Failed to parse native BLE data", e);
          }
      };
  }

  public get isConnected(): boolean {
    if (this.androidBridge) return this.nativeConnected;
    return this.server?.connected || false;
  }

  public async connect(): Promise<boolean> {
    // 1. Native Android Path
    if (this.androidBridge) {
        this.logCallback('INFO', 'BLE', 'Initiating Native Connection...');
        return new Promise((resolve) => {
            this.connectPromiseResolver = resolve;
            
            // Safety timeout
            setTimeout(() => {
                if (this.connectPromiseResolver) {
                    this.logCallback('ERROR', 'BLE', 'Native Connection Timeout');
                    this.connectPromiseResolver(false);
                    this.connectPromiseResolver = null;
                }
            }, 15000);

            this.androidBridge!.connect();
        });
    }

    // 2. Web Bluetooth Path
    if (!(navigator as any).bluetooth) {
      const msg = 'Web Bluetooth not supported in this browser.';
      this.logCallback('ERROR', 'BLE', msg);
      throw new Error("WebBluetoothUnsupported");
    }

    try {
      this.logCallback('INFO', 'BLE', 'Requesting User Selection (Check Popup)...');
      
      // Using acceptAllDevices allows the user to see all BLE devices in the browser picker
      // and select the correct one manually, avoiding issues with device name filtering.
      this.device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [BLE_UUIDS.SERVICE]
      });

      if (!this.device) {
          throw new Error("NoDeviceSelected");
      }
      
      this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));

      this.logCallback('INFO', 'BLE', `Connecting to ${this.device.name || 'Device'}...`);
      if (this.device.gatt) {
        this.server = await this.device.gatt.connect();
      } else {
        throw new Error("GATT server unavailable");
      }

      this.logCallback('INFO', 'BLE', 'Discovering Services...');
      const service = await this.server.getPrimaryService(BLE_UUIDS.SERVICE);

      this.logCallback('INFO', 'BLE', 'Discovering Characteristics...');
      this.rxChar = await service.getCharacteristic(BLE_UUIDS.RX_CHAR);
      this.txChar = await service.getCharacteristic(BLE_UUIDS.TX_CHAR);

      await this.txChar.startNotifications();
      this.txChar.addEventListener('characteristicvaluechanged', this.handleNotifications.bind(this));

      this.logCallback('INFO', 'BLE', 'Subscribed to G1 Data Stream');
      return true;

    } catch (e: any) {
      const errMsg = e.message || e.toString();
      
      // Specific Error Classification for UI Troubleshooting
      if (e.name === 'NotFoundError' || errMsg.includes('cancelled')) {
          this.logCallback('WARN', 'BLE', 'User cancelled selection.');
          throw new Error("UserCancelled");
      }
      if (e.name === 'SecurityError') {
           this.logCallback('ERROR', 'BLE', 'Security: Permission denied.');
           throw new Error("SecurityError");
      }
      if (e.name === 'NetworkError' || errMsg.includes('NetworkError') || errMsg.includes('GATT')) {
           this.logCallback('ERROR', 'BLE', 'Network/GATT Error: Device busy or out of range.');
           throw new Error("NetworkError");
      }
      if (e.name === 'NotSupportedError') {
          throw new Error("NotSupportedError");
      }

      this.logCallback('ERROR', 'BLE', `Connection failed: ${errMsg}`);
      throw e;
    }
  }

  public disconnect() {
    // Native Path
    if (this.androidBridge) {
        this.androidBridge.disconnect();
        this.nativeConnected = false;
        return;
    }

    // Web Bluetooth Path
    if (this.device && this.device.gatt?.connected) {
      this.logCallback('INFO', 'BLE', 'Disconnecting Web Bluetooth...');
      this.device.gatt.disconnect();
    }
  }

  private onDisconnected() {
    this.logCallback('WARN', 'BLE', 'Device Disconnected (Event)');
    this.rxChar = null;
    this.txChar = null;
    this.server = null;
  }

  private handleNotifications(event: any) {
    const value = event.target.value as DataView;
    const arr = new Uint8Array(value.buffer);
    const hex = Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join(' ').toUpperCase();
    this.logCallback('INFO', 'RX', `[${arr.length}] ${hex}`);
    if (this.onDataCallback) this.onDataCallback(arr);
  }

  public async write(data: Uint8Array): Promise<boolean> {
    // Native Path
    if (this.androidBridge) {
        if (!this.nativeConnected) {
             this.logCallback('ERROR', 'BLE', 'Cannot write: Native Disconnected');
             return false;
        }
        try {
            const base64 = bytesToBase64(data);
            this.androidBridge.write(base64);
            return true;
        } catch (e) {
             this.logCallback('ERROR', 'BLE', 'Native Write Failed');
             return false;
        }
    }

    // Web Bluetooth Path
    if (this.rxChar) {
        try {
            // WriteWithoutResponse is generally preferred for throughput
            await this.rxChar.writeValueWithoutResponse(data);
            return true;
        } catch (e: any) {
            this.logCallback('ERROR', 'TX', `Write Error: ${e.message}`);
            return false;
        }
    }
    
    this.logCallback('WARN', 'BLE', 'Write skipped: No characteristic');
    return false;
  }
}
