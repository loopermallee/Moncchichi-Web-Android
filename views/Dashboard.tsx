
import React, { useEffect, useState } from 'react';
import { mockService } from '../services/mockService';
import { soundService } from '../services/soundService';
import { settingsService } from '../services/settingsService';
import { DeviceVitals, ConnectionState, HeadsetState } from '../types';
import StatusCard from '../components/StatusCard';
import { ICONS } from '../constants';
import { Zap, ArrowDown, AlertTriangle, Activity, CheckCircle, Bug, Play, Power, AlertCircle } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [vitals, setVitals] = useState<DeviceVitals | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [isSimulating, setIsSimulating] = useState(settingsService.get('isSimulating'));
  
  // Status UX State
  const [statusText, setStatusText] = useState("Ready");
  const [issueText, setIssueText] = useState<string | null>(null);
  const [fixText, setFixText] = useState<string | null>(null);

  useEffect(() => {
    const unsubVitals = mockService.subscribeToVitals(setVitals);
    const unsubConn = mockService.subscribeToConnection(setConnectionState);
    const unsubStatus = mockService.subscribeToStatus((status, issue, fix) => {
        setStatusText(status);
        setIssueText(issue);
        setFixText(fix);
    });
    
    // Sync with settings service
    setIsSimulating(mockService.isSimulating);
    
    return () => {
      unsubVitals();
      unsubConn();
      unsubStatus();
    };
  }, []);

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    mockService.sendCommand("SET_BRIGHTNESS", val);
    soundService.playTick();
  };

  const toggleSilentMode = () => {
    if (!vitals) return;
    mockService.sendCommand("SET_SILENT_MODE", !vitals.silentMode);
  };

  const toggleConnection = () => {
    if (connectionState === ConnectionState.CONNECTED) {
      mockService.disconnect();
    } else {
      mockService.connect();
    }
  };

  const toggleSimulation = () => {
      const newState = !isSimulating;
      settingsService.set('isSimulating', newState);
      setIsSimulating(newState);
  };

  const isConnected = connectionState === ConnectionState.CONNECTED && (vitals || isSimulating);
  const isConnecting = connectionState === ConnectionState.CONNECTING;
  const hasIssue = !!issueText;

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Connection Controls */}
      <div className="bg-moncchichi-surface rounded-xl p-4 border border-moncchichi-border mb-4">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-moncchichi-textSec uppercase tracking-wider">Connection</h3>
            <button 
                onClick={toggleSimulation}
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${isSimulating ? 'bg-moncchichi-warning/10 text-moncchichi-warning border-moncchichi-warning/30' : 'bg-moncchichi-surfaceAlt text-moncchichi-textSec border-moncchichi-border'}`}
            >
                {isSimulating ? ICONS.ToggleOn : ICONS.ToggleOff}
                {isSimulating ? 'Simulation Mode' : 'Real Device Mode'}
            </button>
        </div>
        
        <button 
            className={`w-full h-12 rounded-lg font-bold flex items-center justify-center gap-2 transition-all duration-300 ${
                isConnected 
                ? 'bg-moncchichi-surface border border-moncchichi-error/50 text-moncchichi-error hover:bg-moncchichi-error/10' 
                : 'bg-moncchichi-accent text-moncchichi-bg shadow-lg shadow-moncchichi-accent/20 hover:brightness-110'
            }`}
            onClick={toggleConnection}
            disabled={isConnecting}
        >
            {isConnecting ? (
                <>
                    <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    <span>Connecting...</span>
                </>
            ) : (
                <>
                    {isConnected ? ICONS.BluetoothDisconnected : ICONS.BluetoothConnected}
                    <span>{isConnected ? "Disconnect" : (isSimulating ? "Connect Simulator" : "Pair G1 Glasses")}</span>
                </>
            )}
        </button>
        {!isSimulating && !isConnected && (
            <div className="mt-2 text-center text-[10px] text-moncchichi-textSec">
                Requires Web Bluetooth (Chrome/Edge). Enable #enable-web-bluetooth-new-permissions-backend in flags if needed.
            </div>
        )}

        {/* Status Monitor & Troubleshooting UI */}
        <div className={`mt-3 overflow-hidden transition-all duration-300 ${isConnecting || hasIssue ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
            {isConnecting && (
                <div className="flex items-center gap-3 p-3 bg-moncchichi-surfaceAlt/50 rounded-lg border border-moncchichi-border">
                    <Activity size={16} className="text-moncchichi-accent animate-pulse" />
                    <span className="text-xs text-moncchichi-text font-mono">{statusText}</span>
                </div>
            )}
            
            {hasIssue && !isConnecting && (
                <div className="bg-moncchichi-error/10 border border-moncchichi-error/30 rounded-lg p-3 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 mb-1 text-moncchichi-error font-bold text-xs">
                        <AlertTriangle size={14} />
                        <span>{issueText || "Connection Error"}</span>
                    </div>
                    {fixText && (
                        <div className="flex items-start gap-2 mt-2 text-[11px] text-moncchichi-text opacity-90 pl-1 border-l-2 border-moncchichi-error/50">
                             <span className="font-bold text-moncchichi-error">FIX:</span> {fixText}
                        </div>
                    )}
                </div>
            )}
        </div>
        
        {isConnected && (
            <div className="mt-3 flex items-center gap-2 justify-center text-[10px] text-moncchichi-success animate-in fade-in">
                <CheckCircle size={12} />
                <span>System Normal. Data Link Active.</span>
            </div>
        )}

        {/* Simulation Override Controls */}
        {isSimulating && (
            <div className="mt-4 p-3 bg-moncchichi-surfaceAlt/30 rounded-xl border border-dashed border-moncchichi-accent/30">
                <div className="flex items-center gap-2 mb-3 text-[10px] font-bold text-moncchichi-accent uppercase tracking-wider">
                    <Bug size={12} /> Simulation Overrides
                </div>
                
                <div className="space-y-3">
                    <div>
                        <span className="text-[10px] text-moncchichi-textSec block mb-1.5">Force Connection State</span>
                        <div className="grid grid-cols-3 gap-2">
                            <button 
                                onClick={() => mockService.debugSetConnectionState(ConnectionState.DISCONNECTED)}
                                className="px-2 py-1.5 text-[9px] font-mono bg-moncchichi-surface border border-moncchichi-border rounded hover:border-moncchichi-textSec text-moncchichi-textSec"
                            >
                                DISCONNECT
                            </button>
                            <button 
                                onClick={() => mockService.debugSetConnectionState(ConnectionState.CONNECTING)}
                                className="px-2 py-1.5 text-[9px] font-mono bg-moncchichi-surface border border-moncchichi-border rounded hover:border-moncchichi-warning text-moncchichi-warning"
                            >
                                CONNECTING
                            </button>
                             <button 
                                onClick={() => mockService.debugTriggerError("Force Fail")}
                                className="px-2 py-1.5 text-[9px] font-mono bg-moncchichi-surface border border-moncchichi-border rounded hover:border-moncchichi-error text-moncchichi-error"
                            >
                                ERROR
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Status Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatusCard 
          label="Link" 
          value={isConnected ? "Active" : (isConnecting ? "Linking..." : "Inactive")}
          subLabel={isConnected ? (isSimulating ? "Virtual" : "BLE UART") : (isConnecting ? "Scanning..." : "Disconnected")} 
          icon={isConnected ? ICONS.BluetoothConnected : ICONS.BluetoothDisconnected}
          color={isConnected ? "success" : (isConnecting ? "warning" : "error")}
        />
        <StatusCard 
          label="Signal" 
          value={isConnected ? `${vitals?.signalRssi ?? -60} dBm` : "--"} 
          subLabel={isConnected ? "Strong" : "--"}
          icon={isConnected ? ICONS.WifiOn : ICONS.WifiOff}
        />
        
        {/* Glasses Battery Card */}
        <StatusCard 
          label="Glasses" 
          value={isConnected ? `${vitals?.batteryPercent ?? 100}%` : "--"} 
          subLabel={
            isConnected ? (
                <div className="flex items-center gap-1 mt-1">
                   {vitals?.isCharging ? (
                       <>
                         <Zap size={12} className="text-moncchichi-warning fill-moncchichi-warning" />
                         <span className="text-moncchichi-warning font-medium">Charging</span>
                       </>
                   ) : (
                       <>
                         <ArrowDown size={12} className="text-moncchichi-error" />
                         <span className="text-moncchichi-error font-medium">Draining</span>
                       </>
                   )}
                </div>
            ) : "--"
          }
          icon={ICONS.Battery}
        />

        {/* Case Battery Card */}
        <StatusCard 
          label="Case" 
          value={isConnected ? `${vitals?.caseBatteryPercent ?? 100}%` : "--"} 
          subLabel={isConnected ? "Ready" : "--"}
          icon={ICONS.Charging}
        />
      </div>

      {/* Quick Settings - Disabled if disconnected */}
      <div className={`bg-moncchichi-surface rounded-xl p-4 border border-moncchichi-border space-y-4 transition-opacity duration-300 ${!isConnected ? 'opacity-50 pointer-events-none grayscale-[0.5]' : ''}`}>
        <h3 className="text-sm font-semibold text-moncchichi-textSec uppercase tracking-wider">Controls</h3>
        
        {/* Brightness Slider */}
        <div>
            <div className="flex justify-between mb-2 items-center">
                <div className="flex items-center gap-2 text-sm text-moncchichi-text">
                    {ICONS.Brightness}
                    <span>Brightness</span>
                </div>
                <span className="text-xs text-moncchichi-accent">{vitals?.brightness || 50}%</span>
            </div>
            <input 
                type="range" 
                min="0" 
                max="100" 
                value={vitals?.brightness || 50}
                onChange={handleBrightnessChange}
                className="w-full h-2 bg-moncchichi-surfaceAlt rounded-lg appearance-none cursor-pointer accent-moncchichi-accent"
            />
        </div>

        {/* Silent Mode Toggle */}
        <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-sm text-moncchichi-text">
                {vitals?.silentMode ? ICONS.SilentOn : ICONS.SilentOff}
                <div className="flex flex-col">
                    <span>Silent Mode</span>
                    <span className="text-[10px] text-moncchichi-textSec">{vitals?.silentMode ? "Haptic/Audio Off" : "Notifications On"}</span>
                </div>
            </div>
            <button 
                onClick={toggleSilentMode}
                className={`w-12 h-7 rounded-full relative transition-colors ${vitals?.silentMode ? 'bg-moncchichi-accent' : 'bg-moncchichi-surfaceAlt border border-moncchichi-border'}`}
            >
                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${vitals?.silentMode ? 'left-6' : 'left-1'}`} />
            </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
