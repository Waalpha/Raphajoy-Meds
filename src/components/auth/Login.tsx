import React, { useState, useEffect } from 'react';
import { auth, db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { Pill, Lock, Mail, AlertCircle, ShieldCheck, UserCheck } from 'lucide-react';
import { UserProfile } from '../../types';
import { logAuditAction } from '../../lib/utils';

interface LoginProps {
  onLoginSuccess?: (user: UserProfile) => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [knownUsers, setKnownUsers] = useState<UserProfile[]>([]);

  // Pre-load known users on mount so sign-in verification is instant
  useEffect(() => {
    // 1. Instantly read local cache
    try {
      const local = JSON.parse(localStorage.getItem('bar_pos_local_users') || '[]');
      if (Array.isArray(local) && local.length > 0) {
        setKnownUsers(local.filter((u: UserProfile) => u.status !== 'deleted' && u.email !== 'cashier@barpos.com'));
      }
    } catch (e) {
      // ignore
    }

    // 2. Fetch fresh staff users from Firestore in background (non-blocking)
    getDocs(collection(db, 'users')).then((snap) => {
      const list: UserProfile[] = [];
      snap.forEach((d) => {
        const u = { uid: d.id, ...d.data() } as UserProfile;
        if (u.status !== 'deleted' && u.uid !== 'local-user-cashier' && u.email !== 'cashier@barpos.com') {
          list.push(u);
        }
      });
      if (list.length > 0) {
        setKnownUsers(list);
        try {
          localStorage.setItem('bar_pos_local_users', JSON.stringify(list));
        } catch (e) {
          // ignore
        }
      }
    }).catch((err) => {
      console.warn('Background users fetch:', err);
    });
  }, []);

  const completeLogin = (userProfile: UserProfile) => {
    if (userProfile.status === 'disabled') {
      setError('This account has been disabled by management.');
      setLoading(false);
      return;
    }

    // Save session immediately
    localStorage.setItem('bar_pos_local_user', JSON.stringify(userProfile));

    // Log audit in background without blocking UI
    logAuditAction(userProfile.uid, userProfile.name, 'LOGIN', `Logged in as ${userProfile.role} (${userProfile.name})`).catch(() => {});

    // Notify parent or reload instantly
    if (onLoginSuccess) {
      onLoginSuccess(userProfile);
    } else {
      window.location.reload();
    }
  };

  const hotelName = (() => {
    try {
      const cached = localStorage.getItem('bar_pos_business_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.name) return parsed.name;
      }
    } catch (e) {}
    return 'Raphajoy Chemist & Pharmacy';
  })();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    if (cleanEmail === 'cashier@barpos.com') {
      setError('The default demo cashier has been removed. Please log in with your active cashier credentials (e.g. atieno@kimuchu.com).');
      setLoading(false);
      return;
    }

    // 1. Instant match in preloaded users or local storage
    const matchedInMemory = knownUsers.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
    if (matchedInMemory) {
      completeLogin(matchedInMemory);
      return;
    }

    try {
      const localUsers: UserProfile[] = JSON.parse(localStorage.getItem('bar_pos_local_users') || '[]');
      const matchedLocal = localUsers.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
      if (matchedLocal) {
        completeLogin(matchedLocal);
        return;
      }
    } catch (e) {
      // ignore
    }

    // 2. Fast direct Firestore query with quick fallback
    try {
      const firestorePromise = (async () => {
        const snap = await getDocs(collection(db, 'users'));
        let found: UserProfile | null = null;
        snap.forEach((d) => {
          const u = { uid: d.id, ...d.data() } as UserProfile;
          if (u.email && u.email.toLowerCase() === cleanEmail) {
            found = u;
          }
        });
        return found;
      })();

      // Fast timeout so user never waits more than 1.2s even on slow networks
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200));
      const firestoreUser = await Promise.race([firestorePromise, timeoutPromise]);

      if (firestoreUser) {
        completeLogin(firestoreUser);
        return;
      }
    } catch (err) {
      console.warn('Direct user query error:', err);
    }

    // 3. Fallback profile creation for known email patterns or custom credentials
    const isOwner = cleanEmail.includes('owner') || cleanEmail.includes('admin');
    const role: 'admin' | 'cashier' = isOwner ? 'admin' : 'cashier';
    const name = isOwner ? 'Hotel Owner' : 'Cashier';

    const fallbackProfile: UserProfile = {
      uid: 'user-' + Date.now(),
      email: cleanEmail,
      name,
      role,
      businessId: DEFAULT_BUSINESS_ID,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    // Save in background
    setDoc(doc(db, 'users', fallbackProfile.uid), fallbackProfile).catch(() => {});

    completeLogin(fallbackProfile);
  };

  const handleDemoLogin = (demoRole: 'admin' | 'cashier') => {
    setError('');
    setLoading(true);

    if (demoRole === 'cashier') {
      // Find active cashier (e.g. Atieno or MERCY)
      const cashier = knownUsers.find((u) => u.role === 'cashier' && u.status === 'active') || {
        uid: 'user-1788862620013',
        name: 'Atieno',
        email: 'atieno@kimuchu.com',
        role: 'cashier',
        businessId: DEFAULT_BUSINESS_ID,
        status: 'active',
        createdAt: new Date().toISOString()
      };
      completeLogin(cashier as UserProfile);
      return;
    }

    // Admin demo: find Cecilia Wangech or Master Owner
    const admin = knownUsers.find((u) => u.role === 'admin' && u.status === 'active') || {
      uid: 'local-user-admin',
      name: 'Master Owner',
      email: 'admin@barpos.com',
      role: 'admin',
      businessId: DEFAULT_BUSINESS_ID,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    completeLogin(admin as UserProfile);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-zinc-900 to-neutral-950 p-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl overflow-hidden border border-white/20">
        
        {/* Header */}
        <div className="bg-emerald-600 p-6 text-center text-white">
          <div className="mx-auto w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
            <Pill className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{hotelName}</h1>
          <p className="text-emerald-100 text-xs mt-1">Chemist & Pharmacy POS & Stock Management</p>
        </div>

        {/* Form Body */}
        <div className="p-8">
          {error && (
            <div className="mb-6 flex items-center space-x-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-200 animate-shake">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">
                Email / Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@raphajoy.com or pharmacist@raphajoy.com"
                  className="w-full rounded-xl border border-gray-300 bg-gray-50/50 py-3.5 pl-11 pr-4 text-sm text-gray-950 placeholder-gray-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-300 bg-gray-50/50 py-3.5 pl-11 pr-4 text-sm text-gray-950 placeholder-gray-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Quick Demo Login Buttons */}
          <div className="mt-8 border-t border-gray-100 pt-6">
            <p className="text-center text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">
              Quick Demo Access
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleDemoLogin('admin')}
                disabled={loading}
                className="flex items-center justify-center space-x-2 rounded-xl border border-emerald-200 bg-emerald-50/60 py-3 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100/80 transition-all shadow-xs"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Admin Owner</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('cashier')}
                disabled={loading}
                className="flex items-center justify-center space-x-2 rounded-xl border border-emerald-200 bg-emerald-50/60 py-3 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100/80 transition-all shadow-xs"
              >
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Cashier POS</span>
              </button>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
