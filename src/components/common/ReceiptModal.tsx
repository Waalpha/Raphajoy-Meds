import React, { useState } from 'react';
import { Sale, BusinessConfig } from '../../types';
import { X, CheckCircle2, Printer, AlertCircle } from 'lucide-react';
import { ThermalReceipt } from '../../printer/ThermalReceipt';
import { thermalPrinterService } from '../../printer/ThermalPrinterService';

interface ReceiptModalProps {
  sale: Sale;
  businessConfig?: BusinessConfig | null;
  onClose: () => void;
}

export function ReceiptModal({ sale, businessConfig, onClose }: ReceiptModalProps) {
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleThermalPrint = async () => {
    setPrinting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const state = thermalPrinterService.getState();
      if (state.status !== 'connected') {
        await thermalPrinterService.connect();
      }
      await thermalPrinterService.printSale(sale, businessConfig);
      setSuccessMsg('Receipt printed successfully via direct thermal driver!');
    } catch (err: any) {
      console.warn('Direct thermal print failed, falling back to browser print:', err);
      try {
        window.print();
        setSuccessMsg('Opened browser print dialog.');
      } catch (printErr: any) {
        setError(printErr.message || err.message || 'Printing failed');
      }
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all max-h-[90vh] overflow-y-auto">
        {/* Header Actions */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
          <div className="flex items-center space-x-2 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
            <span className="font-semibold text-gray-900">Sale Recorded Successfully</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center space-x-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">
            {successMsg}
          </div>
        )}

        {/* Thermal Receipt Preview */}
        <div className="flex justify-center my-4">
          <ThermalReceipt sale={sale} businessConfig={businessConfig} />
        </div>

        {/* Modal Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-100">
          <button
            onClick={handleThermalPrint}
            disabled={printing}
            className="flex flex-1 items-center justify-center space-x-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-sm font-bold text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            <span>{printing ? 'Printing...' : 'Print Thermal Receipt'}</span>
          </button>

          <button
            onClick={onClose}
            className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
