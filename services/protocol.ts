
// Ported logic from Proto.dart and EvenaiProto.dart
// Handles packet construction for Even Realities G1

import { DeviceVitals } from '../types';

export interface ProtocolEvent {
  type: 'BATTERY' | 'STATE' | 'PAIRING' | 'DEBUG' | 'ACK' | 'UNKNOWN';
  subType?: string;
  data?: any;
}

export class Protocol {
  private static evenaiSeq = 0;
  private static beatHeartSeq = 0;

  // [0x25, len_low, len_high, seq, 0x04, seq]
  public static getHeartbeatPacket(): Uint8Array {
    const length = 6;
    const seq = this.beatHeartSeq % 0xFF;
    this.beatHeartSeq++;
    
    return new Uint8Array([
      0x25,
      length & 0xFF,
      (length >> 8) & 0xFF,
      seq,
      0x04,
      seq
    ]);
  }

  // [0x4D, 0xFB] - Set MTU to 251 (0xFB)
  public static getSetMtuPacket(): Uint8Array {
      return new Uint8Array([0x4D, 0xFB]);
  }

  // [0x0E, 0x01]
  public static getMicEnablePacket(enable: boolean = true): Uint8Array {
    return new Uint8Array([0x0E, enable ? 0x01 : 0x00]);
  }

  // [0x01, brightness, auto]
  public static getBrightnessPacket(value: number, auto: boolean = false): Uint8Array {
    return new Uint8Array([0x01, value & 0xFF, auto ? 0x01 : 0x00]);
  }
  
  // [0x03, enable ? 0x01 : 0x00]
  public static getSilentModePacket(enable: boolean): Uint8Array {
      return new Uint8Array([0x03, enable ? 0x01 : 0x00]); 
  }

  // [0x23, 0x74] - Get Firmware Info
  public static getFirmwareInfoPacket(): Uint8Array {
      return new Uint8Array([0x23, 0x74]);
  }

  // [0x06, 0x07, 0x00, seq, 0x06, modeId, secondaryPaneId]
  public static getDashboardModePacket(modeId: number): Uint8Array {
     // 0=Full, 1=Dual, 2=Minimal
     const seq = 0; // Simplified seq
     return new Uint8Array([0x06, 0x07, 0x00, seq, 0x06, modeId & 0xFF, 0x00]);
  }

  // [0x06, 0x15, 0x00, seq, 0x01, time32, time64, icon, temp, c/f, 12h]
  public static getSetTimeAndWeatherPacket(
      iconId: number, 
      temp: number, 
      isFahrenheit: boolean = false, 
      is12h: boolean = false
  ): Uint8Array {
      const seq = 0;
      const now = Date.now();
      const sec = Math.floor(now / 1000);
      
      const buffer = new ArrayBuffer(21);
      const view = new DataView(buffer);
      
      view.setUint8(0, 0x06); // Cmd
      view.setUint8(1, 0x15); // Len
      view.setUint8(2, 0x00); // Pad
      view.setUint8(3, seq);
      view.setUint8(4, 0x01); // SubCmd: Set Time/Weather
      
      view.setUint32(5, sec, true); // Time32 (Little Endian)
      view.setBigUint64(9, BigInt(now), true); // Time64 (Little Endian)
      
      view.setUint8(17, iconId);
      view.setInt8(18, temp); // Signed byte for temp
      view.setUint8(19, isFahrenheit ? 1 : 0);
      view.setUint8(20, is12h ? 1 : 0);
      
      return new Uint8Array(buffer);
  }

  // [0x4B, msgId, maxSeq, seq, ...payload]
  public static getNotificationPackets(
      msgId: number,
      appId: string,
      title: string,
      message: string
  ): Uint8Array[] {
      const payloadObj = {
          ncs_notification: {
              msg_id: msgId,
              app_identifier: appId,
              title: title,
              message: message,
              time_s: Math.floor(Date.now() / 1000),
              display_name: appId
          }
      };
      
      const jsonStr = JSON.stringify(payloadObj);
      const encoder = new TextEncoder();
      const data = encoder.encode(jsonStr);
      
      const packLen = 176;
      const packets: Uint8Array[] = [];
      const maxSeq = Math.ceil(data.length / packLen);
      
      for (let seq = 0; seq < maxSeq; seq++) {
          const start = seq * packLen;
          const end = Math.min(start + packLen, data.length);
          const chunk = data.slice(start, end);
          
          const header = [0x4B, msgId & 0xFF, maxSeq, seq];
          const packet = new Uint8Array(header.length + chunk.length);
          packet.set(header);
          packet.set(chunk, header.length);
          packets.push(packet);
      }
      
      return packets;
  }

  public static getTextPackets(text: string, newScreen: number = 0x01 | 0x30): Uint8Array[] {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const packLen = 191;
    const packets: Uint8Array[] = [];
    
    const syncSeq = this.evenaiSeq & 0xFF;
    this.evenaiSeq++;

    const maxSeq = Math.ceil(data.length / packLen);
    
    const pos = 0; 
    const currentPage = 1;
    const maxPage = 1;

    for (let seq = 0; seq < maxSeq; seq++) {
      const start = seq * packLen;
      const end = Math.min(start + packLen, data.length);
      const chunk = data.slice(start, end);

      const header = [
        0x4E,
        syncSeq,
        maxSeq,
        seq,
        newScreen,
        (pos >> 8) & 0xFF,
        pos & 0xFF,
        currentPage,
        maxPage
      ];

      const packet = new Uint8Array(header.length + chunk.length);
      packet.set(header);
      packet.set(chunk, header.length);
      packets.push(packet);
    }

    return packets;
  }
  
