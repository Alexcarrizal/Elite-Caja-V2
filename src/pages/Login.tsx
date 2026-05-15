import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Lock, Cloud, Key, FileWarning, Sun, Moon } from 'lucide-react';
import Logo from '../components/Logo';
import { auth } from '../services/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { toast } from 'sonner';

export default function Login() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const { 
    login,
    firebaseUser,
    theme,
    toggleTheme
  } = useStore();
  const navigate = useNavigate();

  const handleLocalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(pin)) {
      const hasOpenRegister = (useStore.getState().cashRegisters || []).some(r => r.status === 'open');
      if (hasOpenRegister) {
        navigate('/');
      } else {
        navigate('/cash-register');
      }
    } else {
      setError('PIN incorrecto. Intente de nuevo.');
      setPin('');
    }
  };

  const handleCloudLogin = async () => {
    try {
      setIsCloudLoading(true);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Sesión en la nube iniciada correctamente');
    } catch (err: any) {
      console.error(err);
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        toast.error('Error al iniciar sesión: ' + err.message);
      }
    } finally {
      setIsCloudLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-200">
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          <Logo className="scale-125 transform origin-center" />
        </div>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Ingrese al sistema
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100 dark:border-gray-700">
          
          {/* Cloud Auth Section */}
          <div className="mb-8">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white flex items-center space-x-2">
              <Cloud className="w-4 h-4 text-blue-500" />
              <span>Base de Datos Segura (Nube)</span>
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 mb-4">
              Para tener tu propia base de datos disponible en cualquier computadora, ingresa con tu cuenta de Google.
            </p>

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
                {isCloudLoading ? 'Conectando...' : 'Iniciar Sesión con Google'}
              </button>
            )}
          </div>

          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                Acceso de Cajero (Local)
              </span>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleLocalSubmit}>
            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                PIN Maestro
              </label>
              <div className="mt-2 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                </div>
                <input
                  id="pin"
                  name="pin"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50 dark:bg-gray-700 dark:text-white transition-shadow"
                  placeholder="••••"
                  autoFocus
                />
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400" id="pin-error">
                  {error}
                </p>
              )}
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
              >
                Abrir Caja
              </button>
            </div>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              PIN por defecto: <strong className="text-gray-700 dark:text-gray-300">1234</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
