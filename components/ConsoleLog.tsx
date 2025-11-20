import React, { useEffect, useRef, useState } from 'react';
import { LogEntry } from '../types';
import { ICONS } from '../constants';
import { Terminal } from 'lucide-react';

interface ConsoleLogProps {
  logs: LogEntry[];
  onClear: () => void;
}

const TAG_COLORS: Record<string, string> = {
  BLE: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  RX: 'bg-green-500/10 text-green-400 border-green-500/20',
  TX: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  SERVICE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  VITALS: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  AI: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  APP: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  DEFAULT: 'bg-gray-700/10 text-gray-400 border-gray-600/20'
};

const FILTER_TAGS = ['BLE', 'RX', 'TX', 'SERVICE', 'VITALS', 'AI'];

const ConsoleLog: React.FC<ConsoleLogProps> = ({ logs, onClear }) => {
  const endRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filteredLogs = activeFilter 
    ? logs.filter(l => l.tag === activeFilter)
    : logs;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, activeFilter]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-moncchichi-error';
      case 'WARN': return 'text-moncchichi-warning';
      case 'DEBUG': return 'text-moncchichi-accent';
      default: return 'text-moncchichi-textSec';
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    }) + '.' + d.getMilliseconds().toString().padStart(3, '0');
  };

  const handleCopy = () => {
    const text = logs.map(l => {
        const date = new Date(l.timestamp).toISOString();
        return `${date} [${l.level}] [${l.tag}] ${l.message}`;
    }).join('\n');

    if (navigator && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(console.error);
    }
  };

  const handleExport = () => {
    const text = logs.map(l => {
        const date = new Date(l.timestamp).toISOString();
        return `${date} [${l.level}] [${l.tag}] ${l.message}`;
    }).join('\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moncchichi-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-moncchichi-bg font-mono text-xs sm:text-sm">
      {/* Header */}
      <div className="bg-moncchichi-surface p-2 px-3 border-b border-moncchichi-border flex justify-between items-center sticky top-0 z-10 shadow-sm h-14 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-moncchichi-text font-bold">Console</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-moncchichi-surfaceAlt border border-moncchichi-border text-moncchichi-textSec">
            {filteredLogs.length} / {logs.length}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <button onClick={handleCopy} className="p-2 text-moncchichi-textSec hover:text-moncchichi-text hover:bg-moncchichi-surfaceAlt rounded-lg transition-colors">
            {copied ? <span className="text-moncchichi-success">{ICONS.Check}</span> : ICONS.Copy}
          </button>
          <button onClick={handleExport} className="p-2 text-moncchichi-textSec hover:text-moncchichi-text hover:bg-moncchichi-surfaceAlt rounded-lg transition-colors">
            {ICONS.Export}
          </button>
          <div className="w-px h-4 bg-moncchichi-border mx-1"></div>
          <button onClick={onClear} className="p-2 text-moncchichi-textSec hover:text-moncchichi-error hover:bg-moncchichi-surfaceAlt rounded-lg transition-colors">
            {ICONS.Clear}
          </button>
        </div>
      </div>

      {/* Logs Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
        {filteredLogs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-moncchichi-textSec opacity-50 gap-2">
            <Terminal size={32} />
            <span>{logs.length > 0 ? 'No logs match filter' : 'No logs available'}</span>
          </div>
        )}
        {filteredLogs.map((log) => (
          <div key={log.id} className="flex gap-2 p-1 border-l-2 border-transparent hover:bg-moncchichi-surfaceAlt/50 hover:border-moncchichi-border group">
            <span className="text-gray-600 whitespace-nowrap select-none text-[10px] pt-0.5 font-medium min-w-[60px]">
              {formatTime(log.timestamp)}
            </span>
            <div className="flex-1 break-words">
              <span className={`font-bold text-[10px] mr-1.5 px-1.5 py-0.5 rounded border align-middle inline-block mb-0.5 ${
                TAG_COLORS[log.tag] || TAG_COLORS.DEFAULT
              }`}>
                {log.tag}
              </span>
              <span className={`${getLevelColor(log.level)} leading-tight select-text`}>
                {log.message}
              </span>
            </div>
          </div>
        ))}
        <div ref={endRef} className="h-2" />
      </div>

      {/* Filter Bar (Sticky Bottom) */}
      <div className="bg-moncchichi-surface border-t border-moncchichi-border p-2 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 items-center">
             <span className="text-[10px] text-moncchichi-textSec uppercase font-bold mr-1">Filter:</span>
             {FILTER_TAGS.map(tag => (
                <button
                    key={tag}
                    onClick={() => setActiveFilter(activeFilter === tag ? null : tag)}
                    className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all ${
                        activeFilter === tag 
                        ? 'bg-moncchichi-text text-moncchichi-bg border-moncchichi-text shadow-lg scale-105' 
                        : (TAG_COLORS[tag] || TAG_COLORS.DEFAULT) + ' hover:brightness-125 opacity-80 hover:opacity-100'
                    }`}
                >
                    {tag}
                </button>
             ))}
             {activeFilter && (
                <button 
                    onClick={() => setActiveFilter(null)}
                    className="text-[10px] text-moncchichi-textSec ml-auto px-2 hover:text-moncchichi-text"
                >
                    Reset
                </button>
             )}
        </div>
      </div>
    </div>
  );
};

export default ConsoleLog;