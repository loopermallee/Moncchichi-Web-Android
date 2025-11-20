import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { mockService } from '../services/mockService';

interface PermissionItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'granted' | 'denied' | 'prompt';
}

const Permissions: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [permissions, setPermissions] = useState<PermissionItem[]>([
    {
      id: 'bluetooth',
      title: 'Bluetooth',
      description: 'Required to connect to G1 glasses and sync data.',
      icon: ICONS.BluetoothConnected,
      status: 'prompt'
    },
    {
      id: 'location',
      title: 'Location',
      description: 'Required for Bluetooth Low Energy scanning on Android.',
      icon: ICONS.MapPin,
      status: 'prompt'
    },
    {
      id: 'microphone',
      title: 'Microphone',
      description: 'Required for AI Assistant voice commands.',
      icon: ICONS.MicOn,
      status: 'prompt'
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Required to keep the connection alive in the background.',
      icon: ICONS.Bell,
      status: 'prompt'
    }
  ]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    // Create a deep copy to avoid mutating state directly during the check
    const currentPerms = permissions.map(p => ({ ...p }));
    let hasChanges = false;
    
    // Check Microphone
    if (navigator && navigator.permissions) {
        try {
            // @ts-ignore
            const micStatus = await navigator.permissions.query({ name: 'microphone' });
            const p = currentPerms.find(item => item.id === 'microphone');
            if (p && p.status !== micStatus.state) {
                p.status = micStatus.state;
                hasChanges = true;
            }
        } catch (e) {
            // API might be missing or 'microphone' not supported in this browser's permission query
        }
    }

    // Check Notification
    if (typeof Notification !== 'undefined') {
       const notifStatus = Notification.permission === 'granted' ? 'granted' : 'prompt';
       const p = currentPerms.find(item => item.id === 'notifications');
       if (p && p.status !== notifStatus) {
           p.status = notifStatus;
           hasChanges = true;
       }
    }

    if (hasChanges) {
        setPermissions(currentPerms);
    }
  };

  const requestPermission = async (id: string) => {
    mockService.emitLog("PERM", "INFO", `Requesting permission: ${id}`);
    
    try {
      if (id === 'microphone') {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            await navigator.mediaDevices.getUserMedia({ audio: true });
        } else {
            throw new Error("Media Devices API not supported");
        }
      } else if (id === 'notifications') {
        if (typeof Notification !== 'undefined') {
            await Notification.requestPermission();
        } else {
            throw new Error("Notifications API not supported");
        }
      } else if (id === 'location') {
        if (navigator.geolocation) {
            await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });
        } else {
            throw new Error("Geolocation API not supported");
        }
      } else if (id === 'bluetooth') {
         // @ts-ignore
         if (navigator.bluetooth) {
             // @ts-ignore
             await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
         } else {
             // Fallback for mock environment if bluetooth API is missing
             mockService.emitLog("PERM", "WARN", "Bluetooth API missing, simulating grant");
         }
      }

      // Update state to granted if no error was thrown
      setPermissions(prev => prev.map(p => 
        p.id === id ? { ...p, status: 'granted' } : p
      ));
    } catch (e: any) {
      mockService.emitLog("PERM", "ERROR", `Failed to request ${id}: ${e.message || e}`);
    }
  };

  const handleAllowAll = async () => {
    setLoading(true);
    mockService.emitLog("PERM", "INFO", "Requesting ALL permissions...");
    
    // Execute sequentially to avoid spamming prompts or triggering browser blockers
    for (const p of permissions) {
      if (p.status !== 'granted') {
        await requestPermission(p.id);
        // Small delay for visual feedback
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    setLoading(false);
    mockService.emitLog("PERM", "INFO", "All permissions processed.");
  };

  const allGranted = permissions.every(p => p.status === 'granted');

  return (
    <div className="flex flex-col h-full bg-moncchichi-bg">
      <div className="p-4 border-b border-moncchichi-border bg-moncchichi-surface flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 -ml-2 text-moncchichi-textSec hover:text-moncchichi-text">
          {ICONS.Back}
        </button>
        <h2 className="text-lg font-bold flex items-center gap-2">
          {ICONS.Shield} Permissions
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="bg-moncchichi-surfaceAlt/50 rounded-lg p-4 text-sm text-moncchichi-textSec border border-moncchichi-border">
          To ensure the best experience with your G1 glasses, Moncchichi Hub requires access to the following capabilities on your device.
        </div>

        <div className="space-y-3">
          {permissions.map(item => (
            <div key={item.id} className="bg-moncchichi-surface rounded-xl p-4 border border-moncchichi-border flex items-start gap-4">
              <div className={`p-2 rounded-lg ${item.status === 'granted' ? 'bg-moncchichi-success/10 text-moncchichi-success' : 'bg-moncchichi-surfaceAlt text-moncchichi-text'}`}>
                {item.icon}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-sm">{item.title}</h3>
                  {item.status === 'granted' ? (
                    <span className="text-moncchichi-success">{ICONS.CheckCircle}</span>
                  ) : (
                    <button 
                      onClick={() => requestPermission(item.id)}
                      className="text-xs bg-moncchichi-accent text-moncchichi-bg px-3 py-1.5 rounded-full font-medium hover:opacity-90"
                    >
                      Allow
                    </button>
                  )}
                </div>
                <p className="text-xs text-moncchichi-textSec leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-moncchichi-surface border-t border-moncchichi-border pb-safe">
        <button 
          onClick={handleAllowAll}
          disabled={loading || allGranted}
          className="w-full h-12 bg-moncchichi-accent text-moncchichi-bg rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-moncchichi-bg border-t-transparent rounded-full animate-spin" />
          ) : (
            ICONS.Check
          )}
          {allGranted ? 'All Permissions Granted' : 'Allow All Permissions'}
        </button>
      </div>
    </div>
  );
};

export default Permissions;