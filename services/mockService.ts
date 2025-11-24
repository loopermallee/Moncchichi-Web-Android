
import { ConnectionState, DeviceVitals, LogEntry, HeadsetState } from '../types';
import { BleDriver } from './bleDriver';
import { Protocol, ProtocolEvent } from './protocol';

export interface MusicState {
    isPlaying: boolean;
    track: string;
    artist: string;
}

export interface NavigationState {
    waypoints: string[];
}

class ServiceManager {
  private listeners: ((vitals: DeviceVitals | null) => void)[] = [];
  private logListeners: ((entry: LogEntry) => void)[] = [];
  private connectionListeners: ((state: ConnectionState) => void)[] = [];
  private voiceListeners: ((text: string, isFinal: boolean) => void)[] = [];
  private statusListeners: ((status: string, issue: string | null, fix: string | null) => void)[] = [];
  
  private driver: BleDriver;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private vitals: DeviceVitals | null = null;
  
  // Simulation State
  public isSimulating: boolean = false;
  private simInterval: any = null;
  
  // Status State
  public connectionIssue: string | null = null;
  public connectionFix: string | null = null;

  // App State
  public musicState: MusicState = { isPlaying: false, track: "Bohemian Rhapsody", artist: "Queen" };
  
  constructor() {
    this.driver = new BleDriver((level, tag, msg) => this.emitLog(tag, level, msg));
    this.driver.setDataCallback((data) => this.handleIncomingData(data));
    
    // Default Vitals
    this.vitals = {
        batteryPercent: 85,
        caseBatteryPercent: 92,
        firmwareVersion: "1.6.6",
        hardwareId: "G1_7_L",
        signalRssi: -55,
        isCharging: false,
        isWorn: false,
        inCase: true,
        uptimeSeconds: 0,
        brightness: 50,
        silentMode: false,
        leftLensName: "Even G1_7_L",
        rightLensName: "Even G1_7_R"
    };
  }

  // --- State Management ---

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public getVitals(): DeviceVitals | null {
    return this.vitals;
  }

  public subscribeToVitals(callback: (vitals: DeviceVitals | null) => void): () => void {
    this.listeners.push(callback);
    callback(this.vitals);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  public subscribeToLogs(callback: (entry: LogEntry) => void): () => void {
    this.logListeners.push(callback);
    return () => {
      this.logListeners = this.logListeners.filter(l => l !== callback);
    };
  }

  public subscribeToConnection(callback: (state: ConnectionState) => void): () => void {
    this.connectionListeners.push(callback);
    callback(this.connectionState);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(l => l !== callback);
    };
  }
  
  public subscribeToVoice(callback: (text: string, isFinal: boolean) => void): () => void {
      this.voiceListeners.push(callback);
      return () => {
          this.voiceListeners = this.voiceListeners.filter(l => l !== callback);
      };
  }

