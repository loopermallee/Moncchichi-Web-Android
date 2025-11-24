
import React, { useState, useEffect } from 'react';
import { ICONS, BLE_UUIDS } from '../constants';
import { mockService } from '../services/mockService';
import { ConnectionState } from '../types'; 
import Toast, { ToastType } from '../components/Toast';

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
  const [toast, setToast] = useState<{message: string, type: ToastType} | null>(null);

  useEffect(() => {
    checkPermissions();
    // Poll occasionally for Bluetooth permission changes which don't always fire events
    const interval = setInterval(checkBluetoothStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const updatePermissionStatus = (id: string, status: 'granted' | 'denied' | 'prompt') => {
      setPermissions(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  const checkBluetoothStatus = async () => {
      // @ts-ignore
      if (navigator.bluetooth && navigator.bluetooth.getDevices) {
          try {
              // @ts-ignore
              const devices = await navigator.bluetooth.getDevices();
              const isConnected = mockService.getConnectionState() === 'CONNECTED'; 
              // If we have devices or are connected, consider it granted
              if (devices.length > 0 || isConnected) {
                  updatePermissionStatus('bluetooth', 'granted');
              }
          } catch (e) {}
      }
  };

  const checkPermissions = async () => {
    // 1. Microphone
    try {
        // @ts-ignore
        const micStatus = await navigator.permissions.query({ name: 'microphone' });
        updatePermissionStatus('microphone', micStatus.state);
        micStatus.onchange = () => updatePermissionStatus('microphone', micStatus.state);
    } catch (e) {
        // console.log("Mic check failed", e);
    }

    // 2. Location
    try {
        // @ts-ignore
        const locStatus = await navigator.permissions.query({ name: 'geolocation' });
        updatePermissionStatus('location', locStatus.state);
        locStatus.onchange = () => updatePermissionStatus('location', locStatus.state);
    } catch (e) {
        // console.log("Loc check failed", e);
    }

    // 3. Notifications
    if (typeof Notification !== 'undefined') {
       const notifStatus = Notification.permission === 'granted' ? 'granted' : (Notification.permission === 'denied' ? 'denied' : 'prompt');
       updatePermissionStatus('notifications', notifStatus);
    }

    // 4. Bluetooth
    await checkBluetoothStatus();
  };

  const requestPermission = async (id: string) => {
    mockService.emitLog("PERM", "INFO", `Requesting permission: ${id}`);
    
    // Check if already blocked
    const current = permissions.find(p => p.id === id);
    if (current?.status === 'denied') {
        setToast({ message: "Permission blocked. Enable in browser settings.", type: "error" });
        return;
    }

    try {
      if (id === 'microphone') {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            updatePermissionStatus('microphone', 'granted');
        } else {
            throw new Error("Media Devices API not supported");
        }
      } else if (id === 'notifications') {
        if (typeof Notification !== 'undefined') {
            const result = await Notification.requestPermission();
            updatePermissionStatus('notifications', result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'prompt');
        } else {
            throw new Error("Notifications API not supported");
        }
      } else if (id === 'location') {
        if (navigator.geolocation) {
            await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        updatePermissionStatus('location', 'granted');
                        resolve(pos);
                    }, 
                    (err) => {
                        if (err.code === 1) { // PERMISSION_DENIED
                            updatePermissionStatus('location', 'denied');
                            mockService.emitLog("PERM", "ERROR", "User denied location");
                        }
                        reject(err);
                    }
                );
            });
        } else {
            throw new Error("Geolocation API not supported");
        }
      } else if (id === 'bluetooth') {
         // @ts-ignore
         if (navigator.bluetooth) {
             // @ts-ignore
             await navigator.bluetooth.requestDevice({ 
                 acceptAllDevices: true,
                 optionalServices: [BLE_UUIDS.SERVICE] 
             });
             updatePermissionStatus('bluetooth', 'granted');
         } else {
             mockService.emitLog("PERM", "WARN", "Bluetooth API missing, simulating grant");
             updatePermissionStatus('bluetooth', 'granted'); // Sim fallback
         }
      }

    } catch (e: any) {
      if (e.name !== 'NotFoundError' && !e.message.includes('cancelled')) {
           mockService.emitLog("PERM", "ERROR", `Failed to request ${id}: ${e.message || e}`);
      } else {
           mockService.emitLog("PERM", "WARN", `User cancelled ${id} request`);
      }
    }
  };

  const handleAllowAll = async () => {
    setLoading(true);
    mockService.emitLog("PERM", "INFO", "Requesting ALL permissions...");
    
    for (const p of permissions) {
      if (p.status === 'prompt') {
        await requestPermission(p.id);
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    setLoading(false);
    mockService.emitLog("PERM", "INFO", "All permissions processed.");
  };

  const allGranted = permissions.every(p => p.status === 'granted');

  return (
    <div className="flex flex-col h-full bg-moncchichi-bg relative">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
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
            <div key={item.id} className={`bg-moncchichi-surface rounded-xl p-4 border ${item.status === 'denied' ? 'border-moncchichi-error/30' : 'border-moncchichi-border'} flex items-start gap-4`}>
              <div className={`p-2 rounded-lg ${item.status === 'granted' ? 'bg-moncchichi-success/10 text-moncchichi-success' : (item.status === 'denied' ? 'bg-moncchichi-error/10 text-moncchichi-error' : 'bg-moncchichi-surfaceAlt text-moncchichi-text')}`}>
                {item.icon}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h3 className={`font-semibold text-sm ${item.status === 'denied' ? 'text-moncchichi-error' : 'text-moncchichi-text'}`}>{item.title}</h3>
                  {item.status === 'granted' ? (
                    <span className="text-moncchichi-success">{ICONS.CheckCircle}</span>
                  ) : (
                    <button 
                      onClick={() => requestPermission(item.id)}
                      className={`text-xs px-3 py-1.5 rounded-full font-bold transition-colors ${
                          item.status === 'denied' 
                          ? 'bg-moncchichi-error/10 text-moncchichi-error hover:bg-moncchichi-error/20' 
                          : 'bg-moncchichi-accent text-moncchichi-bg hover:opacity-90'
                      }`}
                    >
                      {item.status === 'denied' ? 'Blocked' : 'Allow'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-moncchichi-textSec leading-relaxed">
                  {item.description}
                  {item.status === 'denied' && (
                      <span className="block mt-1 text-moncchichi-error font-bold">
                          ⚠️ Access blocked. Check browser settings (lock icon).
                      </span>
                  )}
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
    