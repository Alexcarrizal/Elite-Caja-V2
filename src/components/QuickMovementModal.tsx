import React, { useState } from 'react';
import { useStore, defaultSettings } from '../store/useStore';
import { X, DollarSign, Save, ArrowUpCircle, ArrowDownCircle, CreditCard, Banknote, Smartphone, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { PaymentMethodType } from '../types';
import { formatCurrency, capitalizeFirst } from '../utils/format';

interface QuickMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'entrada' | 'salida';
}

export default function QuickMovementModal({ isOpen, onClose, type }: QuickMovementModalProps) {
  const { addExtraIncome, addWithdrawal, cashRegisters, settings = defaultSettings } = useStore();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('Efectivo');
  
  // Commission & Change states
  const [commissionTerm, setCommissionTerm] = useState<string>('Contado');
  const [commissionPayer, setCommissionPayer] = useState<'cliente' | 'vendedor'>('cliente');
  const [cashReceived, setCashReceived] = useState<number>(0);

  const isOpenRegister = cashRegisters.some(r => r.status === 'open');

  // Calculations for 'entrada'
  const numAmount = parseFloat(amount) || 0;
  let commissionAmount = 0;
  
  if (type === 'entrada' && (paymentMethod === 'CLIP' || paymentMethod === 'Mercado Pago')) {
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
      rate = 0.035;
    }
    commissionAmount = numAmount * rate * (1 + ((settings.taxRate || 16) / 100));
  }

  const totalToCharge = numAmount + (commissionPayer === 'cliente' ? commissionAmount : 0);
  const change = cashReceived >= totalToCharge ? cashReceived - totalToCharge : 0;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isOpenRegister) {
      toast.error('Debe abrir la caja primero');
      return;
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }

    if (!description.trim()) {
      toast.error('Ingrese un concepto');
      return;
    }
    
    if (type === 'entrada' && paymentMethod === 'Efectivo' && cashReceived > 0 && cashReceived < totalToCharge) {
      toast.error('El efectivo recibido es menor al total.');
      return;
    }

    if (type === 'entrada') {
      // In POS, the total amount charged goes to total. For Income, we'll just track the exact totalToCharge so balance matches.
      // Wait, extraIncome adds to cash register. If we charge commission to user, we get `totalToCharge`, but the platform (clip) keeps `commissionAmount`.
      // Actually we just call addExtraIncome with the final amount we actually receive from the payment provider or user.
      addExtraIncome(totalToCharge, description, notes, paymentMethod);
      toast.success('Ingreso registrado correctamente');
    } else {
      addWithdrawal(numAmount, description, notes);
      toast.success('Retiro registrado correctamente');
    }

    onClose();
    // Reset state
    setDescription('');
    setAmount('');
    setNotes('');
    setPaymentMethod('Efectivo');
    setCashReceived(0);
    setCommissionTerm('Contado');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md my-8">
        <div className={`p-4 flex justify-between items-center text-white ${type === 'entrada' ? 'bg-emerald-600' : 'bg-rose-600'} rounded-t-2xl`}>
          <div className="flex items-center gap-2">
            {type === 'entrada' ? <ArrowUpCircle className="w-6 h-6" /> : <ArrowDownCircle className="w-6 h-6" />}
            <h2 className="text-xl font-bold">Nueva {type === 'entrada' ? 'Entrada' : 'Salida'}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Concepto / Descripción</label>
            <input 
              required
              type="text"
              placeholder="Ej: Venta rápida, Pago de servicio..."
              value={description}
              onChange={(e) => setDescription(capitalizeFirst(e.target.value))}
              className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cantidad / Monto base</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input 
                required
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-lg font-bold bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
            </div>
          </div>

          {type === 'entrada' && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Método de Pago</label>
              <div className="grid grid-cols-2 gap-2">
                {(settings?.acceptedPaymentMethods || ['Efectivo', 'Tarjeta', 'Transferencia', 'Mixto']).map(method => {
                  let Icon = Banknote;
                  if (method === 'Tarjeta') Icon = CreditCard;
                  if (method === 'Transferencia') Icon = Smartphone;
                  if (method === 'Mixto') Icon = Receipt;
                  if (method === 'Mercado Pago') Icon = Smartphone;
                  if (method === 'CLIP') Icon = Smartphone;

                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method as PaymentMethodType)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-medium transition-colors ${
                        paymentMethod === method 
                          ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300' 
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Icon className="h-5 w-5 mb-1" />
                      <span>{method}</span>
                    </button>
                  );
                })}
              </div>

              {(paymentMethod === 'CLIP' || paymentMethod === 'Mercado Pago') && (
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-900/50 rounded-xl space-y-4">
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
                            type="button"
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
                        type="button"
                        onClick={() => setCommissionPayer('cliente')}
                        className={`flex-1 py-1.5 text-sm font-bold transition-colors ${
                          commissionPayer === 'cliente'
                            ? 'bg-orange-500 text-white'
                            : 'bg-white text-orange-800 hover:bg-orange-50 dark:bg-gray-800 dark:text-orange-300'
                        }`}
                      >
                        Cliente
                      </button>
                      <button
                        type="button"
                        onClick={() => setCommissionPayer('vendedor')}
                        className={`flex-1 py-1.5 text-sm font-bold transition-colors ${
                          commissionPayer === 'vendedor'
                            ? 'bg-orange-500 text-white'
                            : 'bg-white text-orange-800 hover:bg-orange-50 dark:bg-gray-800 dark:text-orange-300'
                        }`}
                      >
                        Vendedor
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <p className="text-sm font-bold text-orange-900 dark:text-orange-400">
                      Comisión {paymentMethod}: <span className="text-lg ml-1">{formatCurrency(commissionAmount, settings.currency)}</span>
                    </p>
                  </div>
                </div>
              )}

              {paymentMethod === 'Efectivo' && (
                <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Efectivo Recibido (Opcional para cambio)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-bold">$</span>
                    <input
                      type="number"
                      value={cashReceived || ''}
                      onChange={(e) => setCashReceived(Number(e.target.value))}
                      className="w-full pl-8 pr-4 py-2 font-bold bg-white dark:bg-gray-800 border box-border border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-0 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                  {cashReceived > 0 && (
                    <div className="flex justify-between items-center mt-2 text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Cambio:</span>
                      <span className={`font-bold ${change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                        {formatCurrency(change, settings.currency)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-3 mt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="font-bold text-gray-700 dark:text-gray-300">Total a registrar:</span>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalToCharge, settings.currency)}
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas (Opcional)</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(capitalizeFirst(e.target.value))}
              placeholder="Detalles adicionales..."
              className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white h-20 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className={`flex-1 px-4 py-2.5 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                type === 'entrada' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 dark:shadow-none' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200 dark:shadow-none'
              }`}
            >
              <Save className="w-5 h-5" />
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