  public subscribeToStatus(callback: (status: string, issue: string | null, fix: string | null) => void): () => void {
      this.statusListeners.push(callback);
      callback("Ready", this.connectionIssue, this.connectionFix);
      return () => {
          this.statusListeners = this.statusListeners.filter(l => l !== callback);
      };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l(this.vitals));
  }

  private setConnectionState(state: ConnectionState) {
    this.connectionState = state;
    this.connectionListeners.forEach(l => l(state));
  }
  
  private emitStatus(status: string, issue: string | null, fix: string | null) {
      this.connectionIssue = issue;
      this.connectionFix = fix;
      this.statusListeners.forEach(l => l(status, issue, fix));
  }

  public emitLog(tag: string, level: LogEntry['level'], message: string) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      tag,
      level,
      message
    };
    this.logListeners.forEach(l => l(entry));
  }

  // --- BLE & Simulation Control ---

  public setSimulationMode(enabled: boolean) {
      this.isSimulating = enabled;
      if (enabled) {
          this.startSimulation();
      } else {
          this.stopSimulation();
          this.disconnect();
      }
  }

  public async connect() {
      if (this.isSimulating) {
          this.setConnectionState(ConnectionState.CONNECTING);
          setTimeout(() => {
              this.setConnectionState(ConnectionState.CONNECTED);
              this.emitStatus("Simulated Connection Active", null, null);
          }, 800);
          return;
      }

      this.setConnectionState(ConnectionState.CONNECTING);
      this.emitStatus("Scanning for G1...", null, null);
      this.connectionIssue = null;
      this.connectionFix = null;

      try {
          const success = await this.driver.connect();
          if (success) {
              this.emitStatus("Negotiating Link...", null, null);
              // HANDSHAKE: Send MTU Request immediately
              this.emitLog("BLE", "INFO", "Handshake: Requesting MTU 251...");
              await this.sendCommandRaw(Protocol.getSetMtuPacket());
          } else {
              this.setConnectionState(ConnectionState.DISCONNECTED);
              this.emitStatus("Ready", null, null);
          }
      } catch (e: any) {
          this.setConnectionState(ConnectionState.ERROR);
          const msg = e.message || "Unknown";
          
          // Map driver errors to user-friendly status
          if (msg === "UserCancelled") {
             this.setConnectionState(ConnectionState.DISCONNECTED);
             this.emitStatus("Ready", null, null);
          } else if (msg === "SecurityError") {
             this.emitStatus("Permission Denied", "Bluetooth permission blocked", "Check browser site settings or permissions icon in address bar.");
          } else if (msg === "NetworkError") {
             this.emitStatus("Connection Failed", "Device unreachable or busy", "Ensure glasses are awake, charged, and not paired to another app.");
          } else if (msg === "NotSupportedError" || msg === "WebBluetoothUnsupported") {
             this.emitStatus("Unsupported", "Web Bluetooth missing", "Use Chrome, Edge, or Bluefy (iOS). Enable #enable-web-bluetooth-new-permissions-backend flags if on Android.");
          } else if (msg === "NoDeviceSelected") {
             this.setConnectionState(ConnectionState.DISCONNECTED);
             this.emitStatus("Ready", null, null);
          } else {
             this.emitStatus("Error", "Connection failed", msg);
          }
      }
  }

  public disconnect() {
      this.driver.disconnect();
      this.setConnectionState(ConnectionState.DISCONNECTED);
      this.emitStatus("Ready", null, null);
  }

  public async sendCommand(type: string, payload?: any) {
      if (this.connectionState !== ConnectionState.CONNECTED && !this.isSimulating) return;

      let packets: Uint8Array[] = [];
      let logMsg = "";

      switch (type) {
          case "TELEPROMPTER_INIT":
              packets = Protocol.getTextPackets(payload);
              logMsg = `[0x4E] Sending Text (${payload.length} chars)`;
              break;
          case "TELEPROMPTER_CLEAR":
              packets = [Protocol.getExitPacket()];
              logMsg = `[0x18] Exit/Clear`;
              break;
          case "SET_BRIGHTNESS":
              packets = [Protocol.getBrightnessPacket(payload)];
              logMsg = `[0x01] Set Brightness: ${payload}`;
              if (this.vitals) { 
                  this.vitals.brightness = payload; 
                  this.notifyListeners();
              }
              break;
          case "SET_SILENT_MODE":
              packets = [Protocol.getSilentModePacket(payload)];
              logMsg = `[0x03] Set Silent: ${payload}`;
              if (this.vitals) {
                  this.vitals.silentMode = payload;
                  this.notifyListeners();
              }
              break;
          case "DASHBOARD_MODE":
              packets = [Protocol.getDashboardModePacket(payload)];
              logMsg = `[0x06] Set Dashboard Mode: ${payload}`;
              break;
          case "CLEAR_SCREEN":
               packets = [Protocol.getExitPacket()];
               logMsg = "Clearing Display";
               break;
          case "MUSIC_CONTROL":
               this.emitLog("MUSIC", "INFO", `Control: ${payload}`);
               // Mock state update
               if (payload === "NEXT") this.musicState.track = "Another One Bites the Dust";
               if (payload === "PREV") this.musicState.track = "Under Pressure";
               if (payload === "PLAY" || payload === "PAUSE") this.musicState.isPlaying = (payload === "PLAY");
               return; // No real packet for mock music yet
          default:
              console.warn("Unknown command", type);
              return;
      }

      this.emitLog("TX", "INFO", logMsg);

      if (this.isSimulating) return;

      for (const p of packets) {
          await this.driver.write(p);
          // Small delay for BLE stack stability
          await new Promise(r => setTimeout(r, 20)); 
      }
  }

  public async sendCommandRaw(packet: Uint8Array) {
      if (this.connectionState === ConnectionState.CONNECTED) {
          await this.driver.write(packet);
      }
  }

  // --- Incoming Data Handling ---

  private handleIncomingData(data: Uint8Array) {
      const event = Protocol.parseTelemetry(data);
      if (!event) return;

      // Handshake Logic
      if (event.type === 'ACK' && event.subType === 'MTU') {
          this.setConnectionState(ConnectionState.CONNECTED);
          this.emitStatus("Connected", null, null);
          this.emitLog("BLE", "INFO", "Handshake: MTU Negotiated. Link Ready.");
          // Request initial state
          this.sendCommandRaw(Protocol.getFirmwareInfoPacket());
      }

      // Telemetry Updates
      if (event.type === 'BATTERY' && event.subType === 'DETAILED') {
           if (this.vitals && event.data.batteryPercent !== undefined) {
               this.vitals.batteryPercent = event.data.batteryPercent;
               this.notifyListeners();
           }
      }

      if (event.type === 'STATE') {
          if (this.vitals) {
              if (event.data.uptimeSeconds !== undefined) this.vitals.uptimeSeconds = event.data.uptimeSeconds;
              if (event.data.isWorn !== undefined) this.vitals.isWorn = event.data.isWorn;
              if (event.data.inCase !== undefined) this.vitals.inCase = event.data.inCase;
              this.notifyListeners();
          }
          if (event.subType === 'WORN') this.emitLog("SYS", "INFO", "Glasses Worn");
          if (event.subType === 'NOT_WORN') this.emitLog("SYS", "INFO", "Glasses Removed");
      }

      if (event.type === 'DEBUG') {
          this.emitLog("G1", "DEBUG", typeof event.data === 'string' ? event.data : JSON.stringify(event.data));
      }
  }

  // --- Simulation Logic ---

  private startSimulation() {
      if (this.simInterval) clearInterval(this.simInterval);
      this.simInterval = setInterval(() => {
          if (this.connectionState === ConnectionState.CONNECTED && this.vitals) {
              // Simulate battery drain
              if (Math.random() > 0.95) {
                  this.vitals.batteryPercent = Math.max(0, this.vitals.batteryPercent! - 1);
                  this.notifyListeners();
              }
              // Simulate RSSI fluctuation
              if (Math.random() > 0.7) {
                  this.vitals.signalRssi = -50 - Math.floor(Math.random() * 20);
                  this.notifyListeners();
              }
              // Simulate incoming heartbeat log
              if (Math.random() > 0.9) {
                  this.emitLog("RX", "INFO", "[6] 2B 69 0A 08 00 00"); // Heartbeat
              }
          }
      }, 2000);
  }

  private stopSimulation() {
      if (this.simInterval) {
          clearInterval(this.simInterval);
          this.simInterval = null;
      }
  }

  // --- Debug Overrides ---
  public debugSetConnectionState(state: ConnectionState) {
      this.setConnectionState(state);
      if (state === ConnectionState.CONNECTED) {
          this.emitStatus("Connected (Forced)", null, null);
      } else if (state === ConnectionState.DISCONNECTED) {
          this.emitStatus("Ready", null, null);
      }
  }

  public debugSetHeadsetState(state: HeadsetState) {
     this.emitLog("DEBUG", "INFO", `Forced Headset State: ${state}`);
  }

  public debugTriggerError(msg: string) {
      this.setConnectionState(ConnectionState.ERROR);
      this.emitStatus("Simulated Error", msg, "Try restarting the simulator");
  }
}

export const mockService = new ServiceManager();
