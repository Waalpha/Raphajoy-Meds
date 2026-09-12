export type UserRole = 'admin' | 'cashier';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  businessId: string;
  status: 'active' | 'disabled' | 'deleted';
  createdAt: string;
}

export interface BusinessConfig {
  id: string;
  name: string;
  logoUrl?: string;
  phone: string;
  location: string;
  address: string;
  currency: string; // e.g. "KSh"
  openingTime: string;
  closingTime: string;
  lowStockThreshold: number;
  receiptHeader?: string;
  receiptFooter?: string;
  tillNumber?: string;
  allowNegativeStock?: boolean;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  barcode?: string;
  barcodeType?: 'CODE128' | 'EAN13' | 'UPC' | string;
  unitType: 'Bottle' | 'Can' | 'Glass' | 'Crate' | 'Piece' | 'Shot' | 'Packet' | 'Night' | 'Plate' | 'Cup' | 'Session' | string;
  buyingPrice?: number;
  sellingPrice: number;
  openingStock: number;
  currentStock: number;
  stockAdded: number; // accumulated added stock during day
  minStockLevel: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export type PaymentMethod = 'Cash' | 'M-Pesa' | 'Card' | 'Other' | 'Order Ticket (Unpaid)';

export interface Sale {
  id: string;
  items: SaleItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  amountTendered?: number;
  change?: number;
  referenceCode?: string;
  cashierId: string;
  cashierName: string;
  businessDayId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  createdAt: number; // timestamp millis
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  previousStock: number;
  addedQty: number;
  newStock: number;
  date: string;
  time: string;
  adminId: string;
  adminName: string;
  reason: string;
  createdAt: number;
}

export interface BusinessDay {
  id: string; // YYYY-MM-DD
  date: string;
  openingTime: string;
  closingTime: string;
  openedBy: string;
  closedBy?: string;
  status: 'open' | 'closed';
  createdAt: number;
}

export interface ClosingItem {
  productId: string;
  productName: string;
  expected: number;
  actual: number;
  variance: number; // actual - expected
}

export interface DailyClosing {
  id: string;
  businessDayId: string;
  date: string;
  cashierId: string;
  cashierName: string;
  items: ClosingItem[];
  totalSales: number;
  paymentTotals: {
    Cash: number;
    'M-Pesa': number;
    Card: number;
    Other: number;
  };
  totalTransactions: number;
  totalItemsSold: number;
  notes?: string;
  submittedAt: number;
  status: 'submitted' | 'reviewed';
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  date: string;
  time: string;
  recordId?: string;
  description: string;
  createdAt: number;
}