  public static getExitPacket(): Uint8Array {
      return new Uint8Array([0x18]);
  }

  // Parse incoming telemetry based on G1 Protocol (F5 Events, 2C Battery, 37 Uptime)
  public static parseTelemetry(data: Uint8Array): ProtocolEvent | null {
      if (data.length === 0) return null;
      const cmd = data[0];
      
      // 0x4D: MTU Acknowledgement
      // Log: 4D-C9... (C9 = Success)
      if (cmd === 0x4D) {
          if (data.length > 1 && data[1] === 0xC9) {
              return { type: 'ACK', subType: 'MTU' };
          }
          return { type: 'ACK', subType: 'MTU_FAIL' };
      }

      // 0x2C: Detailed Battery & State
      // Log: 2C-66-64-64-D9...
      // Header (2C) + Size (66) + Bat% (64=100)
      if (cmd === 0x2C && data.length >= 3) {
          const battery = data[2]; // Index 2 is Battery %
          // Index 3+ are voltages and flags.
          // We can extract more here if we map the bitmasks from the "Even G1 protocol" doc
          // For now, the battery % is the most critical value.
          return { 
              type: 'BATTERY', 
              subType: 'DETAILED', 
              data: { batteryPercent: battery } 
          };
      }

      // 0x37: Uptime (Time Since Boot)
      // Log: 37-37-[TimeBytes]...
      if (cmd === 0x37 && data.length >= 6) {
          // Assuming 32-bit int Little Endian at offset 2
          // 37-37-[B0-B1-B2-B3]
          const uptime = data[2] | (data[3] << 8) | (data[4] << 16) | (data[5] << 24);
          return { 
              type: 'STATE', 
              subType: 'UPTIME', 
              data: { uptimeSeconds: uptime } 
          };
      }

      // 0x2B: State Heartbeat (roughly 1/min)
      // Log: 2B-69...
      if (cmd === 0x2B) {
          return { type: 'STATE', subType: 'HEARTBEAT', data: {} };
      }

      // 0x26: Display Settings ACK
      // Log: 26-06-00-01-02-C9...
      if (cmd === 0x26) {
          const status = data.length > 5 ? data[5] : 0x00;
          return { type: 'ACK', subType: 'DISPLAY_SETTINGS', data: { status } };
      }

      // 0x39: System Status
      if (cmd === 0x39) {
          return { type: 'ACK', subType: 'SYSTEM_STATUS', data: {} };
      }

      // 0xF5: Device Events (Gestures, Wear State)
      if (cmd === 0xF5 && data.length >= 2) {
          const subCmd = data[1];
          switch (subCmd) {
              case 0x11: // BLE Paired Success / Initial State Burst
                  return { type: 'PAIRING', subType: 'SUCCESS' };
              
              case 0x06: // Worn
                  return { type: 'STATE', subType: 'WORN', data: { isWorn: true, inCase: false } };
              
              case 0x07: // Not Worn (Idle)
                  return { type: 'STATE', subType: 'NOT_WORN', data: { isWorn: false, inCase: false } };
                  
              case 0x08: // In Case, Lid Open
                  return { type: 'STATE', subType: 'CASE_OPEN', data: { inCase: true, isWorn: false } };
                  
              case 0x0B: // In Case, Lid Closed (Deep Sleep)
                  return { type: 'STATE', subType: 'CASE_CLOSED', data: { inCase: true, isWorn: false } };
                  
              case 0x0A: // Glasses Battery (Simpler event)
                  return { type: 'BATTERY', subType: 'GLASSES', data: { batteryPercent: data[2] } };
                  
              case 0x0F: // Case Battery
                  return { type: 'BATTERY', subType: 'CASE', data: { caseBatteryPercent: data[2] } };
          }
      }
      
      // Generic ACK: 0xC9 (Success)
      if (cmd === 0xC9 && data.length >= 2) {
          return { type: 'ACK', subType: 'SUCCESS', data: { cmdId: data[1] } };
      }

      // Generic NACK: 0xCA (Fail)
      if (cmd === 0xCA && data.length >= 2) {
          return { type: 'ACK', subType: 'FAILURE', data: { cmdId: data[1] } };
      }

      // Firmware Info Response or Debug Text
      // 0xF4 is explicit debug, but logs also show pure text or 0x6E logs
      if (cmd === 0xF4) {
          const decoder = new TextDecoder();
          const text = decoder.decode(data.slice(1)).replace(/\0/g, '');
          return { type: 'DEBUG', data: text };
      }

      // Textual Log Detection
      // If data looks like text (e.g. "net build time..."), treat as debug
      // 0x20-0x7E are printable ASCII
      if (data.length > 10 && data[0] >= 0x20 && data[0] <= 0x7E) {
          const decoder = new TextDecoder();
          const text = decoder.decode(data).replace(/\0/g, '');
          if (text.includes("ver") || text.includes("build time") || text.includes("DeviceID") || text.includes("stack")) {
              return { type: 'DEBUG', subType: 'FIRMWARE_INFO', data: text };
          }
      }
      
      return null;
  }
}
