import React, { useEffect, useState } from 'react';
import { UserProfile, BusinessConfig, DailyClosing } from '../../types';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { formatCurrency } from '../../lib/utils';
import { CalendarCheck, AlertTriangle, CheckCircle2, User, DollarSign } from 'lucide-react';

interface ClosingsViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
}

export function ClosingsView({ user, businessConfig }: ClosingsViewProps) {
  const [closings, setClosings] = useState<DailyClosing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClosings();
  }, []);

  async function fetchClosings() {
    try {
      const colRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'dailyClosings');
      const snap = await getDocs(colRef);
      const list: DailyClosing[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as DailyClosing);
      });
      list.sort((a, b) => b.submittedAt - a.submittedAt);
      setClosings(list);
    } catch (err) {
      console.warn("Using local fallback daily closings due to permission error:", err);
      try {
        const localClosings = JSON.parse(localStorage.getItem('bar_pos_local_closings') || '[]');
        setClosings(localClosings);
      } catch (e) {
        setClosings([]);
      }
    } finally {
      setLoading(false);
    }
  }

  const currency = businessConfig?.currency || 'KSh';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Daily Closing Reports & Discrepancies</h2>
        <p className="text-sm text-gray-500">Review end-of-day physical stock counts and variances submitted by cashiers</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading daily closings...</div>
      ) : closings.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 shadow-xs">
          <CalendarCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-800">No Daily Closings Submitted Yet</h3>
          <p className="text-sm text-gray-500 mt-1">When cashiers submit end-of-day reports, they will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {closings.map(closing => {
            const hasDiscrepancy = closing.items.some(i => i.variance !== 0);

            return (
              <div key={closing.id} className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${hasDiscrepancy ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {hasDiscrepancy ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-base">Date: {closing.date}</h4>
                      <p className="text-xs text-gray-500">Submitted by cashier: <strong className="text-gray-800">{closing.cashierName}</strong></p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Total Sales</p>
                      <p className="text-lg font-black text-emerald-700">{formatCurrency(closing.totalSales, currency)}</p>
                    </div>
                  </div>
                </div>

                {/* Payment Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl">
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase">Cash</p>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(closing.paymentTotals.Cash, currency)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase">M-Pesa</p>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(closing.paymentTotals['M-Pesa'], currency)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase">Card</p>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(closing.paymentTotals.Card, currency)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase">Other</p>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(closing.paymentTotals.Other, currency)}</p>
                  </div>
                </div>

                {closing.notes && (
                  <p className="text-xs text-gray-600 italic bg-emerald-50/50 p-3 rounded-xl border border-emerald-200">
                    <strong>Cashier Note:</strong> "{closing.notes}"
                  </p>
                )}

                {/* Items & Variances Table */}
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase">
                        <th className="pb-2">Product Name</th>
                        <th className="pb-2 text-center">Expected</th>
                        <th className="pb-2 text-center">Actual Physical</th>
                        <th className="pb-2 text-center">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {closing.items.map((item, idx) => (
                        <tr key={idx} className={item.variance !== 0 ? 'bg-red-50/30 font-semibold' : ''}>
                          <td className="py-2.5 text-gray-900">{item.productName}</td>
                          <td className="py-2.5 text-center text-gray-600">{item.expected}</td>
                          <td className="py-2.5 text-center text-gray-900">{item.actual}</td>
                          <td className="py-2.5 text-center">
                            {item.variance === 0 ? (
                              <span className="text-emerald-600">0 (Match)</span>
                            ) : item.variance < 0 ? (
                              <span className="text-red-600 font-bold">Shortage: {item.variance}</span>
                            ) : (
                              <span className="text-blue-600 font-bold">Overage: +{item.variance}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
