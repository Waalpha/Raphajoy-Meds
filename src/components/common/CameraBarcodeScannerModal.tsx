import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, AlertCircle, RefreshCw, Zap, CheckCircle2 } from 'lucide-react';
import { playScanBeep } from '../../lib/barcodeUtils';

interface CameraBarcodeScannerModalProps {
  onScan: (scannedBarcode: string) => void;
  onClose: () => void;
  isOpen?: boolean;
}

export function CameraBarcodeScannerModal({ onScan, onClose, isOpen = true }: CameraBarcodeScannerModalProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'pos-camera-barcode-reader';

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsInitializing(true);
    setErrorMsg(null);
    setScannedCode(null);

    const formatsToSupport = [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.DATA_MATRIX,
    ];

    const initScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode(readerElementId, {
          formatsToSupport,
          verbose: false
        });
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 280, height: 160 },
            aspectRatio: 1.333
          },
          (decodedText) => {
            if (!isMounted) return;
            const code = decodedText.trim();
            if (code) {
              setScannedCode(code);
              playScanBeep(true);
              // Stop camera and pass result
              if (html5QrCode.isScanning) {
                html5QrCode.stop().then(() => {
                  html5QrCode.clear();
                  onScan(code);
                }).catch(() => {
                  onScan(code);
                });
              } else {
                onScan(code);
              }
            }
          },
          () => {
            // Frame search callback (normal frame-by-frame polling)
          }
        );

        if (isMounted) {
          setIsInitializing(false);
          // Check if torch / flashlight is supported
          try {
            const capabilities = html5QrCode.getRunningTrackCapabilities();
            if (capabilities && (capabilities as any).torch) {
              setHasTorch(true);
            }
          } catch (e) {
            // Torch check optional
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        setIsInitializing(false);
        const strErr = String(err?.message || err || '');
        if (strErr.toLowerCase().includes('permission') || strErr.toLowerCase().includes('denied')) {
          setErrorMsg('Camera access was denied. Please allow camera permissions in your browser or device settings.');
        } else if (strErr.toLowerCase().includes('notfound') || strErr.toLowerCase().includes('device')) {
          setErrorMsg('No camera found on this device. You can use a USB or Bluetooth barcode scanner, or manual barcode entry.');
        } else {
          setErrorMsg(`Unable to open camera: ${strErr || 'Unknown camera error'}`);
        }
      }
    };

    // Small delay to allow modal DOM render
    const timer = setTimeout(() => {
      initScanner();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(() => {});
          } else {
            scannerRef.current.clear();
          }
        } catch (e) {}
      }
    };
  }, [isOpen]);

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any]
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  const handleManualRetry = () => {
    setErrorMsg(null);
    setIsInitializing(true);
    // Trigger unmount / remount effect via state or simple reload
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 text-white shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Camera Barcode Scanner</h2>
              <p className="text-xs text-slate-400">Align barcode inside the target box</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Scanner Container */}
        <div className="relative bg-black min-h-[300px] flex items-center justify-center overflow-hidden">
          <div id={readerElementId} className="w-full h-full" />

          {/* Aiming Reticle Overlay (when active) */}
          {!errorMsg && !isInitializing && !scannedCode && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[280px] h-[150px] border-2 border-emerald-400 rounded-xl relative shadow-lg shadow-emerald-500/10">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl-sm"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr-sm"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl-sm"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br-sm"></div>
                {/* Center red laser scanner line */}
                <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse" />
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isInitializing && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-sm font-medium text-slate-300">Requesting camera access...</p>
              <p className="text-xs text-slate-500">Please tap &ldquo;Allow&rdquo; if prompted by your browser</p>
            </div>
          )}

          {/* Scanned Feedback Overlay */}
          {scannedCode && (
            <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center p-6 text-center space-y-2 animate-in zoom-in-95">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              <p className="text-base font-bold text-white">Barcode Scanned!</p>
              <p className="text-sm font-mono text-emerald-300 bg-emerald-900/60 px-3 py-1 rounded-lg">
                {scannedCode}
              </p>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-500" />
              <h3 className="text-sm font-bold text-white">Camera Unavailable</h3>
              <p className="text-xs text-slate-400 max-w-xs">{errorMsg}</p>
              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-5 py-3.5 bg-slate-950 flex items-center justify-between border-t border-slate-800">
          <div className="flex items-center space-x-2">
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                  torchOn
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{torchOn ? 'Torch ON' : 'Torch'}</span>
              </button>
            )}
            <span className="text-[11px] text-slate-400">Supports Code 128, EAN, UPC, QR</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
          >
            Cancel (ESC)
          </button>
        </div>
      </div>
    </div>
  );
}
