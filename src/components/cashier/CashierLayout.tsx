import React, { useState, useEffect } from 'react';
import { UserProfile, BusinessConfig } from '../../types';
import { auth } from '../../lib/firebase';
import { logAuditAction, formatCurrency } from '../../lib/utils';
import { LayoutDashboard, ShoppingCart, Receipt, Package, CalendarCheck, LogOut, Pill, Lock, Users, X } from 'lucide-react';
import { OfflineStatusIndicator } from '../common/OfflineStatusIndicator';

interface CashierLayoutProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
  activeTab: 'dashboard' | 'sell' | 'sales' | 'stock' | 'closing';
  setActiveTab: (tab: 'dashboard' | 'sell' | 'sales' | 'stock' | 'closing') => void;
  onSwitchUser?: (user: UserProfile) => void;
  onLogout: () => void;
  children?: React.ReactNode;
}

export function CashierLayout({ user, businessConfig, activeTab, setActiveTab, onSwitchUser, onLogout, children }: CashierLayoutProps) {
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [availableCashiers, setAvailableCashiers] = useState<UserProfile[]>([]);
  const [targetCashier, setTargetCashier] = useState<UserProfile & { password?: string } | null>(null);
  const [switchPassword, setSwitchPassword] = useState('');
  const [switchError, setSwitchError] = useState('');

  useEffect(() => {
    try {
      const local = JSON.parse(localStorage.getItem('bar_pos_local_users') || '[]');
      const list = [user, ...local.filter((u: UserProfile) => u.uid !== user.uid && u.role === 'cashier')];
      if (list.length === 1) {
        list.push(
          { uid: 'cashier-1', name: 'Kimani', email: 'kimani@kimuchu.com', role: 'cashier', status: 'active', businessId: 'default' },
          { uid: 'cashier-2', name: 'Amina', email: 'amina@kimuchu.com', role: 'cashier', status: 'active', businessId: 'default' }
        );
      }
      setAvailableCashiers(list);
    } catch (e) {
      setAvailableCashiers([
        user,
        { uid: 'cashier-1', name: 'Kimani', email: 'kimani@hotelpos.com', role: 'cashier', status: 'active', businessId: 'default' }
      ]);
    }
  }, [user]);
  useEffect(() => {
    // Automatically request full screen on mount
    const enterFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen?.();
        }
      } catch (err) {
        console.warn('Auto fullscreen request blocked or not supported:', err);
      }
    };
    enterFullscreen();

    // Prevent exiting full screen by automatically re-requesting if exited
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        try {
          document.documentElement.requestFullscreen?.().catch(() => {});
        } catch (e) {}
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleSignOut = async () => {
    await logAuditAction(user.uid, user.name, 'LOGOUT', 'Cashier logged out');
    await auth.signOut();
    onLogout();
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sell', label: 'Record Sale', icon: ShoppingCart, highlight: true },
    { id: 'sales', label: "Today's Sales", icon: Receipt },
    { id: 'stock', label: 'Inventory Status', icon: Package },
    { id: 'closing', label: 'End-of-Day', icon: CalendarCheck },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Pill className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">
                {businessConfig?.name || 'Raphajoy Chemist & Pharmacy'} <span className="text-xs font-normal text-emerald-400 ml-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Pharmacy POS</span>
              </h1>
              <p className="text-xs text-slate-400">Chemist Cashier: <strong className="text-slate-200">{user.name}</strong></p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <OfflineStatusIndicator />

            <div className="hidden sm:block text-right pr-1">
              <p className="text-xs text-slate-400">Active Currency</p>
              <p className="text-sm font-bold text-emerald-400">{businessConfig?.currency || 'KSh'}</p>
            </div>

            {/* Cashier Switcher Button */}
            <button
              onClick={() => setShowSwitchModal(true)}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 px-3 py-2 rounded-xl text-xs font-bold border border-slate-700 transition-all active:scale-95"
              title="Switch Cashier"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Switch: {user.name}</span>
            </button>

            {/* Full Screen Locked Badge */}
            <div className="flex items-center space-x-1.5 bg-slate-800 text-emerald-400 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700 shadow-xs">
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Fullscreen Locked</span>
            </div>

            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-sm font-medium border border-slate-700 transition-all active:scale-95"
            >
              <LogOut className="w-4 h-4 text-red-400" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="bg-slate-800/90 border-t border-slate-700/60 px-4 sm:px-6 lg:px-8">
          <div className="w-full flex space-x-1 sm:space-x-4 overflow-x-auto py-2 scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? item.highlight
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                        : 'bg-slate-700 text-white shadow-xs'
                      : item.highlight
                      ? 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area - Full screen width responsive container */}
      <main className="flex-1 w-full p-3 sm:p-5 lg:p-6 flex flex-col justify-between">
        <div>{children}</div>
        <footer className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-500 font-medium">
          © 2026 Davetech Solutions. All rights reserved.
        </footer>
      </main>

      {/* Switch Cashier Modal */}
      {showSwitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {targetCashier ? `Authenticate: ${targetCashier.name}` : 'Switch Active Cashier'}
              </h3>
              <button 
                onClick={() => {
                  setShowSwitchModal(false);
                  setTargetCashier(null);
                  setSwitchPassword('');
                  setSwitchError('');
                }} 
                className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {targetCashier ? (
              <form onSubmit={(e) => {
                e.preventDefault();
                const storedPassword = (targetCashier as any).password;
                if (storedPassword && storedPassword !== switchPassword) {
                  setSwitchError('Incorrect password. Please try again.');
                  return;
                }
                if (onSwitchUser) onSwitchUser(targetCashier);
                setShowSwitchModal(false);
                setTargetCashier(null);
                setSwitchPassword('');
                setSwitchError('');
              }} className="space-y-3">
                <p className="text-xs text-gray-600">Enter password for <span className="font-bold text-slate-900">{targetCashier.name}</span> ({targetCashier.email}):</p>
                
                <div>
                  <input
                    type="password"
                    autoComplete="new-password"
                    data-lpignore="true"
                    placeholder="Enter cashier password"
                    value={switchPassword}
                    onChange={(e) => setSwitchPassword(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                </div>

                {switchError && (
                  <p className="text-xs font-bold text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">{switchError}</p>
                )}

                <div className="flex space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetCashier(null);
                      setSwitchPassword('');
                      setSwitchError('');
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                  >
                    Switch Cashier
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="text-xs text-gray-600">Select active cashier for this shift (password required):</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {availableCashiers.map(c => (
                    <button
                      key={c.uid}
                      type="button"
                      onClick={() => {
                        if (c.uid === user.uid) return;
                        setTargetCashier(c as any);
                        setSwitchPassword('');
                        setSwitchError('');
                      }}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${
                        c.uid === user.uid ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900 opacity-80 cursor-default' : 'bg-gray-50 border-gray-200 hover:bg-emerald-50/50 hover:border-emerald-300 cursor-pointer'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-bold">{c.name}</p>
                        <p className="text-[11px] text-gray-500">{c.email}</p>
                      </div>
                      {c.uid === user.uid ? (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Current</span>
                      ) : (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">Switch ➔</span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowSwitchModal(false)}
                  className="w-full py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
