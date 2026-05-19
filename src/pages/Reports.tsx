import React, { useState, useMemo } from 'react';
import { useStore, defaultSettings } from '../store/useStore';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, isAfter, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../utils/format';
import { Calendar, TrendingUp, Package, DollarSign, Download, RefreshCw, ShoppingCart, CreditCard, Percent, TrendingDown, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function Reports() {
  const { 
    sales = [], 
    products = [], 
    settings = defaultSettings, 
    theme,
    cashRegisters = []
  } = useStore();
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year'>('week');

  const filteredSales = useMemo(() => {
    const now = new Date();
    let startDate = startOfDay(now);

    if (dateRange === 'week') startDate = startOfDay(subDays(now, 7));
    if (dateRange === 'month') startDate = startOfDay(subDays(now, 30));
    if (dateRange === 'year') startDate = startOfDay(subDays(now, 365));

    return sales.filter(s => isAfter(new Date(s.date), startDate));
  }, [sales, dateRange]);

  const stats = useMemo(() => {
    const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0);
    const totalTaxes = filteredSales.reduce((sum, s) => sum + (s.tax || 0), 0);
    const totalDiscounts = filteredSales.reduce((sum, s) => {
      return sum + s.items.reduce((itemSum, item) => {
        const itemTotal = item.salePrice * item.quantity;
        const discountAmount = item.discount > 0 ? itemTotal * (item.discount / 100) : 0;
        return itemSum + discountAmount;
      }, 0);
    }, 0);

    const totalProfit = filteredSales.reduce((sum, s) => {
      const saleProfit = s.items.reduce((itemSum, item) => {
        const price = item.salePrice;
        const discountAmount = item.discount > 0 ? price * (item.discount / 100) : 0;
        const finalPrice = price - discountAmount;
        return itemSum + ((finalPrice - item.purchasePrice) * item.quantity);
      }, 0);
      
      const commissionDeduction = (s.commissionPayer === 'vendedor' && s.commission) ? s.commission : 0;
      return sum + saleProfit - commissionDeduction;
    }, 0);

    const totalCost = filteredSales.reduce((sum, s) => {
      return sum + s.items.reduce((itemSum, item) => itemSum + (item.purchasePrice * item.quantity), 0);
    }, 0);

    // Include extra income and withdrawals for the period
    const now = new Date();
    let startDate = startOfDay(now);
    if (dateRange === 'week') startDate = startOfDay(subDays(now, 7));
    if (dateRange === 'month') startDate = startOfDay(subDays(now, 30));
    if (dateRange === 'year') startDate = startOfDay(subDays(now, 365));

    const periodExtraIncome = cashRegisters
      .filter(r => new Date(r.openedAt) >= startDate)
      .reduce((sum, r) => sum + (r.extraIncome || 0), 0);

    const periodWithdrawals = cashRegisters
      .filter(r => new Date(r.openedAt) >= startDate)
      .reduce((sum, r) => sum + (r.withdrawals || 0), 0);

    return {
      totalSales,
      totalCost,
      totalProfit: totalProfit + periodExtraIncome - periodWithdrawals,
      count: filteredSales.length,
      average: filteredSales.length > 0 ? totalSales / filteredSales.length : 0,
      taxes: totalTaxes,
      discounts: totalDiscounts
    };
  }, [filteredSales, dateRange, cashRegisters]);

  const salesAndProfitByDate = useMemo(() => {
    const data: Record<string, { date: string, total: number, profit: number }> = {};
    
    // Initialize last 7 days if week is selected
    if (dateRange === 'week') {
      for (let i = 6; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const label = format(d, 'dd MMM', { locale: es });
        data[label] = { date: label, total: 0, profit: 0 };
      }
    }

    filteredSales.forEach(s => {
      const label = format(new Date(s.date), 'dd MMM', { locale: es });
      if (!data[label]) data[label] = { date: label, total: 0, profit: 0 };
      
      data[label].total += s.total;
      
      const saleProfit = s.items.reduce((itemSum, item) => {
        const price = item.salePrice;
        const discountAmount = item.discount > 0 ? price * (item.discount / 100) : 0;
        const finalPrice = price - discountAmount;
        return itemSum + ((finalPrice - item.purchasePrice) * item.quantity);
      }, 0);
      const commissionDeduction = (s.commissionPayer === 'vendedor' && s.commission) ? s.commission : 0;
      data[label].profit += saleProfit - commissionDeduction;
    });

    return Object.values(data);
  }, [filteredSales, dateRange]);

  const paymentMethods = useMemo(() => {
    const data: Record<string, number> = {};
    filteredSales.forEach(s => {
      data[s.paymentMethod] = (data[s.paymentMethod] || 0) + s.total;
    });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [filteredSales]);

  const topProfitableProducts = useMemo(() => {
    const data: Record<string, { name: string, profit: number, quantity: number, image?: string }> = {};
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        if (!data[item.id]) {
          data[item.id] = { name: item.name, profit: 0, quantity: 0, image: item.image };
        }
        const profit = ((item.salePrice * (1 - (item.discount || 0) / 100)) - item.purchasePrice) * item.quantity;
        data[item.id].profit += profit;
        data[item.id].quantity += item.quantity;
      });
    });
    return Object.values(data).sort((a, b) => b.profit - a.profit).slice(0, 5);
  }, [filteredSales]);

  const topSoldProducts = useMemo(() => {
    const data: Record<string, { name: string, quantity: number, image?: string }> = {};
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        if (!data[item.id]) {
          data[item.id] = { name: item.name, quantity: 0, image: item.image };
        }
        data[item.id].quantity += item.quantity;
      });
    });
    return Object.values(data).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  }, [filteredSales]);

  const lowRotationProducts = useMemo(() => {
    const salesData: Record<string, number> = {};
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        salesData[item.id] = (salesData[item.id] || 0) + item.quantity;
      });
    });

    return products
      .filter(p => p.tracksInventory)
      .map(p => ({
        ...p,
        soldQuantity: salesData[p.id] || 0
      }))
      .sort((a, b) => a.soldQuantity - b.soldQuantity)
      .slice(0, 5);
  }, [filteredSales, products]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Reporte de Ventas', 14, 20);
    doc.setFontSize(12);
    doc.text(`Periodo: ${dateRange === 'today' ? 'Hoy' : dateRange === 'week' ? 'Últimos 7 días' : dateRange === 'month' ? 'Últimos 30 días' : 'Último año'}`, 14, 30);
    doc.text(`Total Ventas: $${stats.totalSales.toFixed(2)}`, 14, 40);
    doc.text(`Costo de Productos: $${stats.totalCost.toFixed(2)}`, 14, 50);
    doc.text(`Ganancia Estimada: $${stats.totalProfit.toFixed(2)}`, 14, 60);

    autoTable(doc, {
      startY: 70,
      head: [['Fecha', 'Método', 'Total']],
      body: filteredSales.map(s => [
        format(new Date(s.date), 'dd/MM/yyyy HH:mm'),
        s.paymentMethod,
        `$${s.total.toFixed(2)}`
      ]),
    });

    doc.save(`Reporte_Ventas_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredSales.map(s => ({
      ID: s.id,
      Fecha: format(new Date(s.date), 'dd/MM/yyyy HH:mm'),
      Subtotal: s.subtotal,
      IVA: s.tax,
      Total: s.total,
      Costo: s.items.reduce((sum, item) => sum + (item.purchasePrice * item.quantity), 0),
      Ganancia: s.items.reduce((sum, item) => {
        const price = item.salePrice;
        const discountAmount = item.discount > 0 ? price * (item.discount / 100) : 0;
        const finalPrice = price - discountAmount;
        return sum + ((finalPrice - item.purchasePrice) * item.quantity);
      }, 0) - ((s.commissionPayer === 'vendedor' && s.commission) ? s.commission : 0),
      MetodoPago: s.paymentMethod,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas");
    XLSX.writeFile(wb, `Reporte_Ventas_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <BarChart3 className="w-7 h-7 mr-2 text-blue-600" />
            Reportes y Estadísticas
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Analiza el rendimiento de tu negocio</p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
          {(['today', 'week', 'month', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                dateRange === range 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {range === 'today' ? 'Hoy' : range === 'week' ? 'Última Semana' : range === 'month' ? 'Último Mes' : 'Último Año'}
            </button>
          ))}
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1"></div>
          <button 
            onClick={() => window.location.reload()}
            className="p-1.5 text-gray-500 hover:text-blue-600 transition-colors"
            title="Refrescar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button 
          onClick={exportExcel} 
          className="flex items-center px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 dark:shadow-none"
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar Excel
        </button>
        <button 
          onClick={exportPDF} 
          className="flex items-center px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-md shadow-red-100 dark:shadow-none"
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar PDF
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Ventas</span>
          </div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white">
            {formatCurrency(stats.totalSales, settings.currency)}
          </h3>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2 text-orange-600 dark:text-orange-400 mb-2">
            <Package className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Costo</span>
          </div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white">
            {formatCurrency(stats.totalCost, settings.currency)}
          </h3>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2 text-green-600 dark:text-green-400 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Ganancia</span>
          </div>
          <h3 className="text-lg font-black text-green-600 dark:text-green-400">
            {formatCurrency(stats.totalProfit, settings.currency)}
          </h3>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400 mb-2">
            <ShoppingCart className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Transacciones</span>
          </div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white">
            {stats.count}
          </h3>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2 text-orange-600 dark:text-orange-400 mb-2">
            <CreditCard className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Ticket Prom.</span>
          </div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white">
            {formatCurrency(stats.average, settings.currency)}
          </h3>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2 text-cyan-600 dark:text-cyan-400 mb-2">
            <Percent className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Impuestos</span>
          </div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white">
            {formatCurrency(stats.taxes, settings.currency)}
          </h3>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 mb-2">
            <TrendingDown className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Descuentos</span>
          </div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white">
            {formatCurrency(stats.discounts, settings.currency)}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-6">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Ventas y Ganancias por Día</h3>
          </div>
          <div className="h-80">
            {salesAndProfitByDate.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <p>No hay datos para mostrar</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesAndProfitByDate}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff'
                    }} 
                  />
                  <Area type="monotone" dataKey="total" name="Ventas" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                  <Area type="monotone" dataKey="profit" name="Ganancia" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-6">
            <PieChartIcon className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Métodos de Pago</h3>
          </div>
          <div className="h-64 flex items-center justify-center">
            {paymentMethods.length === 0 ? (
              <div className="text-gray-400">No hay datos</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethods}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {paymentMethods.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                    formatter={(value: number) => formatCurrency(value, settings.currency)} 
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {paymentMethods.map((method, index) => (
              <div key={method.name} className="flex items-center text-xs">
                <div className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                <span className="text-gray-600 dark:text-gray-400 truncate">{method.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Profitable Products */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Productos Más Rentables</h3>
          </div>
          <div className="p-4">
            {topProfitableProducts.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center justify-center text-gray-400">
                <Package className="w-12 h-12 mb-2 opacity-20" />
                <p>No hay ventas en este período</p>
              </div>
            ) : (
              <div className="space-y-4">
                {topProfitableProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-lg bg-white dark:bg-gray-800 overflow-hidden border border-gray-100 dark:border-gray-700 shrink-0">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-gray-300">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-900 dark:text-white line-clamp-1">{product.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Vendidos: {product.quantity}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-green-600 dark:text-green-400">{formatCurrency(product.profit, settings.currency)}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Ganancia</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Low Rotation Products */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center space-x-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Productos con Menor Rotación</h3>
          </div>
          <div className="p-4">
            {lowRotationProducts.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center justify-center text-gray-400">
                <Package className="w-12 h-12 mb-2 opacity-20" />
                <p>No hay productos</p>
              </div>
            ) : (
              <div className="space-y-4">
                {lowRotationProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-lg bg-white dark:bg-gray-800 overflow-hidden border border-gray-100 dark:border-gray-700 shrink-0">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-gray-300">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-900 dark:text-white line-clamp-1">{product.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Stock Actual: {product.stock}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-red-600 dark:text-red-400">{product.soldQuantity}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Vendidos</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Top Sold Products Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Package className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Productos Más Vendidos (Cantidades)</h3>
          </div>
          <div className="h-64 flex items-center justify-center">
            {topSoldProducts.length === 0 ? (
              <div className="text-gray-400">No hay datos</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSoldProducts} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={100} axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }} />
                  <Tooltip 
                    cursor={{fill: theme === 'dark' ? '#374151' : '#f3f4f6'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                  />
                  <Bar dataKey="quantity" name="Vendidos" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Low Rotation Products Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden p-6">
          <div className="flex items-center space-x-2 mb-6">
            <TrendingDown className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Productos Menos Vendidos</h3>
          </div>
          <div className="h-64 flex items-center justify-center">
            {lowRotationProducts.length === 0 ? (
              <div className="text-gray-400">No hay datos</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lowRotationProducts} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={100} axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }} />
                  <Tooltip 
                    cursor={{fill: theme === 'dark' ? '#374151' : '#f3f4f6'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                  />
                  <Bar dataKey="soldQuantity" name="Vendidos" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
