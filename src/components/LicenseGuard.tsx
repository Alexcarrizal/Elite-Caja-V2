import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Key, ShieldAlert, Clock, CheckCircle2, Monitor, Cloud, Sun, Moon, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { auth } from '../services/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import Logo from './Logo';
import { generateLicenseKey } from '../utils/license';

export const LicenseGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { 
    license, 
    activateTrial, 
    checkLicense, 
    activateLicenseWithKey,
    firebaseUser, 
    theme, 
    toggleTheme, 
    login, 
    forceTrialActivation 
  } = useStore();

  const [inputKey, setInputKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  // Support generator state
  const [clientEmailForKey, setClientEmailForKey] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');

  // Run initial check and set periodic check
  useEffect(() => {
    checkLicense();
    const interval = setInterval(checkLicense, 10000); // Check every 10 seconds during active session
    return () => clearInterval(interval);
  }, [checkLicense]);

  // Live trial countdown timer
  useEffect(() => {
    if (license.status === 'trial' && license.trialEndDate) {
      const updateTimer = () => {
        const remaining = new Date(license.trialEndDate!).getTime() - Date.now();
        if (remaining <= 0) {
          setTimeLeft('expirado');
          checkLicense();
        } else {
          const mins = Math.floor(remaining / 60000);
          const secs = Math.floor((remaining % 60000) / 1000);
          setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')} min`);
        }
      };

      updateTimer();
      const timer = setInterval(updateTimer, 1000);
      return () => clearInterval(timer);
    }
  }, [license.status, license.trialEndDate, checkLicense]);

  const handleCloudLogin = async () => {
    try {
      setIsCloudLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      toast.success('Sesión iniciada correctamente.');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/unauthorized-domain') {
        toast.error(`Dominio no autorizado. Añade ${window.location.hostname} a dominios autorizados de Firebase.`, { duration: 8000 });
      } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        toast.error(`Error (${err.code}): ${err.message}`);
      }
    } finally {
      setIsCloudLoading(false);
    }
  };

  const handleSignOutCloud = async () => {
    try {
      await signOut(auth);
      toast.success('Sesión de Google cerrada');
    } catch (err: any) {
      toast.error('Error al cerrar sesión: ' + err.message);
    }
  };

  const handleActivateLicense = () => {
    setError('');
    setSuccess('');
    
    if (!firebaseUser?.email) {
      setError('Debes iniciar sesión con Google para activar la licencia vinculada.');
      return;
    }
    
    if (!inputKey.trim()) {
      setError('Introduce una clave de licencia.');
      return;
    }

    const res = activateLicenseWithKey(inputKey.trim(), firebaseUser.email);
    if (res.success) {
      setSuccess(res.message);
      toast.success(res.message);
      login('1234'); // automatically authenticate POS pin
    } else {
      setError(res.message);
      toast.error(res.message);
    }
  };

  const handleGenerateKeyForClient = () => {
    if (!clientEmailForKey.trim()) {
      toast.error('Ingresa un correo electrónico');
      return;
    }
    const key = generateLicenseKey(clientEmailForKey.trim());
    setGeneratedKey(key);
    toast.success('Clave generada');
  };

  // 1. If active status, let children mount directly
  if (license.status === 'active') {
    return <>{children}</>;
  }

  // 2. If trial, show progress/countdown banner and render system inside
  if (license.status === 'trial' && license.trialEndDate) {
    const end = new Date(license.trialEndDate);
    if (Date.now() <= end.getTime()) {
      return (
        <div className="relative h-screen flex flex-col overflow-hidden">
          <div className="bg-amber-500 text-white py-2 px-4 text-center text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm z-50">
            <Clock className="w-4 h-4 animate-spin text-amber-100" style={{ animationDuration: '3s' }} />
            <span>Versión de Demostración Activa. Tiempo restante:</span> 
            <span className="font-bold font-mono bg-amber-700/60 px-2 py-0.5 rounded text-white animate-pulse">{timeLeft || 'calculando...'}</span>
          </div>
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </div>
      );
    }
  }

  const isOwner = firebaseUser?.email?.toLowerCase().trim() === 'carrizalalex@gmail.com';

  // 3. Locked / Expired State - Activator View
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="max-w-md w-full relative group"
      >
        <motion.div 
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -inset-[1px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-[17px] opacity-75 blur-[2px]"
        />
        <div className="relative w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
          <button
            onClick={toggleTheme}
            className="absolute top-4 right-4 p-2 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          <div className="p-8">
            <div className="flex justify-center mb-6 mt-2">
              <Logo className="scale-110 transform origin-center" />
            </div>

            <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
              Activación de Elite Caja
            </h2>
            
            <p className="text-center text-gray-500 dark:text-gray-400 mb-6 text-sm leading-relaxed px-2">
              La versión demo de 30 minutos ha finalizado. Para seguir usando el sistema necesitas activar una licencia permanente asociada a tu cuenta de Google.
            </p>

            {/* Cloud connection step */}
            <div className="mb-6">
              {firebaseUser ? (
                <div className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-xl border border-green-200 dark:border-green-900/50 flex items-center justify-between">
                    <div className="truncate pr-2">
                      <p className="text-xs font-semibold text-green-800 dark:text-green-400">Cuenta Google Vinculada</p>
                      <p className="text-xs text-green-600 dark:text-green-500 truncate">{firebaseUser.email}</p>
                    </div>
                    <Cloud className="w-5 h-5 text-green-500 flex-shrink-0" />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Clave de Licencia
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={inputKey}
                        onChange={(e) => setInputKey(e.target.value.toUpperCase())}
                        placeholder="EC-XXXX-XXXX-XXXX-XXXX"
                        className="w-full pl-3 pr-10 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white font-mono uppercase text-sm tracking-wider"
                      />
                      <Key className="absolute right-3.5 top-3.5 w-4 h-4 text-gray-400" />
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-1">
                    <button
                      onClick={handleActivateLicense}
                      className="flex-1 flex justify-center items-center py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm text-sm transition-colors"
                    >
                      Activar Licencia
                    </button>
                    
                    <button
                      onClick={handleSignOutCloud}
                      className="flex-shrink-0 flex justify-center items-center p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 hover:text-red-500 transition-colors"
                      title="Cerrar sesión"
                    >
                      Salir
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-200/50 dark:border-amber-900/50">
                    ⚠️ Primero debes iniciar sesión con tu cuenta de Google. Tu licencia se vinculará de manera segura y única a este correo.
                  </p>
                  <button
                    onClick={handleCloudLogin}
                    disabled={isCloudLoading}
                    className="w-full flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none transition-colors"
                  >
                    <Cloud className="w-5 h-5 mr-2 text-blue-500" />
                    {isCloudLoading ? 'Estableciendo conexión...' : 'Iniciar Sesión con Google'}
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-900/50 rounded-xl flex items-center gap-2 text-xs mb-4 animate-shake">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 border border-green-200/50 dark:border-green-900/50 rounded-xl flex items-center gap-2 text-xs mb-4">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Support section for owner 'carrizalalex@gmail.com' */}
            {isOwner && (
              <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">
                  🔐 Panel de Soporte Administrador
                </p>
                <div className="space-y-3 bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/20">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500">
                      Correo del Cliente
                    </label>
                    <input
                      type="email"
                      value={clientEmailForKey}
                      onChange={(e) => setClientEmailForKey(e.target.value)}
                      placeholder="correo@gmail.com"
                      className="w-full mt-1 px-2.5 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs"
                    />
                  </div>
                  <button
                    onClick={handleGenerateKeyForClient}
                    className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Generar Clave de Licencia
                  </button>
                  {generatedKey && (
                    <div className="mt-2 text-center">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Clave Generada</p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedKey);
                          toast.success('Clave copiada al portapapeles');
                        }}
                        className="mt-1 px-3 py-1.5 bg-gray-900 text-white font-mono text-xs rounded-lg flex items-center justify-center gap-1 w-full border border-gray-800 hover:bg-black"
                      >
                        <span className="font-bold">{generatedKey}</span>
                        <Copy className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700">
              <div className="w-full flex items-center justify-center text-[10px] text-gray-400 font-semibold bg-gray-50 dark:bg-gray-950 p-2.5 rounded-xl uppercase tracking-wider">
                <Monitor className="w-3 h-3 mr-1.5" />
                ID de Equipo: <span className="font-mono text-gray-700 dark:text-gray-300 ml-1">{license.machineId}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

