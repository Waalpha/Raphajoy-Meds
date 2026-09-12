import React, { useEffect, useState } from 'react';
import { auth, db, DEFAULT_BUSINESS_ID } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile, BusinessConfig } from './types';
import { initializeDatabase } from './lib/dbSeeder';

import { Login } from './components/auth/Login';
import { CashierLayout } from './components/cashier/CashierLayout';
import { CashierDashboard } from './components/cashier/CashierDashboard';
import { RecordSaleView } from './components/cashier/RecordSaleView';
import { CashierSalesView } from './components/cashier/CashierSalesView';
import { CashierStockView } from './components/cashier/CashierStockView';
import { DailyClosingView } from './components/cashier/DailyClosingView';

import { AdminLayout } from './components/admin/AdminLayout';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { ProductsView } from './components/admin/ProductsView';
import { CategoriesView } from './components/admin/CategoriesView';
import { StockView } from './components/admin/StockView';
import { SalesReportsView } from './components/admin/SalesReportsView';
import { ClosingsView } from './components/admin/ClosingsView';
import { CashiersView } from './components/admin/CashiersView';
import { AuditLogsView } from './components/admin/AuditLogsView';
import { SettingsView } from './components/admin/SettingsView';
import { PrinterSettingsView } from './components/admin/PrinterSettingsView';

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [businessConfig, setBusinessConfig] = useState<BusinessConfig | null>(() => {
    try {
      const cached = localStorage.getItem('bar_pos_business_config');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return null;
  });
  const [loading, setLoading] = useState(true);

  // Navigation tab states
  const [cashierTab, setCashierTab] = useState<'dashboard' | 'sell' | 'sales' | 'stock' | 'closing'>('dashboard');
  const [adminTab, setAdminTab] = useState<string>('dashboard');

  useEffect(() => {
    // 1. Instant local user check
    const localUserStr = localStorage.getItem('bar_pos_local_user') || localStorage.getItem('raphajoy_pos_user_profile');
    if (localUserStr) {
      try {
        const localUser = JSON.parse(localUserStr);
        if (localUser.uid === 'local-user-cashier' || localUser.email === 'cashier@barpos.com') {
          localStorage.removeItem('bar_pos_local_user');
        } else {
          setUserProfile(localUser);
          setFirebaseUser({ uid: localUser.uid, email: localUser.email } as any);
          setLoading(false);
          // Fetch business config in background
          getDoc(doc(db, 'businesses', DEFAULT_BUSINESS_ID)).then(bizSnap => {
            if (bizSnap.exists()) {
              const data = bizSnap.data() as BusinessConfig;
              setBusinessConfig(data);
              localStorage.setItem('bar_pos_business_config', JSON.stringify(data));
            }
          }).catch(() => {});
          return;
        }
      } catch (e) {
        localStorage.removeItem('bar_pos_local_user');
      }
    }

    // Safety watchdog: Max 2000ms loading screen timeout so UI never hangs
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      if (fUser) {
        setFirebaseUser(fUser);
        // Non-blocking background database initialization
        initializeDatabase(fUser).catch(() => {});

        // Fetch user profile with resilient race condition (max 1500ms timeout)
        try {
          const userDocRef = doc(db, 'users', fUser.uid);
          const userFetchPromise = getDoc(userDocRef);
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));

          const userSnap = await Promise.race([userFetchPromise, timeoutPromise]);

          if (userSnap && userSnap.exists()) {
            const data = userSnap.data() as UserProfile;
            setUserProfile(data);
            localStorage.setItem('raphajoy_pos_user_profile', JSON.stringify(data));
          } else {
            // Check if cached locally
            const cachedStr = localStorage.getItem('raphajoy_pos_user_profile');
            if (cachedStr) {
              try {
                const cached = JSON.parse(cachedStr);
                if (cached.uid === fUser.uid) {
                  setUserProfile(cached);
                }
              } catch (e) {}
            }

            // Create or fallback profile
            const email = fUser.email || '';
            const role = email.includes('cashier') ? 'cashier' : 'admin';
            const profile: UserProfile = {
              uid: fUser.uid,
              email: email,
              name: fUser.displayName || (role === 'admin' ? 'Pharmacy Admin' : 'Pharmacy Cashier'),
              role: role,
              businessId: DEFAULT_BUSINESS_ID,
              status: 'active',
              createdAt: new Date().toISOString()
            };
            setDoc(userDocRef, profile).catch(() => {});
            setUserProfile(profile);
            localStorage.setItem('raphajoy_pos_user_profile', JSON.stringify(profile));
          }

          // Fetch business config in background
          const bizRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID);
          getDoc(bizRef).then(bizSnap => {
            if (bizSnap.exists()) {
              const data = bizSnap.data() as BusinessConfig;
              setBusinessConfig(data);
              localStorage.setItem('bar_pos_business_config', JSON.stringify(data));
            }
          }).catch(() => {});
        } catch (err) {
          console.warn("Could not fetch remote profile immediately, using fallback:", err);
        } finally {
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      } else {
        setFirebaseUser(null);
        setUserProfile(null);
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-medium text-slate-300">Loading Raphajoy Chemist & Pharmacy POS System...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser || !userProfile) {
    return (
      <Login
        onLoginSuccess={(user) => {
          setUserProfile(user);
          setFirebaseUser({ uid: user.uid, email: user.email } as any);
          if (!businessConfig) {
            getDoc(doc(db, 'businesses', DEFAULT_BUSINESS_ID)).then((bizSnap) => {
              if (bizSnap.exists()) {
                setBusinessConfig(bizSnap.data() as BusinessConfig);
              }
            }).catch(() => {});
          }
        }}
      />
    );
  }

  // Render Cashier Interface
  if (userProfile.role === 'cashier') {
    return (
      <CashierLayout
        user={userProfile}
        businessConfig={businessConfig}
        activeTab={cashierTab}
        setActiveTab={setCashierTab}
        onSwitchUser={(newUser) => setUserProfile(newUser)}
        onLogout={() => {
          localStorage.removeItem('bar_pos_local_user');
          auth.signOut();
          setFirebaseUser(null);
          setUserProfile(null);
        }}
      >
        {cashierTab === 'dashboard' && (
          <CashierDashboard
            user={userProfile}
            businessConfig={businessConfig}
            setActiveTab={setCashierTab}
          />
        )}
        {cashierTab === 'sell' && (
          <RecordSaleView
            user={userProfile}
            businessConfig={businessConfig}
          />
        )}
        {cashierTab === 'sales' && (
          <CashierSalesView
            user={userProfile}
            businessConfig={businessConfig}
          />
        )}
        {cashierTab === 'stock' && (
          <CashierStockView
            user={userProfile}
            businessConfig={businessConfig}
          />
        )}
        {cashierTab === 'closing' && (
          <DailyClosingView
            user={userProfile}
            businessConfig={businessConfig}
          />
        )}
      </CashierLayout>
    );
  }

  // Render Admin Interface
  return (
    <AdminLayout
      user={userProfile}
      businessConfig={businessConfig}
      activeTab={adminTab}
      setActiveTab={setAdminTab}
      onLogout={() => {
        localStorage.removeItem('bar_pos_local_user');
        auth.signOut();
        setFirebaseUser(null);
        setUserProfile(null);
      }}
    >
      {adminTab === 'dashboard' && (
        <AdminDashboard
          user={userProfile}
          businessConfig={businessConfig}
        />
      )}
      {adminTab === 'products' && (
        <ProductsView
          user={userProfile}
          businessConfig={businessConfig}
        />
      )}
      {adminTab === 'categories' && (
        <CategoriesView
          user={userProfile}
          businessConfig={businessConfig}
        />
      )}
      {adminTab === 'stock' && (
        <StockView
          user={userProfile}
          businessConfig={businessConfig}
        />
      )}
      {adminTab === 'sales' && (
        <SalesReportsView
          user={userProfile}
          businessConfig={businessConfig}
        />
      )}
      {adminTab === 'closings' && (
        <ClosingsView
          user={userProfile}
          businessConfig={businessConfig}
        />
      )}
      {adminTab === 'cashiers' && (
        <CashiersView
          user={userProfile}
          businessConfig={businessConfig}
        />
      )}
      {adminTab === 'audit' && (
        <AuditLogsView
          user={userProfile}
          businessConfig={businessConfig}
        />
      )}
      {adminTab === 'printer' && (
        <PrinterSettingsView
          user={userProfile}
          businessConfig={businessConfig}
        />
      )}
      {adminTab === 'settings' && (
        <SettingsView
          user={userProfile}
          businessConfig={businessConfig}
          onConfigUpdated={(newCfg) => setBusinessConfig(newCfg)}
        />
      )}
    </AdminLayout>
  );
}
