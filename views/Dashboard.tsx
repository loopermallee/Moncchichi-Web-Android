
import React, { useEffect, useState } from 'react';
import { mockService } from '../services/mockService';
import { soundService } from '../services/soundService';
import { DeviceVitals, ConnectionState } from '../types';
import StatusCard from '../components/StatusCard';
import { ICONS } from '../constants';
import { Zap, ArrowDown } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [vitals, setVitals] = useState<DeviceVitals | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [isSimulating, setIsSimulating] = useState(mockService.isSimulating);

  useEffect(() => {
    const unsubVitals = mockService.subscribeToVitals(setVitals);
    const unsubConn = mockService.subscribeToConnection(setConnectionState);
    setIsSimulating(mockService.isSimulating);
    return () => {
      unsubVitals();
      unsubConn();
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
      mockService.setSimulationMode(newState);
      setIsSimulating(newState);
  };

  const isConnected = connectionState === ConnectionState.CONNECTED && (vitals || isSimulating);
  const isConnecting = connectionState === ConnectionState.CONNECTING;

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

      {/* Lens Status */}
      <div className={`bg-moncchichi-surface rounded-xl p-4 border border-moncchichi-border transition-opacity duration-300 ${!isConnected ? 'opacity-60 grayscale-[0.3]' : ''}`}>
        <h3 className="text-sm font-semibold mb-3 text-moncchichi-textSec uppercase tracking-wider">G1 Even Reality Glasses</h3>
        <div className="space-y-3">
          {/* Left Lens */}
          <div className="flex items-center justify-between p-3 bg-moncchichi-surfaceAlt rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-moncchichi-bg flex items-center justify-center text-moncchichi-accent font-bold text-sm border border-moncchichi-border">L</div>
              <div>
                <div className="font-medium text-sm">{vitals?.leftLensName || "Left Lens"}</div>
                <div className="text-[10px] text-moncchichi-textSec">FW: {vitals?.firmwareVersion || '--'}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-xs ${isConnected ? 'text-moncchichi-success' : 'text-moncchichi-textSec'}`}>
                {isConnected ? '● Connected' : '○ Disconnected'}
              </div>
            </div>
          </div>
          
          {/* Right Lens */}
          <div className="flex items-center justify-between p-3 bg-moncchichi-surfaceAlt rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-moncchichi-bg flex items-center justify-center text-moncchichi-accent font-bold text-sm border border-moncchichi-border">R</div>
              <div>
                <div className="font-medium text-sm">{vitals?.rightLensName || "Right Lens"}</div>
                <div className="text-[10px] text-moncchichi-textSec">FW: {vitals?.firmwareVersion || '--'}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-xs ${isConnected ? 'text-moncchichi-success' : 'text-moncchichi-textSec'}`}>
                {isConnected ? '● Connected' : '○ Disconnected'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
