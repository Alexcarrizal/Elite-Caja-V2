import React, { useMemo, useEffect, useState } from 'react';
import { useStore, defaultSettings } from '../store/useStore';
import { format, isToday, startOfDay, subDays, isAfter, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../utils/format';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  AlertTriangle,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Wallet,
  Calendar,
  Eye,
  EyeOff,
  PlusCircle,
  MinusCircle,
  ClipboardList,
  PackagePlus,
  TrendingDown,
  Tv
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Link } from 'react-router-dom';
import StockReplenishmentModal from '../components/StockReplenishmentModal';
import QuickMovementModal from '../components/QuickMovementModal';
import LessSoldProductsModal from '../components/LessSoldProductsModal';
import ProductImageModal from '../components/ProductImageModal';

export default function Dashboard() {
  const { 
    sales = [], 
    products = [], 
    settings = defaultSettings, 
    theme, 
    currentUser,
    dashboardVisibility = {
      weekSales: true,
      netProfit: true,
      monthSales: true,
      todaySales: true,
      productCost: true,
      streamingCost: true,
    },
    toggleDashboardVisibility
  } = useStore();
  const { cashRegisters = [] } = useStore();
  const navigate = useNavigate();

  const [isReplenishModalOpen, setIsReplenishModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isLessSoldModalOpen, setIsLessSoldModalOpen] = useState(false);
  const [zoomImage, setZoomImage] = useState<{ url: string; name: string } | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'entrada' | 'salida'>('entrada');

  const todaySales = useMemo(() => {
    const currentRegister = cashRegisters.find(r => r.status === 'open');
    if (!currentRegister) return [];
    
    // Only count sales made during the currently open cash register session
    return sales.filter(s => {
      const saleDate = new Date(s.date);
      const openDate = new Date(currentRegister.openedAt);
      return saleDate >= openDate;
    });
  }, [sales, cashRegisters]);

  const weekStart = useMemo(() => {
    const now = new Date();
    const startDay = settings?.weekStartDay ?? 1; // Default to Monday if not set
    const day = now.getDay();
    const diffDays = (day - startDay + 7) % 7;
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffDays);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [settings?.weekStartDay]);

  const weekSales = useMemo(() => {
    return sales.filter(s => {
      const saleDate = new Date(s.date);
      return saleDate >= weekStart;
    });
  }, [sales, weekStart]);

  const monthSales = useMemo(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return sales.filter(s => {
      const saleDate = new Date(s.date);
      return saleDate >= firstDayOfMonth;
    });
  }, [sales]);

  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.tracksInventory && p.stock <= p.minStock);
  }, [products]);

  useEffect(() => {
    if (lowStockProducts.length > 0) {
      toast.error(`¡Atención! ${lowStockProducts.length} productos con stock bajo`, {
        description: 'Es necesario reabastecer el inventario.',
        id: 'low-stock-alert',
        action: {
          label: 'Ver Inventario',
          onClick: () => navigate('/inventory')
        }
      });
    } else {
      toast.dismiss('low-stock-alert');
    }
  }, [lowStockProducts, navigate]);

  const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
  
  const todayExtraIncome = useMemo(() => {
    const currentRegister = cashRegisters.find(r => r.status === 'open');
    if (!currentRegister) return 0;
    return currentRegister.extraIncome || 0;
  }, [cashRegisters]);

  const todayWithdrawals = useMemo(() => {
    const currentRegister = cashRegisters.find(r => r.status === 'open');
    if (!currentRegister) return 0;
    return currentRegister.withdrawals || 0;
  }, [cashRegisters]);

  const weekExtraIncome = useMemo(() => {
    return cashRegisters
      .filter(r => new Date(r.openedAt) >= weekStart)
      .reduce((sum, r) => sum + (r.extraIncome || 0), 0);
  }, [cashRegisters, weekStart]);

  const weekWithdrawals = useMemo(() => {
    return cashRegisters
      .filter(r => new Date(r.openedAt) >= weekStart)
      .reduce((sum, r) => sum + (r.withdrawals || 0), 0);
  }, [cashRegisters, weekStart]);

  const monthExtraIncome = useMemo(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return cashRegisters
      .filter(r => new Date(r.openedAt) >= firstDayOfMonth)
      .reduce((sum, r) => sum + (r.extraIncome || 0), 0);
  }, [cashRegisters]);

  const monthWithdrawals = useMemo(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return cashRegisters
      .filter(r => new Date(r.openedAt) >= firstDayOfMonth)
      .reduce((sum, r) => sum + (r.withdrawals || 0), 0);
  }, [cashRegisters]);

  const weekSalesTotal = weekSales.reduce((sum, s) => sum + s.total, 0);
  const weekTotal = weekSalesTotal + weekExtraIncome;

  const monthSalesTotal = monthSales.reduce((sum, s) => sum + s.total, 0);
  const monthTotal = monthSalesTotal + monthExtraIncome;
  
  const todayProductCost = useMemo(() => {
    return todaySales.reduce((sum, s) => {
      const cost = (s.items || []).reduce((itemSum, item) => {
        if (item.category?.toLowerCase() === 'streaming') return itemSum;
        const purchasePrice = Number(item.purchasePrice) || 0;
        const qty = Number(item.quantity) || 0;
        return itemSum + (purchasePrice * qty);
      }, 0);
      return sum + cost;
    }, 0);
  }, [todaySales]);

  const todayStreamingCost = useMemo(() => {
    return todaySales.reduce((sum, s) => {
      const cost = (s.items || []).reduce((itemSum, item) => {
        if (item.category?.toLowerCase() !== 'streaming') return itemSum;
        const purchasePrice = Number(item.purchasePrice) || 0;
        const qty = Number(item.quantity) || 0;
        return itemSum + (purchasePrice * qty);
      }, 0);
      return sum + cost;
    }, 0);
  }, [todaySales]);

  const weekProductCost = useMemo(() => {
    return weekSales.reduce((sum, s) => {
      const cost = (s.items || []).reduce((itemSum, item) => {
        if (item.category?.toLowerCase() === 'streaming') return itemSum;
        const purchasePrice = Number(item.purchasePrice) || 0;
        const qty = Number(item.quantity) || 0;
        return itemSum + (purchasePrice * qty);
      }, 0);
      return sum + cost;
    }, 0);
  }, [weekSales]);

  const weekStreamingCost = useMemo(() => {
    return weekSales.reduce((sum, s) => {
      const cost = (s.items || []).reduce((itemSum, item) => {
        if (item.category?.toLowerCase() !== 'streaming') return itemSum;
        const purchasePrice = Number(item.purchasePrice) || 0;
        const qty = Number(item.quantity) || 0;
        return itemSum + (purchasePrice * qty);
      }, 0);
      return sum + cost;
    }, 0);
  }, [weekSales]);

  // Calculate net profit for the week (Ingresos - Costos - Gastos)
  const weekNetProfit = weekSales.reduce((sum, s) => {
    const saleProfit = (s.items || []).reduce((itemSum, item) => {
      const price = Number(item.salePrice) || 0;
      const discount = Number(item.discount) || 0;
      const discountAmount = discount > 0 ? price * (discount / 100) : 0;
      const finalPrice = price - discountAmount;
      const purchasePrice = Number(item.purchasePrice) || 0;
      const qty = Number(item.quantity) || 0;
      return itemSum + ((finalPrice - purchasePrice) * qty);
    }, 0);
    
    const commissionDeduction = (s.commissionPayer === 'vendedor' && s.commission) ? Number(s.commission) : 0;
    
    return sum + saleProfit - commissionDeduction;
  }, 0) + weekExtraIncome - weekWithdrawals;

  const recentSales = useMemo(() => {
    return [...sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }, [sales]);

  const [chartPeriod, setChartPeriod] = useState<'week' | 'month' | 'year'>('week');

  const chartData = useMemo(() => {
    const data: Record<string, number> = {};
    const now = new Date();
    
    if (chartPeriod === 'week') {
      const last7Days = Array.from({ length: 7 }).map((_, i) => {
        const d = subDays(now, 6 - i);
        return format(d, 'dd MMM', { locale: es });
      });
      last7Days.forEach(day => data[day] = 0);

      const recentSalesData = sales.filter(s => isAfter(new Date(s.date), startOfDay(subDays(now, 6))));
      recentSalesData.forEach(s => {
        const day = format(new Date(s.date), 'dd MMM', { locale: es });
        if (data[day] !== undefined) {
          data[day] += s.total;
        }
      });

      // Add extra incomes & subtract withdrawals for each day
      cashRegisters.forEach(r => {
        if (r.movements) {
          r.movements.forEach(m => {
            if (m.date && isAfter(new Date(m.date), startOfDay(subDays(now, 6)))) {
              const day = format(new Date(m.date), 'dd MMM', { locale: es });
              if (data[day] !== undefined) {
                if (m.type === 'extra_income') {
                  data[day] += m.amount;
                } else if (m.type === 'withdrawal') {
                  data[day] -= m.amount;
                }
              }
            }
          });
        }
      });
    } else if (chartPeriod === 'month') {
      const last30Days = Array.from({ length: 30 }).map((_, i) => {
        const d = subDays(now, 29 - i);
        return format(d, 'dd MMM', { locale: es });
      });
      last30Days.forEach(day => data[day] = 0);

      const recentSalesData = sales.filter(s => isAfter(new Date(s.date), startOfDay(subDays(now, 29))));
      recentSalesData.forEach(s => {
        const day = format(new Date(s.date), 'dd MMM', { locale: es });
        if (data[day] !== undefined) {
          data[day] += s.total;
        }
      });

      // Add extra incomes & subtract withdrawals for each day
      cashRegisters.forEach(r => {
        if (r.movements) {
          r.movements.forEach(m => {
            if (m.date && isAfter(new Date(m.date), startOfDay(subDays(now, 29)))) {
              const day = format(new Date(m.date), 'dd MMM', { locale: es });
              if (data[day] !== undefined) {
                if (m.type === 'extra_income') {
                  data[day] += m.amount;
                } else if (m.type === 'withdrawal') {
                  data[day] -= m.amount;
                }
              }
            }
          });
        }
      });
    } else if (chartPeriod === 'year') {
      const last12Months = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
        return format(d, 'MMM yyyy', { locale: es });
      });
      last12Months.forEach(month => data[month] = 0);

      const recentSalesData = sales.filter(s => isAfter(new Date(s.date), new Date(now.getFullYear(), now.getMonth() - 11, 1)));
      recentSalesData.forEach(s => {
        const month = format(new Date(s.date), 'MMM yyyy', { locale: es });
        if (data[month] !== undefined) {
          data[month] += s.total;
        }
      });

      // Add extra incomes & subtract withdrawals for each month
      cashRegisters.forEach(r => {
        if (r.movements) {
          r.movements.forEach(m => {
            if (m.date && isAfter(new Date(m.date), new Date(now.getFullYear(), now.getMonth() - 11, 1))) {
              const month = format(new Date(m.date), 'MMM yyyy', { locale: es });
              if (data[month] !== undefined) {
                if (m.type === 'extra_income') {
                  data[month] += m.amount;
                } else if (m.type === 'withdrawal') {
                  data[month] -= m.amount;
                }
              }
            }
          });
        }
      });
    }

    return Object.entries(data).map(([date, total]) => ({ date, total }));
  }, [sales, cashRegisters, chartPeriod]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.3 }}
      className="h-full flex flex-col space-y-6 overflow-y-auto"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={`grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${currentUser?.role === 'Cajero' ? '' : 'xl:grid-cols-6'}`}>
        <motion.div whileHover={{ y: -4 }} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 bg-orange-50 dark:bg-orange-900/30 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-400">
              <Clock className="w-5 h-5" />
            </div>
            <button onClick={() => toggleDashboardVisibility('todaySales')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              {dashboardVisibility?.todaySales !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400 uppercase">VENTAS DE HOY</p>
          <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mt-1.5">
            {dashboardVisibility?.todaySales !== false ? formatCurrency(todayTotal + todayExtraIncome, settings?.currency) : '••••••'}
          </h3>
        </motion.div>

        {currentUser?.role !== 'Cajero' && (
          <motion.div whileHover={{ y: -4 }} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                <Wallet className="w-5 h-5" />
              </div>
              <button onClick={() => toggleDashboardVisibility('netProfit')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                {dashboardVisibility?.netProfit !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400 uppercase">GANANCIA NETA (SEMANAL)</p>
            <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-green-600 dark:text-green-400 mt-1.5 line-clamp-1">
              {dashboardVisibility?.netProfit !== false ? formatCurrency(weekNetProfit, settings?.currency) : '••••••'}
            </h3>
          </motion.div>
        )}

        {currentUser?.role !== 'Cajero' && (
          <motion.div whileHover={{ y: -4 }} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <button onClick={() => toggleDashboardVisibility('productCost')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                {dashboardVisibility?.productCost !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400 uppercase">COSTO PRODUCTOS (SEMANAL)</p>
            <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-red-600 dark:text-red-400 mt-1.5 line-clamp-1">
              {dashboardVisibility?.productCost !== false ? formatCurrency(weekProductCost, settings?.currency) : '••••••'}
            </h3>
          </motion.div>
        )}

        {currentUser?.role !== 'Cajero' && (
          <motion.div whileHover={{ y: -4 }} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 bg-violet-50 dark:bg-violet-900/30 rounded-full flex items-center justify-center text-violet-600 dark:text-violet-400">
                <Tv className="w-5 h-5" />
              </div>
              <button onClick={() => toggleDashboardVisibility('streamingCost')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                {dashboardVisibility?.streamingCost !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400 uppercase">COSTO STREAMING (SEMANAL)</p>
            <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-violet-600 dark:text-violet-400 mt-1.5 line-clamp-1">
              {dashboardVisibility?.streamingCost !== false ? formatCurrency(weekStreamingCost, settings?.currency) : '••••••'}
            </h3>
          </motion.div>
        )}

        <motion.div whileHover={{ y: -4 }} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <button onClick={() => toggleDashboardVisibility('weekSales')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              {dashboardVisibility?.weekSales !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400 uppercase">VENTAS SEMANA</p>
          <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mt-1.5">
            {dashboardVisibility?.weekSales !== false ? formatCurrency(weekTotal, settings?.currency) : '••••••'}
          </h3>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 bg-purple-50 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Calendar className="w-5 h-5" />
            </div>
            <button onClick={() => toggleDashboardVisibility('monthSales')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              {dashboardVisibility?.monthSales !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400 uppercase">VENTAS DEL MES</p>
          <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mt-1.5">
            {dashboardVisibility?.monthSales !== false ? formatCurrency(monthTotal, settings?.currency) : '••••••'}
          </h3>
        </motion.div>
      </div>

      {/* Quick Actions */}
      {currentUser?.role !== 'Cajero' && (
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => {
              navigate('/inventory?action=new-product', { state: { openNewProductModal: true } });
            }}
            className="flex items-center justify-center gap-2 py-2 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-200 dark:shadow-none transition-all transform hover:scale-[1.02] active:scale-[0.98] min-w-[160px]"
          >
            <PackagePlus className="w-5 h-5" />
            <span className="font-bold">Nuevo Producto</span>
          </button>

          <button 
            onClick={() => {
              setAdjustmentType('entrada');
              setIsAdjustmentModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 py-2 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-200 dark:shadow-none transition-all transform hover:scale-[1.02] active:scale-[0.98] min-w-[160px]"
          >
            <PlusCircle className="w-5 h-5" />
            <span className="font-bold">Nueva Entrada</span>
          </button>

          <button 
            onClick={() => {
              setAdjustmentType('salida');
              setIsAdjustmentModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 py-2 px-6 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md shadow-rose-200 dark:shadow-none transition-all transform hover:scale-[1.02] active:scale-[0.98] min-w-[160px]"
          >
            <MinusCircle className="w-5 h-5" />
            <span className="font-bold">Nueva Salida</span>
          </button>

          <button 
            onClick={() => setIsReplenishModalOpen(true)}
            className="flex items-center justify-center gap-2 py-2 px-6 bg-[#ff6b00] hover:bg-[#e66000] text-white rounded-xl shadow-md shadow-orange-200 dark:shadow-none transition-all transform hover:scale-[1.02] active:scale-[0.98] min-w-[160px]"
          >
            <ClipboardList className="w-5 h-5" />
            <span className="font-bold">Reponer Stock</span>
          </button>

          <button 
            onClick={() => setIsLessSoldModalOpen(true)}
            className="flex items-center justify-center gap-2 py-2 px-6 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md shadow-red-200 dark:shadow-none transition-all transform hover:scale-[1.02] active:scale-[0.98] min-w-[160px]"
          >
            <TrendingDown className="w-5 h-5" />
            <span className="font-bold">Menos Vendidos</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Tendencias de Ingresos</h3>
            <div className="flex items-center space-x-4">
              <select 
                value={chartPeriod}
                onChange={(e) => setChartPeriod(e.target.value as any)}
                className="text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 dark:text-gray-300"
              >
                <option value="week">Últimos 7 días</option>
                <option value="month">Últimos 30 días</option>
                <option value="year">Últimos 12 meses</option>
              </select>
              <Link to="/reports" className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">
                Ver reporte completo
              </Link>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '8px', 
                    border: theme === 'dark' ? '1px solid #374151' : 'none', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                    color: theme === 'dark' ? '#f3f4f6' : '#111827'
                  }}
                  formatter={(value: number) => [formatCurrency(value, settings?.currency), 'Total']}
                />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" />
              Stock Bajo
            </h3>
            <Link to="/inventory" className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">
              Ir a inventario
            </Link>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {lowStockProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-2">
                <Package className="h-10 w-10 opacity-20" />
                <p className="text-sm">Todo el stock está bien</p>
              </div>
            ) : (
              lowStockProducts.map(product => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                  <div className="flex items-center space-x-3">
                    <div 
                      className={`h-10 w-10 rounded-lg bg-white dark:bg-gray-800 overflow-hidden flex-shrink-0 ${product.image ? 'cursor-zoom-in hover:ring-2 hover:ring-red-500/55 hover:shadow-sm transition-all' : ''}`}
                      onClick={() => product.image && setZoomImage({ url: product.image, name: product.name })}
                      title={product.image ? "Click para ampliar" : undefined}
                    >
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                          <Package className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900 dark:text-white line-clamp-1">{product.name}</p>
                      <p className="text-xs text-red-600 dark:text-red-400 font-medium">Stock: {product.stock} / Min: {product.minStock}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Ventas Recientes</h3>
          <Link to="/sales" className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">
            Ver todas
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Ticket</th>
                <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Fecha</th>
                <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Artículos</th>
                <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Método</th>
                <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {recentSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="p-4 font-medium text-gray-900 dark:text-white">#{sale.id}</td>
                  <td className="p-4 text-gray-600 dark:text-gray-300">
                    {format(new Date(sale.date), 'dd/MM/yyyy HH:mm')}
                  </td>
                  <td className="p-4 text-gray-600 dark:text-gray-300">
                    {sale.items.reduce((sum, item) => sum + item.quantity, 0)}
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                      {sale.paymentMethod}
                    </span>
                  </td>
                  <td className="p-4 text-right font-bold text-gray-900 dark:text-white">
                    {formatCurrency(sale.total, settings.currency)}
                  </td>
                </tr>
              ))}
              {recentSales.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No hay ventas recientes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <StockReplenishmentModal 
        isOpen={isReplenishModalOpen} 
        onClose={() => setIsReplenishModalOpen(false)} 
      />

      <QuickMovementModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        type={adjustmentType}
      />

      <LessSoldProductsModal
        isOpen={isLessSoldModalOpen}
        onClose={() => setIsLessSoldModalOpen(false)}
      />

      <ProductImageModal
        isOpen={!!zoomImage}
        onClose={() => setZoomImage(null)}
        imageUrl={zoomImage?.url || ''}
        productName={zoomImage?.name || ''}
      />
    </motion.div>
  );
}
