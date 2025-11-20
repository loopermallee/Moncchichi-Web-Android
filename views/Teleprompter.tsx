import React, { useState } from 'react';
import { ICONS } from '../constants';
import { mockService } from '../services/mockService';

const Teleprompter: React.FC = () => {
  const [text, setText] = useState("Welcome to Moncchichi Hub.\nThis is a teleprompter test.\nYou can type here and send it to the G1 glasses.");
  const [speed, setSpeed] = useState(50);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMirror, setIsMirror] = useState(false);
  const [isHudSync, setIsHudSync] = useState(true);

  const handleSend = () => {
    // Protocol 0x09 01 (Init)
    mockService.sendCommand(`TELEPROMPTER_INIT`, text);
    setIsPlaying(true);
  };

  const handleStop = () => {
    // Protocol 0x09 05 (Exit)
    mockService.sendCommand("TELEPROMPTER_CLEAR");
    setIsPlaying(false);
  };

  return (
    <div className="flex flex-col h-full bg-moncchichi-bg font-sans">
      {/* Script Input Area */}
      <div className="flex-1 p-4 min-h-0 flex flex-col">
        <label className="text-xs font-medium text-moncchichi-textSec mb-2 uppercase tracking-wider">Script</label>
        <textarea 
          value={text}
          onChange={e => setText(e.target.value)}
          className="flex-1 w-full bg-moncchichi-surface rounded-xl p-4 text-base leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-moncchichi-accent border border-moncchichi-border placeholder-moncchichi-textSec/30 font-sans transition-all"
          placeholder="Type your speech here..."
        />
      </div>

      {/* Controls Panel (Sticky Bottom) */}
      <div className="bg-moncchichi-surface border-t border-moncchichi-border p-4 space-y-6 pb-8 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
        
        {/* Speed Slider */}
        <div>
          <div className="flex justify-between mb-3">
            <span className="text-sm font-medium">Scroll Speed</span>
            <span className="text-sm text-moncchichi-accent font-mono">{speed}%</span>
          </div>
          <input 
            type="range" 
            min="10" 
            max="100" 
            value={speed}
            onChange={e => setSpeed(Number(e.target.value))}
            className="w-full accent-moncchichi-accent h-2 bg-moncchichi-bg rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Toggles Row */}
        <div className="flex gap-4">
           <button 
             onClick={() => setIsMirror(!isMirror)}
             className={`flex-1 rounded-lg p-3 flex items-center justify-between border transition-all duration-200 ${
               isMirror 
               ? 'bg-moncchichi-accent/10 border-moncchichi-accent/50' 
               : 'bg-moncchichi-bg border-moncchichi-border hover:bg-moncchichi-surfaceAlt'
             }`}
           >
             <span className={`text-xs font-medium ${isMirror ? 'text-moncchichi-accent' : 'text-moncchichi-textSec'}`}>Mirror</span>
             <div className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${isMirror ? 'bg-moncchichi-accent' : 'bg-moncchichi-border'}`}>
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200 ${isMirror ? 'left-5' : 'left-1'}`}></div>
             </div>
           </button>

           <button 
             onClick={() => setIsHudSync(!isHudSync)}
             className={`flex-1 rounded-lg p-3 flex items-center justify-between border transition-all duration-200 ${
               isHudSync 
               ? 'bg-moncchichi-accent/10 border-moncchichi-accent/50' 
               : 'bg-moncchichi-bg border-moncchichi-border hover:bg-moncchichi-surfaceAlt'
             }`}
           >
             <span className={`text-xs font-medium ${isHudSync ? 'text-moncchichi-accent' : 'text-moncchichi-textSec'}`}>HUD Sync</span>
             <div className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${isHudSync ? 'bg-moncchichi-accent' : 'bg-moncchichi-border'}`}>
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200 ${isHudSync ? 'left-5' : 'left-1'}`}></div>
             </div>
           </button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <button 
            onClick={handleStop}
            disabled={!isPlaying}
            className={`col-span-1 h-12 rounded-xl border font-medium flex items-center justify-center gap-2 transition-all active:scale-95 ${
              !isPlaying 
                ? 'bg-moncchichi-bg border-moncchichi-border text-moncchichi-textSec opacity-50 cursor-not-allowed' 
                : 'bg-moncchichi-surfaceAlt border-moncchichi-border text-moncchichi-text hover:bg-moncchichi-border'
            }`}
          >
            {ICONS.Pause}
            <span className="text-sm">Stop</span>
          </button>
          <button 
            onClick={handleSend}
            disabled={isPlaying}
            className={`col-span-2 h-12 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${
                isPlaying
                ? 'bg-moncchichi-success text-moncchichi-bg shadow-moncchichi-success/20'
                : 'bg-moncchichi-accent text-moncchichi-bg shadow-moncchichi-accent/20 hover:brightness-110'
            }`}
          >
            {isPlaying ? (
                <>
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse"/>
                    <span className="text-sm">Live Casting</span>
                </>
            ) : (
                <>
                    {ICONS.Send}
                    <span className="text-sm">Cast to Glasses</span>
                </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Teleprompter;