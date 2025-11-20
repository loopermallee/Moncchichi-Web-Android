
import { ConnectionState, DeviceVitals, LogEntry } from '../types';
import { BleDriver } from './bleDriver';
import { Protocol } from './protocol';

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
  private internalLogBuffer: LogEntry[] = []; 
  
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private intervalId: any = null;
  private heartbeatId: any = null;

  // Mode
  public isSimulating: boolean = false; // Default to real, fallback to mock
  private bleDriver: BleDriver;

  private state: DeviceVitals = {
    batteryPercent: null,
    caseBatteryPercent: null,
    firmwareVersion: null,
    signalRssi: null,
    isCharging: false,
    isWorn: false,
    inCase: false,
    uptimeSeconds: 0,
    brightness: 50,
    silentMode: false,
    leftLensName: "Unknown",
    rightLensName: "Unknown"
  };

  public musicState: MusicState = {
      isPlaying: false,
      track: "Midnight City",
      artist: "M83"
  };
  
  public activeChecklist: string | null = null;
  
  public navigationState: NavigationState = {
      waypoints: []
  };

  constructor() {
    this.bleDriver = new BleDriver(this.emitLog.bind(this));
    // Auto-detect if Web Bluetooth is unavailable and default to sim
    if (typeof navigator !== 'undefined' && !(navigator as any).bluetooth && !(window as any).Android) {
        this.isSimulating = true;
        this.emitLog("SYS", "WARN", "BLE capability unavailable, defaulting to Simulation");
    }
  }

  public setSimulationMode(enabled: boolean) {
      if (this.connectionState === ConnectionState.CONNECTED) {
          this.disconnect();
      }
      this.isSimulating = enabled;
      this.emitLog("SYS", "INFO", `Switched to ${enabled ? "Simulation" : "Real Device"} Mode`);
  }

  private startSimulation() {
    this.state = {
        batteryPercent: 82,
        caseBatteryPercent: 95,
        firmwareVersion: "v1.6.6",
        signalRssi: -58,
        isCharging: false,
        isWorn: true,
        inCase: false,
        uptimeSeconds: 1240,
        brightness: 75,
        silentMode: false,
        leftLensName: "G1_L_E4A1",
        rightLensName: "G1_R_B2C9"
    };

    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      this.simulateTelemetryUpdate();
    }, 5000);
  }

  private startRealHeartbeat() {
      if (this.heartbeatId) clearInterval(this.heartbeatId);
      this.heartbeatId = setInterval(async () => {
          if (this.connectionState === ConnectionState.CONNECTED) {
              const packet = Protocol.getHeartbeatPacket();
              await this.bleDriver.write(packet);
              // In a real app, we'd parse the RX notification response to update battery, etc.
          }
      }, 15000); // 15s per Android impl
  }

  private stopSimulation() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.heartbeatId) {
        clearInterval(this.heartbeatId);
        this.heartbeatId = null;
    }
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public getVitals(): DeviceVitals {
    return this.state;
  }

  public getRecentLogs(): LogEntry[] {
    return this.internalLogBuffer;
  }

  public disconnect() {
    this.stopSimulation();
    if (this.isSimulating) {
        this.connectionState = ConnectionState.DISCONNECTED;
        this.emitLog("BLE", "WARN", "User initiated disconnect (Sim)");
    } else {
        this.bleDriver.disconnect();
        this.connectionState = ConnectionState.DISCONNECTED;
    }
    this.notifyConnectionListeners();
    this.notifyListeners();
  }

  public async connect() {
    if (this.connectionState === ConnectionState.CONNECTED) return;

    this.connectionState = ConnectionState.CONNECTING;
    this.notifyConnectionListeners();
    
    if (this.isSimulating) {
        this.emitLog("BLE", "INFO", "Simulating G1 Connection...");
        try {
            await new Promise(r => setTimeout(r, 1500));
            this.connectionState = ConnectionState.CONNECTED;
            this.startSimulation();
            this.emitLog("BLE", "INFO", "Simulated Connection established");
            this.notifyConnectionListeners();
            this.notifyListeners();
        } catch (err: any) {
            this.connectionState = ConnectionState.ERROR;
            this.notifyConnectionListeners();
        }
    } else {
        this.emitLog("BLE", "INFO", "Starting BLE connection...");
        const success = await this.bleDriver.connect();
        if (success) {
            this.connectionState = ConnectionState.CONNECTED;
            this.startRealHeartbeat();
            // Initial config
            // Enable Mic? Or wait for intent?
            // this.bleDriver.write(Protocol.getMicEnablePacket(true)); 
            this.notifyConnectionListeners();
        } else {
            this.connectionState = ConnectionState.DISCONNECTED; // Or Error
            this.notifyConnectionListeners();
        }
    }
  }

  private simulateTelemetryUpdate() {
    if (this.connectionState !== ConnectionState.CONNECTED) return;

    const rssiNoise = Math.floor(Math.random() * 5) - 2;
    this.state = {
      ...this.state,
      signalRssi: -58 + rssiNoise,
      uptimeSeconds: this.state.uptimeSeconds + 5
    };
    this.notifyListeners();
  }

  public subscribeToVitals(callback: (vitals: DeviceVitals | null) => void) {
    this.listeners.push(callback);
    callback(this.connectionState === ConnectionState.CONNECTED ? this.state : null);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  public subscribeToLogs(callback: (entry: LogEntry) => void) {
    this.logListeners.push(callback);
    return () => {
      this.logListeners = this.logListeners.filter(l => l !== callback);
    };
  }

  public subscribeToConnection(callback: (state: ConnectionState) => void) {
    this.connectionListeners.push(callback);
    callback(this.connectionState);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(l => l !== callback);
    };
  }

  public subscribeToVoice(callback: (text: string, isFinal: boolean) => void) {
    this.voiceListeners.push(callback);
    return () => {
      this.voiceListeners = this.voiceListeners.filter(l => l !== callback);
    };
  }

  private notifyListeners() {
    const data = this.connectionState === ConnectionState.CONNECTED ? this.state : null;
    this.listeners.forEach(l => l(data));
  }

  private notifyConnectionListeners() {
    this.connectionListeners.forEach(l => l(this.connectionState));
  }

  public emitLog(tag: string, level: LogEntry['level'], message: string) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      tag,
      level,
      message
    };
    
    this.internalLogBuffer.push(entry);
    if (this.internalLogBuffer.length > 200) {
        this.internalLogBuffer.shift();
    }

    this.logListeners.forEach(l => l(entry));
  }

  public emitVoiceData(text: string, isFinal: boolean = true) {
    if (isFinal) {
        this.emitLog("BLE", "INFO", `[VOICE] Received: "${text}"`);
    }
    this.voiceListeners.forEach(l => l(text, isFinal));
  }

  // Main Command Interface
  public async sendCommand(cmd: string, payload?: any): Promise<string> {
    if (this.connectionState !== ConnectionState.CONNECTED) {
        this.emitLog("APP", "ERROR", `Cannot send ${cmd}: Device disconnected`);
        return "ERROR";
    }

    if (this.isSimulating) {
        return this.handleMockCommand(cmd, payload);
    } else {
        return this.handleRealCommand(cmd, payload);
    }
  }

  // Real Device Logic
  private async handleRealCommand(cmd: string, payload?: any): Promise<string> {
      let packet: Uint8Array | Uint8Array[] | null = null;

      switch (cmd) {
          case "SET_BRIGHTNESS":
              // Payload is 0-100, map to 0-42 (0x2A)
              const val = Math.floor((payload as number / 100) * 0x2A);
              packet = Protocol.getBrightnessPacket(val);
              break;
          case "TELEPROMPTER_INIT": // Also used for general text sending
          case "SEND_TEXT":
              // Payload is string
              packet = Protocol.getTextPackets(payload as string);
              break;
          case "TELEPROMPTER_CLEAR":
          case "CLEAR_SCREEN":
              packet = Protocol.getExitPacket();
              break;
          case "START_VOICE_CAPTURE":
              packet = Protocol.getMicEnablePacket(true);
              break;
          case "STOP_VOICE_CAPTURE":
              packet = Protocol.getMicEnablePacket(false);
              break;
          case "UPDATE_WEATHER":
              // payload: { icon: int, temp: int }
              if (payload) {
                  packet = Protocol.getSetTimeAndWeatherPacket(payload.icon, payload.temp);
              }
              break;
          // For commands not yet implemented in real protocol or purely internal state
          case "MUSIC_CONTROL":
          case "CHECKLIST_OPEN":
              // Fallback to just logging or mock state update for UI feedback
              this.emitLog("TX", "WARN", `Command ${cmd} not fully implemented on Real Device, updating UI state only.`);
              return this.handleMockCommand(cmd, payload, true); // Update state but don't log TX as if sent
          default:
              this.emitLog("TX", "WARN", `Unknown command for Real Device: ${cmd}`);
              return "ERROR";
      }

      if (packet) {
          if (Array.isArray(packet)) {
              for (const p of packet) {
                  await this.bleDriver.write(p);
                  await new Promise(r => setTimeout(r, 50)); // Small delay between chunks
              }
          } else {
              await this.bleDriver.write(packet as Uint8Array);
          }
          return "OK";
      }
      return "ERROR";
  }

  // Mock Logic
  private async handleMockCommand(cmd: string, payload?: any, silentLog: boolean = false): Promise<string> {
    await new Promise(r => setTimeout(r, 150));
    
    if (!silentLog) {
        // Basic logging for mock
        if (cmd === "SET_BRIGHTNESS") {
            const val = Math.floor((payload as number / 100) * 0x2A);
            const hexVal = val.toString(16).padStart(2, '0').toUpperCase();
            this.emitLog("TX", "INFO", `[01] ${hexVal} 00 (Set Brightness: ${payload}%)`);
        } else if (cmd.includes("TEXT") || cmd.includes("INIT")) {
             this.emitLog("TX", "INFO", `[0x4E] Sending Text Data...`);
        } else {
             this.emitLog("TX", "INFO", `[MOCK] ${cmd}`);
        }
    }

    // State updates (shared between real/mock to keep UI in sync)
    if (cmd === "SET_BRIGHTNESS") {
      this.state.brightness = payload;
      this.notifyListeners();
    }
    if (cmd === "SET_SILENT_MODE") {
      this.state.silentMode = payload;
      this.notifyListeners();
    }
    if (cmd === "MUSIC_CONTROL") {
        const action = payload as 'PLAY' | 'PAUSE' | 'NEXT' | 'PREV';
        if (action === 'PLAY') this.musicState.isPlaying = true;
        if (action === 'PAUSE') this.musicState.isPlaying = false;
        if (action === 'NEXT') this.musicState.track = "New Track " + Math.floor(Math.random() * 100);
        if (action === 'PREV') this.musicState.track = "Prev Track " + Math.floor(Math.random() * 100);
    }
    if (cmd === "START_VOICE_CAPTURE" && this.isSimulating) {
        setTimeout(() => {
             this.emitVoiceData("Moncchichi play music");
        }, 2000);
    }

    return "OK";
  }
}

export const mockService = new ServiceManager();
