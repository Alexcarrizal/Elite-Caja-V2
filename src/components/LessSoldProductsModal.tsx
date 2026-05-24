import React, { useMemo, useState } from 'react';
import { useStore, defaultSettings } from '../store/useStore';
import { X, TrendingDown, Package } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import ProductImageModal from './ProductImageModal';

interface LessSoldProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LessSoldProductsModal({ isOpen, onClose }: LessSoldProductsModalProps) {
  const { sales = [], products = [], settings = defaultSettings } = useStore();
  const [zoomImage, setZoomImage] = useState<{ url: string; name: string } | null>(null);

  const lessSoldProducts = useMemo(() => {
    // Calculate total sold quantity for each product across all sales
    const salesData: Record<string, number> = {};
    sales.forEach(s => {
      s.items.forEach(item => {
        salesData[item.id] = (salesData[item.id] || 0) + item.quantity;
      });
    });

    // Map through all products to get sold quantities, then sort ascending
    // We optionally include all products, even those not tracking inventory, or you can filter.
    return products
      .map(p => ({
        ...p,
        soldQuantity: salesData[p.id] || 0
      }))
      .sort((a, b) => a.soldQuantity - b.soldQuantity);
  }, [sales, products]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1a1f2e] text-gray-900 dark:text-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-800">
        <div className="p-4 bg-red-600 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-6 h-6" />
            <h2 className="text-xl font-bold">Productos Menos Vendidos</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#242b3d]">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Esta lista muestra todos tus productos ordenados por los que tienen la menor cantidad de ventas históricas, permitiéndote identificar inventario atascado.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {lessSoldProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <Package className="w-16 h-16 mb-4 opacity-20" />
              <p>No hay productos en el inventario.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lessSoldProducts.map((product) => (
                <div key={product.id} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                  <div 
                    className={`h-12 w-12 rounded-lg bg-white dark:bg-gray-700 overflow-hidden border border-gray-100 dark:border-gray-600 shrink-0 ${product.image ? 'cursor-zoom-in hover:ring-2 hover:ring-blue-500 hover:shadow-md transition-all' : ''}`}
                    onClick={() => product.image && setZoomImage({ url: product.image, name: product.name })}
                    title={product.image ? "Click para ampliar" : undefined}
                  >
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-gray-300 dark:text-gray-500">
                        <Package className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900 dark:text-white truncate" title={product.name}>{product.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Stock: {product.tracksInventory ? product.stock : 'N/A'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-red-600 dark:text-red-400 text-lg">{product.soldQuantity}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Vendidos</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#1a1f2e] flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-[#2d3548] dark:hover:bg-[#374151] text-gray-800 dark:text-white font-bold rounded-lg transition-colors"
          >
            Cerrar
          </button>
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
