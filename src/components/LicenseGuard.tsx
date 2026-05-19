import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Key, ShieldAlert, Clock, CheckCircle2, Monitor, Cloud, Sun, Moon, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import Logo from './Logo';

export const LicenseGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { license, activateTrial, checkLicense, firebaseUser, theme, toggleTheme, login } = useStore();

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCloudLoading, setIsCloudLoading] = useState(false);

  useEffect(() => {
    checkLicense();
    // Check every hour
    const interval = setInterval(checkLicense, 3600000);
    return () => clearInterval(interval);
  }, [checkLicense]);

  const handleActivateTrial = () => {
    setError('');
    setSuccess('');
    const result = activateTrial();
    if (result.success) {
      setSuccess(result.message);
      login('1234');
    } else {
      setError(result.message);
    }
  };

  const handleCloudLogin = async () => {
    try {
      setIsCloudLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      toast.success('Sesión iniciada correctamente. Sincronizando datos...');
      
      // We don't manually check "licenses" collection here anymore.
      // cloudSync.tsx will detect the new firebaseUser, download their store,
      // and update the license (or generate a fresh 5-day trial).
      // LicenseGuard will un-render itself once license becomes 'active' or 'trial'.

    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/unauthorized-domain') {
        toast.error(`Dominio no autorizado. Añade ${window.location.hostname} a dominios autorizados en Authentication -> Settings en Firebase.`, { duration: 8000 });
      } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
         toast.error(`Error (${err.code}): ${err.message}`);
      } else {
         toast.error(`Aviso: Ventana de login cerrada (${err.code})`);
      }
    } finally {
      setIsCloudLoading(false);
    }
  };

  if (license.status === 'active') {
    return <>{children}</>;
  }

  if (license.status === 'trial' && license.trialEndDate) {
    const now = new Date();
    const endDate = new Date(license.trialEndDate);
    if (now <= endDate) {
      return (
        <div className="relative h-screen flex flex-col overflow-hidden">
          <div className="bg-blue-600 text-white py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            Periodo de prueba activo. Vence el {format(endDate, "d 'de' MMMM 'a las' HH:mm", { locale: es })}
          </div>
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="max-w-md w-full relative group"
      >
        <motion.div 
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -inset-[1px] bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 rounded-[17px] opacity-75 blur-[1px]"
        />
        <div className="relative w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          <button
          onClick={toggleTheme}
          className="absolute top-4 right-4 p-2 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <div className="p-8">
          <div className="flex justify-center mb-8 mt-2">
            <Logo className="scale-110 transform origin-center" />
          </div>

          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
            Bienvenido a Elite Caja
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-8 text-sm leading-relaxed px-2">
            {license.status === 'expired' 
              ? 'Tu periodo de prueba ha expirado. Adquiere una licencia en la nube para continuar.' 
              : 'El sistema de venta más potente. Inicia sesión con tu cuenta de Google para obtener 5 días de prueba gratis.'}
          </p>

          <div className="mb-6">
            {firebaseUser ? (
              <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-xl border border-green-200 dark:border-green-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-green-800 dark:text-green-400">Conectado a la nube</p>
                  <p className="text-xs text-green-600 dark:text-green-500">{firebaseUser.email}</p>
                </div>
                <Cloud className="w-5 h-5 text-green-500" />
              </div>
            ) : (
              <button
                onClick={handleCloudLogin}
                disabled={isCloudLoading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <Cloud className="w-5 h-5 mr-2 text-blue-500" />
                {isCloudLoading ? 'Conectando...' : 'Iniciar con Google (Prueba 5 días)'}
              </button>
            )}
          </div>

            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-2 text-sm animate-shake mb-4">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl flex items-center gap-2 text-sm mb-4">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                {success}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 pt-2">
              {/* Force Google login for 5-day trial, removed offline trial button */}
            </div>

          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
            <button 
              onClick={() => {
                navigator.clipboard.writeText(license.machineId);
                toast.success('ID de equipo copiado al portapapeles');
              }}
              className="w-full flex items-center justify-center text-xs text-gray-500 font-medium bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
            >
              <div className="flex items-center gap-2 uppercase tracking-wider">
                <Monitor className="w-3 h-3" />
                ID de Equipo: <span className="font-mono text-gray-900 dark:text-gray-200">{license.machineId}</span>
                <Copy className="w-3 h-3 ml-2 text-gray-400 group-hover:text-blue-500 transition-colors" />
              </div>
            </button>
          </div>
        </div>
        </div>
      </motion.div>
    </div>
  );
};
