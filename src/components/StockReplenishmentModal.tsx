import React, { useMemo, useState } from 'react';
import { useStore, defaultSettings } from '../store/useStore';
import { 
  X, 
  Download, 
  PlusCircle, 
  Edit, 
  Trash2, 
  Truck,
  Package,
  Plus,
  Minus,
  CheckCircle,
  CheckSquare
} from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface StockReplenishmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterOption?: 'all' | 'zero';
}

export default function StockReplenishmentModal({ isOpen, onClose, filterOption = 'all' }: StockReplenishmentModalProps) {
  const { products = [], updateProduct, settings = defaultSettings } = useStore();
  const [replenishQuantities, setReplenishQuantities] = useState<Record<string, number>>({});
  
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editCost, setEditCost] = useState<number>(0);
  const [editPrice, setEditPrice] = useState<number>(0);

  const lowStockProducts = useMemo(() => {
    let filtered = products.filter(p => p.tracksInventory && p.stock <= p.minStock);
    if (filterOption === 'zero') {
      filtered = filtered.filter(p => p.stock <= 0);
    }
    return filtered;
  }, [products, filterOption]);

  const groupedBySupplier = useMemo(() => {
    const groups: Record<string, typeof lowStockProducts> = {};
    lowStockProducts.forEach(p => {
      const supplier = p.supplier || 'Sin Proveedor';
      if (!groups[supplier]) groups[supplier] = [];
      groups[supplier].push(p);
    });
    return groups;
  }, [lowStockProducts]);

  const handleQuantityChange = (productId: string, value: string) => {
    const qty = value === '' ? 0 : parseInt(value) || 0;
    setReplenishQuantities(prev => ({ ...prev, [productId]: qty }));
  };

  const handleEditClick = (product: any) => {
    setEditingProductId(product.id);
    setEditCost(product.purchasePrice || 0);
    setEditPrice(product.salePrice || 0);
  };

  const handleSaveEdit = (productId: string) => {
    updateProduct(productId, {
      purchasePrice: editCost,
      salePrice: editPrice
    });
    setEditingProductId(null);
  };

  const handleReplenishItem = (item: any, qty: number) => {
    if (qty > 0) {
      updateProduct(item.id, { stock: item.stock + qty });
      // Remove from our quantities map to reset
      const newQuantities = { ...replenishQuantities };
      delete newQuantities[item.id];
      setReplenishQuantities(newQuantities);
    }
  };

  const handleReplenishAll = () => {
    let count = 0;
    lowStockProducts.forEach(item => {
      const qty = replenishQuantities[item.id] !== undefined ? replenishQuantities[item.id] : (item.minStock * 2 - item.stock);
      if (qty > 0) {
        updateProduct(item.id, { stock: item.stock + qty });
        count++;
      }
    });
    if (count > 0) {
      setReplenishQuantities({});
      alert(`Stock actualizado para ${count} productos.`);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Lista de Reposición de Inventario', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);

    let currentY = 35;

    (Object.entries(groupedBySupplier) as [string, typeof lowStockProducts][]).forEach(([supplier, items]) => {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${supplier} (${items.length} productos)`, 14, currentY);
      currentY += 5;

      autoTable(doc, {
        startY: currentY,
        head: [['Producto', 'Categoría', 'Stock Actual', 'Mínimo', 'Cant. a Pedir']],
        body: items.map(item => [
          item.name,
          item.category,
          item.stock.toString(),
          item.minStock.toString(),
          replenishQuantities[item.id]?.toString() || (item.minStock * 2 - item.stock).toString()
        ]),
        margin: { left: 14 },
        theme: 'striped',
        headStyles: { fillColor: [249, 115, 22] } // Orange
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
      
      if (currentY > 270) {
        doc.addPage();
        currentY = 20;
      }
    });

    doc.save(`Lista_Reposicion_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1f2e] text-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-800">
        {/* Header */}
        <div className="p-4 bg-[#ff6b00] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-6 h-6" />
            <h2 className="text-xl font-bold">Lista de Reposición</h2>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={exportPDF}
              className="flex items-center gap-2 px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Descargar PDF
            </button>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Subtitle */}
        <div className="p-4 border-b border-gray-800">
          <p className="text-gray-400 text-sm">Productos que requieren compra inmediata, organizados por proveedor.</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {Object.entries(groupedBySupplier).length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 py-20">
              <Package className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg">No hay productos que requieran reposición actualmente.</p>
            </div>
          ) : (
            (Object.entries(groupedBySupplier) as [string, typeof lowStockProducts][]).map(([supplier, items]) => (
              <div key={supplier} className="bg-[#242b3d] rounded-xl overflow-hidden border border-gray-800">
                <div className="p-3 bg-[#2d3548] flex justify-between items-center border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-[#ff6b00]" />
                    <span className="font-bold">{supplier}</span>
                  </div>
                  <span className="text-xs bg-gray-700 px-2 py-1 rounded-full text-gray-300">
                    {items.length} productos
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-800">
                        <th className="p-3 font-medium uppercase text-xs">Producto</th>
                        <th className="p-3 font-medium uppercase text-xs">Categoría</th>
                        <th className="p-3 font-medium uppercase text-xs">Costo Est. / Precio</th>
                        <th className="p-3 font-medium uppercase text-xs text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {items.map(item => {
                        const qty = replenishQuantities[item.id] || (item.minStock * 2 - item.stock);
                        const estCost = item.purchasePrice * qty;
                        
                        return (
                          <React.Fragment key={item.id}>
                          <tr className="hover:bg-white/5 transition-colors">
                            <td className="p-3 font-medium">{item.name}</td>
                            <td className="p-3 text-blue-400">{item.category}</td>
                            <td className="p-3">
                              <span className="font-bold text-gray-200">{formatCurrency(estCost, settings.currency)}</span>
                              <span className="text-xs text-gray-500 block">Venta: {formatCurrency(item.salePrice, settings.currency)}</span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-end gap-2">
                                <input 
                                  type="number" 
                                  min="0"
                                  value={qty}
                                  onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                  className="w-16 bg-[#1a1f2e] border border-gray-700 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#ff6b00] outline-none"
                                />
                                <button onClick={() => handleQuantityChange(item.id, Math.max(0, qty - 1).toString())} className="p-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded transition-colors">
                                  <Minus className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleQuantityChange(item.id, (qty + 1).toString())} className="p-1.5 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded transition-colors">
                                  <Plus className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleEditClick(item)} className="p-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded transition-colors" title="Editar Costo/Precio">
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleReplenishItem(item, qty)} className="p-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 rounded transition-colors" title="Reponer Stock" disabled={qty <= 0}>
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleQuantityChange(item.id, '0')} className="p-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded transition-colors" title="No pedir">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {editingProductId === item.id && (
                            <tr className="bg-[#1a1f2e]/50 border-t border-gray-800">
                              <td colSpan={4} className="p-3">
                                <div className="flex items-center gap-4 bg-[#232936] p-3 rounded-lg border border-gray-700">
                                  <div className="flex-1">
                                    <label className="block text-xs text-gray-400 mb-1">Costo de Compra</label>
                                    <div className="relative">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                      <input 
                                        type="number" 
                                        value={editCost}
                                        onChange={(e) => setEditCost(Number(e.target.value))}
                                        className="w-full bg-[#1a1f2e] border border-gray-700 rounded pl-6 pr-2 py-1 text-sm outline-none focus:border-[#ff6b00]"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <label className="block text-xs text-gray-400 mb-1">Precio de Venta</label>
                                    <div className="relative">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                      <input 
                                        type="number" 
                                        value={editPrice}
                                        onChange={(e) => setEditPrice(Number(e.target.value))}
                                        className="w-full bg-[#1a1f2e] border border-gray-700 rounded pl-6 pr-2 py-1 text-sm outline-none focus:border-[#ff6b00]"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex items-end gap-2 pt-5">
                                    <button 
                                      onClick={() => setEditingProductId(null)}
                                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                                    >
                                      Cancelar
                                    </button>
                                    <button 
                                      onClick={() => handleSaveEdit(item.id)}
                                      className="px-3 py-1 bg-[#ff6b00] hover:bg-[#e66000] text-white text-sm font-medium rounded transition-colors"
                                    >
                                      Guardar
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-[#2d3548] hover:bg-[#374151] text-white font-bold rounded-lg transition-colors"
          >
            Cerrar
          </button>
          {lowStockProducts.length > 0 && (
            <button 
              onClick={handleReplenishAll}
              className="flex items-center gap-2 px-6 py-2 bg-[#ff6b00] hover:bg-[#e66000] text-white font-bold rounded-lg transition-colors"
            >
              <CheckSquare className="w-5 h-5" />
              Ingresar Todo el Stock
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
