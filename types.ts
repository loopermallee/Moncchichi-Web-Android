
export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR'
}

export enum HeadsetState {
  IDLE = 'IDLE',
  CONNECTING_LEFT = 'CONNECTING_LEFT',
  LEFT_ONLINE_UNPRIMED = 'LEFT_ONLINE_UNPRIMED',
  CONNECTING_RIGHT = 'CONNECTING_RIGHT',
  RIGHT_ONLINE_UNPRIMED = 'RIGHT_ONLINE_UNPRIMED',
  READY_BOTH = 'READY_BOTH',
  STABLE = 'STABLE',
  IDLE_SLEEP = 'IDLE_SLEEP',
  WAKE_QUIET = 'WAKE_QUIET',
  RECOVERING = 'RECOVERING'
}

export enum LensSide {
  LEFT = 'LEFT',
  RIGHT = 'RIGHT'
}

export interface DeviceVitals {
  batteryPercent: number | null;
  caseBatteryPercent: number | null;
  firmwareVersion: string | null;
  hardwareId: string | null;
  signalRssi: number | null;
  isCharging: boolean;
  isWorn: boolean;
  inCase: boolean;
  uptimeSeconds: number;
  brightness: number; // 0-100 approx mapped from 0x00-0x2A
  silentMode: boolean;
  leftLensName?: string;
  rightLensName?: string;
}

export interface LensStatus {
  side: LensSide;
  connected: boolean;
  battery: number | null;
  rssi: number | null;
  firmware: string | null;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  tag: string;
  message: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
}

export enum MessageSource {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
  SYSTEM = 'SYSTEM'
}

export enum MessageOrigin {
  LLM = 'LLM',
  OFFLINE = 'OFFLINE',
  DEVICE = 'DEVICE',
  SYSTEM = 'SYSTEM',
  API = 'API',
  USER = 'USER'
}

export interface ChatMessage {
  id: string;
  text: string;
  source: MessageSource;
  origin: MessageOrigin;
  timestamp: number;
}

export interface TeleprompterState {
  text: string;
  speed: number;
  isPlaying: boolean;
  isMirror: boolean;
  scrollProgress: number;
}

export interface Subtask {
  id: string;
  text: string;
  completed: boolean;
}

export interface ChecklistItem {
  id: string;
  text: string;
  description?: string;
  completed: boolean;
  dueDate: number; // timestamp for "When to do"
  createdAt: number;
  subtasks: Subtask[];
}