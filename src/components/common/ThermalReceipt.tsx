import React from 'react';
import { Sale, BusinessConfig } from '../../types';
import { formatCurrency } from '../../lib/utils';

interface ThermalReceiptProps {
  sale: Sale;
  businessConfig?: BusinessConfig | null;
}

export function ThermalReceipt({ sale, businessConfig }: ThermalReceiptProps) {
  const currency = businessConfig?.currency || 'KSh';
  const businessName = businessConfig?.name || 'Raphajoy Chemist & Pharmacy';
  const address = businessConfig?.address || 'Main Street, Nairobi';
  const phone = businessConfig?.phone || '+254 722 000 111';
  const footer = businessConfig?.receiptFooter || 'Get Well Soon! Thank you for choosing Raphajoy.';

  const subtotal = sale.totalAmount;

  return (
    <div className="thermal-receipt-container w-[58mm] max-w-[58mm] bg-white text-black font-mono text-[11px] leading-tight p-2 mx-auto shadow-sm rounded-lg border border-gray-200">
      <div className="text-center space-y-0.5 mb-2">
        <h1 className="text-xs font-bold uppercase tracking-wider">{businessName}</h1>
        <p className="text-[10px] text-gray-600">{address}</p>
        <p className="text-[10px] text-gray-600">Tel: {phone}</p>
      </div>

      <div className="border-t border-dashed border-gray-400 pt-1.5 mb-2 text-[10px] space-y-0.5">
        <div className="flex justify-between">
          <span className="text-gray-600">Receipt:</span>
          <span className="font-bold">#{sale.id.slice(-8).toUpperCase()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Date:</span>
          <span>{sale.date} {sale.time}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Cashier:</span>
          <span>{sale.cashierName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Payment:</span>
          <span className="font-bold text-emerald-700">{sale.paymentMethod}</span>
        </div>
        {sale.referenceCode && (
          <div className="flex justify-between">
            <span className="text-gray-600">Ref Code:</span>
            <span className="font-mono">{sale.referenceCode}</span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-gray-400 pt-1.5 mb-2">
        <table className="w-full text-left text-[10px]">
          <thead>
            <tr className="border-b border-gray-400 pb-0.5 text-gray-600">
              <th className="font-normal pb-0.5">Item</th>
              <th className="text-center font-normal pb-0.5">Qty</th>
              <th className="text-right font-normal pb-0.5">Price</th>
              <th className="text-right font-normal pb-0.5">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dotted divide-gray-200">
            {sale.items.map((item, idx) => (
              <tr key={idx} className="py-1">
                <td className="pr-1 font-sans font-medium text-gray-900 truncate max-w-[20mm]">{item.productName}</td>
                <td className="text-center">{item.quantity}</td>
                <td className="text-right">{item.unitPrice}</td>
                <td className="text-right font-bold">{item.totalAmount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-dashed border-gray-400 pt-1.5 space-y-0.5 text-[10px] font-sans">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal:</span>
          <span>{formatCurrency(subtotal, currency)}</span>
        </div>
        <div className="flex justify-between text-xs font-bold text-gray-900 pt-1 border-t border-gray-300">
          <span>TOTAL:</span>
          <span>{formatCurrency(sale.totalAmount, currency)}</span>
        </div>
        {sale.amountTendered !== undefined && sale.amountTendered > 0 && (
          <div className="flex justify-between text-gray-600 pt-0.5">
            <span>Amount Paid:</span>
            <span>{formatCurrency(sale.amountTendered, currency)}</span>
          </div>
        )}
        {sale.change !== undefined && sale.change > 0 && (
          <div className="flex justify-between font-semibold text-emerald-700">
            <span>Change:</span>
            <span>{formatCurrency(sale.change, currency)}</span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-gray-400 pt-3 mt-3 text-center text-[10px] text-gray-500 space-y-0.5">
        <p className="font-medium text-gray-700">You were served by: {sale.cashierName || 'Cashier'}</p>
        <p className="font-medium text-gray-700">{footer}</p>
        <p className="text-[9px]">Thermal Receipt 58mm</p>
      </div>
    </div>
  );
}
