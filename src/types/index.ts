export type PaymentMethodType = 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Mixto' | 'Mercado Pago' | 'CLIP';

export interface BusinessSettings {
  name: string;
  legalName: string;
  owner: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  rfc: string;
  logo: string; // Base64 or URL
  receiptMessage: string;
  currency: string;
  taxRate: number; // Percentage
  applyTax: boolean; // Whether to apply tax to sales
  acceptedPaymentMethods: PaymentMethodType[];
  backupFrequency?: 'never' | 'weekly' | 'biweekly' | 'monthly';
  lastBackupDate?: string;
  weekStartDay?: number; // 0 for Sunday, 1 for Monday, etc.
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  supplier: string;
  barcode: string;
  purchasePrice: number;
  salePrice: number;
  tracksInventory: boolean;
  stock: number;
  minStock: number;
  image: string; // Base64 or URL
  warranty?: string; // Optional warranty information
}

export interface CartItem extends Product {
  cartId: string;
  quantity: number;
  discount: number; // Percentage or fixed amount
}

export interface SuspendedSale {
  id: string;
  name: string;
  date: string;
  items: CartItem[];
  customerId: string;
}

export interface Sale {
  id: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethodType;
  cashReceived?: number;
  change?: number;
  commission?: number;
  commissionPayer?: 'cliente' | 'vendedor';
  term?: string; // e.g., 'Contado', '3 MSI'
  customerId?: string;
  customerName?: string;
}

export interface CashMovement {
  id: string;
  type: 'withdrawal' | 'extra_income';
  amount: number;
  description: string;
  notes?: string;
  date: string;
  paymentMethod?: PaymentMethodType;
}

export interface CashRegister {
  id: string;
  openedAt: string;
  closedAt?: string;
  initialAmount: number;
  salesTotal: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  mercadoPagoSales: number;
  clipSales: number;
  withdrawals: number;
  extraIncome: number;
  expectedCash: number;
  actualCash?: number;
  difference?: number;
  status: 'open' | 'closed';
  movements?: CashMovement[];
}

export interface User {
  id: string;
  name: string;
  role: 'Administrador' | 'Cajero' | 'Supervisor';
  pin: string;
}

export type MovementType = 'entrada' | 'salida' | 'ajuste' | 'venta';

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  type: MovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  date: string;
  userId: string;
  userName: string;
  notes?: string;
}

export interface RemissionItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Remission {
  id: string;
  folio: string;
  date: string;
  customerName: string;
  items: RemissionItem[];
  total: number;
  notes?: string;
}

export interface License {
  status: 'trial' | 'active' | 'expired' | 'blocked' | 'none';
  trialStartDate?: string;
  trialEndDate?: string;
  activatedAt?: string;
  machineId: string;
  isTrialUsed: boolean;
  cloudEmail?: string;
}
