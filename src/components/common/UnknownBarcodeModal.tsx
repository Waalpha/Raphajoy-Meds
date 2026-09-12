import React, { useState } from 'react';
import { AlertTriangle, Plus, Search, X, Link, Check, Package } from 'lucide-react';
import { Product } from '../../types';

export interface UnknownBarcodeModalProps {
  barcode?: string;
  scannedBarcode?: string;
  products?: Product[];
  onAddNewProduct?: (barcode: string) => void;
  onCreateNew?: (barcode: string) => void;
  onSearchProduct?: (barcode: string) => void;
  onSearchManual?: () => void;
  onAssignToExisting?: (productId: string, barcode: string) => void;
  onClose: () => void;
  isAdmin?: boolean;
}

export function UnknownBarcodeModal({
  barcode,
  scannedBarcode,
  products = [],
  onAddNewProduct,
  onCreateNew,
  onSearchProduct,
  onSearchManual,
  onAssignToExisting,
  onClose,
  isAdmin = true
}: UnknownBarcodeModalProps) {
  const code = (scannedBarcode || barcode || '').trim();
  const [showAssignView, setShowAssignView] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew(code);
    } else if (onAddNewProduct) {
      onAddNewProduct(code);
    }
  };

  const handleManualSearch = () => {
    if (onSearchManual) {
      onSearchManual();
    } else if (onSearchProduct) {
      onSearchProduct(code);
    }
  };

  const handleConfirmAssign = () => {
    if (selectedProductId && onAssignToExisting) {
      onAssignToExisting(selectedProductId, code);
    }
  };

  const unassignedProducts = products.filter(p => {
    const matchesSearch = !filterSearch || 
      p.name.toLowerCase().includes(filterSearch.toLowerCase()) || 
      p.categoryName?.toLowerCase().includes(filterSearch.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-100 px-6 py-4 bg-amber-50/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-700 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">Product Not Found</h2>
              <p className="text-xs text-amber-800">Scanned barcode is not assigned to any item</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 hover:bg-amber-100 hover:text-gray-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Scanned Barcode</p>
            <div className="bg-slate-900 text-emerald-400 font-mono text-xl font-black py-3 px-5 rounded-2xl tracking-widest inline-block shadow-inner border border-slate-700">
              {code}
            </div>
            <p className="text-xs text-gray-600 max-w-md mx-auto">
              This barcode is not currently in your active inventory. Select how you would like to handle it:
            </p>
          </div>

          {!showAssignView ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {/* Option A: Search Catalog Manually */}
              <button
                type="button"
                onClick={handleManualSearch}
                className="p-4 rounded-2xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/50 flex flex-col items-center text-center transition-all group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-emerald-100 text-gray-700 group-hover:text-emerald-700 flex items-center justify-center mb-2 transition-colors">
                  <Search className="w-5 h-5" />
                </div>
                <span className="text-xs font-black text-gray-900 mb-1">Search Catalog</span>
                <span className="text-[11px] text-gray-500">Find the product manually</span>
              </button>

              {/* Option B: Create New Product */}
              <button
                type="button"
                onClick={handleCreateNew}
                className="p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50/40 hover:bg-emerald-100/60 flex flex-col items-center text-center transition-all group cursor-pointer shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-2 shadow-xs">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="text-xs font-black text-emerald-900 mb-1">Add New Item</span>
                <span className="text-[11px] text-emerald-700 font-medium">Create with this barcode</span>
              </button>

              {/* Option C: Assign to Existing Product */}
              <button
                type="button"
                onClick={() => setShowAssignView(true)}
                disabled={products.length === 0}
                className="p-4 rounded-2xl border-2 border-gray-200 hover:border-slate-800 hover:bg-gray-50 flex flex-col items-center text-center transition-all group cursor-pointer disabled:opacity-40"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-slate-200 text-gray-700 group-hover:text-slate-900 flex items-center justify-center mb-2 transition-colors">
                  <Link className="w-5 h-5" />
                </div>
                <span className="text-xs font-black text-gray-900 mb-1">Assign to Existing</span>
                <span className="text-[11px] text-gray-500">Attach to current product</span>
              </button>
            </div>
          ) : (
            /* Assign to Existing Product View */
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">Select product to receive this barcode:</span>
                <button
                  type="button"
                  onClick={() => setShowAssignView(false)}
                  className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                >
                  ← Back to options
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Type to filter existing items..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-gray-200 rounded-xl p-2 bg-gray-50">
                {unassignedProducts.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No matching products found</p>
                ) : (
                  unassignedProducts.map(p => {
                    const isSelected = selectedProductId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedProductId(p.id)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-emerald-100 border-emerald-500 text-emerald-950 font-bold shadow-xs'
                            : 'bg-white border-gray-200 hover:bg-gray-100/80 text-gray-800'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <Package className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs font-bold">{p.name}</p>
                            <p className="text-[10px] text-gray-500">{p.categoryName} • Stock: {p.currentStock}</p>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignView(false)}
                  className="px-3.5 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!selectedProductId}
                  onClick={handleConfirmAssign}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  Confirm & Assign Barcode
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            Cancel (ESC)
          </button>
        </div>
      </div>
    </div>
  );
}
