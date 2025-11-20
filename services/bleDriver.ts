
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
              // Note: Real data parsing would happen here or emit an event to the main service
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
      this.logCallback('ERROR', 'BLE', 'Web Bluetooth not supported');
      return false;
    }

    try {
      this.logCallback('INFO', 'BLE', 'Requesting device (G1_...)...');
      // G1 Glasses typically advertise with name starting with "G1"
      this.device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ namePrefix: 'G1' }],
        optionalServices: [BLE_UUIDS.SERVICE]
      });

      if (!this.device) return false;
      
      this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));

      this.logCallback('INFO', 'BLE', `Connecting to ${this.device.name}...`);
      if (this.device.gatt) {
        this.server = await this.device.gatt.connect();
      } else {
        throw new Error("GATT server unavailable");
      }

      this.logCallback('INFO', 'BLE', 'Getting Service...');
      const service = await this.server.getPrimaryService(BLE_UUIDS.SERVICE);

      this.logCallback('INFO', 'BLE', 'Getting Characteristics...');
      this.rxChar = await service.getCharacteristic(BLE_UUIDS.RX_CHAR);
      this.txChar = await service.getCharacteristic(BLE_UUIDS.TX_CHAR);

      await this.txChar.startNotifications();
      this.txChar.addEventListener('characteristicvaluechanged', this.handleNotifications.bind(this));

      this.logCallback('INFO', 'BLE', 'Connected & Subscribed');
      return true;

    } catch (e: any) {
      this.logCallback('ERROR', 'BLE', `Connection failed: ${e.message}`);
      return false;
    }
  }

  public disconnect() {
    // Native Path
    if (this.androidBridge) {
        this.androidBridge.disconnect();
        // We assume disconnection callback will fire, but we set state immediately for UI responsiveness
        this.nativeConnected = false;
        return;
    }

    // Web Bluetooth Path
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
  }

  private onDisconnected() {
    this.logCallback('WARN', 'BLE', 'Device Disconnected');
    this.rxChar = null;
    this.txChar = null;
    this.server = null;
  }

  private handleNotifications(event: any) {
    const value = event.target.value as DataView;
    const arr = new Uint8Array(value.buffer);
    const hex = Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join(' ').toUpperCase();
    this.logCallback('INFO', 'RX', `[${arr.length}] ${hex}`);
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
            
            const hex = Array.from(data).map(b => b.toString(16).padStart(2,'0')).join(' ').toUpperCase();
            this.logCallback('INFO', 'TX', `[${data.length}] ${hex}`);
            return true;
        } catch (e: any) {
            this.logCallback('ERROR', 'BLE', `Native Write failed: ${e.message}`);
            return false;
        }
    }

    // Web Bluetooth Path
    if (!this.rxChar) {
      this.logCallback('ERROR', 'BLE', 'Cannot write: No characteristic');
      return false;
    }
    try {
      await this.rxChar.writeValueWithoutResponse(data);
      const hex = Array.from(data).map(b => b.toString(16).padStart(2,'0')).join(' ').toUpperCase();
      this.logCallback('INFO', 'TX', `[${data.length}] ${hex}`);
      return true;
    } catch (e: any) {
      this.logCallback('ERROR', 'BLE', `Write failed: ${e.message}`);
      return false;
    }
  }
}
