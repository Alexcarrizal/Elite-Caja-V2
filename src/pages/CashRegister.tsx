import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore, defaultSettings } from '../store/useStore';
import { Wallet, ArrowDownCircle, ArrowUpCircle, FileText, Lock, Unlock, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, capitalizeFirst } from '../utils/format';
import { jsPDF } from 'jspdf';
import { PaymentMethodType } from '../types';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function CashRegister() {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    cashRegisters = [], 
    openRegister, 
    closeRegister, 
    addWithdrawal, 
    addExtraIncome, 
    deleteMovement, 
    editMovement, 
    settings = defaultSettings, 
    sales = [],
    logout
  } = useStore();
  const currentRegister = cashRegisters.find(r => r.status === 'open');
  const pastRegisters = cashRegisters.filter(r => r.status === 'closed').reverse();

  // Calculate profit of the day
  const today = new Date().toDateString();
  const salesToday = currentRegister 
    ? sales.filter(s => {
        const saleDate = new Date(s.date);
        const openDate = new Date(currentRegister.openedAt);
        return saleDate >= openDate;
      })
    : [];
  
  const todayExtraIncome = currentRegister ? (currentRegister.extraIncome || 0) : 0;

  const todayWithdrawals = currentRegister ? (currentRegister.withdrawals || 0) : 0;

  const profitToday = salesToday.reduce((totalProfit, sale) => {
    const saleProfit = sale.items.reduce((itemProfit, item) => {
      const price = item.salePrice;
      const discountAmount = item.discount > 0 ? price * (item.discount / 100) : 0;
      const finalPrice = price - discountAmount;
      return itemProfit + ((finalPrice - item.purchasePrice) * item.quantity);
    }, 0);
    
    const commissionDeduction = (sale.commissionPayer === 'vendedor' && sale.commission) ? sale.commission : 0;
    
    return totalProfit + saleProfit - commissionDeduction;
  }, 0) + todayExtraIncome - todayWithdrawals;

  const costToday = salesToday.reduce((totalCost, sale) => {
    return totalCost + sale.items.reduce((itemCost, item) => itemCost + (item.purchasePrice * item.quantity), 0);
  }, 0);

  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('Efectivo');
  const [actionType, setActionType] = useState<'open' | 'close' | 'withdraw' | 'income' | 'edit_movement' | null>(null);
  const [editingMovementId, setEditingMovementId] = useState<string | null>(null);
  const [logoutOnClose, setLogoutOnClose] = useState<boolean>(false);

  React.useEffect(() => {
    if (!currentRegister) {
      setActionType('open');
    }
  }, [currentRegister]);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actionType === 'open') {
      openRegister(amount);
      navigate('/');
    } else if (actionType === 'close') {
      if (currentRegister) {
        const closedRegister = {
          ...currentRegister,
          closedAt: new Date().toISOString(),
          actualCash: amount,
          difference: amount - currentRegister.expectedCash,
          status: 'closed' as const
        };
        generateReport(closedRegister);

        // Sync directly to Firestore if we have a firebase user
        if (auth.currentUser) {
          const uid = auth.currentUser.uid;
          try {
            await setDoc(doc(db, 'stores', uid, 'cashRegisters', closedRegister.id), JSON.parse(JSON.stringify(closedRegister)));
          } catch (e) {
            console.error('Failed to sync closed register directly to Firebase:', e);
          }
        }
      }
      closeRegister(amount);
      if (logoutOnClose) {
        // Wait 500ms for underlying state-driven cloudSync operations to finalize
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          await signOut(auth);
        } catch(e) {
          console.error('Failed to sign out of Firebase', e);
        }
        useStore.setState({ firebaseUser: null });
        logout();
        useStore.getState().clearDatabase();
        navigate('/login');
      }
    } else if (actionType === 'withdraw') {
      addWithdrawal(amount, description || 'Retiro de caja', notes);
    } else if (actionType === 'income') {
      addExtraIncome(amount, description || 'Ingreso extra', notes, paymentMethod);
    } else if (actionType === 'edit_movement' && editingMovementId) {
      editMovement(editingMovementId, amount, description, notes, paymentMethod);
    }
    setAmount(0);
    setDescription('');
    setNotes('');
    setPaymentMethod('Efectivo');
    setActionType(null);
    setEditingMovementId(null);
    setLogoutOnClose(false);
  };

  const handleEditMovement = (movement: any) => {
    setAmount(movement.amount);
    setDescription(movement.description);
    setNotes(movement.notes || '');
    setPaymentMethod(movement.paymentMethod || 'Efectivo');
    setEditingMovementId(movement.id);
    setActionType('edit_movement');
  };

  const handleDeleteMovement = (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este movimiento?')) {
      deleteMovement(id);
    }
  };

  const getRegisterStats = (register: any) => {
    const sessionSales = sales.filter(s => {
      const saleDate = new Date(s.date).getTime();
      const openedAt = new Date(register.openedAt).getTime();
      const closedAt = register.closedAt ? new Date(register.closedAt).getTime() : new Date().getTime();
      return saleDate >= openedAt && saleDate <= closedAt;
    });

    const cost = sessionSales.reduce((total, sale) => {
      return total + sale.items.reduce((itemTotal, item) => itemTotal + (item.purchasePrice * item.quantity), 0);
    }, 0);

    const profit = sessionSales.reduce((total, sale) => {
      const saleProfit = sale.items.reduce((itemTotal, item) => {
        const price = item.salePrice;
        const discountAmount = item.discount > 0 ? price * (item.discount / 100) : 0;
        const finalPrice = price - discountAmount;
        return itemTotal + ((finalPrice - item.purchasePrice) * item.quantity);
      }, 0);
      const commissionDeduction = (sale.commissionPayer === 'vendedor' && sale.commission) ? sale.commission : 0;
      return total + saleProfit - commissionDeduction;
    }, 0);

    return { cost, profit, salesCount: sessionSales.length };
  };

  const generateReport = (register: any) => {
    const stats = getRegisterStats(register);
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Corte de Caja', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Fecha Apertura: ${format(new Date(register.openedAt), 'dd/MM/yyyy HH:mm')}`, 20, 40);
    if (register.closedAt) {
      doc.text(`Fecha Cierre: ${format(new Date(register.closedAt), 'dd/MM/yyyy HH:mm')}`, 20, 50);
    }
    
    doc.text(`Monto Inicial: $${register.initialAmount.toFixed(2)}`, 20, 70);
    doc.text(`Ventas en Efectivo: $${register.cashSales.toFixed(2)}`, 20, 80);
    doc.text(`Ventas con Tarjeta: $${register.cardSales.toFixed(2)}`, 20, 90);
    doc.text(`Ventas por Transferencia: $${register.transferSales.toFixed(2)}`, 20, 100);
    doc.text(`Ventas Mercado Pago: $${(register.mercadoPagoSales || 0).toFixed(2)}`, 20, 110);
    doc.text(`Ventas CLIP: $${(register.clipSales || 0).toFixed(2)}`, 20, 120);
    doc.text(`Ingresos Extra: $${register.extraIncome.toFixed(2)}`, 20, 130);
    doc.text(`Retiros: -$${register.withdrawals.toFixed(2)}`, 20, 140);
    
    doc.setFont('', 'bold');
    doc.text(`Efectivo Esperado: $${register.expectedCash.toFixed(2)}`, 20, 160);
    if (register.actualCash !== undefined) {
      doc.text(`Efectivo Real: $${register.actualCash.toFixed(2)}`, 20, 170);
      doc.text(`Diferencia: $${register.difference?.toFixed(2)}`, 20, 180);
    }

    doc.text(`Resumen de la Sesión:`, 120, 70);
    doc.setFont('', 'normal');
    doc.text(`Total Ventas: $${register.salesTotal.toFixed(2)}`, 120, 80);
    doc.text(`Costo de Productos: $${stats.cost.toFixed(2)}`, 120, 90);
    doc.text(`Ganancia Estimada: $${stats.profit.toFixed(2)}`, 120, 100);
    doc.text(`No. de Ventas: ${stats.salesCount}`, 120, 110);

    if (register.movements && register.movements.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Movimientos de Caja', 105, 20, { align: 'center' });
      
      let yPos = 40;
      doc.setFontSize(10);
      
      register.movements.forEach((mov: any) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setFont('', 'bold');
        doc.text(format(new Date(mov.date), 'HH:mm'), 20, yPos);
        doc.text(mov.type === 'extra_income' ? 'INGRESO' : 'RETIRO', 40, yPos);
        doc.text(`$${mov.amount.toFixed(2)}`, 70, yPos);
        
        doc.setFont('', 'normal');
        doc.text(mov.description, 100, yPos);
        
        yPos += 6;
        
        if (mov.notes) {
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text(`Nota: ${mov.notes}`, 40, yPos);
          doc.setTextColor(0);
          doc.setFontSize(10);
          yPos += 6;
        }
        
        yPos += 4;
      });
    }

    doc.save(`Corte_Caja_${format(new Date(register.openedAt), 'yyyyMMdd_HHmm')}.pdf`);
  };

  const getExtraIncomeByMethod = (method: string) => {
    if (!currentRegister || !currentRegister.movements) return 0;
    return currentRegister.movements
      .filter(m => m.type === 'extra_income' && (m.paymentMethod === method || (!m.paymentMethod && method === 'Efectivo')))
      .reduce((sum, m) => sum + m.amount, 0);
  };

  const totalCash = (currentRegister?.cashSales || 0) + getExtraIncomeByMethod('Efectivo');
  const totalCard = (currentRegister?.cardSales || 0) + getExtraIncomeByMethod('Tarjeta');
  const totalTransfer = (currentRegister?.transferSales || 0) + getExtraIncomeByMethod('Transferencia');
  const totalMercadoPago = (currentRegister?.mercadoPagoSales || 0) + getExtraIncomeByMethod('Mercado Pago');
  const totalClip = (currentRegister?.clipSales || 0) + getExtraIncomeByMethod('CLIP');
  const totalIngresos = totalCash + totalCard + totalTransfer + totalMercadoPago + totalClip;

  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Caja</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Status Card */}
        <div className={`col-span-1 md:col-span-2 p-6 rounded-2xl shadow-sm border ${
          currentRegister 
            ? 'bg-gradient-to-br from-green-50 to-emerald-100 border-green-200 dark:from-green-900/40 dark:to-emerald-900/20 dark:border-green-800' 
            : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 dark:from-gray-800 dark:to-gray-900 dark:border-gray-700'
        }`}>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                {currentRegister ? <Unlock className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" /> : <Lock className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />}
                {currentRegister ? 'Caja Abierta' : 'Caja Cerrada'}
              </h2>
              {currentRegister && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Abierta el {format(new Date(currentRegister.openedAt), "dd 'de' MMMM, HH:mm", { locale: es })}
                </p>
              )}
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              currentRegister ? 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
            }`}>
              {currentRegister ? 'Activa' : 'Inactiva'}
            </div>
          </div>

          {currentRegister ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/60 dark:bg-gray-800/60 p-4 rounded-xl">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1">Fondo Inicial</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatCurrency(currentRegister.initialAmount, settings.currency)}
                </p>
              </div>
              <div className="bg-white/60 dark:bg-gray-800/60 p-4 rounded-xl">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1">Ventas Efectivo</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  +{formatCurrency(currentRegister.cashSales, settings.currency)}
                </p>
              </div>
              <div className="bg-white/60 dark:bg-gray-800/60 p-4 rounded-xl">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1">Retiros</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">
                  -{formatCurrency(currentRegister.withdrawals, settings.currency)}
                </p>
              </div>
              <div className="bg-white/60 dark:bg-gray-800/60 p-4 rounded-xl border-2 border-green-200 dark:border-green-800">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1">Efectivo Esperado</p>
                <p className="text-xl font-black text-gray-900 dark:text-white">
                  {formatCurrency(currentRegister.expectedCash, settings.currency)}
                </p>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>La caja está cerrada. Ábrela para comenzar a vender.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 mb-6">
            {!currentRegister ? (
              <button 
                onClick={() => setActionType('open')}
                className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-sm"
              >
                Abrir Caja
              </button>
            ) : (
              <>
                <button 
                  onClick={() => setActionType('close')}
                  className="flex-1 sm:flex-none px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors shadow-sm"
                >
                  Cerrar Caja
                </button>
                <button 
                  onClick={() => setActionType('withdraw')}
                  className="flex-1 sm:flex-none px-4 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-colors shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-center"
                >
                  <ArrowDownCircle className="w-5 h-5 mr-2 text-red-500" /> Retiro
                </button>
                <button 
                  onClick={() => setActionType('income')}
                  className="flex-1 sm:flex-none px-4 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-colors shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-center"
                >
                  <ArrowUpCircle className="w-5 h-5 mr-2 text-green-500" /> Ingreso Extra
                </button>
              </>
            )}
          </div>

          {currentRegister && currentRegister.movements && currentRegister.movements.length > 0 && (
            <div className="bg-white/60 dark:bg-gray-800/60 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Movimientos de Caja</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                {[...currentRegister.movements].reverse().map((movement) => (
                  <div key={movement.id} className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-gray-900 dark:text-white text-sm">
                        {movement.description}
                      </span>
                      <div className="flex items-center space-x-3">
                        <span className={`font-bold text-sm ${movement.type === 'extra_income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {movement.type === 'extra_income' ? '+' : '-'}
                          {formatCurrency(movement.amount, settings.currency)}
                        </span>
                        <div className="flex items-center space-x-1">
                          <button 
                            onClick={() => handleEditMovement(movement)}
                            className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteMovement(movement.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                      <span>{format(new Date(movement.date), 'HH:mm')}</span>
                      <span className="capitalize">{movement.type === 'extra_income' ? 'Ingreso' : 'Retiro'}</span>
                    </div>
                    {movement.notes && (
                      <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700">
                        {movement.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Totals Summary */}
        <div className="flex flex-col space-y-6">
          {currentRegister && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Resumen de Ingresos (Ventas + Extras)</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Efectivo</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(totalCash, settings.currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Tarjeta</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(totalCard, settings.currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Transferencia</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(totalTransfer, settings.currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Mercado Pago</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(totalMercadoPago, settings.currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">CLIP</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(totalClip, settings.currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="font-bold text-gray-900 dark:text-white">Total Ingresos</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 text-lg">
                    {formatCurrency(totalIngresos, settings.currency)}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div className="bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-indigo-900/40 dark:to-blue-900/20 p-6 rounded-2xl shadow-sm border border-indigo-100 dark:border-indigo-800">
            <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100 mb-4">Resumen del Día</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-indigo-700/70 dark:text-indigo-300/70 mb-1">Costo de Productos Vendidos</p>
                <p className="text-2xl font-bold text-indigo-800 dark:text-indigo-200">
                  {formatCurrency(costToday, settings.currency)}
                </p>
              </div>
              <div className="pt-3 border-t border-indigo-200/50 dark:border-indigo-700/50">
                <p className="text-sm text-indigo-700/70 dark:text-indigo-300/70 mb-1">Ganancias del Día (Ventas + Extras - Retiros)</p>
                <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(profitToday, settings.currency)}
                </p>
              </div>
            </div>
          </div>


        </div>
      </div>

      {/* History */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Historial de Cortes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Apertura</th>
                <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Cierre</th>
                <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Ventas Totales</th>
                <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Diferencia</th>
                <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">Reporte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {pastRegisters.map((reg) => (
                <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="p-4 text-gray-900 dark:text-white">
                    {format(new Date(reg.openedAt), 'dd/MM/yyyy HH:mm')}
                  </td>
                  <td className="p-4 text-gray-900 dark:text-white">
                    {reg.closedAt ? format(new Date(reg.closedAt), 'dd/MM/yyyy HH:mm') : '-'}
                  </td>
                  <td className="p-4 font-medium text-gray-900 dark:text-white">
                    {formatCurrency(reg.salesTotal, settings.currency)}
                  </td>
                  <td className="p-4">
                    <span className={`font-medium ${
                      (reg.difference || 0) === 0 ? 'text-gray-500 dark:text-gray-400' :
                      (reg.difference || 0) > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatCurrency(reg.difference || 0, settings.currency)}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => generateReport(reg)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors inline-flex"
                    >
                      <FileText className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {pastRegisters.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No hay cortes de caja registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Modal */}
      {actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {actionType === 'open' && 'Abrir Caja'}
                {actionType === 'close' && 'Cerrar Caja'}
                {actionType === 'withdraw' && 'Registrar Retiro'}
                {actionType === 'income' && 'Registrar Ingreso Extra'}
                {actionType === 'edit_movement' && 'Editar Movimiento'}
              </h2>
            </div>
            <form onSubmit={handleAction} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {actionType === 'open' && 'Monto Inicial en Efectivo'}
                  {actionType === 'close' && 'Efectivo Real en Caja'}
                  {actionType === 'withdraw' && 'Monto a Retirar'}
                  {actionType === 'income' && 'Monto de Ingreso'}
                  {actionType === 'edit_movement' && 'Monto'}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium text-lg">$</span>
                  <input
                    type="number"
                    step="0.01"
                    autoFocus
                    value={amount === 0 ? '' : amount}
                    onChange={(e) => setAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full pl-8 pr-4 py-3 text-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white placeholder:opacity-30 dark:placeholder:opacity-30"
                    placeholder="0"
                  />
                </div>
              </div>

              {actionType === 'close' && (
                <div className="flex items-center space-x-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="logoutOnClose"
                    checked={logoutOnClose}
                    onChange={(e) => setLogoutOnClose(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-red-600 focus:ring-red-500 dark:focus:ring-red-600 bg-gray-50 dark:bg-gray-900 cursor-pointer"
                  />
                  <label htmlFor="logoutOnClose" className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors">
                    Cerrar sesión al confirmar cierre
                  </label>
                </div>
              )}
              
              {(actionType === 'withdraw' || actionType === 'income' || actionType === 'edit_movement') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Descripción
                    </label>
                    <input
                      type="text"
                      required
                      value={description}
                      onChange={(e) => setDescription(capitalizeFirst(e.target.value))}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white"
                      placeholder={actionType === 'withdraw' ? 'Ej. Pago de servicios' : 'Ej. Cambio inicial'}
                    />
                  </div>
                  
                  {(actionType === 'income' || (actionType === 'edit_movement' && editingMovementId && currentRegister?.movements?.find(m => m.id === editingMovementId)?.type === 'extra_income')) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Método de Pago
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white appearance-none"
                      >
                        <option value="Efectivo">Efectivo</option>
                        <option value="Tarjeta">Tarjeta</option>
                        <option value="Transferencia">Transferencia</option>
                        <option value="Mercado Pago">Mercado Pago</option>
                        <option value="CLIP">CLIP</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nota (Opcional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(capitalizeFirst(e.target.value))}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white resize-none"
                      placeholder="Detalles adicionales..."
                      rows={2}
                    />
                  </div>
                </>
              )}
              
              <div className="flex justify-end space-x-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => {
                    setActionType(null);
                    setEditingMovementId(null);
                  }} 
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className={`px-6 py-2 text-white rounded-lg transition-colors font-medium ${
                    actionType === 'close' || actionType === 'withdraw' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {actionType === 'edit_movement' ? 'Guardar Cambios' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
