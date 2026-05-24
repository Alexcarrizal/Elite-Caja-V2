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
import { useNavigate } from 'react-router-dom';
import ProductImageModal from '../components/ProductImageModal';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function Reports() {
  const { 
    sales = [], 
    products = [], 
    settings = defaultSettings, 
    theme,
    cashRegisters = [],
    currentUser
  } = useStore();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (currentUser?.role === 'Cajero') {
      navigate('/', { replace: true });
    }
  }, [currentUser, navigate]);

  const [filterType, setFilterType] = useState<'relative' | 'specific_week' | 'specific_month' | 'specific_year'>('relative');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year'>('week');
  const [selectedWeekDate, setSelectedWeekDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedMonthYear, setSelectedMonthYear] = useState<number>(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [zoomImage, setZoomImage] = useState<{ url: string; name: string } | null>(null);

  if (currentUser?.role === 'Cajero') {
    return null;
  }

  const currentPeriodRange = useMemo(() => {
    if (filterType === 'relative') {
      const now = new Date();
      let startDate = startOfDay(now);
      if (dateRange === 'today') startDate = startOfDay(now);
      else if (dateRange === 'week') startDate = startOfDay(subDays(now, 7));
      else if (dateRange === 'month') startDate = startOfDay(subDays(now, 30));
      else if (dateRange === 'year') startDate = startOfDay(subDays(now, 365));
      return { start: startDate, end: new Date() };
    }
    
    if (filterType === 'specific_week') {
      const refDate = new Date(selectedWeekDate + 'T12:00:00');
      const day = refDate.getDay();
      const diffToMonday = refDate.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(refDate);
      monday.setDate(diffToMonday);
      monday.setHours(0, 0, 0, 0);
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      
      return { start: monday, end: sunday };
    }
    
    if (filterType === 'specific_month') {
      const firstDay = new Date(selectedMonthYear, selectedMonth, 1, 0, 0, 0, 0);
      const lastDay = new Date(selectedMonthYear, selectedMonth + 1, 0, 23, 59, 59, 999);
      return { start: firstDay, end: lastDay };
    }
    
    if (filterType === 'specific_year') {
      const firstDay = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
      const lastDay = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
      return { start: firstDay, end: lastDay };
    }
    
    return { start: new Date(0), end: new Date() };
  }, [filterType, dateRange, selectedWeekDate, selectedMonth, selectedMonthYear, selectedYear]);

  const periodText = useMemo(() => {
    if (filterType === 'relative') {
      return dateRange === 'today' ? 'Hoy' 
        : dateRange === 'week' ? 'Últimos 7 días' 
        : dateRange === 'month' ? 'Últimos 30 días' 
        : 'Último año';
    }
    if (filterType === 'specific_week') {
      const { start, end } = currentPeriodRange;
      return `Semana del ${format(start, 'dd/MM/yyyy')} al ${format(end, 'dd/MM/yyyy')}`;
    }
    if (filterType === 'specific_month') {
      const { start } = currentPeriodRange;
      return `Mes de ${format(start, 'MMMM yyyy', { locale: es })}`;
    }
    if (filterType === 'specific_year') {
      return `Año ${selectedYear}`;
    }
    return '';
  }, [filterType, dateRange, currentPeriodRange, selectedYear]);

  const filteredSales = useMemo(() => {
    const { start, end } = currentPeriodRange;
    return sales.filter(s => {
      const saleDate = new Date(s.date);
      return saleDate >= start && saleDate <= end;
    });
  }, [sales, currentPeriodRange]);

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
    const { start, end } = currentPeriodRange;

    const periodExtraIncome = cashRegisters
      .filter(r => {
        const rDate = new Date(r.openedAt);
        return rDate >= start && rDate <= end;
      })
      .reduce((sum, r) => sum + (r.extraIncome || 0), 0);

    const periodWithdrawals = cashRegisters
      .filter(r => {
        const rDate = new Date(r.openedAt);
        return rDate >= start && rDate <= end;
      })
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
  }, [filteredSales, currentPeriodRange, cashRegisters]);

  const salesAndProfitByDate = useMemo(() => {
    const data: Record<string, { date: string, total: number, profit: number }> = {};
    const isYearly = filterType === 'specific_year' || (filterType === 'relative' && dateRange === 'year');
    
    // Initialize labels
    if (filterType === 'relative' && dateRange === 'week') {
      for (let i = 6; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const label = format(d, 'dd MMM', { locale: es });
        data[label] = { date: label, total: 0, profit: 0 };
      }
    } else if (filterType === 'specific_week') {
      const { start } = currentPeriodRange;
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const label = format(d, 'dd MMM', { locale: es });
        data[label] = { date: label, total: 0, profit: 0 };
      }
    } else if (filterType === 'specific_month') {
      const { start } = currentPeriodRange;
      const year = start.getFullYear();
      const month = start.getMonth();
      const numDays = new Date(year, month + 1, 0).getDate();
      for (let i = 1; i <= numDays; i++) {
        const d = new Date(year, month, i);
        const label = format(d, 'dd MMM', { locale: es });
        data[label] = { date: label, total: 0, profit: 0 };
      }
    } else if (isYearly) {
      const year = filterType === 'specific_year' ? selectedYear : new Date().getFullYear();
      for (let m = 0; m < 12; m++) {
        const d = new Date(year, m, 1);
        const label = format(d, 'MMM', { locale: es });
        data[label] = { date: label, total: 0, profit: 0 };
      }
    }

    filteredSales.forEach(s => {
      const sDate = new Date(s.date);
      const label = isYearly 
        ? format(sDate, 'MMM', { locale: es })
        : format(sDate, 'dd MMM', { locale: es });
        
      if (!data[label]) {
        data[label] = { date: label, total: 0, profit: 0 };
      }
      
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
  }, [filteredSales, filterType, dateRange, currentPeriodRange, selectedYear]);

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
    doc.text(`Periodo: ${periodText}`, 14, 30);
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
      </div>

      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              id="btn-filter-relative"
              onClick={() => setFilterType('relative')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                filterType === 'relative'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-50 dark:bg-gray-700/50 text-gray-650 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Período Rápido
            </button>
            <button
              id="btn-filter-week"
              onClick={() => setFilterType('specific_week')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                filterType === 'specific_week'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-50 dark:bg-gray-700/50 text-gray-650 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Por Semana
            </button>
            <button
              id="btn-filter-month"
              onClick={() => setFilterType('specific_month')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                filterType === 'specific_month'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-50 dark:bg-gray-700/50 text-gray-650 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Por Mes
            </button>
            <button
              id="btn-filter-year"
              onClick={() => setFilterType('specific_year')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                filterType === 'specific_year'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-50 dark:bg-gray-700/50 text-gray-650 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Por Año
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              id="btn-reports-reload"
              onClick={() => window.location.reload()}
              className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-gray-500 hover:text-blue-600 transition-colors border border-gray-150 dark:border-gray-700"
              title="Refrescar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dynamic Controls depending on selected filterType */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center gap-4 transition-all duration-200">
          {filterType === 'relative' && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 pr-2 font-mono">Segmentos:</span>
              {(['today', 'week', 'month', 'year'] as const).map((range) => (
                <button
                  key={range}
                  id={`btn-range-${range}`}
                  onClick={() => setDateRange(range)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    dateRange === range 
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50' 
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {range === 'today' ? 'Hoy' : range === 'week' ? 'Última Semana' : range === 'month' ? 'Último Mes' : 'Último Año'}
                </button>
              ))}
            </div>
          )}

          {filterType === 'specific_week' && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
              <div className="flex flex-col gap-1 min-w-[200px]">
                <label className="text-xs font-bold text-gray-500 uppercase font-mono">Selecciona un día de la semana:</label>
                <div className="relative">
                  <input
                    id="input-week-date"
                    type="date"
                    value={selectedWeekDate}
                    onChange={(e) => setSelectedWeekDate(e.target.value)}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-950 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <Calendar className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex items-center bg-blue-500/10 dark:bg-blue-500/5 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-950 px-4 py-2.5 rounded-xl text-xs font-bold mt-2 sm:mt-auto">
                <Calendar className="w-4 h-4 mr-2" />
                Semana calculada: {periodText}
              </div>
            </div>
          )}

          {filterType === 'specific_month' && (
            <div className="flex flex-wrap items-end gap-3 w-full">
              <div className="flex flex-col gap-1 min-w-[150px]">
                <label className="text-xs font-bold text-gray-500 uppercase font-mono">Mes:</label>
                <select
                  id="select-month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-950 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, idx) => (
                    <option key={idx} value={idx}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 min-w-[120px]">
                <label className="text-xs font-bold text-gray-500 uppercase font-mono">Año:</label>
                <select
                  id="select-month-year"
                  value={selectedMonthYear}
                  onChange={(e) => setSelectedMonthYear(Number(e.target.value))}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-950 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="bg-blue-500/10 dark:bg-blue-500/5 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-950 px-4 py-2.5 rounded-xl text-xs font-bold sm:mt-auto">
                Rango: {periodText}
              </div>
            </div>
          )}

          {filterType === 'specific_year' && (
            <div className="flex flex-wrap items-end gap-3 w-full">
              <div className="flex flex-col gap-1 min-w-[150px]">
                <label className="text-xs font-bold text-gray-500 uppercase font-mono">Año:</label>
                <select
                  id="select-year"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-950 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="bg-blue-500/10 dark:bg-blue-500/5 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-950 px-4 py-2.5 rounded-xl text-xs font-bold sm:mt-auto">
                Rango: {periodText}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-sm text-gray-800 dark:text-gray-200 font-bold">
            Mostrando resultados para: <span className="text-blue-600 dark:text-blue-400 underline decoration-2">{periodText}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button 
              id="btn-export-excel"
              onClick={exportExcel} 
              className="flex items-center px-4 py-2 bg-emerald-600 text-white font-extrabold text-xs rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 dark:shadow-none"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar Excel
            </button>
            <button 
              id="btn-export-pdf"
              onClick={exportPDF} 
              className="flex items-center px-4 py-2 bg-red-600 text-white font-extrabold text-xs rounded-xl hover:bg-red-700 transition-all shadow-md shadow-red-100 dark:shadow-none"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar PDF
            </button>
          </div>
        </div>
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
                      <div 
                        className={`h-10 w-10 rounded-lg bg-white dark:bg-gray-800 overflow-hidden border border-gray-100 dark:border-gray-700 shrink-0 ${product.image ? 'cursor-zoom-in hover:ring-2 hover:ring-blue-500 hover:shadow-md transition-all' : ''}`}
                        onClick={() => product.image && setZoomImage({ url: product.image, name: product.name })}
                        title={product.image ? "Click para ampliar" : undefined}
                      >
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
                      <div 
                        className={`h-10 w-10 rounded-lg bg-white dark:bg-gray-800 overflow-hidden border border-gray-100 dark:border-gray-700 shrink-0 ${product.image ? 'cursor-zoom-in hover:ring-2 hover:ring-blue-500 hover:shadow-md transition-all' : ''}`}
                        onClick={() => product.image && setZoomImage({ url: product.image, name: product.name })}
                        title={product.image ? "Click para ampliar" : undefined}
                      >
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

      <ProductImageModal
        isOpen={!!zoomImage}
        onClose={() => setZoomImage(null)}
        imageUrl={zoomImage?.url || ''}
        productName={zoomImage?.name || ''}
      />
    </div>
  );
}
