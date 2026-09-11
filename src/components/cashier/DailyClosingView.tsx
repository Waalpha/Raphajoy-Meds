import React, { useEffect, useState } from 'react';
import { UserProfile, BusinessConfig, Product, Sale, DailyClosing, ClosingItem } from '../../types';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { collection, getDocs, doc, setDoc, query, where, getDoc } from 'firebase/firestore';
import { formatCurrency, logAuditAction } from '../../lib/utils';
import { CalendarCheck, AlertTriangle, CheckCircle2, DollarSign, Send, Info } from 'lucide-react';
import { getLocalCachedProducts } from '../../lib/offlineManager';

interface DailyClosingViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
}

export function DailyClosingView({ user, businessConfig }: DailyClosingViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [actualCounts, setActualCounts] = useState<Record<string, number>>({});
  const [salesSummary, setSalesSummary] = useState({
    totalSales: 0,
    cash: 0,
    mpesa: 0,
    card: 0,
    other: 0,
    transactions: 0,
    itemsSold: 0
  });
  const [notes, setNotes] = useState('');
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchClosingData();
  }, []);

  function populateLocalData() {
    const prods = getLocalCachedProducts();
    const initialCounts: Record<string, number> = {};
    prods.forEach(p => {
      initialCounts[p.id] = p.currentStock;
    });
    setProducts(prods);
    setActualCounts(initialCounts);

    const localSales: Sale[] = JSON.parse(localStorage.getItem('bar_pos_local_sales') || '[]');
    const todayLocal = localSales.filter(s => s.date === todayStr);
    let tSales = 0;
    let cash = 0;
    let mpesa = 0;
    let card = 0;
    let other = 0;
    let itemsCount = 0;

    todayLocal.forEach(s => {
      tSales += s.totalAmount;
      if (s.paymentMethod === 'Cash') cash += s.totalAmount;
      if (s.paymentMethod === 'M-Pesa') mpesa += s.totalAmount;
      if (s.paymentMethod === 'Card') card += s.totalAmount;
      if (s.paymentMethod === 'Other') other += s.totalAmount;
      s.items.forEach(i => {
        itemsCount += i.quantity;
      });
    });

    setSalesSummary({
      totalSales: tSales,
      cash,
      mpesa,
      card,
      other,
      transactions: todayLocal.length,
      itemsSold: itemsCount
    });
  }

  async function fetchClosingData() {
    // Check local closings first
    try {
      const localClosings = JSON.parse(localStorage.getItem('bar_pos_local_closings') || '{}');
      if (localClosings[`${todayStr}-${user.uid}`]) {
        setAlreadySubmitted(true);
      }
    } catch (e) {
      // ignore
    }

    // If offline, populate immediately from local storage without waiting for remote Firestore
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      populateLocalData();
      setLoading(false);
      return;
    }

    try {
      // 1. Check if already submitted today
      const closingRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'dailyClosings', `${todayStr}-${user.uid}`);
      const closingSnap = await getDoc(closingRef);
      if (closingSnap.exists()) {
        setAlreadySubmitted(true);
      }

      // 2. Fetch products
      const prodRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'products');
      const prodSnap = await getDocs(prodRef);
      const prods: Product[] = [];
      const initialCounts: Record<string, number> = {};
      prodSnap.forEach(d => {
        const prod = { id: d.id, ...d.data() } as Product;
        prods.push(prod);
        initialCounts[prod.id] = prod.currentStock;
      });
      setProducts(prods);
      setActualCounts(initialCounts);

      // 3. Fetch today's sales
      const salesRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'sales');
      const salesQuery = query(salesRef, where('date', '==', todayStr));
      const salesSnap = await getDocs(salesQuery);

      let tSales = 0;
      let cash = 0;
      let mpesa = 0;
      let card = 0;
      let other = 0;
      let itemsCount = 0;

      salesSnap.forEach(d => {
        const sale = d.data() as Sale;
        tSales += sale.totalAmount;
        if (sale.paymentMethod === 'Cash') cash += sale.totalAmount;
        if (sale.paymentMethod === 'M-Pesa') mpesa += sale.totalAmount;
        if (sale.paymentMethod === 'Card') card += sale.totalAmount;
        if (sale.paymentMethod === 'Other') other += sale.totalAmount;

        sale.items.forEach(i => {
          itemsCount += i.quantity;
        });
      });

      setSalesSummary({
        totalSales: tSales,
        cash,
        mpesa,
        card,
        other,
        transactions: salesSnap.size,
        itemsSold: itemsCount
      });
    } catch (err) {
      console.warn("Working offline: calculating daily closing from local storage:", err);
      populateLocalData();
    } finally {
      setLoading(false);
    }
  }

  const handleActualChange = (productId: string, val: string) => {
    const num = parseInt(val);
    setActualCounts(prev => ({
      ...prev,
      [productId]: isNaN(num) ? 0 : num
    }));
  };

  const handleSubmitClosing = async () => {
    if (!window.confirm("Are you sure you want to submit today's end-of-day closing? This cannot be edited afterwards.")) {
      return;
    }

    setSubmitting(true);
    try {
      const closingItems: ClosingItem[] = products.map(p => {
        const expected = p.currentStock;
        const actual = actualCounts[p.id] !== undefined ? actualCounts[p.id] : expected;
        const variance = actual - expected;
        return {
          productId: p.id,
          productName: p.name,
          expected,
          actual,
          variance
        };
      });

      const closingId = `${todayStr}-${user.uid}`;
      const dailyClosing: DailyClosing = {
        id: closingId,
        businessDayId: todayStr,
        date: todayStr,
        cashierId: user.uid,
        cashierName: user.name,
        items: closingItems,
        totalSales: salesSummary.totalSales,
        paymentTotals: {
          Cash: salesSummary.cash,
          'M-Pesa': salesSummary.mpesa,
          Card: salesSummary.card,
          Other: salesSummary.other
        },
        totalTransactions: salesSummary.transactions,
        totalItemsSold: salesSummary.itemsSold,
        notes,
        submittedAt: Date.now(),
        status: 'submitted'
      };

      // 1. Always save to local closings immediately
      try {
        const localClosings = JSON.parse(localStorage.getItem('bar_pos_local_closings') || '{}');
        localClosings[closingId] = dailyClosing;
        localStorage.setItem('bar_pos_local_closings', JSON.stringify(localClosings));
      } catch (e) {
        console.warn("Could not save to local closings:", e);
      }

      // 2. Try Firestore if online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const closingRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'dailyClosings', closingId);
          await setDoc(closingRef, dailyClosing);
        } catch (dbErr) {
          console.warn("Online write deferred for closing, saved locally:", dbErr);
        }
      }

      try {
        await logAuditAction(
          user.uid,
          user.name,
          'CLOSING_SUBMITTED',
          `Submitted end-of-day closing for ${todayStr}. Total Sales: ${salesSummary.totalSales}`,
          closingId
        );
      } catch (e) {
        // suppress
      }

      setAlreadySubmitted(true);
      setSuccess(true);
    } catch (err) {
      console.error("Error submitting closing:", err);
      // Even if online call errored, closing was saved locally above
      setAlreadySubmitted(true);
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  const currency = businessConfig?.currency || 'KSh';

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading closing checklist...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">End-of-Day Closing</h2>
        <p className="text-sm text-gray-500">Physical stock count reconciliation and daily sales submission</p>
      </div>

      {alreadySubmitted && (
        <div className="rounded-2xl bg-emerald-50 p-5 border border-emerald-200 flex items-center space-x-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
          <div>
            <h4 className="font-bold text-emerald-900 text-base">Closing Already Submitted</h4>
            <p className="text-xs text-emerald-700 mt-0.5">You have successfully submitted today's shift closing. Admin is reviewing the report.</p>
          </div>
        </div>
      )}

      {/* Sales Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Today's Sales</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{formatCurrency(salesSummary.totalSales, currency)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Cash Collected</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{formatCurrency(salesSummary.cash, currency)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">M-Pesa Collected</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{formatCurrency(salesSummary.mpesa, currency)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Transactions / Items</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{salesSummary.transactions} txns / {salesSummary.itemsSold} items</p>
        </div>
      </div>

      {/* Physical Stock Count Reconciliation Table */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Physical Stock Reconciliation</h3>
          <p className="text-xs text-gray-500 mt-1">Count your physical inventory on shelves and enter the actual quantities below.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500">
                <th className="p-4">Product Name</th>
                <th className="p-4 text-center">Expected Stock</th>
                <th className="p-4 text-center">Actual Physical Count</th>
                <th className="p-4 text-center">Variance / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {products.map(product => {
                const expected = product.currentStock;
                const actual = actualCounts[product.id] !== undefined ? actualCounts[product.id] : expected;
                const variance = actual - expected;

                return (
                  <tr key={product.id} className="hover:bg-gray-50/60">
                    <td className="p-4 font-bold text-gray-900">{product.name}</td>
                    <td className="p-4 text-center font-medium text-gray-700">{expected}</td>
                    <td className="p-4 text-center">
                      <input
                        type="number"
                        disabled={alreadySubmitted}
                        value={actual}
                        onChange={(e) => handleActualChange(product.id, e.target.value)}
                        className="w-24 text-center font-bold rounded-xl border border-gray-300 py-2 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:bg-gray-100"
                      />
                    </td>
                    <td className="p-4 text-center">
                      {variance === 0 ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                          Exact Match (0)
                        </span>
                      ) : variance < 0 ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Shortage: {Math.abs(variance)}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                          <span>Overage: +{variance}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-2 pt-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">
            Shift Closing Notes / Observations
          </label>
          <textarea
            disabled={alreadySubmitted}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any remarks regarding shortages, breakage, or general shift notes..."
            className="w-full rounded-2xl border border-gray-300 p-4 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:bg-gray-100"
            rows={3}
          />
        </div>

        {!alreadySubmitted && (
          <div className="flex justify-end pt-4">
            <button
              onClick={handleSubmitClosing}
              disabled={submitting}
              className="flex items-center space-x-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 px-8 py-4 text-base font-bold text-white shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
              <span>{submitting ? 'Submitting Closing...' : 'SUBMIT DAILY CLOSING'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
