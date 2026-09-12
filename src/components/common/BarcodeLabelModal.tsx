import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../../types';
import { BarcodeFormat, generateAutoBarcode, renderBarcodeSvg, validateBarcode } from '../../lib/barcodeUtils';
import { formatCurrency } from '../../lib/utils';
import { Printer, X, RefreshCw, Check, AlertCircle, Copy } from 'lucide-react';

interface BarcodeLabelModalProps {
  product: Product;
  currency: string;
  businessName?: string;
  onClose: () => void;
  onUpdateBarcode?: (newBarcode: string, format: string) => Promise<void>;
}

export function BarcodeLabelModal({ product, currency, businessName, onClose, onUpdateBarcode }: BarcodeLabelModalProps) {
  const [format, setFormat] = useState<BarcodeFormat>(
    (product.barcodeType as BarcodeFormat) || 'CODE128'
  );
  const [barcodeValue, setBarcodeValue] = useState<string>(
    product.barcode != null && String(product.barcode).trim() ? String(product.barcode) : generateAutoBarcode('CODE128')
  );
  const [quantity, setQuantity] = useState<number>(10);
  const [labelSize, setLabelSize] = useState<'thermal' | 'grid2' | 'grid3'>('thermal');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const previewSvgRef = useRef<SVGSVGElement | null>(null);

  // Render preview whenever barcodeValue or format changes
  useEffect(() => {
    const valResult = validateBarcode(barcodeValue, format);
    if (!valResult.valid) {
      setValidationError(valResult.error || 'Invalid barcode');
      return;
    }
    setValidationError(null);

    if (previewSvgRef.current) {
      renderBarcodeSvg(previewSvgRef.current, barcodeValue, format, {
        height: 48,
        width: 1.8,
        fontSize: 12,
        displayValue: true
      });
    }
  }, [barcodeValue, format]);

  const handleGenerateNew = () => {
    const newCode = generateAutoBarcode(format);
    setBarcodeValue(newCode);
    setSavedSuccess(false);
  };

  const handleSaveToProduct = async () => {
    const valResult = validateBarcode(barcodeValue, format);
    if (!valResult.valid) {
      setValidationError(valResult.error || 'Invalid barcode');
      return;
    }

    if (onUpdateBarcode) {
      setSaving(true);
      try {
        await onUpdateBarcode(barcodeValue, format);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      } catch (err: any) {
        setValidationError(err.message || 'Failed to update barcode on product');
      } finally {
        setSaving(false);
      }
    }
  };

  const handlePrint = () => {
    // Generate printable window
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow popups to print barcode labels.');
      return;
    }

    // Render single label template SVG
    const svgHtml = previewSvgRef.current ? previewSvgRef.current.outerHTML : '';
    const formattedPrice = formatCurrency(product.sellingPrice, currency);

    let labelsHtml = '';
    for (let i = 0; i < quantity; i++) {
      labelsHtml += `
        <div class="barcode-label">
          <div class="product-title">${product.name}</div>
          <div class="barcode-img">${svgHtml}</div>
          <div class="price-row">
            <span class="price-tag">${formattedPrice}</span>
            <span class="unit-tag">${product.unitType || 'Unit'}</span>
          </div>
        </div>
      `;
    }

    const gridClass = labelSize === 'thermal' ? 'layout-thermal' : labelSize === 'grid2' ? 'layout-grid2' : 'layout-grid3';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcode Labels - ${product.name}</title>
          <style>
            @page {
              margin: 4mm;
              size: auto;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              margin: 0;
              padding: 6px;
              color: #000;
              background: #fff;
            }
            .labels-container {
              display: flex;
              flex-wrap: wrap;
              gap: 6px;
              justify-content: flex-start;
            }
            .layout-thermal .barcode-label {
              width: 50mm;
              height: 30mm;
              page-break-inside: avoid;
              border: 1px dashed #ccc;
              box-sizing: border-box;
              padding: 4px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              text-align: center;
              margin-bottom: 4px;
            }
            .layout-grid2 .barcode-label {
              width: 47%;
              border: 1px dashed #ddd;
              box-sizing: border-box;
              padding: 6px;
              display: flex;
              flex-direction: column;
              align-items: center;
              margin-bottom: 6px;
              page-break-inside: avoid;
            }
            .layout-grid3 .barcode-label {
              width: 31%;
              border: 1px dashed #ddd;
              box-sizing: border-box;
              padding: 6px;
              display: flex;
              flex-direction: column;
              align-items: center;
              margin-bottom: 6px;
              page-break-inside: avoid;
            }
            .product-title {
              font-size: 11px;
              font-weight: 700;
              line-height: 1.1;
              max-height: 24px;
              overflow: hidden;
              text-overflow: ellipsis;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              text-align: center;
              margin-bottom: 2px;
            }
            .barcode-img svg {
              width: 100%;
              max-width: 170px;
              height: auto;
              max-height: 48px;
            }
            .price-row {
              width: 100%;
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 0 4px;
              margin-top: 2px;
            }
            .price-tag {
              font-size: 13px;
              font-weight: 900;
              letter-spacing: -0.5px;
            }
            .unit-tag {
              font-size: 9px;
              color: #555;
              text-transform: uppercase;
            }
            @media print {
              body { padding: 0; }
              .barcode-label { border: 1px solid transparent !important; }
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="labels-container ${gridClass}">
            ${labelsHtml}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Print Barcode Labels</h2>
              <p className="text-xs text-gray-500 truncate max-w-sm">{product.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Barcode Preview Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs flex flex-col items-center justify-center text-center">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Live Label Preview
            </p>
            <p className="text-sm font-bold text-gray-900 mb-2 max-w-md line-clamp-1">
              {product.name}
            </p>

            {validationError ? (
              <div className="flex items-center space-x-2 text-amber-700 bg-amber-50 px-3 py-2 rounded-lg text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            ) : (
              <div className="my-2 p-3 bg-white border border-gray-100 rounded-xl shadow-xs inline-block">
                <svg ref={previewSvgRef} className="mx-auto" />
              </div>
            )}

            <div className="mt-1 flex items-center justify-between w-full max-w-xs px-4 text-xs">
              <span className="font-bold text-emerald-700 text-base">
                {formatCurrency(product.sellingPrice, currency)}
              </span>
              <span className="text-gray-500 font-medium">
                Per {product.unitType || 'Unit'}
              </span>
            </div>
          </div>

          {/* Barcode Code & Format Configuration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Barcode Number & Symbology
              </label>
              <div className="flex items-center space-x-2 text-xs">
                <button
                  type="button"
                  onClick={() => setFormat('CODE128')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    format === 'CODE128' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Code 128
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('EAN13')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    format === 'EAN13' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  EAN-13
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('UPC')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    format === 'UPC' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  UPC-A
                </button>
              </div>
            </div>

            <div className="flex space-x-2">
              <input
                type="text"
                value={barcodeValue}
                onChange={(e) => {
                  setBarcodeValue(e.target.value);
                  setSavedSuccess(false);
                }}
                placeholder="Enter or scan barcode..."
                className="flex-1 font-mono rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
              <button
                type="button"
                onClick={handleGenerateNew}
                className="inline-flex items-center space-x-1.5 rounded-xl border border-gray-300 bg-gray-50 px-3.5 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition active:scale-95"
                title="Auto-generate valid barcode"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Auto Generate</span>
              </button>
            </div>

            {onUpdateBarcode && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-gray-500">
                  {barcodeValue !== product.barcode
                    ? 'Changes not yet saved to product database'
                    : 'Synced with product record'}
                </span>
                <button
                  type="button"
                  onClick={handleSaveToProduct}
                  disabled={saving || !!validationError}
                  className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
                >
                  {savedSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Saved to Product!</span>
                    </>
                  ) : (
                    <>
                      <span>{saving ? 'Saving...' : 'Save Barcode to Product'}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Printing Options */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Number of Copies
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
                <div className="flex space-x-1">
                  {[5, 10, 20].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuantity(q)}
                      className={`px-2 py-1.5 text-xs font-medium rounded-lg ${
                        quantity === q ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Label Layout Format
              </label>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as any)}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-sm bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              >
                <option value="thermal">50mm × 30mm (Thermal Sticker)</option>
                <option value="grid2">2-Column Sheet</option>
                <option value="grid3">3-Column A4 Sheet</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={!!validationError}
            className="inline-flex items-center space-x-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Print {quantity} Label{quantity > 1 ? 's' : ''}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
