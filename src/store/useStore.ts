import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateLicensePin } from '../utils/license';
import { BusinessSettings, Product, CartItem, Sale, CashRegister, User, InventoryMovement, Customer, Remission, License, PaymentMethodType, CashMovement } from '../types';

import { type User as FirebaseUser } from 'firebase/auth';

interface AppState {
  settings: BusinessSettings;
  products: Product[];
  sales: Sale[];
  remissions: Remission[];
  cashRegisters: CashRegister[];
  users: User[];
  customers: Customer[];
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
  loadSaleIntoCart: (saleId: string) => void;
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
  clearDatabase: () => void;
  
  // License Actions
  activateTrial: () => { success: boolean; message: string };
  activateLicense: (pin: string) => { success: boolean; message: string };
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

const MASTER_PIN = "99887766"; // This would be generated or stored securely

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
      sales: [],
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
      },

      setFirebaseUser: (user) => set({ firebaseUser: user }),

      toggleDashboardVisibility: (key) => set((state) => {
        const currentVisibility = state.dashboardVisibility || {
          weekSales: true,
          netProfit: true,
          monthSales: true,
          todaySales: true,
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
          if (newSale.paymentMethod === 'Efectivo') updatedRegister.cashSales = (updatedRegister.cashSales || 0) + newSale.total;
          if (newSale.paymentMethod === 'Tarjeta') updatedRegister.cardSales = (updatedRegister.cardSales || 0) + newSale.total;
          if (newSale.paymentMethod === 'Transferencia') updatedRegister.transferSales = (updatedRegister.transferSales || 0) + newSale.total;
          if (newSale.paymentMethod === 'Mercado Pago') updatedRegister.mercadoPagoSales = (updatedRegister.mercadoPagoSales || 0) + newSale.total;
          if (newSale.paymentMethod === 'CLIP') updatedRegister.clipSales = (updatedRegister.clipSales || 0) + newSale.total;
          
          const cashExtraIncome = (updatedRegister.movements || [])
            .filter(m => m.type === 'extra_income' && (m.paymentMethod === 'Efectivo' || !m.paymentMethod))
            .reduce((sum, m) => sum + m.amount, 0);
            
          updatedRegister.expectedCash = (updatedRegister.initialAmount || 0) + (updatedRegister.cashSales || 0) + cashExtraIncome - (updatedRegister.withdrawals || 0);
          
          updatedRegisters = state.cashRegisters.map((r) => r.id === currentRegister.id ? updatedRegister : r);
        }

        return {
          sales: [...state.sales, newSale],
          products: updatedProducts,
          cart: [],
          cashRegisters: updatedRegisters,
          inventoryMovements: [...newMovements, ...state.inventoryMovements],
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
          if (saleToDelete.paymentMethod === 'Efectivo') updatedRegister.cashSales = (updatedRegister.cashSales || 0) - saleToDelete.total;
          if (saleToDelete.paymentMethod === 'Tarjeta') updatedRegister.cardSales = (updatedRegister.cardSales || 0) - saleToDelete.total;
          if (saleToDelete.paymentMethod === 'Transferencia') updatedRegister.transferSales = (updatedRegister.transferSales || 0) - saleToDelete.total;
          if (saleToDelete.paymentMethod === 'Mercado Pago') updatedRegister.mercadoPagoSales = (updatedRegister.mercadoPagoSales || 0) - saleToDelete.total;
          if (saleToDelete.paymentMethod === 'CLIP') updatedRegister.clipSales = (updatedRegister.clipSales || 0) - saleToDelete.total;
          
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
        sales: [],
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

      activateLicense: (pin: string) => {
        const state = get();
        const generatedPin = generateLicensePin(state.license.machineId);
        
        if (pin === MASTER_PIN || pin === generatedPin) {
          set({
            license: {
              ...state.license,
              status: 'active',
              activatedAt: new Date().toISOString()
            }
          });
          return { success: true, message: 'Licencia activada permanentemente.' };
        }
        return { success: false, message: 'PIN Maestro incorrecto.' };
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
          };
          if (!state.products) state.products = defaultProducts;
          if (!state.users) state.users = [defaultUser];
          if (!state.customers) state.customers = [];
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
