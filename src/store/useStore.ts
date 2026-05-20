import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BusinessSettings, Product, CartItem, Sale, CashRegister, User, InventoryMovement, Customer, Supplier, Remission, License, PaymentMethodType, CashMovement, SuspendedSale } from '../types';

import { type User as FirebaseUser } from 'firebase/auth';

interface AppState {
  settings: BusinessSettings;
  products: Product[];
  sales: Sale[];
  suspendedSales: SuspendedSale[];
  remissions: Remission[];
  cashRegisters: CashRegister[];
  users: User[];
  customers: Customer[];
  suppliers: Supplier[];
  currentUser: User | null;
  cart: CartItem[];
  theme: 'light' | 'dark';
  inventoryMovements: InventoryMovement[];
  license: License;
  
  firebaseUser: FirebaseUser | null;
  setFirebaseUser: (user: FirebaseUser | null) => void;
  // Dashboard Visibility State
  dashboardVisibility: {
    weekSales: boolean;
    netProfit: boolean;
    monthSales: boolean;
    todaySales: boolean;
    productCost: boolean;
  };
  
  // Actions
  updateSettings: (settings: Partial<BusinessSettings>) => void;
  toggleDashboardVisibility: (key: keyof AppState['dashboardVisibility']) => void;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addToCart: (product: Product, quantity?: number) => void;
  updateCartItem: (cartId: string, quantity: number, discount?: number) => void;
  removeFromCart: (cartId: string) => void;
  clearCart: () => void;
  processSale: (sale: Sale) => void;
  deleteSale: (saleId: string) => void;
  returnSale: (saleId: string) => void;
  loadSaleIntoCart: (saleId: string) => void;
  suspendCart: (name: string, customerId: string) => void;
  resumeCart: (suspendedSaleId: string) => void;
  deleteSuspendedSale: (suspendedSaleId: string) => void;
  addRemission: (remission: Remission) => void;
  deleteRemission: (id: string) => void;
  openRegister: (initialAmount: number) => void;
  closeRegister: (actualCash: number) => void;
  addWithdrawal: (amount: number, description: string, notes?: string) => void;
  addExtraIncome: (amount: number, description: string, notes?: string, paymentMethod?: PaymentMethodType) => void;
  deleteMovement: (id: string) => void;
  editMovement: (id: string, amount: number, description: string, notes?: string, paymentMethod?: PaymentMethodType) => void;
  login: (pin: string) => boolean;
  logout: () => void;
  toggleTheme: () => void;
  addInventoryMovement: (movement: Omit<InventoryMovement, 'id' | 'date'>) => void;
  addCustomer: (customer: Omit<Customer, 'id'>) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addSupplier: (supplier: Omit<Supplier, 'id'>) => void;
  updateSupplier: (id: string, supplier: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (id: string, user: Partial<User>) => void;
  deleteUser: (id: string) => void;
  clearDatabase: () => void;
  
  // License Actions
  activateTrial: () => { success: boolean; message: string };
  activateCloudLicense: (email: string) => void;
  checkLicense: () => void;
  regenerateMachineId: () => void;
}

const generateMachineId = () => {
  const stored = localStorage.getItem('machine_id');
  if (stored && stored.includes('-')) return stored;
  
  // Create a unique ID
  const randomPart1 = Math.random().toString(36).substring(2, 8).toUpperCase().padEnd(6, '0');
  const randomPart2 = Math.random().toString(36).substring(2, 8).toUpperCase().padEnd(6, '0');
  const newId = `${randomPart1}-${randomPart2}`;
  
  localStorage.setItem('machine_id', newId);
  return newId;
};

export const defaultSettings: BusinessSettings = {
  name: 'EliteCaja',
  legalName: '',
  owner: '',
  address: '',
  phone: '',
  whatsapp: '',
  email: '',
  rfc: '',
  logo: '',
  receiptMessage: '¡Gracias por su compra!',
  currency: 'MXN',
  taxRate: 16,
  applyTax: false,
  acceptedPaymentMethods: ['Efectivo', 'Tarjeta', 'Transferencia', 'Mixto', 'Mercado Pago', 'CLIP'],
  backupFrequency: 'never',
  lastBackupDate: '',
  weekStartDay: 1, // Default to Monday
};

const defaultUser: User = {
  id: '1',
  name: 'Admin',
  role: 'Administrador',
  pin: '1234',
};

const defaultProducts: Product[] = [];

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      products: defaultProducts,
      customers: [],
      suppliers: [],
      sales: [],
      suspendedSales: [],
      remissions: [],
      cashRegisters: [],
      users: [defaultUser],
      currentUser: null, // Default to null to force login/license check
      cart: [],
      theme: 'light',
      firebaseUser: null,
      inventoryMovements: [],
      license: {
        status: 'none',
        machineId: generateMachineId(),
        isTrialUsed: false
      },
      dashboardVisibility: {
        weekSales: true,
        netProfit: true,
        monthSales: true,
        todaySales: true,
        productCost: true,
      },

