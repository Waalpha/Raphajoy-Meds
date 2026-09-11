import React, { useEffect, useState } from 'react';
import { UserProfile, BusinessConfig, Product, StockMovement } from '../../types';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { formatCurrency, logAuditAction } from '../../lib/utils';
import { Layers, Plus, History, Search, AlertCircle, CheckCircle2 } from 'lucide-react';

interface StockViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
}

export function StockView({ user, businessConfig }: StockViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  // Add stock modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addQty, setAddQty] = useState<number>(20);
  const [reason, setReason] = useState<string>('New stock delivery from supplier');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchStockAndMovements();
  }, []);

  async function fetchStockAndMovements() {
    try {
      // Fetch products
      const prodRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'products');
      const prodSnap = await getDocs(prodRef);
      const prods: Product[] = [];
      prodSnap.forEach(d => {
        prods.push({ id: d.id, ...d.data() } as Product);
      });
      setProducts(prods);
      if (prods.length > 0 && !selectedProduct) {
        setSelectedProduct(prods[0]);
      }

      // Fetch stock movements
      const movRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'stockMovements');
      const movSnap = await getDocs(movRef);
      const movs: StockMovement[] = [];
      movSnap.forEach(d => {
        movs.push({ id: d.id, ...d.data() } as StockMovement);
      });
      movs.sort((a, b) => b.createdAt - a.createdAt);
      setMovements(movs);
    } catch (err) {
      console.warn("Using local fallback stock movements due to permission error:", err);
      try {
        const localProds = JSON.parse(localStorage.getItem('bar_pos_local_products') || '[{"id":"p1","name":"Tusker Lager 500ml","categoryId":"cat-beer","unitType":"Bottle","buyingPrice":180,"sellingPrice":250,"openingStock":50,"stockAdded":0,"currentStock":45,"minStockLevel":10}]');
        const localMovs = JSON.parse(localStorage.getItem('bar_pos_local_movements') || '[]');
        setProducts(localProds);
        if (localProds.length > 0 && !selectedProduct) {
          setSelectedProduct(localProds[0]);
        }
        setMovements(localMovs);
      } catch (e) {
        setProducts([]);
        setMovements([]);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || addQty <= 0) {
      setError('Please select a product and enter a valid quantity to add.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const prevStock = selectedProduct.currentStock;
      const newStock = prevStock + addQty;
      const totalAdded = (selectedProduct.stockAdded || 0) + addQty;
      const now = new Date();
      const movementId = 'mov-' + Date.now();

      // Update product currentStock and stockAdded
      const prodRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'products', selectedProduct.id);
      await updateDoc(prodRef, {
        currentStock: newStock,
        stockAdded: totalAdded,
        updatedAt: now.toISOString()
      });

      // Record stock movement history
      const movement: StockMovement = {
        id: movementId,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        previousStock: prevStock,
        addedQty: Number(addQty),
        newStock,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        adminId: user.uid,
        adminName: user.name,
        reason: reason.trim() || 'Stock replenishment',
        createdAt: now.getTime()
      };

      const movRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'stockMovements', movementId);
      await setDoc(movRef, movement);

      await logAuditAction(
        user.uid,
        user.name,
        'STOCK_ADDED',
        `Added ${addQty} units to ${selectedProduct.name}. Previous: ${prevStock}, New: ${newStock}. Reason: ${reason}`,
        movementId
      );

      setSuccessMsg(`Successfully added ${addQty} units to ${selectedProduct.name}! New stock is ${newStock}.`);
      setAddQty(20);
      await fetchStockAndMovements();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to add stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Stock Management & Additions</h2>
        <p className="text-sm text-gray-500">Record stock deliveries and view complete stock movement history</p>
      </div>

      {successMsg && (
        <div className="flex items-center space-x-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center space-x-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Add Stock Form Card */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-6">
        <div className="flex items-center space-x-3 border-b border-gray-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Record Stock Addition</h3>
            <p className="text-xs text-gray-500">Add received stock deliveries while keeping full audit trail history</p>
          </div>
        </div>

        <form onSubmit={handleAddStockSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
              Select Product
            </label>
            <select
              value={selectedProduct?.id || ''}
              onChange={(e) => {
                const found = products.find(p => p.id === e.target.value);
                if (found) setSelectedProduct(found);
              }}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 bg-white"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Current: {p.currentStock})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
              Quantity to Add
            </label>
            <input
              type="number"
              min="1"
              required
              value={addQty}
              onChange={(e) => setAddQty(Number(e.target.value))}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
              Reason / Supplier Ref
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Kenya Breweries Delivery"
              className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-sm font-bold text-white shadow-md transition-all active:scale-95"
            >
              {loading ? 'Recording...' : 'Add Stock'}
            </button>
          </div>
        </form>

        {selectedProduct && (
          <div className="flex items-center space-x-6 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200 text-xs text-emerald-900">
            <div>Previous Stock: <strong className="font-bold">{selectedProduct.currentStock}</strong></div>
            <div>+ Added: <strong className="font-bold text-emerald-700">{addQty}</strong></div>
            <div>= New Result Stock: <strong className="font-bold text-emerald-800">{selectedProduct.currentStock + addQty}</strong></div>
          </div>
        )}
      </div>

      {/* Stock Movement History Table */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
          <History className="w-5 h-5 text-emerald-600" />
          <span>Stock Movement History Log</span>
        </h3>

        {movements.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No stock additions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <th className="p-4">Date & Time</th>
                  <th className="p-4">Product Name</th>
                  <th className="p-4 text-center">Previous</th>
                  <th className="p-4 text-center">Added</th>
                  <th className="p-4 text-center">New Stock</th>
                  <th className="p-4">Reason / Ref</th>
                  <th className="p-4">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {movements.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50/60">
                    <td className="p-4 text-gray-500 text-xs font-mono">{m.date} {m.time}</td>
                    <td className="p-4 font-bold text-gray-900">{m.productName}</td>
                    <td className="p-4 text-center font-medium text-gray-700">{m.previousStock}</td>
                    <td className="p-4 text-center font-bold text-emerald-600">+{m.addedQty}</td>
                    <td className="p-4 text-center font-extrabold text-gray-900">{m.newStock}</td>
                    <td className="p-4 text-gray-700">{m.reason}</td>
                    <td className="p-4 text-gray-600 text-xs font-medium">{m.adminName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
