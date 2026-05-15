import React, { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { ShieldCheck, Search, Package, User, Clock, AlertTriangle } from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

function parseWarrantyDays(warrantyInput?: string): number | null {
  if (!warrantyInput) return null;
  const str = warrantyInput.toLowerCase().trim();
  let modifier = 1;
  // Plurals and variations are handled well enough by these basic checks
  if (str.includes('año') || str.includes('anio') || str.includes('year') || str.includes('años')) modifier = 365;
  else if (str.includes('mes') || str.includes('month') || str.includes('meses')) modifier = 30;
  else if (str.includes('dia') || str.includes('día') || str.includes('day') || str.includes('dias') || str.includes('días')) modifier = 1;
  
  const numMatch = str.match(/\d+(\.\d+)?/);
  if (numMatch) {
    return Math.round(parseFloat(numMatch[0]) * modifier);
  }
  return null;
}

export default function Warranties() {
  const { sales = [] } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  
  const warrantyItems = useMemo(() => {
    const items: Array<{
      id: string;
      saleId: string;
      saleDate: string;
      customerName: string;
      productName: string;
      warrantyString: string;
      warrantyDays: number | null;
      endDate: Date | null;
      daysRemaining: number | null;
      status: 'active' | 'expired' | 'unknown';
    }> = [];

    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (item.warranty && item.warranty.trim() !== '') {
          const wDays = parseWarrantyDays(item.warranty);
          let endDate: Date | null = null;
          let daysRemaining: number | null = null;
          let status: 'active' | 'expired' | 'unknown' = 'unknown';

          if (wDays !== null) {
            endDate = addDays(new Date(sale.date), wDays);
            daysRemaining = differenceInDays(endDate, new Date());
            if (daysRemaining >= 0) {
              status = 'active';
            } else {
              status = 'expired';
            }
          }

          items.push({
            id: `${sale.id}-${item.id}`,
            saleId: sale.id,
            saleDate: sale.date,
            customerName: sale.customerName || 'Cliente Mostrador',
            productName: item.name,
            warrantyString: item.warranty,
            warrantyDays: wDays,
            endDate,
            daysRemaining,
            status
          });
        }
      });
    });

    return items.sort((a, b) => {
      // sort by days remaining (active first, then expired)
      if (a.status === 'active' && b.status === 'active') {
        return (a.daysRemaining || 0) - (b.daysRemaining || 0);
      }
      if (a.status === 'active') return -1;
      if (b.status === 'active') return 1;
      return new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime();
    });
  }, [sales]);

  const filteredItems = warrantyItems.filter(item => {
    const term = searchTerm.toLowerCase();
    return item.productName.toLowerCase().includes(term) ||
           item.customerName.toLowerCase().includes(term) ||
           item.saleId.toLowerCase().includes(term) ||
           item.warrantyString.toLowerCase().includes(term);
  });

  // Calculate stats
  const activeWarranties = warrantyItems.filter(i => i.status === 'active').length;
  const expiredWarranties = warrantyItems.filter(i => i.status === 'expired').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-500" />
            Historial de Garantías
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Control de garantías de productos vendidos
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
            <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400">TOTAL CON GARANTÍA</p>
            <h3 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mt-1">
              {warrantyItems.length}
            </h3>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
            <Clock className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400">GARANTÍAS ACTIVAS</p>
            <h3 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mt-1">
              {activeWarranties}
            </h3>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
          <div className="p-3 bg-rose-50 dark:bg-rose-900/30 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400">GARANTÍAS VENCIDAS</p>
            <h3 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mt-1">
              {expiredWarranties}
            </h3>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar por cliente, producto o folio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Producto</th>
                <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Garantía</th>
                <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha Compra</th>
                <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredItems.map((item, i) => (
                <tr key={`${item.id}-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white truncate max-w-[150px] sm:max-w-[200px]">
                        {item.customerName}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                        <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <span className="text-gray-700 dark:text-gray-300 truncate max-w-[150px] sm:max-w-xs block">
                        {item.productName}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-gray-700 dark:text-gray-300 font-medium">
                    {item.warrantyString}
                  </td>
                  <td className="p-4 text-gray-500 dark:text-gray-400 text-sm">
                    {format(new Date(item.saleDate), 'dd MMM yyyy', { locale: es })}
                  </td>
                  <td className="p-4">
                    {item.status === 'active' && item.daysRemaining !== null ? (
                      <div className="inline-flex items-center px-2.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium border border-emerald-100 dark:border-emerald-800">
                        <Clock className="w-3.5 h-3.5 mr-1.5" />
                        Restan {item.daysRemaining} {item.daysRemaining === 1 ? 'día' : 'días'}
                      </div>
                    ) : item.status === 'expired' ? (
                      <div className="inline-flex items-center px-2.5 py-1.5 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-xs font-medium border border-rose-100 dark:border-rose-800">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                        Vencida
                      </div>
                    ) : (
                      <div className="inline-flex items-center px-2.5 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-medium border border-gray-200 dark:border-gray-700">
                        Indefinida
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No se encontraron garantías que coincidan con la búsqueda.
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
