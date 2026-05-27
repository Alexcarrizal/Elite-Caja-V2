import React, { useState, useRef } from 'react';
import { useStore, defaultSettings } from '../store/useStore';
import { Save, Upload, Store, User, FileText, Settings as SettingsIcon, Download, Database, Lock, CreditCard, AlertTriangle, Trash2, Key, Monitor, Clock, CheckCircle2, Edit, Eye, EyeOff, Copy } from 'lucide-react';
import { capitalizeFirst } from '../utils/format';
import { PaymentMethodType } from '../types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const { settings = defaultSettings, updateSettings, users = [], currentUser, license, addUser, updateUser, deleteUser } = useStore();
  const navigate = useNavigate();

  // Route security: Cajero role boot-out
  React.useEffect(() => {
    if (currentUser?.role === 'Cajero') {
      navigate('/', { replace: true });
    }
  }, [currentUser, navigate]);

  const [formData, setFormData] = useState(settings || defaultSettings);
  const [isSaving, setIsSaving] = useState(false);

  // Users Admin states
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userForm, setUserForm] = useState({ name: '', role: 'Cajero', pin: '' });
  const [showPins, setShowPins] = useState<{ [key: string]: boolean }>({});

  // Sync form with store when settings change (e.g. after clear database or rehydration)
  React.useEffect(() => {
    setFormData(settings);
  }, [settings]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (currentUser?.role === 'Cajero') {
    return null;
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveUser = () => {
    if (!userForm.name.trim()) {
      toast.error('Por favor escribe un nombre de usuario');
      return;
    }
    if (userForm.pin.length < 4) {
      toast.error('El PIN debe tener al menos 4 dígitos numéricos');
      return;
    }
    
    // Check PIN uniqueness
    const duplicatePin = (users || []).find(u => u.pin === userForm.pin && (!editingUser || u.id !== editingUser.id));
    if (duplicatePin) {
      toast.error(`Este PIN ya pertenece a ${duplicatePin.name}`);
      return;
    }

    if (editingUser) {
      updateUser(editingUser.id, userForm);
      toast.success('Usuario actualizado con éxito');
      setEditingUser(null);
    } else {
      addUser(userForm);
      toast.success('Nuevo usuario registrado con éxito');
    }
    setUserForm({ name: '', role: 'Cajero', pin: '' });
  };

  const handleDeleteUser = (u: any) => {
    if (u.id === currentUser?.id) {
      toast.error('No puedes eliminarte a ti mismo mientras tienes sesión activa');
      return;
    }
    
    // Count administrators
    const admins = (users || []).filter(user => user.role === 'Administrador');
    if (u.role === 'Administrador' && admins.length <= 1) {
      toast.error('Debe haber al menos un Administrador registrado en el sistema');
      return;
    }

    deleteUser(u.id);
    toast.success('Usuario eliminado del sistema');
  };

  const handlePaymentMethodToggle = (method: PaymentMethodType) => {
    const methods = formData.acceptedPaymentMethods || ['Efectivo', 'Tarjeta', 'Transferencia', 'Mixto'];
    if (methods.includes(method)) {
      setFormData({ ...formData, acceptedPaymentMethods: methods.filter(m => m !== method) });
    } else {
      setFormData({ ...formData, acceptedPaymentMethods: [...methods, method] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      updateSettings(formData);
      setIsSaving(false);
    }, 500);
  };

  const handleExportDB = () => {
    const state = useStore.getState();
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pos-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    // Update last backup date
    updateSettings({ lastBackupDate: new Date().toISOString() });
    setFormData(prev => ({ ...prev, lastBackupDate: new Date().toISOString() }));
  };

  const handleImportDB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data && typeof data === 'object' && 'settings' in data && 'products' in data) {
          if (window.confirm('¿Estás seguro de que deseas sobrescribir la base de datos actual? Esta acción no se puede deshacer.')) {
            const currentLicense = useStore.getState().license;
            const currentFirebaseUser = useStore.getState().firebaseUser;
            const activeUser = useStore.getState().currentUser;
            const updatedData = { ...data };
            
            // ALWAYS preserve the current license, machine ID and active accounts
            updatedData.license = {
              ...(updatedData.license || {}),
              machineId: currentLicense.machineId,
              status: currentLicense.status,
              trialStartDate: currentLicense.trialStartDate,
              trialEndDate: currentLicense.trialEndDate,
              isTrialUsed: currentLicense.isTrialUsed,
              activatedAt: currentLicense.activatedAt,
              cloudEmail: currentLicense.cloudEmail || (updatedData.license ? updatedData.license.cloudEmail : '')
            };
            
            updatedData.firebaseUser = currentFirebaseUser;
            if (activeUser) {
              updatedData.currentUser = activeUser;
            }
            
            useStore.setState(updatedData);
            alert('Base de datos importada correctamente. La página se recargará.');
            window.location.reload();
          }
        } else {
          alert('El archivo no tiene un formato válido.');
        }
      } catch (error) {
        alert('Error al leer el archivo. Asegúrate de que sea un archivo JSON válido.');
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClearDatabase = () => {
    if (window.confirm('⚠️ ¡ADVERTENCIA! ⚠️\n\n¿Estás seguro de que deseas borrar TODOS los datos (productos, ventas, movimientos y configuración)?\n\nEsta acción NO se puede deshacer y empezarás con una base de datos completamente en blanco.')) {
      if (window.confirm('Por favor, confirma una vez más que deseas ELIMINAR TODA LA BASE DE DATOS.')) {
        useStore.getState().clearDatabase();
        toast.success('Base de datos borrada. Reiniciando...');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto max-w-4xl mx-auto w-full pb-12">
      <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configuración del Negocio <span className="text-xs font-normal text-gray-400 ml-2">v2.1</span></h1>
        <button 
          onClick={handleSubmit}
          disabled={isSaving}
          className="flex items-center px-6 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-200 dark:shadow-none"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center space-x-3 bg-gray-50 dark:bg-gray-900/50">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg text-green-600 dark:text-green-400">
              <User className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Información</h2>
          </div>
          <div className="p-6 space-y-6">
            {/* Logo has been permanently set to EliteCaja */}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del Propietario</label>
                <input type="text" value={formData.owner} onChange={e => setFormData({...formData, owner: capitalizeFirst(e.target.value)})} className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-shadow" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dirección Completa</label>
                <textarea rows={2} value={formData.address} onChange={e => setFormData({...formData, address: capitalizeFirst(e.target.value)})} className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-shadow resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
                  <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-shadow" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">WhatsApp</label>
                  <input type="tel" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-shadow" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo Electrónico</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-shadow" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center space-x-3 bg-gray-50 dark:bg-gray-900/50">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg text-purple-600 dark:text-purple-400">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Preferencias</h2>
          </div>
          <div className="p-6 space-y-4 flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Moneda</label>
                <select value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})} className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-shadow">
                  <option value="MXN">MXN - Peso Mexicano</option>
                  <option value="USD">USD - Dólar Estadounidense</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="COP">COP - Peso Colombiano</option>
                  <option value="ARS">ARS - Peso Argentino</option>
                  <option value="CLP">CLP - Peso Chileno</option>
                  <option value="PEN">PEN - Sol Peruano</option>
                  <option value="UYU">UYU - Peso Uruguayo</option>
                  <option value="CRC">CRC - Colón Costarricense</option>
                  <option value="GTQ">GTQ - Quetzal Guatemalteco</option>
                  <option value="HNL">HNL - Lempira Hondureño</option>
                  <option value="NIO">NIO - Córdoba Nicaragüense</option>
                  <option value="PAB">PAB - Balboa Panameño</option>
                  <option value="PYG">PYG - Guaraní Paraguayo</option>
                  <option value="DOP">DOP - Peso Dominicano</option>
                  <option value="VES">VES - Bolívar Venezolano</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Impuesto (IVA %)</label>
                <input type="number" step="0.1" value={formData.taxRate} onChange={e => setFormData({...formData, taxRate: Number(e.target.value)})} className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-shadow" />
              </div>
            </div>
            <div className="pt-2">
              <label className="flex items-center space-x-2">
                <input type="checkbox" checked={formData.applyTax} onChange={e => setFormData({...formData, applyTax: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Aplicar IVA a las ventas automáticamente</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Día de inicio de semana</label>
              <select value={formData.weekStartDay ?? 1} onChange={e => setFormData({...formData, weekStartDay: Number(e.target.value)})} className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-shadow">
                <option value="1">Lunes</option>
                <option value="2">Martes</option>
                <option value="3">Miércoles</option>
                <option value="4">Jueves</option>
                <option value="5">Viernes</option>
                <option value="6">Sábado</option>
                <option value="0">Domingo</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Afecta los cortes de las tarjetas de ventas y ganancias de la semana en la vista principal.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensaje en Tickets</label>
              <textarea rows={3} value={formData.receiptMessage} onChange={e => setFormData({...formData, receiptMessage: capitalizeFirst(e.target.value)})} placeholder="Ej: ¡Gracias por su compra! Vuelva pronto." className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-shadow resize-none" />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Este mensaje aparecerá al final de todos los tickets impresos y PDFs.</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col md:col-span-2">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center space-x-3 bg-gray-50 dark:bg-gray-900/50">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Métodos de Pago Aceptados</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Selecciona los métodos de pago que estarán disponibles al momento de cobrar.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {(['Efectivo', 'Tarjeta', 'Transferencia', 'Mixto', 'Mercado Pago', 'CLIP'] as PaymentMethodType[]).map((method) => {
                const isSelected = (formData.acceptedPaymentMethods || ['Efectivo', 'Tarjeta', 'Transferencia', 'Mixto', 'Mercado Pago', 'CLIP']).includes(method);
                return (
                  <label 
                    key={method} 
                    className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500' 
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={isSelected}
                      onChange={() => handlePaymentMethodToggle(method)}
                    />
                    <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 ${
                      isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className={`font-medium ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {method}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>



        {/* Respaldo de Base de Datos */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col md:col-span-2">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center space-x-3 bg-gray-50 dark:bg-gray-900/50">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg text-emerald-600 dark:text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Respaldo de Base de Datos</h2>
          </div>
          <div className="p-6 flex flex-col sm:flex-row gap-4">
            <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Recordatorio de Respaldo</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Configura cada cuánto tiempo el sistema te recordará realizar un respaldo de tu información.
              </p>
              <select
                value={formData.backupFrequency || 'never'}
                onChange={e => setFormData({...formData, backupFrequency: e.target.value as any})}
                className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-shadow"
              >
                <option value="never">Nunca</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>

            <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Exportar Datos</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Descarga una copia completa de tu base de datos (productos, ventas, configuración) en formato JSON.
              </p>
              <button 
                onClick={handleExportDB}
                className="flex items-center justify-center w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Backup
              </button>
              {formData.lastBackupDate && (
                <p className="text-xs text-center mt-2 text-gray-500 dark:text-gray-400">
                  Último respaldo: {new Date(formData.lastBackupDate).toLocaleDateString()}
                </p>
              )}
            </div>
            
            <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Importar Datos</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Restaura tu base de datos desde un archivo JSON. <strong className="text-red-500 dark:text-red-400">Esto reemplazará todos los datos actuales.</strong>
              </p>
              <input 
                type="file" 
                accept=".json" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleImportDB} 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center w-full px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar Backup
              </button>
            </div>
          </div>
        </div>

        {/* Licencia y Activación */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col md:col-span-2">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center space-x-3 bg-gray-50 dark:bg-gray-900/50">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-400">
              <Key className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Licencia y Activación</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${
                    license.status === 'active' ? 'bg-green-100 text-green-600' : 
                    license.status === 'trial' ? 'bg-blue-100 text-blue-600' : 
                    'bg-red-100 text-red-600'
                  }`}>
                    {license.status === 'active' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">Estado del Sistema</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {license.status === 'active' ? 'Activado Permanente' : 
                       license.status === 'trial' ? 'Periodo de Prueba' : 
                       license.status === 'expired' ? 'Prueba Expirada' : 'No Activado'}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 dark:text-gray-400">ID de Equipo:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-gray-900 dark:text-white">{license.machineId}</span>
                    </div>
                  </div>
                  {license.status === 'trial' && license.trialEndDate && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Vence el:</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {format(new Date(license.trialEndDate), "d 'de' MMMM, yyyy", { locale: es })}
                      </span>
                    </div>
                  )}
                  {license.status === 'active' && license.activatedAt && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Activado el:</span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {format(new Date(license.activatedAt), "d 'de' MMMM, yyyy", { locale: es })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Administración de Personal */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col md:col-span-2">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center space-x-3 bg-gray-50 dark:bg-gray-900/50">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
              <User className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Administración de Cajeros y Personal</h2>
          </div>
          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* List of Users */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm uppercase tracking-wider">Usuarios Registrados</h3>
              <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden bg-gray-50/50 dark:bg-gray-900/20">
                {(users || []).map((u) => {
                  const isCur = u.id === currentUser?.id;
                  const showPin = showPins[u.id];
                  return (
                    <div key={u.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="p-2.5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 dark:text-white">{u.name}</span>
                            {isCur && <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 px-1.5 py-0.5 rounded-full font-bold">Tú</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                              u.role === 'Administrador' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                              u.role === 'Supervisor' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' :
                              'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                            }`}>
                              {u.role}
                            </span>
                            <span className="text-xs text-gray-400 font-mono">
                              PIN: {showPin ? u.pin : '••••'}
                            </span>
                            <button 
                              onClick={() => setShowPins(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                              title={showPin ? "Ocultar PIN" : "Mostrar PIN"}
                            >
                              {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setEditingUser(u);
                            setUserForm({ name: u.name, role: u.role, pin: u.pin });
                          }}
                          className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* User Form */}
            <div className="bg-gray-50/50 dark:bg-gray-900/40 p-5 rounded-xl border border-gray-150 dark:border-gray-700/60 flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm uppercase tracking-wider mb-4">
                  {editingUser ? 'Editar Personal' : 'Registrar Nuevo Personal'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Nombre de usuario</label>
                    <input 
                      type="text" 
                      value={userForm.name} 
                      onChange={e => setUserForm({ ...userForm, name: capitalizeFirst(e.target.value) })} 
                      placeholder="Ej: Juan Pérez"
                      className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Rol asignado</label>
                    <select 
                      value={userForm.role}
                      onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                      className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Cajero">Cajero (Restringido)</option>
                      <option value="Supervisor">Supervisor (Media Privacidad)</option>
                      <option value="Administrador">Administrador (Control Total)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">PIN numérico de acceso</label>
                    <input 
                      type="text" 
                      maxLength={8}
                      value={userForm.pin} 
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        setUserForm({ ...userForm, pin: val });
                      }} 
                      placeholder="Ej: 4321 (Solo números)"
                      className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Se utiliza para iniciar sesión o autorizar movimientos rápidos.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                {editingUser && (
                  <button
                    onClick={() => {
                      setEditingUser(null);
                      setUserForm({ name: '', role: 'Cajero', pin: '' });
                    }}
                    className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-650 text-sm transition-colors"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={handleSaveUser}
                  className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-sm transition-colors"
                >
                  {editingUser ? 'Actualizar' : 'Registrar'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Zona de Peligro */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-red-200 dark:border-red-900/50 overflow-hidden flex flex-col md:col-span-2">
          <div className="p-6 border-b border-red-100 dark:border-red-900/30 flex items-center space-x-3 bg-red-50 dark:bg-red-900/20">
            <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-red-700 dark:text-red-400">Zona de Peligro</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-red-50/50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
              <div>
                <h3 className="font-bold text-red-800 dark:text-red-400 mb-1">Borrar Base de Datos</h3>
                <p className="text-sm text-red-600/80 dark:text-red-400/80">
                  Elimina todos los productos, ventas, movimientos de inventario, cortes de caja y la configuración del negocio. Ideal para limpiar los datos de ejemplo y empezar de cero.
                </p>
              </div>
              <button 
                onClick={handleClearDatabase}
                className="flex items-center justify-center px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-sm whitespace-nowrap"
              >
                <Trash2 className="w-5 h-5 mr-2" />
                Empezar de Cero
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
