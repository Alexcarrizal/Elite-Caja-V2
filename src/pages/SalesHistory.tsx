import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, defaultSettings } from '../store/useStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../utils/format';
import { Search, Trash2, Edit, Eye, FileText, AlertTriangle, MessageCircle, TrendingUp, DollarSign, Receipt, Banknote, Calendar, Filter, Package } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Sale, PaymentMethodType, CashMovement } from '../types';

import { generateReceiptPDF } from '../utils/pdf';
import { shareReceiptWhatsApp } from '../utils/receiptImage';

export default function SalesHistory() {
  const { 
    sales = [], 
    settings = defaultSettings, 
    deleteSale, 
    loadSaleIntoCart, 
    customers = [],
    cashRegisters = [],
    deleteMovement,
    editMovement
  } = useStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState<PaymentMethodType | 'all'>('all');
  const [editingMovement, setEditingMovement] = useState<CashMovement | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDescription, setEditDescription] = useState<string>('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethodType>('Efectivo');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isAlert?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  type HistoryItem = 
    | { type: 'sale'; data: Sale }
    | { type: 'income'; data: CashMovement };

  const allItems: HistoryItem[] = [
    ...sales.map(s => ({ type: 'sale' as const, data: s })),
    ...cashRegisters.flatMap(r => r.movements || []).filter(m => m.type === 'extra_income').map(m => ({ type: 'income' as const, data: m }))
  ];

  // Sorting items by date descending
  const sortedItems = allItems.sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());

  const filteredItems = sortedItems.filter(item => {
    const data = item.data;
    const isSale = item.type === 'sale';
    
    const matchesSearch = data.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (isSale ? (data as Sale).paymentMethod.toLowerCase().includes(searchTerm.toLowerCase()) : 'efectivo'.includes(searchTerm.toLowerCase())) ||
      (isSale && (data as Sale).customerName && (data as Sale).customerName!.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (!isSale && (data as CashMovement).description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesMethod = methodFilter === 'all' || (isSale ? (data as Sale).paymentMethod === methodFilter : methodFilter === 'Efectivo');
    
    let matchesDate = true;
    const itemDate = new Date(data.date);
    const now = new Date();
    
    if (dateFilter === 'today') {
      matchesDate = itemDate.toDateString() === now.toDateString();
    } else if (dateFilter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      matchesDate = itemDate >= weekAgo;
    } else if (dateFilter === 'month') {
      matchesDate = itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    }
    
    return matchesSearch && matchesMethod && matchesDate;
  });

  const stats = {
    total: filteredItems.reduce((sum, item) => sum + (item.type === 'sale' ? (item.data as Sale).total : (item.data as CashMovement).amount), 0),
    count: filteredItems.length,
    cash: filteredItems.reduce((sum, item) => {
      if (item.type === 'sale' && (item.data as Sale).paymentMethod === 'Efectivo') return sum + (item.data as Sale).total;
      if (item.type === 'income') return sum + (item.data as CashMovement).amount;
      return sum;
    }, 0),
    average: filteredItems.length > 0 ? filteredItems.reduce((sum, item) => sum + (item.type === 'sale' ? (item.data as Sale).total : (item.data as CashMovement).amount), 0) / filteredItems.length : 0
  };

  const handleDelete = (sale: Sale) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Venta',
      message: `¿Estás seguro de que deseas eliminar la venta #${sale.id}?\n\nEsta acción devolverá los productos al inventario y restará el monto de la caja actual (si está abierta).`,
      onConfirm: () => {
        deleteSale(sale.id);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleEdit = (sale: Sale) => {
    setConfirmModal({
      isOpen: true,
      title: 'Modificar Venta',
      message: `¿Deseas modificar la venta #${sale.id}?\n\nEsto cancelará la venta actual, devolverá los productos al inventario, y los cargará en el Punto de Venta para que puedas realizar los cambios necesarios y volver a cobrarla.`,
      onConfirm: () => {
        loadSaleIntoCart(sale.id);
        navigate('/pos');
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleView = (sale: Sale) => {
    setSelectedSale(sale);
    setIsViewModalOpen(true);
  };

  const handleWhatsAppReceipt = (sale: Sale) => {
    let phone = "";
    let name = "Cliente";

    if (sale.customerId && sale.customerId !== 'mostrador') {
      const customer = customers.find(c => c.id === sale.customerId);
      if (customer) {
        phone = customer.phone || "";
        name = customer.name || "Cliente";
      }
    }
    
    // Generate the JPG and share directly
    shareReceiptWhatsApp(sale, settings, phone, name);
  };

  const printReceipt = (sale: Sale) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 250]
    });

    let y = 10;
    const margin = 5;
    const width = 70;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.name, width / 2 + margin, y, { align: 'center' });
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (settings.rfc) {
      doc.text(`RFC: ${settings.rfc}`, width / 2 + margin, y, { align: 'center' });
      y += 5;
    }
    if (settings.address) {
      const addressLines = doc.splitTextToSize(settings.address, width);
      doc.text(addressLines, width / 2 + margin, y, { align: 'center' });
      y += (addressLines.length * 4) + 1;
    }
    if (settings.phone) {
      doc.text(`Tel: ${settings.phone}`, width / 2 + margin, y, { align: 'center' });
      y += 5;
    }

    y += 2;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, y, width + margin, y);
    y += 5;

    doc.text(`Ticket: #${sale.id}`, margin, y);
    y += 5;
    doc.text(`Fecha: ${format(new Date(sale.date), 'dd/MM/yyyy HH:mm')}`, margin, y);
    y += 5;
    if (sale.customerName) {
      doc.text(`Cliente: ${sale.customerName}`, margin, y);
      y += 5;
    }
    
    doc.line(margin, y, width + margin, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.text('Cant', margin, y);
    doc.text('Descripción', margin + 10, y);
    doc.text('Importe', width + margin, y, { align: 'right' });
    y += 5;
    doc.setFont('helvetica', 'normal');

    sale.items.forEach((item) => {
      doc.text(item.quantity.toString(), margin, y);
      
      let description = item.name;
      if (item.discount && item.discount > 0) {
        description += ` (-${item.discount}%)`;
      }
      
      const descLines = doc.splitTextToSize(description, 40);
      doc.text(descLines, margin + 10, y);
      
      const itemTotal = (item.salePrice * item.quantity * (1 - (item.discount || 0) / 100)).toFixed(2);
      doc.text(`$${itemTotal}`, width + margin, y, { align: 'right' });
      
      y += (descLines.length * 4) + 1;
    });

    y += 2;
    doc.line(margin, y, width + margin, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', margin + 20, y);
    doc.text(`$${sale.total.toFixed(2)}`, width + margin, y, { align: 'right' });
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const messageLines = doc.splitTextToSize(settings.receiptMessage || '¡Gracias por su compra!', width);
    doc.text(messageLines, width / 2 + margin, y, { align: 'center' });

    doc.save(`Ticket_${sale.id}.pdf`);
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Historial de Ventas</h1>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por ticket o método..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-shadow"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center space-x-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Ventas</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.total, settings.currency)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center space-x-4">
          <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-xl text-green-600 dark:text-green-400">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Transacciones</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.count}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Efectivo</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.cash, settings.currency)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center space-x-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Promedio</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.average, settings.currency)}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
          <Calendar className="w-4 h-4 ml-2 text-gray-400" />
          <select 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-sm text-gray-700 dark:text-gray-300 pr-8"
          >
            <option value="all">Todo el tiempo</option>
            <option value="today">Hoy</option>
            <option value="week">Últimos 7 días</option>
            <option value="month">Este mes</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setMethodFilter('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center ${
              methodFilter === 'all' 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none' 
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Todos
          </button>
          {(['Efectivo', 'Tarjeta', 'Transferencia', 'Mercado Pago', 'Mixto'] as PaymentMethodType[]).map((method) => (
            <button
              key={method}
              onClick={() => setMethodFilter(method)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center ${
                methodFilter === method 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none' 
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
              }`}
            >
              {method}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
              <tr>
                <th className="p-4 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Ticket</th>
                <th className="p-4 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Fecha</th>
                <th className="p-4 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Artículos</th>
                <th className="p-4 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Método</th>
                <th className="p-4 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Total</th>
                <th className="p-4 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredItems.map((item) => {
                if (item.type === 'sale') {
                  const sale = item.data as Sale;
                  return (
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
                      <td className="p-4 font-bold text-gray-900 dark:text-white">
                        {formatCurrency(sale.total, settings.currency)}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => handleView(sale)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors inline-flex"
                          title="Ver Detalles"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        {sale.customerId && customers.find(c => c.id === sale.customerId)?.phone && (
                          <button
                            onClick={() => handleWhatsAppReceipt(sale)}
                            className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors inline-flex"
                            title="Enviar Ticket por WhatsApp"
                          >
                            <MessageCircle className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(sale)}
                          className="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-colors inline-flex"
                          title="Modificar Venta"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => printReceipt(sale)}
                          className="p-2 text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors inline-flex"
                          title="Imprimir Ticket"
                        >
                          <FileText className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(sale)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors inline-flex"
                          title="Eliminar Venta"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                } else {
                  const income = item.data as CashMovement;
                  return (
                    <tr key={income.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors bg-green-50/30 dark:bg-green-900/10">
                      <td className="p-4 font-medium text-gray-900 dark:text-white">#{income.id.slice(0, 8)}</td>
                      <td className="p-4 text-gray-600 dark:text-gray-300">
                        {format(new Date(income.date), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="p-4 text-gray-600 dark:text-gray-300">
                        {income.description}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 w-fit">
                            Ingreso Extra
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {income.paymentMethod || 'Efectivo'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(income.amount, settings.currency)}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingMovement(income);
                            setEditAmount(income.amount);
                            setEditDescription(income.description);
                            setEditPaymentMethod(income.paymentMethod || 'Efectivo');
                          }}
                          className="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-colors inline-flex"
                          title="Modificar Ingreso"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              title: 'Eliminar Ingreso',
                              message: '¿Estás seguro de que deseas eliminar este ingreso extra?',
                              onConfirm: () => {
                                deleteMovement(income.id);
                                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                              }
                            });
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors inline-flex"
                          title="Eliminar Ingreso"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                }
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                      <Package className="w-16 h-16 mb-4 opacity-20" />
                      <p className="text-lg font-medium">No se encontraron ventas</p>
                      <p className="text-sm">Intenta ajustar tus filtros de búsqueda</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      {isViewModalOpen && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Detalles de Venta #{selectedSale.id}
              </h2>
              <button 
                onClick={() => setIsViewModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Fecha</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {format(new Date(selectedSale.date), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Método de Pago</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedSale.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Subtotal</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(selectedSale.subtotal, settings.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                  <p className="font-bold text-blue-600 dark:text-blue-400 text-lg">
                    {formatCurrency(selectedSale.total, settings.currency)}
                  </p>
                </div>
                {selectedSale.customerName && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Cliente</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedSale.customerName}</p>
                  </div>
                )}
              </div>

              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Productos</h3>
              <div className="space-y-3">
                {selectedSale.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {item.quantity} x {formatCurrency(item.salePrice, settings.currency)}
                        {item.discount ? ` (-${item.discount}%)` : ''}
                      </p>
                    </div>
                    <p className="font-bold text-gray-900 dark:text-white">
                      {formatCurrency(item.salePrice * item.quantity * (1 - (item.discount || 0) / 100), settings.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end space-x-3">
              <button 
                onClick={() => printReceipt(selectedSale)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center"
              >
                <FileText className="w-4 h-4 mr-2" />
                Imprimir Ticket
              </button>
              <button 
                onClick={() => setIsViewModalOpen(false)}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Movement Modal */}
      {editingMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md flex flex-col">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Modificar Ingreso Extra
              </h2>
              <button 
                onClick={() => setEditingMovement(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              editMovement(editingMovement.id, editAmount, editDescription, editingMovement.notes, editPaymentMethod);
              setEditingMovement(null);
            }} className="p-6 flex-1">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Monto
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Concepto
                  </label>
                  <input
                    type="text"
                    required
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Método de Pago
                  </label>
                  <select
                    value={editPaymentMethod}
                    onChange={(e) => setEditPaymentMethod(e.target.value as PaymentMethodType)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white appearance-none"
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Tarjeta">Tarjeta</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Mercado Pago">Mercado Pago</option>
                    <option value="CLIP">CLIP</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button 
                  type="button"
                  onClick={() => setEditingMovement(null)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900 dark:text-white mb-2">
              {confirmModal.title}
            </h3>
            <p className="text-center text-gray-600 dark:text-gray-300 mb-6 whitespace-pre-line">
              {confirmModal.message}
            </p>
            <div className="flex justify-center space-x-3">
              {!confirmModal.isAlert && (
                <button
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={confirmModal.onConfirm}
                className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                {confirmModal.isAlert ? 'Aceptar' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
