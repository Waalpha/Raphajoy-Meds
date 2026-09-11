import React, { useState, useEffect } from 'react';
import {
  getOfflineStatus,
  subscribeOfflineStatus,
  syncOfflineQueue,
  OfflineStatus
} from '../../lib/offlineManager';
import { Wifi, WifiOff, RefreshCw, Check, Download } from 'lucide-react';

export function OfflineStatusIndicator() {
  const [status, setStatus] = useState<OfflineStatus>(getOfflineStatus());
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const unsub = subscribeOfflineStatus((newStatus) => {
      setStatus(newStatus);
    });

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      unsub();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleManualSync = async () => {
    setSyncFeedback(null);
    const res = await syncOfflineQueue();
    if (res.syncedCount > 0) {
      setSyncFeedback(`Synced ${res.syncedCount} sale${res.syncedCount > 1 ? 's' : ''}!`);
      setTimeout(() => setSyncFeedback(null), 3000);
    } else if (res.errors > 0) {
      setSyncFeedback(`Sync failed (${res.errors} error)`);
      setTimeout(() => setSyncFeedback(null), 3000);
    } else {
      setSyncFeedback('All caught up!');
      setTimeout(() => setSyncFeedback(null), 2000);
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="flex items-center space-x-2">
      {/* Install PWA Button if browser triggered installability */}
      {isInstallable && (
        <button
          onClick={handleInstallClick}
          className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-2.5 py-1 rounded-xl text-xs font-black shadow-xs transition-all active:scale-95"
          title="Install Raphajoy Chemist POS App on this device"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Install App</span>
        </button>
      )}

      {/* Online / Offline Status Badge */}
      <div
        className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all ${
          !status.isOnline
            ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 animate-pulse'
            : status.pendingSalesCount > 0
            ? 'bg-emerald-900/60 border-emerald-600 text-emerald-200'
            : 'bg-slate-800/80 border-slate-700 text-emerald-400'
        }`}
        title={
          !status.isOnline
            ? 'Operating in Offline Mode. Sales are stored locally and will sync once reconnected.'
            : status.pendingSalesCount > 0
            ? `${status.pendingSalesCount} sale(s) waiting to upload to server.`
            : 'Online & Synced with Database'
        }
      >
        {!status.isOnline ? (
          <>
            <WifiOff className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Offline Mode</span>
          </>
        ) : status.pendingSalesCount > 0 ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
            <span>{status.pendingSalesCount} pending</span>
          </>
        ) : (
          <>
            <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden md:inline">Online</span>
          </>
        )}
      </div>

      {/* Pending Queue & Manual Sync Button */}
      {status.isOnline && status.pendingSalesCount > 0 && (
        <button
          onClick={handleManualSync}
          disabled={status.isSyncing}
          className="flex items-center space-x-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-2.5 py-1 rounded-xl text-xs font-black transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${status.isSyncing ? 'animate-spin' : ''}`} />
          <span>Sync ({status.pendingSalesCount})</span>
        </button>
      )}

      {/* Sync feedback toast message */}
      {syncFeedback && (
        <div className="bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-lg text-xs font-bold flex items-center space-x-1">
          <Check className="w-3 h-3" />
          <span>{syncFeedback}</span>
        </div>
      )}
    </div>
  );
}