      setFirebaseUser: (user) => set({ firebaseUser: user }),

      toggleDashboardVisibility: (key) => set((state) => {
        const currentVisibility = state.dashboardVisibility || {
          weekSales: true,
          netProfit: true,
          monthSales: true,
          todaySales: true,
          productCost: true,
        };
        return {
          dashboardVisibility: {
            ...currentVisibility,
            [key]: !currentVisibility[key]
          }
        };
      }),

      addInventoryMovement: (movement) => set((state) => ({
        inventoryMovements: [
          {
            ...movement,
            id: Math.random().toString(36).substr(2, 9),
            date: new Date().toISOString(),
          },
          ...state.inventoryMovements,
        ],
      })),

      addCustomer: (customer) => set((state) => ({
        customers: [...state.customers, { ...customer, id: Math.random().toString(36).substr(2, 9) }],
      })),

      updateCustomer: (id, updatedCustomer) => set((state) => ({
        customers: state.customers.map((c) => (c.id === id ? { ...c, ...updatedCustomer } : c)),
      })),

      deleteCustomer: (id) => set((state) => ({
        customers: state.customers.filter((c) => c.id !== id),
      })),

      addSupplier: (supplier) => set((state) => ({
        suppliers: [...state.suppliers, { ...supplier, id: Math.random().toString(36).substr(2, 9) }],
      })),

      updateSupplier: (id, updatedSupplier) => set((state) => ({
        suppliers: state.suppliers.map((s) => (s.id === id ? { ...s, ...updatedSupplier } : s)),
      })),

      deleteSupplier: (id) => set((state) => ({
        suppliers: state.suppliers.filter((s) => s.id !== id),
      })),

      addUser: (user) => set((state) => ({
        users: [...state.users, { ...user, id: Math.random().toString(36).substr(2, 9) }],
      })),

      updateUser: (id, updatedUser) => set((state) => ({
        users: state.users.map((u) => (u.id === id ? { ...u, ...updatedUser } : u)),
        currentUser: state.currentUser && state.currentUser.id === id ? { ...state.currentUser, ...updatedUser } : state.currentUser,
      })),

      deleteUser: (id) => set((state) => ({
        users: state.users.filter((u) => u.id !== id),
      })),

      updateSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),
      
      addProduct: (product) => set((state) => {
        const newState = { products: [...state.products, product] } as Partial<AppState>;
        
        if (product.tracksInventory && product.stock > 0 && state.currentUser) {
          newState.inventoryMovements = [
            {
              id: Math.random().toString(36).substr(2, 9),
              productId: product.id,
              productName: product.name,
              type: 'entrada',
              quantity: product.stock,
              previousStock: 0,
              newStock: product.stock,
              date: new Date().toISOString(),
              userId: state.currentUser.id,
              userName: state.currentUser.name,
              notes: 'Inventario inicial',
            },
            ...state.inventoryMovements,
          ];
        }
        
        return newState;
      }),
      
      updateProduct: (id, updatedProduct) => set((state) => {
        const oldProduct = state.products.find(p => p.id === id);
        const newState = {
          products: state.products.map((p) => (p.id === id ? { ...p, ...updatedProduct } : p)),
        } as Partial<AppState>;

        if (oldProduct && updatedProduct.stock !== undefined && oldProduct.stock !== updatedProduct.stock && state.currentUser) {
          const diff = updatedProduct.stock - oldProduct.stock;
          newState.inventoryMovements = [
            {
              id: Math.random().toString(36).substr(2, 9),
              productId: oldProduct.id,
              productName: oldProduct.name,
              type: 'ajuste',
              quantity: diff,
              previousStock: oldProduct.stock,
              newStock: updatedProduct.stock,
              date: new Date().toISOString(),
              userId: state.currentUser.id,
              userName: state.currentUser.name,
              notes: 'Ajuste manual',
            },
            ...state.inventoryMovements,
          ];
        }

        return newState;
      }),
      
      deleteProduct: (id) => set((state) => ({
        products: state.products.filter((p) => p.id !== id),
      })),

      addToCart: (product, quantity = 1) => set((state) => {
        const existingItem = state.cart.find((item) => item.id === product.id);
        if (existingItem) {
          return {
            cart: state.cart.map((item) =>
              item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
            ),
          };
        }
        return {
          cart: [...state.cart, { ...product, cartId: Math.random().toString(36).substr(2, 9), quantity, discount: 0 }],
        };
      }),

      updateCartItem: (cartId, quantity, discount) => set((state) => ({
        cart: state.cart.map((item) =>
          item.cartId === cartId ? { ...item, quantity, discount: discount !== undefined ? discount : item.discount } : item
        ),
      })),

      removeFromCart: (cartId) => set((state) => ({
        cart: state.cart.filter((item) => item.cartId !== cartId),
      })),

      clearCart: () => set({ cart: [] }),

      processSale: (newSale) => set((state) => {
        const newMovements: InventoryMovement[] = [];
        
        // Update inventory
        const updatedProducts = state.products.map((p) => {
          const cartItem = newSale.items.find((item) => item.id === p.id);
          if (cartItem && p.tracksInventory) {
            const newStock = p.stock - cartItem.quantity;
            
            if (state.currentUser) {
              newMovements.push({
                id: Math.random().toString(36).substr(2, 9),
                productId: p.id,
                productName: p.name,
                type: 'venta',
                quantity: -cartItem.quantity,
                previousStock: p.stock,
                newStock: newStock,
                date: new Date().toISOString(),
                userId: state.currentUser.id,
                userName: state.currentUser.name,
                notes: `Venta #${newSale.id}`,
              });
            }
            
            return { ...p, stock: newStock };
          }
          return p;
        });

        // Update current cash register
        const currentRegister = state.cashRegisters.find((r) => r.status === 'open');
        let updatedRegisters = state.cashRegisters;
        
        if (currentRegister) {
          const updatedRegister = { ...currentRegister };
          updatedRegister.salesTotal = (updatedRegister.salesTotal || 0) + newSale.total;
          
          // Update specific payment method totals
          if (newSale.paymentMethod === 'Mixto' && newSale.mixedPayments) {
            newSale.mixedPayments.forEach((mp) => {
              if (mp.method === 'Efectivo') updatedRegister.cashSales = (updatedRegister.cashSales || 0) + mp.amount;
              else if (mp.method === 'Tarjeta') updatedRegister.cardSales = (updatedRegister.cardSales || 0) + mp.amount;
              else if (mp.method === 'Transferencia') updatedRegister.transferSales = (updatedRegister.transferSales || 0) + mp.amount;
              else if (mp.method === 'Mercado Pago') updatedRegister.mercadoPagoSales = (updatedRegister.mercadoPagoSales || 0) + mp.amount;
              else if (mp.method === 'CLIP') updatedRegister.clipSales = (updatedRegister.clipSales || 0) + mp.amount;
            });
          } else {
            if (newSale.paymentMethod === 'Efectivo') updatedRegister.cashSales = (updatedRegister.cashSales || 0) + newSale.total;
            if (newSale.paymentMethod === 'Tarjeta') updatedRegister.cardSales = (updatedRegister.cardSales || 0) + newSale.total;
            if (newSale.paymentMethod === 'Transferencia') updatedRegister.transferSales = (updatedRegister.transferSales || 0) + newSale.total;
            if (newSale.paymentMethod === 'Mercado Pago') updatedRegister.mercadoPagoSales = (updatedRegister.mercadoPagoSales || 0) + newSale.total;
            if (newSale.paymentMethod === 'CLIP') updatedRegister.clipSales = (updatedRegister.clipSales || 0) + newSale.total;
          }
          
          const cashExtraIncome = (updatedRegister.movements || [])
            .filter(m => m.type === 'extra_income' && (m.paymentMethod === 'Efectivo' || !m.paymentMethod))
            .reduce((sum, m) => sum + m.amount, 0);
            
          updatedRegister.expectedCash = (updatedRegister.initialAmount || 0) + (updatedRegister.cashSales || 0) + cashExtraIncome - (updatedRegister.withdrawals || 0);
          
          updatedRegisters = state.cashRegisters.map((r) => r.id === currentRegister.id ? updatedRegister : r);
        }

        // Update customer points
        let updatedCustomers = state.customers;
        if (newSale.customerId) {
          const pointsEarned = newSale.pointsEarned || 0;
          const pointsUsed = newSale.pointsUsed || 0;
          updatedCustomers = state.customers.map(c => {
            if (c.id === newSale.customerId) {
              return { ...c, points: Math.max(0, (c.points || 0) + pointsEarned - pointsUsed) };
            }
            return c;
          });
        }

        return {
          sales: [...state.sales, newSale],
          products: updatedProducts,
          cart: [],
          cashRegisters: updatedRegisters,
          inventoryMovements: [...newMovements, ...state.inventoryMovements],
          customers: updatedCustomers,
        };
      }),

      deleteSale: (saleId) => set((state) => {
        const saleToDelete = state.sales.find((s) => s.id === saleId);
        if (!saleToDelete) return state;

        const newMovements: InventoryMovement[] = [];
        
        // Restore inventory
        const updatedProducts = state.products.map((p) => {
          const cartItem = saleToDelete.items.find((item) => item.id === p.id);
          if (cartItem && p.tracksInventory) {
            const newStock = p.stock + cartItem.quantity;
            
            if (state.currentUser) {
              newMovements.push({
                id: Math.random().toString(36).substr(2, 9),
                productId: p.id,
                productName: p.name,
                type: 'ajuste',
                quantity: cartItem.quantity,
                previousStock: p.stock,
                newStock: newStock,
                date: new Date().toISOString(),
                userId: state.currentUser.id,
                userName: state.currentUser.name,
                notes: `Cancelación de Venta #${saleToDelete.id}`,
              });
            }
            
            return { ...p, stock: newStock };
          }
          return p;
        });

        // Update current cash register if open
        const currentRegister = state.cashRegisters.find((r) => r.status === 'open');
        let updatedRegisters = state.cashRegisters;
        
        if (currentRegister) {
          const updatedRegister = { ...currentRegister };
          updatedRegister.salesTotal = (updatedRegister.salesTotal || 0) - saleToDelete.total;
          
          if (saleToDelete.paymentMethod === 'Mixto' && saleToDelete.mixedPayments) {
            saleToDelete.mixedPayments.forEach((mp) => {
              if (mp.method === 'Efectivo') updatedRegister.cashSales = (updatedRegister.cashSales || 0) - mp.amount;
              else if (mp.method === 'Tarjeta') updatedRegister.cardSales = (updatedRegister.cardSales || 0) - mp.amount;
              else if (mp.method === 'Transferencia') updatedRegister.transferSales = (updatedRegister.transferSales || 0) - mp.amount;
              else if (mp.method === 'Mercado Pago') updatedRegister.mercadoPagoSales = (updatedRegister.mercadoPagoSales || 0) - mp.amount;
              else if (mp.method === 'CLIP') updatedRegister.clipSales = (updatedRegister.clipSales || 0) - mp.amount;
            });
          } else {
            if (saleToDelete.paymentMethod === 'Efectivo') updatedRegister.cashSales = (updatedRegister.cashSales || 0) - saleToDelete.total;
            if (saleToDelete.paymentMethod === 'Tarjeta') updatedRegister.cardSales = (updatedRegister.cardSales || 0) - saleToDelete.total;
            if (saleToDelete.paymentMethod === 'Transferencia') updatedRegister.transferSales = (updatedRegister.transferSales || 0) - saleToDelete.total;
            if (saleToDelete.paymentMethod === 'Mercado Pago') updatedRegister.mercadoPagoSales = (updatedRegister.mercadoPagoSales || 0) - saleToDelete.total;
            if (saleToDelete.paymentMethod === 'CLIP') updatedRegister.clipSales = (updatedRegister.clipSales || 0) - saleToDelete.total;
          }
          
          const cashExtraIncome = (updatedRegister.movements || [])
            .filter(m => m.type === 'extra_income' && (m.paymentMethod === 'Efectivo' || !m.paymentMethod))
            .reduce((sum, m) => sum + m.amount, 0);
            
          updatedRegister.expectedCash = (updatedRegister.initialAmount || 0) + (updatedRegister.cashSales || 0) + cashExtraIncome - (updatedRegister.withdrawals || 0);
          
          updatedRegisters = state.cashRegisters.map((r) => r.id === currentRegister.id ? updatedRegister : r);
        }

        return {
          sales: state.sales.filter((s) => s.id !== saleId),
          products: updatedProducts,
          cashRegisters: updatedRegisters,
          inventoryMovements: [...newMovements, ...state.inventoryMovements],
        };
      }),

      returnSale: (saleId) => set((state) => {
        const originalSale = state.sales.find((s) => s.id === saleId);
        if (!originalSale) return state;

        if (originalSale.isReturn) return state; // Don't return a return
        
        // Prevent duplicate returns
        if (state.sales.some(s => s.returnedSaleId === saleId)) {
          alert('Esta venta ya ha sido devuelta parcialmente o en su totalidad.');
          return state;
        }

        const newMovements: InventoryMovement[] = [];
        
        // Restore inventory
        const updatedProducts = state.products.map((p) => {
          const cartItem = originalSale.items.find((item) => item.id === p.id);
          if (cartItem && p.tracksInventory) {
            const newStock = p.stock + cartItem.quantity;
            
            if (state.currentUser) {
              newMovements.push({
                id: Math.random().toString(36).substr(2, 9),
                productId: p.id,
                productName: p.name,
                type: 'ajuste',
                quantity: cartItem.quantity,
                previousStock: p.stock,
                newStock: newStock,
                date: new Date().toISOString(),
                userId: state.currentUser.id,
                userName: state.currentUser.name,
                notes: `Devolución de Venta #${originalSale.id}`,
              });
            }
            return { ...p, stock: newStock };
          }
          return p;
        });

        // Update current cash register if open
        const currentRegister = state.cashRegisters.find((r) => r.status === 'open');
        let updatedRegisters = state.cashRegisters;
        
        if (currentRegister) {
          const updatedRegister = { ...currentRegister };
          updatedRegister.salesTotal = (updatedRegister.salesTotal || 0) - originalSale.total;
          
          if (originalSale.paymentMethod === 'Mixto' && originalSale.mixedPayments) {
            originalSale.mixedPayments.forEach((mp) => {
              if (mp.method === 'Efectivo') updatedRegister.cashSales = (updatedRegister.cashSales || 0) - mp.amount;
              else if (mp.method === 'Tarjeta') updatedRegister.cardSales = (updatedRegister.cardSales || 0) - mp.amount;
              else if (mp.method === 'Transferencia') updatedRegister.transferSales = (updatedRegister.transferSales || 0) - mp.amount;
              else if (mp.method === 'Mercado Pago') updatedRegister.mercadoPagoSales = (updatedRegister.mercadoPagoSales || 0) - mp.amount;
              else if (mp.method === 'CLIP') updatedRegister.clipSales = (updatedRegister.clipSales || 0) - mp.amount;
            });
          } else {
            if (originalSale.paymentMethod === 'Efectivo') updatedRegister.cashSales = (updatedRegister.cashSales || 0) - originalSale.total;
            if (originalSale.paymentMethod === 'Tarjeta') updatedRegister.cardSales = (updatedRegister.cardSales || 0) - originalSale.total;
            if (originalSale.paymentMethod === 'Transferencia') updatedRegister.transferSales = (updatedRegister.transferSales || 0) - originalSale.total;
            if (originalSale.paymentMethod === 'Mercado Pago') updatedRegister.mercadoPagoSales = (updatedRegister.mercadoPagoSales || 0) - originalSale.total;
            if (originalSale.paymentMethod === 'CLIP') updatedRegister.clipSales = (updatedRegister.clipSales || 0) - originalSale.total;
          }
          
          const cashExtraIncome = (updatedRegister.movements || [])
            .filter(m => m.type === 'extra_income' && (m.paymentMethod === 'Efectivo' || !m.paymentMethod))
            .reduce((sum, m) => sum + m.amount, 0);
            
          updatedRegister.expectedCash = (updatedRegister.initialAmount || 0) + (updatedRegister.cashSales || 0) + cashExtraIncome - (updatedRegister.withdrawals || 0);
          
          updatedRegisters = state.cashRegisters.map((r) => r.id === currentRegister.id ? updatedRegister : r);
        }

        const returnSaleObj: Sale = {
          ...originalSale,
          id: Math.random().toString(36).substr(2, 9),
          date: new Date().toISOString(),
          subtotal: -originalSale.subtotal,
          tax: -originalSale.tax,
          total: -originalSale.total,
          isReturn: true,
          returnedSaleId: originalSale.id,
        };

        return {
          sales: [returnSaleObj, ...state.sales],
          products: updatedProducts,
          cashRegisters: updatedRegisters,
          inventoryMovements: [...newMovements, ...state.inventoryMovements],
        };
      }),

      loadSaleIntoCart: (saleId) => {
        const saleToLoad = get().sales.find((s) => s.id === saleId);
        if (!saleToLoad) return;

        // First, delete the sale to restore inventory and cash register
        get().deleteSale(saleId);

        // Then, set the cart to the items from the sale
        set({
          cart: saleToLoad.items.map(item => ({
            ...item,
            cartId: Math.random().toString(36).substr(2, 9)
          }))
        });
      },

      suspendCart: (name, customerId) => {
        const { cart } = get();
        if (cart.length === 0) return;

        const newSuspendedSale: SuspendedSale = {
          id: Math.random().toString(36).substr(2, 9),
          name,
          date: new Date().toISOString(),
          items: [...cart],
          customerId
        };

        set((state) => ({
          suspendedSales: [...state.suspendedSales, newSuspendedSale],
          cart: []
        }));
      },

      resumeCart: (suspendedSaleId) => {
        const saleToResume = get().suspendedSales.find((s) => s.id === suspendedSaleId);
        if (!saleToResume) return;

        set((state) => ({
          cart: [...saleToResume.items],
          suspendedSales: state.suspendedSales.filter(s => s.id !== suspendedSaleId)
        }));
      },

      deleteSuspendedSale: (suspendedSaleId) => {
        set((state) => ({
          suspendedSales: state.suspendedSales.filter((s) => s.id !== suspendedSaleId)
        }));
      },

      addRemission: (remission) => set((state) => ({
        remissions: [...state.remissions, remission],
      })),

      deleteRemission: (id) => set((state) => ({
        remissions: state.remissions.filter((r) => r.id !== id),
      })),

      openRegister: (initialAmount) => set((state) => {
        const newRegister: CashRegister = {
          id: Math.random().toString(36).substr(2, 9),
          openedAt: new Date().toISOString(),
          initialAmount,
          salesTotal: 0,
          cashSales: 0,
          cardSales: 0,
          transferSales: 0,
          mercadoPagoSales: 0,
          clipSales: 0,
          withdrawals: 0,
          extraIncome: 0,
          expectedCash: initialAmount,
          status: 'open',
        };
        return { cashRegisters: [...state.cashRegisters, newRegister] };
      }),

      closeRegister: (actualCash) => set((state) => {
        const currentRegister = state.cashRegisters.find((r) => r.status === 'open');
        if (!currentRegister) return state;

        const updatedRegister: CashRegister = {
          ...currentRegister,
          closedAt: new Date().toISOString(),
          actualCash,
          difference: actualCash - currentRegister.expectedCash,
          status: 'closed',
        };

        return {
          cashRegisters: state.cashRegisters.map((r) => r.id === currentRegister.id ? updatedRegister : r),
        };
      }),

      addWithdrawal: (amount, description, notes) => set((state) => {
        const currentRegister = state.cashRegisters.find((r) => r.status === 'open');
        if (!currentRegister) return state;

        const newMovement = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'withdrawal' as const,
          amount,
          description,
          notes,
          date: new Date().toISOString()
        };

        const updatedRegister = {
          ...currentRegister,
          withdrawals: currentRegister.withdrawals + amount,
          expectedCash: currentRegister.expectedCash - amount,
          movements: [...(currentRegister.movements || []), newMovement]
        };

        return {
          cashRegisters: state.cashRegisters.map((r) => r.id === currentRegister.id ? updatedRegister : r),
        };
      }),

      addExtraIncome: (amount, description, notes, paymentMethod = 'Efectivo') => set((state) => {
        const currentRegister = state.cashRegisters.find((r) => r.status === 'open');
        if (!currentRegister) return state;

        const newMovement: CashMovement = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'extra_income' as const,
          amount,
          description,
          notes,
          paymentMethod,
          date: new Date().toISOString()
        };

        const isCash = paymentMethod === 'Efectivo';

        const updatedRegister = {
          ...currentRegister,
          extraIncome: currentRegister.extraIncome + amount,
          expectedCash: currentRegister.expectedCash + (isCash ? amount : 0),
          movements: [...(currentRegister.movements || []), newMovement]
        };

        return {
          cashRegisters: state.cashRegisters.map((r) => r.id === currentRegister.id ? updatedRegister : r),
        };
      }),

      deleteMovement: (id) => set((state) => {
        let targetRegisterIndex = -1;
        let movementIndex = -1;

        for (let i = 0; i < state.cashRegisters.length; i++) {
          const register = state.cashRegisters[i];
          if (register.movements) {
            const idx = register.movements.findIndex(m => m.id === id);
            if (idx !== -1) {
              targetRegisterIndex = i;
              movementIndex = idx;
              break;
            }
          }
        }

        if (targetRegisterIndex === -1) return state;

        const targetRegister = state.cashRegisters[targetRegisterIndex];
        const movement = targetRegister.movements![movementIndex];

        const updatedRegister = { ...targetRegister };
        updatedRegister.movements = targetRegister.movements!.filter(m => m.id !== id);

        if (movement.type === 'withdrawal') {
          updatedRegister.withdrawals -= movement.amount;
          updatedRegister.expectedCash += movement.amount;
        } else if (movement.type === 'extra_income') {
          updatedRegister.extraIncome -= movement.amount;
          const isCash = movement.paymentMethod === 'Efectivo' || !movement.paymentMethod;
          if (isCash) {
            updatedRegister.expectedCash -= movement.amount;
          }
        }
        
        if (updatedRegister.status === 'closed' && updatedRegister.actualCash !== undefined) {
          updatedRegister.difference = updatedRegister.actualCash - updatedRegister.expectedCash;
        }

        const newRegisters = [...state.cashRegisters];
        newRegisters[targetRegisterIndex] = updatedRegister;

        return {
          cashRegisters: newRegisters,
        };
      }),

      editMovement: (id, amount, description, notes, paymentMethod) => set((state) => {
        let targetRegisterIndex = -1;
        let movementIndex = -1;

        for (let i = 0; i < state.cashRegisters.length; i++) {
          const register = state.cashRegisters[i];
          if (register.movements) {
            const idx = register.movements.findIndex(m => m.id === id);
            if (idx !== -1) {
              targetRegisterIndex = i;
              movementIndex = idx;
              break;
            }
          }
        }

        if (targetRegisterIndex === -1) return state;

        const targetRegister = state.cashRegisters[targetRegisterIndex];
        const oldMovement = targetRegister.movements![movementIndex];
        const amountDiff = amount - oldMovement.amount;

        const updatedMovements = [...targetRegister.movements!];
        updatedMovements[movementIndex] = {
          ...oldMovement,
          amount,
          description,
          notes,
          ...(paymentMethod ? { paymentMethod } : {})
        };

        const updatedRegister = { ...targetRegister, movements: updatedMovements };

        if (oldMovement.type === 'withdrawal') {
          updatedRegister.withdrawals += amountDiff;
          updatedRegister.expectedCash -= amountDiff;
        } else if (oldMovement.type === 'extra_income') {
          updatedRegister.extraIncome += amountDiff;
          
          const oldIsCash = oldMovement.paymentMethod === 'Efectivo' || !oldMovement.paymentMethod;
          const newIsCash = paymentMethod ? paymentMethod === 'Efectivo' : oldIsCash;
          
          if (oldIsCash) updatedRegister.expectedCash -= oldMovement.amount;
          if (newIsCash) updatedRegister.expectedCash += amount;
        }
        
        if (updatedRegister.status === 'closed' && updatedRegister.actualCash !== undefined) {
          updatedRegister.difference = updatedRegister.actualCash - updatedRegister.expectedCash;
        }

        const newRegisters = [...state.cashRegisters];
        newRegisters[targetRegisterIndex] = updatedRegister;

        return {
          cashRegisters: newRegisters,
        };
      }),

      login: (pin) => {
        const user = get().users.find((u) => u.pin === pin);
        if (user) {
          set({ currentUser: user });
          return true;
        }
        return false;
      },

      logout: () => set({ currentUser: null }),

      toggleTheme: () => set((state) => {
        const newTheme = state.theme === 'light' ? 'dark' : 'light';
        if (newTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        return { theme: newTheme };
      }),

      clearDatabase: () => set({
        products: [],
        customers: [],
        suppliers: [],
        sales: [],
        suspendedSales: [],
        cashRegisters: [],
        inventoryMovements: [],
        cart: [],
        settings: defaultSettings,
        license: {
          status: 'none',
          machineId: generateMachineId(),
          isTrialUsed: false
        }
      }),

      activateTrial: () => {
        const state = get();
        
        if (state.license.isTrialUsed) {
          return { success: false, message: 'El periodo de prueba ya fue utilizado en esta computadora.' };
        }

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + 5);

        const newLicense: License = {
          ...state.license,
          status: 'trial',
          trialStartDate: startDate.toISOString(),
          trialEndDate: endDate.toISOString(),
          isTrialUsed: true
        };

        set({ license: newLicense });
        return { success: true, message: 'Prueba de 5 días activada correctamente.' };
      },

      activateCloudLicense: (email: string) => {
        const state = get();
        set({
          license: {
            ...state.license,
            status: 'active',
            activatedAt: new Date().toISOString(),
            cloudEmail: email
          }
        });
      },

      checkLicense: () => {
        const state = get();
        if (state.license.status === 'trial' && state.license.trialEndDate) {
          const now = new Date();
          const endDate = new Date(state.license.trialEndDate);
          if (now > endDate) {
            set({
              license: {
                ...state.license,
                status: 'expired'
              }
            });
          }
        }
      },

      regenerateMachineId: () => {
        localStorage.removeItem('machine_id'); // clear it
        const newId = generateMachineId();
        set((state) => ({
          license: {
            ...state.license,
            machineId: newId,
            status: 'none',
            isTrialUsed: false,
            trialEndDate: undefined,
            trialStartDate: undefined
          }
        }));
      }
    }),
    {
      name: 'pos-storage',
      version: 6,
      migrate: (persistedState: any, version: number) => {
        if (!persistedState) return persistedState;
        
        const state = { ...persistedState };
        
        if (version < 6) {
          state.products = [];
          state.customers = [];
          state.sales = [];
          state.remissions = [];
          state.cashRegisters = [];
          state.inventoryMovements = [];
          state.cart = [];
        }

        // Version 2 migration logic (ensure fields exist)
        if (version < 2) {
          state.dashboardVisibility = state.dashboardVisibility || {
            weekSales: true,
            netProfit: true,
            monthSales: true,
            todaySales: true,
            productCost: true,
          };
          state.settings = {
            ...defaultSettings,
            ...(state.settings || {})
          };
        }

        // Version 3 migration logic (aggressive check for all critical fields)
        if (version < 3) {
          if (!state.settings) state.settings = defaultSettings;
          if (!state.dashboardVisibility) state.dashboardVisibility = {
            weekSales: true,
            netProfit: true,
            monthSales: true,
            todaySales: true,
            productCost: true,
          };
          if (!state.products) state.products = defaultProducts;
          if (!state.users) state.users = [defaultUser];
          if (!state.customers) state.customers = [];
          if (!state.suppliers) state.suppliers = [];
          if (!state.sales) state.sales = [];
          if (!state.remissions) state.remissions = [];
          if (!state.cashRegisters) state.cashRegisters = [];
          if (!state.inventoryMovements) state.inventoryMovements = [];
          if (!state.cart) state.cart = [];
          if (!state.theme) state.theme = 'light';
        }

        if (version < 4) {
          if (!state.license) {
            state.license = {
              status: 'none',
              machineId: generateMachineId(),
              isTrialUsed: false
            };
          }
        }

        // Version 5 migration logic (remove deterministic machine IDs)
        if (version < 5) {
          if (state.license && state.license.machineId && !state.license.machineId.includes('-')) {
            // Remove deterministic machine ID from old browser storage
            localStorage.removeItem('machine_id');
            state.license.machineId = generateMachineId();
          }
        }
        
        // Remove license data if present
        delete state.licenseType;
        delete state.licenseKey;
        delete state.demoStartDate;
        
        return state;
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Error during hydration:', error);
        }
      },
    }
  )
);
