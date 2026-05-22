import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore, defaultSettings } from '../store/useStore';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, Receipt, ShoppingCart, Star, Check, Printer, ArrowRight, UserPlus, User, AlertTriangle, MessageCircle, Clock, Pause, Play } from 'lucide-react';
import { generateReceiptPDF } from '../utils/pdf';
import { shareReceiptWhatsApp } from '../utils/receiptImage';
import { formatCurrency, capitalizeFirst } from '../utils/format';
import { PaymentMethodType, Sale, Product } from '../types';
import { AnimatePresence, motion } from 'motion/react';
import BarcodeScannerModal from '../components/BarcodeScannerModal';

export default function POS() {
  const { 
    products = [], 
    cart = [],
    suspendedSales = [],
    addToCart, 
    updateCartItem, 
    removeFromCart, 
    clearCart, 
    processSale,
    suspendCart,
    resumeCart,
    deleteSuspendedSale,
    settings = defaultSettings, 
    theme, 
    sales = [], 
    customers = [], 
    addCustomer, 
    cashRegisters = [] 
  } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');

  const categories = useMemo(() => {
    return Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort();
  }, [products]);

  const subcategories = useMemo(() => {
    const filtered = selectedCategory && selectedCategory !== 'all'
      ? products.filter(p => p.category === selectedCategory)
      : products;
    return Array.from(new Set(filtered.map(p => p.subcategory).filter(Boolean))).sort();
  }, [products, selectedCategory]);

  useEffect(() => {
    setSelectedSubcategory('all');
  }, [selectedCategory]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('Efectivo');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [applyTax, setApplyTax] = useState<boolean>(settings.applyTax);
  const [mixedPaymentValues, setMixedPaymentValues] = useState<{ method: PaymentMethodType; amount: string | number }[]>([
    { method: 'Efectivo', amount: '' },
    { method: 'Tarjeta', amount: '' }
  ]);
  const [globalDiscount, setGlobalDiscount] = useState<number | string>('');
  const [globalDiscountType, setGlobalDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [pointsToUse, setPointsToUse] = useState<number | string>('');
  
  // Customer states
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('mostrador');
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  
  // Commission states
  const [commissionTerm, setCommissionTerm] = useState<string>('Contado');
  const [commissionPayer, setCommissionPayer] = useState<'cliente' | 'vendedor'>('cliente');

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  // Suspended sales state
  const [showSuspendedModal, setShowSuspendedModal] = useState(false);
  const [showSuspendNameModal, setShowSuspendNameModal] = useState(false);
  const [suspendName, setSuspendName] = useState('');

  // Custom product state
  const [showCustomProductModal, setShowCustomProductModal] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global barcode scanner listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if a modal is open
      if (showNewCustomerModal || showCustomProductModal || showSuccessModal || showSuspendedModal || showSuspendNameModal) return;

      // If user is actively typing in an input or textarea, let the input handle it
      if (
        document.activeElement instanceof HTMLInputElement || 
        document.activeElement instanceof HTMLTextAreaElement
      ) {
         return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNewCustomerModal, showCustomProductModal, showSuccessModal]);
  const [customProduct, setCustomProduct] = useState({ name: '', price: 0, quantity: 1 });

  const handleAddToCart = (product: Product, quantity: number = 1) => {
    if (product.tracksInventory) {
      const existingItem = cart.find(item => item.id === product.id);
      const currentQuantityInCart = existingItem ? existingItem.quantity : 0;
      if (currentQuantityInCart + quantity > product.stock) {
        alert(`No hay suficiente inventario para agregar "${product.name}".\nStock disponible: ${product.stock}\nEn el carrito: ${currentQuantityInCart}`);
        return;
      }
    }
    addToCart(product, quantity);
  };

  const topProducts = useMemo(() => {
    const productSales: Record<string, number> = {};
    sales.forEach(sale => {
      sale.items.forEach(item => {
        productSales[item.id] = (productSales[item.id] || 0) + item.quantity;
      });
    });

    return Object.entries(productSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => products.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);
  }, [sales, products]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return products.filter(p => {
      // Search term matches name, barcode, supplier, category or subcategory
      const matchesSearch = !term ||
        (p.name && p.name.toLowerCase().includes(term)) || 
        (p.barcode && String(p.barcode).toLowerCase().includes(term)) ||
        (p.category && p.category.toLowerCase().includes(term)) ||
        (p.subcategory && p.subcategory.toLowerCase().includes(term)) ||
        (p.supplier && p.supplier.toLowerCase().includes(term));

      // Category filter
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;

      // Subcategory filter
      const matchesSubcategory = selectedSubcategory === 'all' || p.subcategory === selectedSubcategory;

      return matchesSearch && matchesCategory && matchesSubcategory;
    });
  }, [products, searchTerm, selectedCategory, selectedSubcategory]);



  const subtotal = cart.reduce((sum, item) => {
    const price = item.salePrice;
    const discountAmount = item.discount > 0 ? (item.discountType === 'fixed' ? item.discount : price * (item.discount / 100)) : 0;
    return sum + ((price - discountAmount) * item.quantity);
  }, 0);

  const parsedGlobalDiscount = Number(globalDiscount) || 0;
  const globalDiscountAmount = parsedGlobalDiscount > 0 ? (globalDiscountType === 'fixed' ? parsedGlobalDiscount : subtotal * (parsedGlobalDiscount / 100)) : 0;
  const subtotalAfterDiscount = Math.max(0, subtotal - globalDiscountAmount);

  const tax = applyTax ? subtotalAfterDiscount * (settings.taxRate / 100) : 0;
  
  // Calculate commission
  let commissionAmount = 0;
  if (paymentMethod === 'CLIP' || paymentMethod === 'Mercado Pago') {
    let rate = 0;
    if (paymentMethod === 'CLIP') {
      switch (commissionTerm) {
        case 'Contado': rate = 0.036; break;
        case '3 MSI': rate = 0.054; break;
        case '6 MSI': rate = 0.084; break;
        case '9 MSI': rate = 0.114; break;
        case '12 MSI': rate = 0.144; break;
        default: rate = 0.036;
      }
    } else if (paymentMethod === 'Mercado Pago') {
      rate = 0.035; // Standard Mercado Pago rate
    }
    
    // Commission is applied to the subtotal + tax
    const baseForCommission = subtotalAfterDiscount + tax;
    // Add IVA to the commission itself
    commissionAmount = baseForCommission * rate * (1 + (settings.taxRate / 100));
  }

  const selectedCustomer = selectedCustomerId !== 'mostrador' ? customers.find(c => c.id === selectedCustomerId) : null;
  const maxPointsAvailable = selectedCustomer?.points || 0;
  const parsedPointsToUse = Math.min(Number(pointsToUse) || 0, maxPointsAvailable);

  const totalBeforePoints = subtotalAfterDiscount + tax + (commissionPayer === 'cliente' ? commissionAmount : 0);
  const total = Math.max(0, totalBeforePoints - parsedPointsToUse);
  
  const mixedPaymentsTotal = mixedPaymentValues.reduce((sum, val) => sum + (Number(val.amount) || 0), 0);
  const actualCashReceived = paymentMethod === 'Mixto' ? mixedPaymentValues.find(m => m.method === 'Efectivo')?.amount as number || 0 : Math.max(cashReceived, total);
  const change = paymentMethod === 'Mixto' ? 0 : actualCashReceived - total;

  const hasOpenRegister = cashRegisters.some(r => r.status === 'open');

  const handleProcessSale = () => {
    if (cart.length === 0) return;
    if (!hasOpenRegister) {
      alert('Debes abrir la caja antes de poder registrar ventas.');
      return;
    }

    if (paymentMethod === 'Mixto' && Math.abs(mixedPaymentsTotal - total) > 0.01) {
      alert(`Los pagos mixtos deben sumar exactamente el total de la cuenta.\nFaltan/Sobran: ${formatCurrency(Math.abs(mixedPaymentsTotal - total), settings.currency)}`);
      return;
    }

    const pointsEarned = Math.floor(total / 100);

    const baseSaleData = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      items: [...cart],
      subtotal: subtotalAfterDiscount, // store discounted subtotal or original? Original is better but keeping compatibility with subtotal fields.
      tax,
      total,
      paymentMethod,
      globalDiscount: parsedGlobalDiscount > 0 ? parsedGlobalDiscount : undefined,
      globalDiscountType: parsedGlobalDiscount > 0 ? globalDiscountType : undefined,
      pointsEarned: selectedCustomer ? pointsEarned : undefined,
      pointsUsed: parsedPointsToUse > 0 ? parsedPointsToUse : undefined,
    };

    const customer = selectedCustomer;

    // Eliminate undefined to avoid Firestore errors
    const saleData = {
      ...baseSaleData,
      ...(paymentMethod === 'Efectivo' && { cashReceived: actualCashReceived, change }),
      ...(paymentMethod === 'Mixto' && { mixedPayments: mixedPaymentValues.map(mp => ({ method: mp.method, amount: Number(mp.amount) || 0 })) }),
      ...(commissionAmount > 0 && { commission: commissionAmount, commissionPayer, term: commissionTerm }),
      ...(customer && { 
        customerId: customer.id,
        customerName: customer.name 
      })
    };

    processSale(saleData as any);
    
    setLastSale(saleData);
    setShowSuccessModal(true);
  };

  const handlePrintReceipt = () => {
    if (lastSale) {
      generateReceiptPDF(lastSale, settings);
    }
  };

  const handleSendWhatsApp = () => {
    if (!lastSale) return;
    
    let phone = "";
    let name = "Cliente";
    
    if (lastSale.customerId && lastSale.customerId !== 'mostrador') {
      const customer = customers.find(c => c.id === lastSale.customerId);
      if (customer) {
        phone = customer.phone || "";
        name = customer.name || "Cliente";
      }
    }
    
    // Generate the JPG and share directly
    shareReceiptWhatsApp(lastSale, settings, phone, name);
  };

  const handleNewSale = () => {
    setShowSuccessModal(false);
    setLastSale(null);
    setCashReceived(0);
    setSearchTerm('');
    setPaymentMethod('Efectivo');
    setSelectedCustomerId('mostrador');
    setPointsToUse('');
    setGlobalDiscount('');
    setMixedPaymentValues([
      { method: 'Efectivo', amount: '' },
      { method: 'Tarjeta', amount: '' }
    ]);
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name) return;
    
    // Create a temporary ID to select it immediately
    const tempId = Math.random().toString(36).substr(2, 9);
    addCustomer({ ...newCustomer });
    
    // We can't easily get the exact ID from the store immediately without a return value,
    // so we'll just select the last added customer in the next render, or we can just 
    // find it by name. Actually, let's just reset to 'mostrador' or let the user select it.
    // Wait, let's just find the customer by name after adding.
    setTimeout(() => {
      const added = useStore.getState().customers.find(c => c.name === newCustomer.name);
      if (added) setSelectedCustomerId(added.id);
    }, 100);

    setNewCustomer({ name: '', phone: '', email: '' });
    setShowNewCustomerModal(false);
  };

  const handleAddCustomProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customProduct.name || customProduct.price <= 0 || customProduct.quantity <= 0) return;

    const newProduct = {
      id: `custom-${Math.random().toString(36).substr(2, 9)}`,
      name: customProduct.name,
      category: 'Venta Libre',
      supplier: 'N/A',
      barcode: '',
      purchasePrice: 0,
      salePrice: customProduct.price,
      tracksInventory: false,
      stock: 0,
      minStock: 0,
      image: ''
    };

    handleAddToCart(newProduct, customProduct.quantity);
    setShowCustomProductModal(false);
    setCustomProduct({ name: '', price: 0, quantity: 1 });
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6">
      {/* Left side: Products */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            const input = searchInputRef.current;
            if (!input) return;
            const term = input.value.trim();
            if (!term) return;

            // Busqueda exacta por codigo de barras
            const exactMatch = products.find(p => p.barcode && String(p.barcode).toLowerCase() === term.toLowerCase());
            if (exactMatch) {
               handleAddToCart(exactMatch);
               setSearchTerm('');
               // Force raw value clearing to avoid race conditions with scanner
               input.value = '';
               return;
            }
            
            // Si no hay match exacto de codigo de barras, buscar en otros campos
            const lowerTerm = term.toLowerCase();
            const currentFiltered = products.filter(p => 
              (p.name && p.name.toLowerCase().includes(lowerTerm)) || 
              (p.barcode && String(p.barcode).toLowerCase().includes(lowerTerm)) ||
              (p.category && p.category.toLowerCase().includes(lowerTerm)) ||
              (p.supplier && p.supplier.toLowerCase().includes(lowerTerm))
            );

            if (currentFiltered.length === 1) {
              handleAddToCart(currentFiltered[0]);
              setSearchTerm('');
              input.value = '';
            }
          }} 
          className="p-4 border-b border-gray-100 dark:border-gray-700 flex gap-3"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 h-5 w-5" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por nombre, código, categoría o proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-shadow dark:text-white"
              autoFocus
            />
          </div>
          <button
            type="button"
            onClick={() => setShowScannerModal(true)}
            className="flex items-center justify-center p-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
            title="Escanear Código de Barras"
          >
            <div className="w-6 h-6 flex flex-col justify-between items-center opacity-80">
              <div className="w-full h-[3px] bg-current rounded-full"></div>
              <div className="w-3/4 h-[3px] bg-current rounded-full"></div>
              <div className="w-full h-[3px] bg-current rounded-full"></div>
              <div className="w-1/2 h-[3px] bg-current rounded-full"></div>
              <div className="w-full h-[3px] bg-current rounded-full"></div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setShowCustomProductModal(true)}
            className="flex items-center justify-center px-4 py-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors whitespace-nowrap"
          >
            <Plus className="w-5 h-5 mr-2" />
            Venta Libre
          </button>
        </form>

        {/* Category & Subcategory Pill bar */}
        <div className="bg-gray-50/50 dark:bg-gray-950/20 border-b border-gray-100 dark:border-gray-700/80 py-3.5 px-4 shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:divide-x md:divide-gray-100 dark:md:divide-gray-800">
            {/* Categories Col */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Categorías</span>
                {(selectedCategory !== 'all' || selectedSubcategory !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('all');
                      setSelectedSubcategory('all');
                    }}
                    className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline"
                  >
                    Limpiar Filtros
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-1 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                    selectedCategory === 'all'
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'bg-white border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  Todas ({products.length})
                </button>
                {categories.map(cat => {
                  const count = products.filter(p => p.category === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                        selectedCategory === cat
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'bg-white border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subcategories Col */}
            <div className={`space-y-2 md:pl-4 transition-all`}>
              <div className="flex items-center">
                <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Subcategorías</span>
                {selectedCategory !== 'all' && (
                  <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded bg-blue-105 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-bold max-w-[140px] truncate">
                    {selectedCategory}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-1 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setSelectedSubcategory('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                    selectedSubcategory === 'all'
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                      : 'bg-white border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  Todas ({selectedCategory === 'all' ? products.length : products.filter(p => p.category === selectedCategory).length})
                </button>
                {subcategories.map(sub => {
                  const count = products.filter(p => {
                    const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
                    return matchCat && p.subcategory === sub;
                  }).length;
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSelectedSubcategory(sub)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                        selectedSubcategory === sub
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                          : 'bg-white border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      {sub} ({count})
                    </button>
                  );
                })}
                {subcategories.length === 0 && (
                  <div className="text-xs text-gray-400 italic py-1 pl-1">
                    No hay subcategorías registradas para esta selección.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
          {/* Top 10 Products Section */}
          {topProducts.length > 0 && !searchTerm && selectedCategory === 'all' && selectedSubcategory === 'all' && (
            <div>
              <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center">
                <Star className="w-4 h-4 mr-1.5 text-yellow-500" />
                Top 10 Más Vendidos
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {topProducts.map(product => (
                  <button
                    key={`top-${product.id}`}
                    onClick={() => handleAddToCart(product)}
                    disabled={product.tracksInventory && product.stock <= 0}
                    className={`flex flex-col text-left rounded-xl p-2 transition-all border group ${
                      product.tracksInventory && product.stock <= 0
                        ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        : 'bg-blue-50/50 dark:bg-blue-900/10 hover:shadow-md border-blue-100 dark:border-blue-800/30 hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
                  >
                    <div className="aspect-square w-full bg-white dark:bg-gray-800 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className={`w-full h-full object-cover transition-transform ${product.tracksInventory && product.stock <= 0 ? '' : 'group-hover:scale-105'}`} referrerPolicy="no-referrer" />
                      ) : (
                        <Receipt className="h-6 w-6 text-gray-300 dark:text-gray-600" />
                      )}
                    </div>
                    <h3 className="font-medium text-xs text-gray-900 dark:text-gray-100 line-clamp-2 mb-1 leading-tight">{product.name}</h3>
                    <p className={`font-bold mt-auto text-sm ${product.tracksInventory && product.stock <= 0 ? 'text-gray-500' : 'text-blue-600 dark:text-blue-400'}`}>
                      {formatCurrency(product.salePrice, settings.currency)}
                    </p>
                    {product.tracksInventory && product.stock <= 0 && (
                      <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider mt-1">Agotado</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All Products Section */}
          <div>
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center flex-wrap gap-1">
              {searchTerm ? (
                <span>Resultados de Búsqueda</span>
              ) : selectedCategory !== 'all' ? (
                <>
                  <span>Categoría:</span>
                  <span className="text-blue-600 dark:text-blue-400 font-black normal-case">{selectedCategory}</span>
                  {selectedSubcategory !== 'all' && (
                    <>
                      <span className="mx-1 text-gray-300 dark:text-gray-600">&gt;</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-black normal-case">{selectedSubcategory}</span>
                    </>
                  )}
                </>
              ) : (
                <span>Todos los Productos</span>
              )}
              <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-550 font-medium lowercase">({filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'})</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => handleAddToCart(product)}
                  disabled={product.tracksInventory && product.stock <= 0}
                  className={`flex flex-col text-left rounded-xl p-3 transition-all border group ${
                    product.tracksInventory && product.stock <= 0
                    ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    : 'bg-gray-50 dark:bg-gray-900 hover:shadow-md border-transparent hover:border-blue-200 dark:hover:border-blue-800'
                  }`}
                >
                  <div className="aspect-square w-full bg-white dark:bg-gray-800 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className={`w-full h-full object-cover transition-transform ${product.tracksInventory && product.stock <= 0 ? '' : 'group-hover:scale-105'}`} referrerPolicy="no-referrer" />
                    ) : (
                      <Receipt className="h-8 w-8 text-gray-300 dark:text-gray-600" />
                    )}
                  </div>
                  <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">{product.name}</h3>
                  <p className={`font-bold mt-auto ${product.tracksInventory && product.stock <= 0 ? 'text-gray-500' : 'text-blue-600 dark:text-blue-400'}`}>
                    {formatCurrency(product.salePrice, settings.currency)}
                  </p>
                  {product.tracksInventory && (
                    <p className={`text-xs mt-1 font-medium ${product.stock <= 0 ? 'text-red-500' : product.stock <= product.minStock ? 'text-orange-500' : 'text-gray-500 dark:text-gray-400'}`}>
                      {product.stock <= 0 ? 'Agotado' : `Stock: ${product.stock}`}
                    </p>
                  )}
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400">
                  No se encontraron productos.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Cart */}
      <div className="w-full lg:w-96 flex flex-col h-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg dark:text-white">Carrito</h2>
            {suspendedSales.length > 0 && (
              <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-0.5 rounded-full dark:bg-yellow-900 dark:text-yellow-300">
                {suspendedSales.length}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowSuspendedModal(true)} 
              className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
              title="Ventas suspendidas"
            >
              <Clock className="w-5 h-5" />
            </button>
            {cart.length > 0 && (
              <>
                <button 
                  onClick={() => setShowSuspendNameModal(true)} 
                  className="text-gray-500 hover:text-yellow-600 dark:text-gray-400 dark:hover:text-yellow-400"
                  title="Suspender venta actual"
                >
                  <Pause className="w-5 h-5" />
                </button>
                <button 
                  onClick={clearCart} 
                  className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                  title="Vaciar carrito"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-4">
              <ShoppingCart className="h-12 w-12 opacity-20" />
              <p>El carrito está vacío</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.cartId} className="flex flex-col bg-gray-50 dark:bg-gray-900 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-sm dark:text-gray-200 line-clamp-2 pr-2">{item.name}</h4>
                  <button onClick={() => removeFromCart(item.cartId)} className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1">
                    <button 
                      onClick={() => updateCartItem(item.cartId, Math.max(1, item.quantity - 1))}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-medium w-6 text-center dark:text-white">{item.quantity}</span>
                    <button 
                      onClick={() => {
                        if (item.tracksInventory && item.quantity + 1 > item.stock) {
                          alert(`No hay suficiente inventario para agregar "${item.name}".\nStock disponible: ${item.stock}`);
                          return;
                        }
                        updateCartItem(item.cartId, item.quantity + 1)
                      }}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-white">
                      {formatCurrency(item.salePrice * item.quantity, settings.currency)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
          {/* Customer Selection */}
          <div className="mb-4 flex gap-2 items-center">
            <div className="relative flex-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  setPointsToUse('');
                }}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white text-sm appearance-none"
              >
                <option value="mostrador">Nota Mostrador</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setShowNewCustomerModal(true)}
              className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-xl transition-colors flex-shrink-0"
              title="Nuevo Cliente"
            >
              <UserPlus className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2 mb-4 text-sm">
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal, settings.currency)}</span>
            </div>

            {selectedCustomer && (
              <div className="pt-2 pb-2 border-t border-gray-100 dark:border-gray-700 mt-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">Usar Puntos</span>
                    <span className="text-xs text-amber-500 font-medium">Disponibles: {selectedCustomer.points || 0}</span>
                  </div>
                  <div className="flex bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden w-[100px]">
                    <input 
                      type="number"
                      min="0"
                      max={selectedCustomer.points || 0}
                      placeholder="0"
                      value={pointsToUse === 0 ? '' : pointsToUse}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val <= (selectedCustomer.points || 0)) {
                          setPointsToUse(e.target.value);
                        }
                      }}
                      className="w-full bg-transparent px-2 py-1.5 text-sm outline-none text-gray-700 dark:text-white text-right"
                    />
                  </div>
                </div>
                {parsedPointsToUse > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400 mt-1">
                    <span>Descuento por Puntos</span>
                    <span>-{formatCurrency(parsedPointsToUse, settings.currency)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Global Discount Block */}
            <div className="pt-2 pb-2 border-t border-b border-gray-100 dark:border-gray-700 my-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-500 dark:text-gray-400">Descuento</span>
                <div className="flex bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex-1 max-w-[200px]">
                  <select 
                    value={globalDiscountType}
                    onChange={(e) => setGlobalDiscountType(e.target.value as 'percentage' | 'fixed')}
                    className="bg-transparent pl-2 pr-1 py-1 text-sm border-r border-gray-200 dark:border-gray-700 outline-none text-gray-700 dark:text-gray-300"
                  >
                    <option value="percentage">%</option>
                    <option value="fixed">$</option>
                  </select>
                  <input 
                    type="number"
                    min="0"
                    placeholder="0"
                    value={globalDiscount === 0 ? '' : globalDiscount}
                    onChange={(e) => setGlobalDiscount(e.target.value)}
                    className="w-full bg-transparent px-2 py-1 text-sm outline-none text-gray-700 dark:text-white"
                  />
                </div>
              </div>
              {globalDiscountAmount > 0 && (
                <div className="flex justify-between text-green-600 dark:text-green-400 mt-1">
                  <span>Aplicado</span>
                  <span>-{formatCurrency(globalDiscountAmount, settings.currency)}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={applyTax} 
                  onChange={(e) => setApplyTax(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>IVA ({settings.taxRate}%)</span>
              </label>
              <span>{formatCurrency(tax, settings.currency)}</span>
            </div>
            {(paymentMethod === 'CLIP' || paymentMethod === 'Mercado Pago') && commissionPayer === 'cliente' && (
              <div className="flex justify-between text-orange-600 dark:text-orange-400">
                <span>Comisión {paymentMethod}</span>
                <span>+{formatCurrency(commissionAmount, settings.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700 dark:text-white">
              <span>Total a Cobrar</span>
              <span className="text-purple-600 dark:text-purple-400 text-2xl">
                {formatCurrency(total, settings.currency)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 mb-4">
            {(settings.acceptedPaymentMethods || ['Efectivo', 'Tarjeta', 'Transferencia', 'Mixto']).map(method => {
              let Icon = Banknote;
              if (method === 'Tarjeta') Icon = CreditCard;
              if (method === 'Transferencia') Icon = Smartphone;
              if (method === 'Mixto') Icon = Receipt;
              if (method === 'Mercado Pago') Icon = Smartphone;
              if (method === 'CLIP') Icon = Smartphone;

              return (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method as PaymentMethodType)}
                  className={`flex items-center justify-between p-3 rounded-xl border font-medium transition-colors ${
                    paymentMethod === method 
                      ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center">
                    <Icon className="h-5 w-5 mr-3" />
                    <span>{method}</span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {(method === 'Efectivo' || method === 'Transferencia') ? '(Sin comisión)' : ''}
                  </span>
                </button>
              );
            })}
          </div>

          {(paymentMethod === 'CLIP' || paymentMethod === 'Mercado Pago') && (
            <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-900/50 rounded-xl space-y-4">
              {paymentMethod === 'CLIP' && (
                <div>
                  <label className="block text-sm font-bold text-orange-900 dark:text-orange-400 mb-2">Plazo de Pago</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'Contado', rate: '3.6%' },
                      { id: '3 MSI', rate: '5.4%' },
                      { id: '6 MSI', rate: '8.4%' },
                      { id: '9 MSI', rate: '11.4%' },
                      { id: '12 MSI', rate: '14.4%' }
                    ].map(term => (
                      <button
                        key={term.id}
                        onClick={() => setCommissionTerm(term.id)}
                        className={`p-2 text-center rounded-lg border text-sm transition-colors ${
                          commissionTerm === term.id
                            ? 'bg-orange-500 border-orange-600 text-white'
                            : 'bg-white border-orange-200 text-orange-800 hover:bg-orange-100 dark:bg-gray-800 dark:border-orange-900/50 dark:text-orange-300'
                        }`}
                      >
                        <div className="font-bold">{term.id}</div>
                        <div className="text-xs opacity-80">{term.rate} + IVA</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-orange-900 dark:text-orange-400 mb-2">¿Quién paga la comisión?</label>
                <div className="flex rounded-lg overflow-hidden border border-orange-200 dark:border-orange-900/50">
                  <button
                    onClick={() => setCommissionPayer('cliente')}
                    className={`flex-1 py-2 text-sm font-bold transition-colors ${
                      commissionPayer === 'cliente'
                        ? 'bg-orange-500 text-white'
                        : 'bg-white text-orange-800 hover:bg-orange-50 dark:bg-gray-800 dark:text-orange-300'
                    }`}
                  >
                    Cliente
                  </button>
                  <button
                    onClick={() => setCommissionPayer('vendedor')}
                    className={`flex-1 py-2 text-sm font-bold transition-colors ${
                      commissionPayer === 'vendedor'
                        ? 'bg-orange-500 text-white'
                        : 'bg-white text-orange-800 hover:bg-orange-50 dark:bg-gray-800 dark:text-orange-300'
                    }`}
                  >
                    Vendedor
                  </button>
                </div>
              </div>

              <div className="p-3 bg-orange-100/50 dark:bg-orange-900/30 rounded-lg">
                <p className="text-sm font-bold text-orange-900 dark:text-orange-400">
                  Comisión {paymentMethod} ({paymentMethod === 'CLIP' ? commissionTerm : '3.5% + IVA'}):
                </p>
                <p className="text-xl font-bold text-orange-700 dark:text-orange-500">
                  {formatCurrency(commissionAmount, settings.currency)}
                </p>
                <p className="text-xs text-orange-800/70 dark:text-orange-400/70 mt-1">
                  {commissionPayer === 'cliente' 
                    ? 'El cliente pagará la comisión adicional.' 
                    : 'El vendedor absorberá la comisión.'}
                </p>
              </div>
            </div>
          )}

          {paymentMethod === 'Efectivo' && (
            <div className="mb-4 space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Efectivo Recibido</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-xl font-bold">$</span>
                <input
                  type="number"
                  value={cashReceived || ''}
                  onChange={(e) => setCashReceived(Number(e.target.value))}
                  className="w-full pl-10 pr-4 py-3 text-2xl font-bold bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-blue-500 focus:ring-0 dark:text-white transition-colors"
                  placeholder="0.00"
                />
              </div>
              {cashReceived > 0 && (
                <div className="flex justify-between items-center mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                  <span className="text-base font-bold text-gray-600 dark:text-gray-400">Cambio:</span>
                  <span className={`text-2xl font-black ${change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {formatCurrency(change, settings.currency)}
                  </span>
                </div>
              )}
            </div>
          )}

          {paymentMethod === 'Mixto' && (
            <div className="mb-4 space-y-3 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-900/50 rounded-xl">
              <h3 className="text-sm font-bold text-purple-900 dark:text-purple-400 mb-2">Desglose de Pago</h3>
              {mixedPaymentValues.map((mp, index) => (
                <div key={index} className="flex gap-2">
                  <select 
                    value={mp.method}
                    onChange={(e) => {
                      const newVals = [...mixedPaymentValues];
                      newVals[index].method = e.target.value as PaymentMethodType;
                      setMixedPaymentValues(newVals);
                    }}
                    className="w-1/2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Tarjeta">Tarjeta</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Mercado Pago">Mercado Pago</option>
                    <option value="CLIP">CLIP</option>
                  </select>
                  <div className="relative w-1/2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input 
                      type="number"
                      value={mp.amount}
                      onChange={(e) => {
                        const newVals = [...mixedPaymentValues];
                        newVals[index].amount = e.target.value;
                        setMixedPaymentValues(newVals);
                      }}
                      className="w-full pl-7 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  {index > 1 && (
                    <button 
                      onClick={() => setMixedPaymentValues(mixedPaymentValues.filter((_, i) => i !== index))}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-purple-200 dark:border-purple-800">
                <button 
                  onClick={() => setMixedPaymentValues([...mixedPaymentValues, { method: 'Transferencia', amount: '' }])}
                  className="text-xs font-bold text-purple-700 dark:text-purple-400 flex items-center hover:underline"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Método
                </button>
                <div className="text-right">
                  <span className="text-xs text-purple-600 dark:text-purple-400 block">Suma Total</span>
                  <span className={`font-bold ${Math.abs(mixedPaymentsTotal - total) > 0.01 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                    {formatCurrency(mixedPaymentsTotal, settings.currency)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {!hasOpenRegister && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium">Debes abrir la caja en la sección "Caja" para poder cobrar.</p>
            </div>
          )}

          <button
            onClick={handleProcessSale}
            disabled={cart.length === 0 || !hasOpenRegister}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors shadow-sm"
          >
            Cobrar
          </button>
        </div>
      </div>

      {/* New Customer Modal */}
      <AnimatePresence>
        {showNewCustomerModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-700"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Nuevo Cliente</h2>
                <button 
                  onClick={() => setShowNewCustomerModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: capitalizeFirst(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-shadow"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Teléfono (Opcional)
                  </label>
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-shadow"
                    placeholder="Ej. 555 123 4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Correo Electrónico (Opcional)
                  </label>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-shadow"
                    placeholder="Ej. juan@correo.com"
                  />
                </div>
                <div className="pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowNewCustomerModal(false)}
                    className="px-4 py-2 font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-bold shadow-sm"
                  >
                    Guardar Cliente
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && lastSale && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-gray-900/95 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-gray-800 text-center relative overflow-hidden"
            >
              {/* Decorative background blur */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl mix-blend-screen pointer-events-none"></div>

              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Check className="w-8 h-8 text-white" strokeWidth={3} />
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">¡Venta Exitosa!</h2>
              <p className="text-gray-400 mb-2 font-medium">
                Total cobrado: <span className="text-emerald-400">{formatCurrency(lastSale.total, settings.currency)}</span>
              </p>
              {lastSale.pointsEarned ? (
                <div className="flex items-center justify-center space-x-2 text-amber-400 mb-8 font-medium">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>+{lastSale.pointsEarned} puntos obtenidos</span>
                </div>
              ) : <div className="mb-8"></div>}
              
              <div className="space-y-3 relative">
                <button
                  onClick={handlePrintReceipt}
                  className="w-full py-3.5 px-4 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-all flex items-center justify-center border border-gray-700 hover:border-gray-600 shadow-sm"
                >
                  <Printer className="w-5 h-5 mr-2" />
                  Imprimir Ticket
                </button>
                
                <button
                  onClick={handleSendWhatsApp}
                  className="w-full py-3.5 px-4 bg-[#25D366] hover:bg-[#128C7E] text-white font-medium rounded-xl transition-all flex items-center justify-center shadow-sm shadow-[#25D366]/20"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Enviar WhatsApp
                </button>
                
                <button
                  onClick={handleNewSale}
                  className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all flex items-center justify-center shadow-md shadow-emerald-500/20 mt-2"
                >
                  <ArrowRight className="w-5 h-5 mr-2" />
                  Siguiente Venta
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Product Modal */}
      <AnimatePresence>
        {showCustomProductModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-700"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Venta Libre</h2>
                <button 
                  onClick={() => setShowCustomProductModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleAddCustomProduct} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Descripción *
                  </label>
                  <input
                    type="text"
                    required
                    value={customProduct.name}
                    onChange={(e) => setCustomProduct({ ...customProduct, name: capitalizeFirst(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white"
                    placeholder="Ej. Servicio de reparación"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Precio Unitario *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={customProduct.price === 0 ? '' : customProduct.price}
                      onChange={(e) => setCustomProduct({ ...customProduct, price: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Cantidad *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      value={customProduct.quantity}
                      onChange={(e) => setCustomProduct({ ...customProduct, quantity: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white"
                    />
                  </div>
                </div>
                <div className="pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCustomProductModal(false)}
                    className="px-4 py-2 font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-bold shadow-sm"
                  >
                    Agregar al Carrito
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suspend Name Modal */}
      <AnimatePresence>
        {showSuspendNameModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-100 dark:border-gray-700"
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Suspender Venta</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Asigna un nombre para identificar esta venta más tarde (ej. "Cliente que fue al cajero").
              </p>
              <input
                type="text"
                autoFocus
                value={suspendName}
                onChange={(e) => setSuspendName(e.target.value)}
                placeholder="Nombre o referencia..."
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white mb-6"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    suspendCart(suspendName || `Venta ${new Date().toLocaleTimeString()}`, selectedCustomerId);
                    setSuspendName('');
                    setShowSuspendNameModal(false);
                  }
                }}
              />
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowSuspendNameModal(false)}
                  className="px-4 py-2 font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    suspendCart(suspendName || `Venta ${new Date().toLocaleTimeString()}`, selectedCustomerId);
                    setSuspendName('');
                    setShowSuspendNameModal(false);
                  }}
                  className="px-6 py-2 bg-yellow-600 text-white font-bold rounded-xl hover:bg-yellow-700"
                >
                  Suspender
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suspended Sales List Modal */}
      <AnimatePresence>
        {showSuspendedModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl border border-gray-100 dark:border-gray-700"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-6 h-6 text-yellow-500" />
                  Ventas Suspendidas
                </h3>
                <button onClick={() => setShowSuspendedModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                  ✕
                </button>
              </div>
              <div className="overflow-y-auto p-6 flex-1">
                {suspendedSales.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No hay ventas suspendidas.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {suspendedSales.map(sale => (
                      <div key={sale.id} className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800 flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{sale.name}</p>
                          <p className="text-sm text-gray-500">{new Date(sale.date).toLocaleString()} - {sale.items.length} artículos</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              resumeCart(sale.id);
                              setSelectedCustomerId(sale.customerId);
                              setShowSuspendedModal(false);
                            }}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
                          >
                            Retomar
                          </button>
                          <button
                            onClick={() => deleteSuspendedSale(sale.id)}
                            className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BarcodeScannerModal 
        isOpen={showScannerModal} 
        onClose={() => setShowScannerModal(false)}
        onScan={(decodedText) => {
          const exactMatch = products.find(p => p.barcode && String(p.barcode).toLowerCase() === decodedText.toLowerCase());
          if (exactMatch) {
            handleAddToCart(exactMatch);
          } else {
             alert(`No se encontró ningún producto con el código de barras: ${decodedText}`);
          }
        }}
      />
    </div>
  );
}
