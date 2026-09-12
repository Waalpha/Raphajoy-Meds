import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, BusinessConfig, Product, SaleItem, Sale, PaymentMethod } from '../../types';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { formatCurrency, logAuditAction } from '../../lib/utils';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Banknote,
  Smartphone,
  CircleDollarSign,
  ArrowLeft,
  X,
  Printer,
  Barcode,
  Camera,
  Volume2,
  Sparkles,
  Zap,
  Keyboard,
  RefreshCw,
  Check
} from 'lucide-react';
import { ReceiptModal } from '../common/ReceiptModal';
import { CameraBarcodeScannerModal } from '../common/CameraBarcodeScannerModal';
import { UnknownBarcodeModal } from '../common/UnknownBarcodeModal';
import { playAudioBeep } from '../../lib/barcodeUtils';
import {
  saveSaleLocallyAndQueue,
  cacheLocalProducts,
  getLocalCachedProducts,
  cacheLocalCategories,
  getLocalCachedCategories,
  syncOfflineQueue
} from '../../lib/offlineManager';

interface RecordSaleViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
}

export function RecordSaleView({ user, businessConfig }: RecordSaleViewProps) {
  const businessId = user.businessId || DEFAULT_BUSINESS_ID;
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<SaleItem[]>([]);
  
  // Barcode Scanning State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanMode, setScanMode] = useState<'barcode' | 'search'>('barcode');
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [lastScannedProductId, setLastScannedProductId] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);
  
  // Quick Product Create modal state (from unknown barcode)
  const [showQuickCreateModal, setShowQuickCreateModal] = useState(false);
  const [quickCreateBarcode, setQuickCreateBarcode] = useState('');
  const [quickCreateName, setQuickCreateName] = useState('');
  const [quickCreatePrice, setQuickCreatePrice] = useState('');
  const [quickCreateStock, setQuickCreateStock] = useState('50');
  const [quickCreateCategory, setQuickCreateCategory] = useState('');

  // Refs for auto-focus & hardware scanning
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const tenderedInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Payment states
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [amountTendered, setAmountTendered] = useState<string>('');
  const [referenceCode, setReferenceCode] = useState<string>('');
  const [mobileView, setMobileView] = useState<'catalog' | 'payment'>('catalog');
  
  // Custom item modal state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successSale, setSuccessSale] = useState<Sale | null>(null);
  const [orderReceiptSale, setOrderReceiptSale] = useState<Sale | null>(null);
  const [openTabs, setOpenTabs] = useState<Sale[]>([]);
  const [showOpenTabsModal, setShowOpenTabsModal] = useState(false);

  // Automatically focus the barcode input when POS opens
  useEffect(() => {
    const timer = setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard Shortcuts (F2, F4, ESC) & Global USB/Bluetooth HID Barcode listener
  useEffect(() => {
    let scanBuffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Shortcut: F2 focuses Barcode/Search Input
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
        return;
      }

      // Shortcut: F4 switches to Payment and focuses Tendered amount
      if (e.key === 'F4') {
        e.preventDefault();
        setMobileView('payment');
        setTimeout(() => {
          tenderedInputRef.current?.focus();
          tenderedInputRef.current?.select();
        }, 100);
        return;
      }

      // Shortcut: ESC closes modals
      if (e.key === 'Escape') {
        if (showCameraScanner) setShowCameraScanner(false);
        if (unknownBarcode) setUnknownBarcode(null);
        if (showQuickCreateModal) setShowQuickCreateModal(false);
        if (showCustomModal) setShowCustomModal(false);
        if (showOpenTabsModal) setShowOpenTabsModal(false);
        return;
      }

      // Check if user is typing in another regular text field
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputActive = activeTag === 'input' || activeTag === 'textarea';
      const isBarcodeInput = document.activeElement === barcodeInputRef.current;

      // If typing in another input (like custom name or tendered amount), do not intercept
      if (isInputActive && !isBarcodeInput) {
        return;
      }

      // Hardware Barcode Scanner detection via rapid key sequence (< 60ms between characters)
      const now = Date.now();
      if (now - lastKeyTime > 75) {
        scanBuffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (scanBuffer.length >= 3) {
          e.preventDefault();
          processBarcodeScan(scanBuffer.trim());
          scanBuffer = '';
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        scanBuffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, cart, showCameraScanner, unknownBarcode, showQuickCreateModal]);

  useEffect(() => {
    try {
      const tabs = JSON.parse(localStorage.getItem('bar_pos_open_tabs') || '[]');
      setOpenTabs(tabs);
    } catch (e) {}
  }, []);

  const saveToOpenTabs = (orderSale: Sale) => {
    try {
      const tabs = JSON.parse(localStorage.getItem('bar_pos_open_tabs') || '[]');
      const filtered = tabs.filter((t: Sale) => t.id !== orderSale.id);
      filtered.unshift(orderSale);
      localStorage.setItem('bar_pos_open_tabs', JSON.stringify(filtered));
      setOpenTabs(filtered);
    } catch (e) {}
  };

  const removeOpenTab = (orderId: string) => {
    try {
      const tabs = JSON.parse(localStorage.getItem('bar_pos_open_tabs') || '[]');
      const filtered = tabs.filter((t: Sale) => t.id !== orderId);
      localStorage.setItem('bar_pos_open_tabs', JSON.stringify(filtered));
      setOpenTabs(filtered);
    } catch (e) {}
  };

  const resumeOpenTab = (tab: Sale) => {
    setCart(tab.items);
    removeOpenTab(tab.id);
    setShowOpenTabsModal(false);
  };

  const handlePrintOrderReceipt = () => {
    if (cart.length === 0) {
      setError('Cart is empty. Please select items to print order receipt.');
      return;
    }
    const now = new Date();
    const orderSale: Sale = {
      id: 'order-' + Date.now(),
      items: [...cart],
      totalAmount: totalCartAmount,
      paymentMethod: 'Order Ticket (Unpaid)',
      amountTendered: 0,
      change: 0,
      cashierId: user.uid,
      cashierName: user.name,
      businessDayId: now.toISOString().split('T')[0],
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0],
      createdAt: now.getTime()
    };
    saveToOpenTabs(orderSale);
    setOrderReceiptSale(orderSale);
  };

  useEffect(() => {
    fetchProductsAndCategories();
  }, []);

  async function fetchProductsAndCategories() {
    // 1. Instant load from offline cache
    const cachedProds = getLocalCachedProducts();
    if (cachedProds.length > 0) {
      setProducts(cachedProds);
    }
    const cachedCats = getLocalCachedCategories();
    if (cachedCats.length > 0) {
      setCategories(cachedCats);
    }

    // 2. Only fetch fresh from Firestore if actively online
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    try {
      const prodRef = collection(db, 'businesses', businessId, 'products');
      const prodSnap = await getDocs(prodRef);
      const prods: Product[] = [];
      prodSnap.forEach(d => {
        prods.push({ id: d.id, ...d.data() } as Product);
      });
      if (prods.length > 0) {
        setProducts(prods);
        cacheLocalProducts(prods);
      }

      const catRef = collection(db, 'businesses', businessId, 'categories');
      const catSnap = await getDocs(catRef);
      const cats: { id: string; name: string }[] = [];
      catSnap.forEach(d => {
        cats.push({ id: d.id, name: d.data().name });
      });
      if (cats.length > 0) {
        setCategories(cats);
        cacheLocalCategories(cats);
      }
    } catch (err) {
      console.warn("Using local cached catalog:", err);
    }
  }

  const addToCart = (product: Product, delta: number = 1): boolean => {
    setError('');
    const existingIndex = cart.findIndex(item => item.productId === product.id);
    const currentQtyInCart = existingIndex >= 0 ? cart[existingIndex].quantity : 0;
    const requestedQty = currentQtyInCart + delta;

    // Check stock availability
    if (delta > 0 && product.currentStock !== undefined && requestedQty > product.currentStock) {
      playAudioBeep('error');
      setError(`Insufficient stock for "${product.name}". Available: ${product.currentStock}, In Cart: ${currentQtyInCart}`);
      return false;
    }

    if (requestedQty <= 0) {
      if (existingIndex >= 0) {
        const newCart = [...cart];
        newCart.splice(existingIndex, 1);
        setCart(newCart);
      }
      return true;
    }

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity = requestedQty;
      newCart[existingIndex].totalAmount = requestedQty * product.sellingPrice;
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          productName: product.name,
          barcode: product.barcode,
          quantity: 1,
          unitPrice: product.sellingPrice,
          totalAmount: product.sellingPrice
        }
      ]);
    }
    return true;
  };

  // Process Barcode Scan (from Hardware Scanner, Camera, or Manual Entry)
  const processBarcodeScan = (scannedCode: string) => {
    const code = scannedCode != null ? String(scannedCode).trim() : '';
    if (!code) return;

    // Search tenant products by Barcode or fallback ID
    const product = products.find(p =>
      p.barcode && String(p.barcode).trim().toLowerCase() === code.toLowerCase()
    ) || products.find(p => p.id.toLowerCase() === code.toLowerCase());

    if (!product) {
      playAudioBeep('error');
      setUnknownBarcode(code);
      setScanFeedback({
        type: 'error',
        message: `Barcode "${code}" not found in catalog.`
      });
      return;
    }

    // Check if out of stock
    if (product.currentStock !== undefined && product.currentStock <= 0) {
      playAudioBeep('error');
      setScanFeedback({
        type: 'error',
        message: `Out of Stock: "${product.name}" has 0 stock remaining!`
      });
      return;
    }

    const inCart = cart.find(i => i.productId === product.id);
    const curQty = inCart ? inCart.quantity : 0;
    if (product.currentStock !== undefined && curQty + 1 > product.currentStock) {
      playAudioBeep('error');
      setScanFeedback({
        type: 'warning',
        message: `Stock limit reached: only ${product.currentStock} units available for "${product.name}".`
      });
      return;
    }

    // Add to cart or increase quantity
    const added = addToCart(product, 1);
    if (added) {
      playAudioBeep('success');
      setLastScannedProductId(product.id);
      setScanFeedback({
        type: 'success',
        message: `Scanned & Added: "${product.name}" (${formatCurrency(product.sellingPrice, currency)})`
      });

      // Clear scan highlight after 2.5 seconds
      setTimeout(() => {
        setLastScannedProductId(null);
      }, 2500);

      // Clear feedback message after 3.5 seconds
      setTimeout(() => {
        setScanFeedback(null);
      }, 3500);

      // Re-focus barcode input for rapid continuous scanning
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 50);
    }
  };

  const handleBarcodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    processBarcodeScan(code);
    setBarcodeInput('');
  };

  // Quick-Assign Barcode to an Existing Product
  const handleAssignBarcodeToProduct = async (productId: string, barcodeToAssign: string) => {
    try {
      const prodRef = doc(db, 'businesses', businessId, 'products', productId);
      await updateDoc(prodRef, {
        barcode: barcodeToAssign,
        barcodeType: 'CODE128',
        updatedAt: new Date().toISOString()
      });

      const updated = products.map(p =>
        p.id === productId ? { ...p, barcode: barcodeToAssign, barcodeType: 'CODE128' as const } : p
      );
      setProducts(updated);
      cacheLocalProducts(updated);

      const target = updated.find(p => p.id === productId);
      if (target) {
        addToCart(target, 1);
        playAudioBeep('success');
        setScanFeedback({
          type: 'success',
          message: `Barcode assigned to "${target.name}" and added to cart!`
        });
      }
      setUnknownBarcode(null);
    } catch (err) {
      console.error("Failed to assign barcode:", err);
      // Local fallback
      const updated = products.map(p =>
        p.id === productId ? { ...p, barcode: barcodeToAssign } : p
      );
      setProducts(updated);
      cacheLocalProducts(updated);
      const target = updated.find(p => p.id === productId);
      if (target) {
        addToCart(target, 1);
        playAudioBeep('success');
      }
      setUnknownBarcode(null);
    }
  };

  // Quick Create Product with Scanned Barcode
  const handleQuickCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(quickCreatePrice);
    if (!quickCreateName.trim() || isNaN(priceNum) || priceNum <= 0) {
      setError('Please enter a valid product name and selling price.');
      return;
    }

    try {
      const newId = 'prod-' + Date.now();
      const cat = categories.find(c => c.id === quickCreateCategory) || categories[0];
      const stockNum = parseInt(quickCreateStock) || 50;

      const newProd: Product = {
        id: newId,
        name: quickCreateName.trim(),
        barcode: quickCreateBarcode.trim(),
        barcodeType: 'CODE128',
        categoryId: cat?.id || 'cat-general',
        categoryName: cat?.name || 'General',
        unitType: 'Pack',
        buyingPrice: Math.round(priceNum * 0.7),
        sellingPrice: priceNum,
        openingStock: stockNum,
        currentStock: stockNum,
        stockAdded: 0,
        minStockLevel: 10,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'businesses', businessId, 'products', newId), newProd);
      } catch (err) {
        console.warn("Firestore save deferred:", err);
      }

      const updated = [newProd, ...products];
      setProducts(updated);
      cacheLocalProducts(updated);

      addToCart(newProd, 1);
      playAudioBeep('success');
      setShowQuickCreateModal(false);
      setQuickCreateBarcode('');
      setQuickCreateName('');
      setQuickCreatePrice('');
      setScanFeedback({
        type: 'success',
        message: `Created "${newProd.name}" and added to cart!`
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create product');
    }
  };

  const updateCartQty = (productId: string, newQty: number) => {
    setError('');
    if (newQty <= 0) {
      setCart(cart.filter(item => item.productId !== productId));
      return;
    }

    setCart(cart.map(item => {
      if (item.productId === productId) {
        return {
          ...item,
          quantity: newQty,
          totalAmount: newQty * item.unitPrice
        };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(customPrice);
    if (!customName.trim() || isNaN(price) || price <= 0) {
      setError('Please provide a valid item name and price.');
      return;
    }

    const qty = customQty > 0 ? customQty : 1;
    const customItem: SaleItem = {
      productId: 'custom-' + Date.now(),
      productName: customName.trim(),
      quantity: qty,
      unitPrice: price,
      totalAmount: qty * price
    };

    setCart([...cart, customItem]);
    setShowCustomModal(false);
    setCustomName('');
    setCustomPrice('');
    setCustomQty(1);
    setError('');
  };

  const totalCartAmount = cart.reduce((sum, item) => sum + item.totalAmount, 0);

  // Auto-fill tendered amount with exact cart total if empty or less than total
  useEffect(() => {
    if (!amountTendered || parseFloat(amountTendered) < totalCartAmount) {
      if (totalCartAmount > 0) {
        setAmountTendered(totalCartAmount.toString());
      }
    }
  }, [totalCartAmount]);

  const handleRecordSale = () => {
    if (cart.length === 0) {
      setError('Cart is empty. Please select products to record sale.');
      return;
    }

    // Strict validation: amount received/tendered cannot be less than total bill amount
    const tenderedNum = amountTendered ? parseFloat(amountTendered) : 0;
    if (isNaN(tenderedNum) || tenderedNum < totalCartAmount) {
      setError(`Amount received (${formatCurrency(tenderedNum, currency)}) is less than total bill (${formatCurrency(totalCartAmount, currency)}). Please collect full payment of at least ${formatCurrency(totalCartAmount, currency)}.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const now = new Date();
      const saleId = 'sale-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      const parsedTendered = amountTendered ? parseFloat(amountTendered) : totalCartAmount;
      const changeDue = Math.max(0, parsedTendered - totalCartAmount);

      const completedSale: Sale = {
        id: saleId,
        items: [...cart],
        totalAmount: totalCartAmount,
        paymentMethod,
        amountTendered: parsedTendered,
        change: changeDue,
        referenceCode: referenceCode.trim() || undefined,
        cashierId: user.uid,
        cashierName: user.name,
        businessDayId: todayStr,
        date: todayStr,
        time: now.toTimeString().split(' ')[0],
        createdAt: now.getTime()
      };

      // 1. Instantly persist locally & queue for sync (ensures 100% offline-first reliability)
      saveSaleLocallyAndQueue(completedSale, businessId);

      // 2. Immediately update in-memory products state with deducted stock so UI reflects sold units
      const updatedLocalProds = getLocalCachedProducts();
      if (updatedLocalProds.length > 0) {
        setProducts(updatedLocalProds);
      }

      // 3. Immediately display receipt modal & reset cart - zero delay for customer!
      setSuccessSale(completedSale);
      setCart([]);
      setAmountTendered('');
      setReferenceCode('');
      setMobileView('catalog');

      // 4. Background non-blocking audit log & Firestore sync if online
      logAuditAction(
        user.uid,
        user.name,
        'SALE_RECORDED',
        `Recorded sale of ${formatCurrency(totalCartAmount, currency)} via ${paymentMethod} (${cart.length} items)`,
        saleId
      ).catch(() => {});

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        syncOfflineQueue(businessId).catch((syncErr) => {
          console.warn('Background sync deferred:', syncErr);
        });
      }
    } catch (err: any) {
      console.error("Sale recording failed:", err);
      setError(err.message || 'Failed to complete transaction.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.categoryName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const currency = businessConfig?.currency || 'KSh';
  const cartItemCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const parsedTendered = amountTendered ? parseFloat(amountTendered) : 0;
  const changeDue = Math.max(0, parsedTendered - totalCartAmount);
  const balanceRemaining = Math.max(0, totalCartAmount - parsedTendered);

  return (
    <div className="space-y-4 pb-28 lg:pb-6">
      {/* ================= PROMINENT POS BARCODE SCANNING & SEARCH STATION ================= */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-3.5 sm:p-4 text-white shadow-lg border border-slate-700/80">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Mode Selector & Status Indicators */}
          <div className="flex items-center justify-between lg:justify-start gap-2.5">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                <Barcode className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black tracking-wide text-white uppercase">
                    {scanMode === 'barcode' ? 'Barcode Scan Station' : 'Manual Catalog Search'}
                  </span>
                  <span className="flex items-center text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5"></span>
                    Scanner Ready
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  Auto-adds to cart via USB / Bluetooth scanner, camera or typing
                </p>
              </div>
            </div>

            {/* Mode Switch Toggle */}
            <div className="flex bg-slate-950/80 rounded-xl p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setScanMode('barcode');
                  setTimeout(() => barcodeInputRef.current?.focus(), 50);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                  scanMode === 'barcode'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Barcode className="w-3.5 h-3.5" />
                <span>Barcode</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanMode('search');
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                  scanMode === 'search'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </button>
            </div>
          </div>

          {/* Center Input Box */}
          <div className="flex-1 max-w-2xl">
            {scanMode === 'barcode' ? (
              <form onSubmit={handleBarcodeSubmit} className="relative flex items-center">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400">
                  <Barcode className="w-5 h-5" />
                </div>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan barcode (USB/Bluetooth) or type & press Enter..."
                  className="w-full pl-11 pr-24 py-2.5 rounded-xl bg-slate-950 border-2 border-emerald-500/70 focus:border-emerald-400 text-sm font-mono font-bold text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition-all shadow-inner"
                  autoComplete="off"
                />
                <div className="absolute inset-y-0 right-1.5 flex items-center space-x-1">
                  {barcodeInput && (
                    <button
                      type="button"
                      onClick={() => setBarcodeInput('')}
                      className="p-1 rounded-md text-slate-400 hover:text-white"
                      title="Clear"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    Scan
                  </button>
                </div>
              </form>
            ) : (
              <div className="relative flex items-center">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400">
                  <Search className="w-5 h-5" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search medicines, vitamins or supplies..."
                  className="w-full pl-11 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-emerald-400 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Action: Camera Scanner + Shortcuts */}
          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCameraScanner(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-600 text-xs font-bold transition-all flex items-center space-x-2 shadow-xs cursor-pointer"
              title="Open device camera to scan barcodes"
            >
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>Camera Scanner</span>
            </button>

            <div className="hidden xl:flex items-center space-x-1.5 text-[11px] text-slate-400 bg-slate-950/60 px-2.5 py-1.5 rounded-xl border border-slate-800">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-bold border border-slate-700">F2</kbd>
              <span>Scan</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-bold border border-slate-700 ml-1">F4</kbd>
              <span>Pay</span>
            </div>
          </div>
        </div>

        {/* Real-time Scan Notification Alert */}
        {scanFeedback && (
          <div className={`mt-3 py-2 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
            scanFeedback.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
              : scanFeedback.type === 'warning'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
              : 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-xs'
          }`}>
            <div className="flex items-center space-x-2">
              {scanFeedback.type === 'success' && <Check className="w-4 h-4 text-emerald-400" />}
              {scanFeedback.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-400" />}
              {scanFeedback.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
              <span>{scanFeedback.message}</span>
            </div>
            <button
              onClick={() => setScanFeedback(null)}
              className="p-1 hover:opacity-75 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Mobile Top Segment Switcher (Catalog vs Cart & Payment) */}
      <div className="lg:hidden flex rounded-2xl bg-slate-900 p-1.5 shadow-md sticky top-16 z-30">
        <button
          onClick={() => setMobileView('catalog')}
          className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl flex items-center justify-center space-x-2 transition-all ${
            mobileView === 'catalog'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <span>📋 Catalog ({filteredProducts.length})</span>
        </button>
        <button
          onClick={() => setMobileView('payment')}
          className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all ${
            mobileView === 'payment'
              ? 'bg-emerald-500 text-slate-950 shadow-md ring-2 ring-emerald-400'
              : 'text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30'
          }`}
        >
          <CreditCard className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>Payment & Cart</span>
          <span className="ml-1 bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
            {cartItemCount} | {formatCurrency(totalCartAmount, currency)}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Product Catalog & Search (Visible on desktop or when mobileView === 'catalog') */}
        <div className={`lg:col-span-7 space-y-4 ${mobileView === 'payment' ? 'hidden lg:block' : 'block'}`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter catalog by medicine name, barcode or category..."
                className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 shadow-xs"
              />
            </div>

            {/* Open Tabs Button */}
            <button
              type="button"
              onClick={() => setShowOpenTabsModal(true)}
              className="px-4 py-3 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 whitespace-nowrap transition-all flex items-center space-x-2 shadow-xs cursor-pointer"
            >
              <span>📂 Open Tabs</span>
              <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[11px] font-black">{openTabs.length}</span>
            </button>

            <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none items-center">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                All Items
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
              <button
                onClick={() => setShowCustomModal(true)}
                className="px-3 py-2.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 whitespace-nowrap transition-all flex items-center space-x-1"
                title="Add custom item not in catalog"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Custom</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center space-x-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[calc(100vh-230px)] overflow-y-auto pr-1">
            {filteredProducts.map(product => {
              const inCart = cart.find(i => i.productId === product.id);
              const isOutOfStock = product.currentStock <= 0;

              return (
                <div
                  key={product.id}
                  className={`rounded-2xl border p-4 bg-white shadow-xs flex flex-col justify-between transition-all ${
                    isOutOfStock ? 'border-emerald-200/80 bg-emerald-50/10' : 'border-gray-200 hover:border-emerald-500 hover:shadow-md'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 mb-1">
                          {product.categoryName}
                        </span>
                        <h4 className="font-bold text-gray-900 text-base">{product.name}</h4>
                      </div>
                      <span className="text-sm font-extrabold text-emerald-700">
                        {formatCurrency(product.sellingPrice, currency)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className={`font-semibold ${isOutOfStock ? 'text-emerald-700' : product.currentStock <= product.minStockLevel ? 'text-emerald-600' : 'text-emerald-600'}`}>
                        Available: {product.currentStock} {product.unitType}s
                        {isOutOfStock && <span className="ml-1 text-[10px] text-emerald-600 font-normal">(Tap to sell)</span>}
                      </span>
                      {inCart && (
                        <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                          In Cart: {inCart.quantity}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => addToCart(product, -1)}
                        disabled={!inCart}
                        className="w-9 h-9 rounded-xl border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-100 disabled:opacity-30 active:scale-95 transition-all font-bold"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-bold text-sm text-gray-900">
                        {inCart ? inCart.quantity : 0}
                      </span>
                      <button
                        onClick={() => addToCart(product, 1)}
                        className="w-9 h-9 rounded-xl border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-100 active:scale-95 transition-all font-bold"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      onClick={() => addToCart(product, 1)}
                      className="rounded-xl bg-slate-900 hover:bg-emerald-600 text-white px-4 py-2 text-xs font-bold shadow-xs active:scale-95 transition-all"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Cart AND Prominent "WHERE TO PUT PAYMENT" (Visible on desktop or when mobileView === 'payment') */}
        <div className={`lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 shadow-md border border-gray-200 flex flex-col justify-between space-y-4 ${mobileView === 'catalog' ? 'hidden lg:flex' : 'flex'}`}>
          <div>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2">
                {mobileView === 'payment' && (
                  <button
                    onClick={() => setMobileView('catalog')}
                    className="lg:hidden p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all flex items-center"
                    title="Back to Catalog"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    <span className="text-xs font-bold">Catalog</span>
                  </button>
                )}
                <h3 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-600" />
                  <span>Current Cart</span>
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowCustomModal(true)}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-xl border border-emerald-200 transition-all flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Custom Item</span>
                </button>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900">
                  {cartItemCount} items
                </span>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="my-3 max-h-52 overflow-y-auto space-y-2 pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30 text-gray-400" />
                  <p className="text-xs font-bold text-gray-600">Cart is empty</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Select drinks from the catalog or add a custom item</p>
                  <button
                    onClick={() => setMobileView('catalog')}
                    className="lg:hidden mt-2 text-xs font-bold text-emerald-600 underline"
                  >
                    Open Drinks Catalog
                  </button>
                </div>
              ) : (
                cart.map((item) => {
                  const isJustScanned = lastScannedProductId === item.productId;
                  return (
                    <div
                      key={item.productId}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                        isJustScanned
                          ? 'bg-emerald-100/90 border-emerald-500 ring-2 ring-emerald-400 scale-[1.01] shadow-xs'
                          : 'bg-gray-50 border-gray-100 hover:bg-gray-100/60'
                      }`}
                    >
                      <div className="flex-1 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h5 className="font-semibold text-gray-900 text-xs sm:text-sm">{item.productName}</h5>
                          {item.barcode && (
                            <span className="inline-flex items-center text-[10px] font-mono text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded font-semibold border border-emerald-200">
                              #{item.barcode}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500">{formatCurrency(item.unitPrice, currency)} each</p>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <div className="flex items-center space-x-1 border border-gray-300 rounded-lg bg-white px-1 py-0.5">
                          <button
                            onClick={() => updateCartQty(item.productId, item.quantity - 1)}
                            className="p-1 text-gray-600 hover:text-red-600"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateCartQty(item.productId, parseInt(e.target.value) || 0)}
                            className="w-8 text-center font-bold text-xs focus:outline-none"
                          />
                          <button
                            onClick={() => updateCartQty(item.productId, item.quantity + 1)}
                            className="p-1 text-gray-600 hover:text-emerald-600"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="font-extrabold text-xs sm:text-sm text-gray-900 w-16 text-right">
                          {formatCurrency(item.totalAmount, currency)}
                        </span>

                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ================= PAYMENT SECTION (WHERE TO PUT PAYMENT) ================= */}
          <div className="border-t-2 border-emerald-300 bg-slate-900 text-white -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4 sm:p-5 rounded-b-3xl space-y-4 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-black">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    Where to Put Payment
                  </h4>
                  <p className="text-[11px] text-slate-400">Select payment method & enter amount</p>
                </div>
              </div>
              <span className="text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full">
                Step 2
              </span>
            </div>

            {/* Total Bill Card */}
            <div className="bg-slate-800 border border-slate-700 p-3 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total Bill to Collect</p>
                <p className="text-2xl font-black text-emerald-400">{formatCurrency(totalCartAmount, currency)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-300">{cartItemCount} item{cartItemCount === 1 ? '' : 's'}</p>
                <p className="text-[10px] text-emerald-400 font-semibold">Ready for Tender</p>
              </div>
            </div>

            {/* 1. Payment Method Buttons */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                1. Select Payment Method:
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'Cash', label: 'Cash', icon: Banknote },
                  { id: 'M-Pesa', label: 'M-Pesa', icon: Smartphone },
                  { id: 'Card', label: 'Card', icon: CreditCard },
                  { id: 'Other', label: 'Other', icon: CircleDollarSign }
                ].map(m => {
                  const Icon = m.icon;
                  const isSelected = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(m.id as PaymentMethod);
                        if (m.id === 'Cash' && (!amountTendered || amountTendered === '0')) {
                          setAmountTendered(totalCartAmount > 0 ? totalCartAmount.toString() : '');
                        }
                      }}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-md ring-2 ring-emerald-300/40 scale-102'
                          : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      <Icon className="w-4 h-4 mb-0.5" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Amount Tendered / Received Input (Always available to record money paid) */}
            <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-2xl space-y-2.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-emerald-300">
                    2. Enter Amount Received / Tendered:
                  </label>
                  <span className="text-[10px] text-slate-400">Record customer money paid</span>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center font-bold text-emerald-400 text-sm">
                    {currency}
                  </span>
                  <input
                    ref={tenderedInputRef}
                    type="number"
                    min="0"
                    step="any"
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                    placeholder={totalCartAmount > 0 ? totalCartAmount.toString() : '0.00'}
                    className="w-full pl-13 pr-14 py-2.5 rounded-xl border-2 border-emerald-500 bg-slate-900 text-xl font-black text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  {amountTendered && (
                    <button
                      type="button"
                      onClick={() => setAmountTendered('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-bold text-slate-400 hover:text-slate-200"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Cash Presets */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setAmountTendered(totalCartAmount.toString())}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-emerald-600 text-white border border-slate-600"
                >
                  Exact ({formatCurrency(totalCartAmount, currency)})
                </button>
                {[500, 1000, 2000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmountTendered(val.toString())}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-emerald-600 text-white border border-slate-600"
                  >
                    {val}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const current = parseFloat(amountTendered) || 0;
                    setAmountTendered((current + 100).toString());
                  }}
                  className="text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40"
                >
                  +100
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const current = parseFloat(amountTendered) || 0;
                    setAmountTendered((current + 500).toString());
                  }}
                  className="text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40"
                >
                  +500
                </button>
              </div>

              {/* Live Change Calculation */}
              {amountTendered && parsedTendered >= totalCartAmount && (
                <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wide">
                    Change to Return:
                  </span>
                  <span className="text-lg font-black text-emerald-400">
                    {formatCurrency(changeDue, currency)}
                  </span>
                </div>
              )}

              {amountTendered && parsedTendered > 0 && parsedTendered < totalCartAmount && (
                <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/60 flex items-center justify-between">
                  <span className="text-xs font-bold text-red-300 uppercase tracking-wide">
                    Balance Remaining:
                  </span>
                  <span className="text-base font-black text-red-400">
                    {formatCurrency(balanceRemaining, currency)}
                  </span>
                </div>
              )}
            </div>

            {paymentMethod === 'M-Pesa' && (
              <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-2xl space-y-2">
                <label className="block text-xs font-bold text-emerald-300">
                  2. Enter M-Pesa Confirmation Code or Customer Phone:
                </label>
                <input
                  type="text"
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  placeholder="e.g. QBC91823 or 0712345678"
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-emerald-500 bg-slate-900 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <p className="text-[10px] text-slate-400">
                  Customer confirms M-Pesa payment to your till/paybill.
                </p>
              </div>
            )}

            {(paymentMethod === 'Card' || paymentMethod === 'Other') && (
              <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-2xl space-y-2">
                <label className="block text-xs font-bold text-emerald-300">
                  2. Reference / Slip Code (Optional):
                </label>
                <input
                  type="text"
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  placeholder="e.g. POS Slip Approval #4892"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-600 bg-slate-900 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Print Order Receipt (KOT) Button */}
            <button
              type="button"
              onClick={handlePrintOrderReceipt}
              disabled={cart.length === 0}
              className="w-full rounded-2xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 py-3 text-xs sm:text-sm font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>PRINT ORDER RECEIPT (KOT)</span>
            </button>

            {/* Complete Payment Button */}
            <button
              onClick={handleRecordSale}
              disabled={loading || cart.length === 0}
              className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] py-3.5 text-sm sm:text-base font-black text-slate-950 shadow-xl shadow-emerald-500/20 transition-all disabled:opacity-50 uppercase tracking-wide flex items-center justify-center space-x-2 cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5 text-slate-950" />
              <span>
                {loading ? 'Processing Transaction...' : `COMPLETE PAYMENT (${formatCurrency(totalCartAmount, currency)})`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bottom Sticky Bar for Mobile (Always visible on mobile to jump directly to Payment) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 p-3 px-4 flex items-center justify-between shadow-2xl">
        <div>
          <p className="text-[11px] text-slate-400 font-medium">
            {cartItemCount} item{cartItemCount === 1 ? '' : 's'} in cart
          </p>
          <p className="text-lg font-black text-emerald-400">
            {formatCurrency(totalCartAmount, currency)}
          </p>
        </div>
        <button
          onClick={() => setMobileView(mobileView === 'catalog' ? 'payment' : 'catalog')}
          className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black px-4 py-2.5 rounded-xl shadow-lg transition-all text-xs sm:text-sm uppercase tracking-wide"
        >
          <CreditCard className="w-4 h-4" />
          <span>{mobileView === 'catalog' ? 'PUT PAYMENT ➔' : 'BACK TO CATALOG'}</span>
        </button>
      </div>

      {/* Custom Item Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="text-base font-bold text-gray-900">Add Custom Drink / Item</h4>
              <button
                onClick={() => setShowCustomModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomItem} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Item Description</label>
                <input
                  type="text"
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Cocktail, Special Shot, Snack"
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Price ({currency})</label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder="250"
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={customQty}
                    onChange={(e) => setCustomQty(parseInt(e.target.value) || 1)}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-xs font-bold text-white shadow-md transition-all uppercase"
                >
                  Add to Cart
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="flex-1 rounded-xl border border-gray-300 py-3 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Receipt Modal */}
      {successSale && (
        <ReceiptModal
          sale={successSale}
          businessConfig={businessConfig}
          onClose={() => setSuccessSale(null)}
        />
      )}

      {/* Order Receipt / KOT Modal */}
      {orderReceiptSale && (
        <ReceiptModal
          sale={orderReceiptSale}
          businessConfig={businessConfig}
          onClose={() => setOrderReceiptSale(null)}
        />
      )}

      {/* Open Unpaid Order Tabs Modal */}
      {showOpenTabsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl space-y-4 text-slate-900 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center space-x-2">
                <span>📂 Open Unpaid Order Tabs ({openTabs.length})</span>
              </h3>
              <button onClick={() => setShowOpenTabsModal(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-600">Unpaid orders that were printed or saved. Click Resume to load them back into the active cart.</p>
            {openTabs.length === 0 ? (
              <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-sm font-semibold">No open unpaid tabs</p>
                <p className="text-xs text-gray-400 mt-1">Printed order receipts and saved unpaid tabs will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {openTabs.map(tab => (
                  <div key={tab.id} className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-gray-900 text-sm">#{tab.id.slice(-6).toUpperCase()}</span>
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">{tab.date} {tab.time}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 font-medium">
                        {tab.items.length} item{tab.items.length === 1 ? '' : 's'} ({tab.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')})
                      </p>
                      <p className="text-xs font-bold text-emerald-800 mt-1">Total: {formatCurrency(tab.totalAmount, currency)}</p>
                    </div>
                    <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => resumeOpenTab(tab)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                      >
                        Resume Order ➔
                      </button>
                      <button
                        type="button"
                        onClick={() => removeOpenTab(tab.id)}
                        className="px-3 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold transition-all cursor-pointer"
                        title="Delete Tab"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowOpenTabsModal(false)}
              className="w-full py-3 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner Modal */}
      {showCameraScanner && (
        <CameraBarcodeScannerModal
          onScan={(code) => {
            processBarcodeScan(code);
            setShowCameraScanner(false);
          }}
          onClose={() => setShowCameraScanner(false)}
        />
      )}

      {/* Unknown Barcode Modal */}
      {unknownBarcode && (
        <UnknownBarcodeModal
          scannedBarcode={unknownBarcode}
          products={products}
          onClose={() => setUnknownBarcode(null)}
          onSearchManual={() => {
            setScanMode('search');
            setSearchQuery(unknownBarcode);
            setUnknownBarcode(null);
            setTimeout(() => searchInputRef.current?.focus(), 100);
          }}
          onAssignToExisting={(productId, code) => {
            handleAssignBarcodeToProduct(productId, code);
          }}
          onCreateNew={(code) => {
            setQuickCreateBarcode(code);
            setQuickCreateName('');
            setQuickCreatePrice('');
            setQuickCreateStock('50');
            setQuickCreateCategory(categories[0]?.id || '');
            setUnknownBarcode(null);
            setShowQuickCreateModal(true);
          }}
        />
      )}

      {/* Quick Add Product with Scanned Barcode Modal */}
      {showQuickCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Quick-Add Product</h3>
                  <p className="text-xs text-gray-500">Create item and add directly to cart</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickCreateModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateProduct} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Pre-filled Barcode</label>
                <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 border border-gray-300 rounded-xl font-mono text-xs font-bold text-gray-800">
                  <Barcode className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{quickCreateBarcode}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Medicine / Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Panadol Extra 500mg (16s)"
                  value={quickCreateName}
                  onChange={(e) => setQuickCreateName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Selling Price ({currency}) *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    placeholder="e.g. 150"
                    value={quickCreatePrice}
                    onChange={(e) => setQuickCreatePrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-black focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Initial Stock Qty</label>
                  <input
                    type="number"
                    min="0"
                    value={quickCreateStock}
                    onChange={(e) => setQuickCreateStock(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {categories.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                  <select
                    value={quickCreateCategory}
                    onChange={(e) => setQuickCreateCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowQuickCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Save & Add to Cart
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
