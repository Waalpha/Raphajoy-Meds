import React, { useEffect, useState } from 'react';
import { UserProfile, BusinessConfig } from '../../types';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { logAuditAction } from '../../lib/utils';
import { forceResetDatabaseToPharmacy } from '../../lib/dbSeeder';
import { Settings, Save, CheckCircle2, AlertCircle, Building2, Trash2, AlertTriangle, RotateCcw } from 'lucide-react';
import { clearAllPaymentRecords } from '../../lib/offlineManager';

interface SettingsViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
  onConfigUpdated: (newConfig: BusinessConfig) => void;
}

export function SettingsView({ user, businessConfig, onConfigUpdated }: SettingsViewProps) {
  const [formData, setFormData] = useState<BusinessConfig>({
    id: DEFAULT_BUSINESS_ID,
    name: 'Raphajoy Chemist & Pharmacy',
    phone: '+254 722 000 111',
    location: 'Nairobi, Kenya',
    address: 'Main Street, Medical Plaza, Nairobi',
    currency: 'KSh',
    openingTime: '08:00',
    closingTime: '21:00',
    lowStockThreshold: 5,
    receiptHeader: 'RAPHAJOY CHEMIST & PHARMACY',
    receiptFooter: 'Get Well Soon! Thank you for choosing Raphajoy.',
    tillNumber: '888999'
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');

  // Clear Payment / Sales Records State
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState('');
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (businessConfig) {
      setFormData(businessConfig);
    }
  }, [businessConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const bizRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID);
      await setDoc(bizRef, formData, { merge: true });
      localStorage.setItem('bar_pos_business_config', JSON.stringify(formData));
      await logAuditAction(user.uid, user.name, 'SETTINGS_UPDATED', 'Updated business settings config');
      onConfigUpdated(formData);
      setSuccess('Business settings updated successfully!');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Business Settings & Configuration</h2>
        <p className="text-sm text-gray-500">Configure bar name, contact info, currency, operating hours, and receipt branding</p>
      </div>

      {success && (
        <div className="flex items-center space-x-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center space-x-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 border border-gray-200 shadow-xs space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Bar / Business Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Currency Symbol</label>
            <input
              type="text"
              required
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Phone Number</label>
            <input
              type="text"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">M-Pesa Till / Paybill Number</label>
            <input
              type="text"
              value={formData.tillNumber || ''}
              onChange={(e) => setFormData({ ...formData, tillNumber: e.target.value })}
              placeholder="e.g. 543210"
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Location / City</label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Physical Address</label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Opening Time</label>
            <input
              type="text"
              required
              value={formData.openingTime}
              onChange={(e) => setFormData({ ...formData, openingTime: e.target.value })}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Closing Time</label>
            <input
              type="text"
              required
              value={formData.closingTime}
              onChange={(e) => setFormData({ ...formData, closingTime: e.target.value })}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Low Stock Threshold Alert</label>
            <input
              type="number"
              min="1"
              required
              value={formData.lowStockThreshold}
              onChange={(e) => setFormData({ ...formData, lowStockThreshold: Number(e.target.value) })}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Receipt Footer Message</label>
            <input
              type="text"
              value={formData.receiptFooter || ''}
              onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center space-x-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>

      {/* Danger Zone: Fresh Start */}
      <div className="bg-red-50/50 rounded-3xl p-8 border border-red-200 shadow-xs space-y-4">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-red-100 rounded-2xl text-red-600 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-red-950">Data Reset & Fresh Start</h3>
            <p className="text-sm text-red-800 mt-1">
              Clear all sales records, payment transactions (Cash, M-Pesa, Card), and cashier daily shift closings.
              Use this when launching live, resetting test data, or starting fresh with 0.00 sales.
            </p>
            <p className="text-xs text-red-700 mt-2 font-medium">
              Note: All catalog products, inventory stock counts, prices, and staff user logins are safely preserved.
            </p>
          </div>
        </div>

        {clearSuccess && (
          <div className="flex items-center space-x-3 rounded-2xl bg-emerald-100 p-4 text-sm text-emerald-900 border border-emerald-300">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-700" />
            <span>{clearSuccess}</span>
          </div>
        )}

        <div className="pt-2 flex justify-between items-center flex-wrap gap-3">
          {resetSuccess && (
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{resetSuccess}</span>
            </div>
          )}
          <div className="flex items-center space-x-3 ml-auto">
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm("Are you sure you want to reset and reload the entire database with fresh Raphajoy Chemist & Pharmacy categories and products?")) return;
                setResetting(true);
                setError('');
                setResetSuccess('');
                try {
                  await forceResetDatabaseToPharmacy();
                  setResetSuccess('Database successfully reset and loaded with fresh Raphajoy Pharmacy catalog!');
                  setTimeout(() => {
                    window.location.reload();
                  }, 1500);
                } catch (err: any) {
                  setError(err.message || 'Failed to reset database');
                } finally {
                  setResetting(false);
                }
              }}
              disabled={resetting}
              className="flex items-center space-x-2 rounded-2xl bg-slate-800 hover:bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{resetting ? 'Resetting Catalog...' : 'Reset DB to Raphajoy Pharmacy'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmText('');
                setShowClearModal(true);
              }}
              className="flex items-center space-x-2 rounded-2xl bg-red-600 hover:bg-red-700 px-6 py-3 text-sm font-bold text-white shadow-md shadow-red-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Clear All Payment Records</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Clear All Payment Records?</h3>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              This action will permanently delete all sales transactions, payment histories, and cashier daily shift closings across both cloud Firestore and local storage.
            </p>

            <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-200 text-xs text-emerald-900 space-y-1">
              <p className="font-bold">What will be preserved:</p>
              <p>• All 70 catalog products, categories & prices</p>
              <p>• Current stock inventory levels</p>
              <p>• Staff and cashier logins</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Type <span className="font-bold text-red-600">CLEAR</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="Type CLEAR"
                className="w-full rounded-xl border border-gray-300 p-3 text-sm font-mono uppercase focus:border-red-600 focus:outline-none"
              />
            </div>

            <div className="flex space-x-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={clearing}
                className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setClearing(true);
                  setError('');
                  setClearSuccess('');
                  try {
                    const res = await clearAllPaymentRecords(user);
                    setShowClearModal(false);
                    setConfirmText('');
                    setClearSuccess(`Successfully cleared all payment records (${res.deletedSales} sales, ${res.deletedClosings} closings deleted).`);
                    setTimeout(() => {
                      window.location.reload();
                    }, 1400);
                  } catch (err: any) {
                    setError(err.message || 'Failed to clear payment records');
                  } finally {
                    setClearing(false);
                  }
                }}
                disabled={confirmText !== 'CLEAR' || clearing}
                className="flex items-center space-x-2 rounded-xl bg-red-600 hover:bg-red-700 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-red-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                <span>{clearing ? 'Clearing...' : 'Permanently Clear'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
