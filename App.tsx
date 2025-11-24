
import React, { useState, useEffect, useRef } from 'react';
import { ICONS, MOCK_LOGS_INIT } from './constants';
import { LogEntry, ConnectionState } from './types';
import { mockService } from './services/mockService';
import { soundService } from './services/soundService';
import { settingsService } from './services/settingsService'; // Auto-init settings
import { getWeather, WeatherData } from './services/weatherService';
import ConsoleLog from './components/ConsoleLog';
import Dashboard from './views/Dashboard';
import Assistant from './views/Assistant';
import Teleprompter from './views/Teleprompter';
import Permissions from './views/Permissions';
import Transport from './views/Transport';
import WeatherRealtime from './views/WeatherRealtime';
import Checklist from './views/Checklist';
import Reader from './views/Reader';
import Toast, { ToastType } from './components/Toast';
import { CloudLightning } from 'lucide-react';

type View = 'dashboard' | 'assistant' | 'teleprompter' | 'console' | 'permissions' | 'transport' | 'weather-realtime' | 'checklist' | 'reader';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [toast, setToast] = useState<{message: string, type: ToastType} | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize with some mock history
    const initLogs: LogEntry[] = MOCK_LOGS_INIT.map((msg, i) => {
      const tagMatch = msg.match(/^\[(.*?)\]/);
      const tag = tagMatch ? tagMatch[1] : 'SYS';
      const cleanMsg = msg.replace(/^\[.*?\]/, '').trim();
      return {
        id: `init-${i}`,
        timestamp: Date.now() - (10000 - i * 1000),
        tag,
        level: 'INFO',
        message: cleanMsg
      };
    });
    setLogs(initLogs);

    // Subscribe to new logs
    const unsubLogs = mockService.subscribeToLogs((entry) => {
      setLogs(prev => [...prev, entry].slice(-500)); // Increased buffer size
    });

    // Subscribe to connection state for Toasts and UI updates
    let lastState = mockService.getConnectionState();
    const unsubConn = mockService.subscribeToConnection((state) => {
        setIsConnected(state === ConnectionState.CONNECTED);
        
        // Trigger Toasts on state change
        if (state === ConnectionState.CONNECTED && lastState !== ConnectionState.CONNECTED) {
            setToast({ message: "Connected to G1 Glasses", type: "success" });
            soundService.playClick();
        } else if (state === ConnectionState.DISCONNECTED && lastState === ConnectionState.CONNECTED) {
            setToast({ message: "Disconnected from device", type: "info" });
        } else if (state === ConnectionState.ERROR) {
            setToast({ message: "Connection failed. Check console.", type: "error" });
        }
        lastState = state;
    });

    // Fetch Weather for basic widget state (optional usage)
    getWeather().then(setWeather);

    // Add global click listener for UI sounds
    const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        // Check if clicked element or parent is a button/link
        if (target.closest('button') || target.closest('a') || target.closest('input[type="range"]') || target.closest('input[type="checkbox"]')) {
            // We handle specific sounds in handlers, general fallback can be here if needed, 
            // but for now let's rely on specific calls to avoid double sounds, or check if it's a nav item
            if (!target.closest('nav')) {
                 soundService.playClick();
            }
        }
    };
    window.addEventListener('click', handleClick);

    return () => {
        unsubLogs();
        unsubConn();
        window.removeEventListener('click', handleClick);
    };
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleShowToast = (message: string, type: ToastType) => {
    setToast({ message, type });
  };

  const NavItem = ({ id, icon, label }: { id: View; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => {
        if (currentView !== id) {
            soundService.playNavigation();
            setCurrentView(id);
        }
        setIsMenuOpen(false);
      }}
      className={`flex flex-col items-center justify-center w-full h-full gap-1 pt-2 pb-2 transition-all duration-200 active:scale-95 ${
        currentView === id 
          ? 'text-moncchichi-accent' 
          : 'text-moncchichi-textSec hover:text-moncchichi-text'
      }`}
    >
      <div className={`${currentView === id ? 'scale-110' : ''} transition-transform duration-200`}>
        {icon}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-screen bg-moncchichi-bg text-moncchichi-text selection:bg-moncchichi-accent selection:text-moncchichi-bg overflow-hidden">
      
      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Mobile Header - Increased z-index to [100] to appear above view headers */}
      <header className="h-14 px-4 bg-moncchichi-surface border-b border-moncchichi-border flex items-center justify-between shrink-0 z-[100] relative shadow-sm">
        <div className="flex items-center gap-3">
          <div className="font-bold text-lg tracking-tighter uppercase text-moncchichi-accent select-none">Moncchichi</div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 transition-opacity duration-300" style={{opacity: isConnected ? 1 : 0.5}}>
             <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-moncchichi-success animate-pulse' : 'bg-moncchichi-error'}`}></div>
             <span className="text-xs font-medium text-moncchichi-textSec hidden sm:block">
                {isConnected ? "G1 Connected" : "Offline"}
             </span>
           </div>
           
           {/* Overflow Menu */}
           <div className="relative" ref={menuRef}>
             <button 
               onClick={() => {
                 setIsMenuOpen(!isMenuOpen);
                 soundService.playInteraction();
               }}
               className="p-2 -mr-2 text-moncchichi-textSec hover:text-moncchichi-text active:bg-moncchichi-surfaceAlt rounded-full transition-colors active:scale-95"
             >
               {ICONS.Menu}
             </button>
             
             {isMenuOpen && (
               <div className="absolute right-0 top-full mt-2 w-56 bg-moncchichi-surfaceAlt border border-moncchichi-border rounded-xl shadow-xl overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-right z-50">
                 
                 {/* Renamed Weather Option */}
                 <button 
                     onClick={() => {
                         setCurrentView('weather-realtime');
                         setIsMenuOpen(false);
                     }}
                     className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-moncchichi-surface transition-colors active:bg-moncchichi-border/50"
                 >
                     <div className="text-moncchichi-textSec"><CloudLightning size={20} /></div>
                     <span className="font-medium">Eye of the Storm</span>
                 </button>

                 <div className="h-px bg-moncchichi-border mx-2 my-1 opacity-50"></div>

                 <button 
                   onClick={() => {
                     setCurrentView('checklist');
                     setIsMenuOpen(false);
                   }}
                   className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-moncchichi-surface transition-colors active:bg-moncchichi-border/50"
                 >
                   <div className="text-moncchichi-textSec">{ICONS.CheckList}</div>
                   <span>Checklist</span>
                 </button>
                 
                 <button 
                   onClick={() => {
                     setCurrentView('transport');
                     setIsMenuOpen(false);
                   }}
                   className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-moncchichi-surface transition-colors active:bg-moncchichi-border/50"
                 >
                   <div className="text-moncchichi-textSec">{ICONS.Bus}</div>
                   <span>Griffin's Flight</span>
                 </button>

                 <button 
                   onClick={() => {
                     setCurrentView('reader');
                     setIsMenuOpen(false);
                   }}
                   className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-moncchichi-surface transition-colors active:bg-moncchichi-border/50"
                 >
                   <div className="text-moncchichi-textSec">{ICONS.Reader}</div>
                   <span>Grimoire of Knowledge</span>
                 </button>

                 <div className="h-px bg-moncchichi-border my-1"></div>
                 <button 
                   onClick={() => {
                     setCurrentView('permissions');
                     setIsMenuOpen(false);
                   }}
                   className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-moncchichi-surface transition-colors active:bg-moncchichi-border/50"
                 >
                   <div className="text-moncchichi-textSec">{ICONS.Shield}</div>
                   <span>Permissions</span>
                 </button>
                 <div className="h-px bg-moncchichi-border my-1"></div>
                 <div className="px-4 py-2 text-[10px] text-moncchichi-textSec text-center">
                   v1.1.0 (Persistence Update)
                 </div>
               </div>
             )}
           </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative w-full bg-moncchichi-bg">
        <div className="absolute inset-0 overflow-y-auto scrollbar-hide overscroll-y-contain">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 h-full">
            {currentView === 'dashboard' && <Dashboard />}
            {currentView === 'assistant' && <Assistant />}
            {currentView === 'teleprompter' && <Teleprompter />}
            {currentView === 'console' && <div className="h-full p-0"><ConsoleLog logs={logs} onClear={handleClearLogs} /></div>}
            {currentView === 'permissions' && <Permissions onBack={() => setCurrentView('dashboard')} />}
            {currentView === 'transport' && <Transport onBack={() => setCurrentView('dashboard')} onShowToast={handleShowToast} />}
            {currentView === 'weather-realtime' && <WeatherRealtime onBack={() => setCurrentView('dashboard')} onShowToast={handleShowToast} />}
            {currentView === 'checklist' && <Checklist onBack={() => setCurrentView('dashboard')} />}
            {currentView === 'reader' && <Reader onBack={() => setCurrentView('dashboard')} />}
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="h-16 bg-moncchichi-surface border-t border-moncchichi-border flex justify-between items-stretch shrink-0 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-30">
        <NavItem id="dashboard" icon={ICONS.Dashboard} label="Hub" />
        <NavItem id="assistant" icon={ICONS.Assistant} label="Assistant" />
        <NavItem id="teleprompter" icon={ICONS.Teleprompter} label="Prompter" />
        <NavItem id="console" icon={ICONS.Console} label="Console" />
      </nav>
    </div>
  );
}

export default App;
