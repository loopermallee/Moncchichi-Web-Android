
// Ported logic from Proto.dart and EvenaiProto.dart
// Handles packet construction for Even Realities G1

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

  // [0x0E, 0x01]
  public static getMicEnablePacket(enable: boolean = true): Uint8Array {
    return new Uint8Array([0x0E, enable ? 0x01 : 0x00]);
  }

  // [0x01, brightness, auto]
  public static getBrightnessPacket(value: number, auto: boolean = false): Uint8Array {
    return new Uint8Array([0x01, value & 0xFF, auto ? 0x01 : 0x00]);
  }
  
  // [0x03, enable ? 0x0C : 0x0A] (Based on logs/mock logic, command structure assumed based on typical pattern)
  public static getSilentModePacket(enable: boolean): Uint8Array {
      // Placeholder: Exact opcode for silent mode isn't explicitly clear in snippets, using generic toggle structure
      // If strictly following Proto.dart, we'd need the exact opcode. 
      // For now, we use a safe placeholder or rely on Dashboard config.
      return new Uint8Array([0x03, enable ? 0x01 : 0x00]); 
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
  // Ported from _getNotifyPackList
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
          
          // Header: [0x4B, msgId, maxSeq, seq]
          const header = [0x4B, msgId & 0xFF, maxSeq, seq];
          const packet = new Uint8Array(header.length + chunk.length);
          packet.set(header);
          packet.set(chunk, header.length);
          packets.push(packet);
      }
      
      return packets;
  }

  // Text / AI Data Packets
  // Based on EvenaiProto.evenaiMultiPackListV2
  public static getTextPackets(text: string, newScreen: number = 0x01 | 0x30): Uint8Array[] {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const packLen = 191;
    const packets: Uint8Array[] = [];
    
    const syncSeq = this.evenaiSeq & 0xFF;
    this.evenaiSeq++;

    const maxSeq = Math.ceil(data.length / packLen);
    
    // Fixed values for now, can be dynamic
    const pos = 0; 
    const currentPage = 1;
    const maxPage = 1;

    for (let seq = 0; seq < maxSeq; seq++) {
      const start = seq * packLen;
      const end = Math.min(start + packLen, data.length);
      const chunk = data.slice(start, end);

      // Header: [cmd, syncSeq, maxSeq, seq, newScreen, pos_hi, pos_lo, cur, max]
      // Header Length: 9 bytes
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
  
  // 0x18
  public static getExitPacket(): Uint8Array {
      return new Uint8Array([0x18]);
  }
}
