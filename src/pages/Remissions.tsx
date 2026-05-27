import React, { useState } from 'react';
import { useStore, defaultSettings } from '../store/useStore';
import { Plus, Search, FileText, Trash2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../utils/format';
import { Remission, RemissionItem } from '../types';
import { jsPDF } from 'jspdf';
import { useNavigate } from 'react-router-dom';
import { generateRemissionPDF } from '../utils/pdf';

export default function Remissions() {
  const { 
    remissions = [], 
    addRemission, 
    deleteRemission, 
    settings = defaultSettings,
    currentUser
  } = useStore();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (currentUser?.role === 'Cajero') {
      navigate('/', { replace: true });
    }
  }, [currentUser, navigate]);

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  if (currentUser?.role === 'Cajero') {
    return null;
  }
  
  // New Remission State
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<RemissionItem[]>([]);
  
  // New Item State
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState(0);

  const filteredRemissions = remissions.filter(r => 
    r.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  ).reverse();

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemDesc || newItemQty <= 0 || newItemPrice < 0) return;

    const newItem: RemissionItem = {
      id: Math.random().toString(36).substr(2, 9),
      description: newItemDesc,
      quantity: newItemQty,
      unitPrice: newItemPrice,
      total: newItemQty * newItemPrice
    };

    setItems([...items, newItem]);
    setNewItemDesc('');
    setNewItemQty(1);
    setNewItemPrice(0);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleSaveRemission = (downloadPdf = true) => {
    if (items.length === 0) {
      alert('Agrega al menos un artículo a la nota de remisión.');
      return;
    }

    const total = items.reduce((sum, item) => sum + item.total, 0);
    const folio = `REM-${(remissions.length + 1).toString().padStart(4, '0')}`;

    const newRemission: Remission = {
      id: Math.random().toString(36).substr(2, 9),
      folio,
      date: new Date().toISOString(),
      customerName: customerName || 'Público en General',
      items,
      total,
      notes
    };

    addRemission(newRemission);

    if (downloadPdf) {
      generateRemissionPDF(newRemission, settings);
    }

    setIsCreating(false);
    setCustomerName('');
    setNotes('');
    setItems([]);
  };

  const handlePrintRemission = (remission: Remission) => {
    generateRemissionPDF(remission, settings);
  };

  if (isCreating) {
    return (
      <div className="h-full flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsCreating(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-600 dark:text-gray-300"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nueva Nota de Remisión</h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleSaveRemission(false)}
              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-colors text-sm"
            >
              Solo Guardar
            </button>
            <button
              onClick={() => handleSaveRemission(true)}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm shadow-blue-200 dark:shadow-none flex items-center gap-2 text-sm"
            >
              <FileText className="w-4 h-4" />
              Guardar y Descargar PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Agregar Concepto</h2>
              <form onSubmit={handleAddItem} className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
                  <input
                    type="text"
                    required
                    value={newItemDesc}
                    onChange={(e) => setNewItemDesc(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white"
                    placeholder="Ej. Servicio de mantenimiento"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cant.</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Precio Unit.</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newItemPrice === 0 ? '' : newItemPrice}
                    onChange={(e) => setNewItemPrice(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white"
                    placeholder="0.00"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-colors h-[42px]"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </form>

              <div className="mt-6">
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Conceptos Agregados</h3>
                {items.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">No hay conceptos agregados aún.</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{item.description}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {item.quantity} x {formatCurrency(item.unitPrice, settings.currency)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="font-bold text-gray-900 dark:text-white">
                            {formatCurrency(item.total, settings.currency)}
                          </span>
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Detalles</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente (Opcional)</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white"
                    placeholder="Público en General"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas Adicionales</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white resize-none"
                    placeholder="Garantía, condiciones, etc."
                    rows={3}
                  />
                </div>
                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">Total</span>
                    <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                      {formatCurrency(items.reduce((sum, item) => sum + item.total, 0), settings.currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notas de Remisión</h1>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-sm shadow-blue-200 dark:shadow-none"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nueva Remisión
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar por folio o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Folio</th>
                <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Fecha</th>
                <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Cliente</th>
                <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Total</th>
                <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredRemissions.map((remission) => (
                <tr key={remission.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="p-4 font-medium text-gray-900 dark:text-white">
                    {remission.folio}
                  </td>
                  <td className="p-4 text-gray-600 dark:text-gray-300">
                    {format(new Date(remission.date), 'dd/MM/yyyy HH:mm')}
                  </td>
                  <td className="p-4 text-gray-600 dark:text-gray-300">
                    {remission.customerName}
                  </td>
                  <td className="p-4 font-bold text-gray-900 dark:text-white">
                    {formatCurrency(remission.total, settings.currency)}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handlePrintRemission(remission)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        title="Imprimir"
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('¿Estás seguro de que deseas eliminar esta nota de remisión?')) {
                            deleteRemission(remission.id);
                          }
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRemissions.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No se encontraron notas de remisión.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
