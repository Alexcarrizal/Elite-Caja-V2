import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Lock, Cloud, Key, FileWarning, Sun, Moon } from 'lucide-react';
import Logo from '../components/Logo';
import { auth } from '../services/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { toast } from 'sonner';

export default function Login() {
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const { 
    login,
    currentUser,
    firebaseUser,
    theme,
    toggleTheme
  } = useStore();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (currentUser) {
      const hasOpenRegister = (useStore.getState().cashRegisters || []).some(r => r.status === 'open');
      navigate(hasOpenRegister ? '/' : '/cash-register');
    }
  }, [currentUser, navigate]);

  const handleCloudLogin = async () => {
    try {
      setIsCloudLoading(true);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Sesión en la nube iniciada correctamente');
      
      // Auto-login to bypass POS screen and go into app
      if (login('1234')) {
        const hasOpenRegister = (useStore.getState().cashRegisters || []).some(r => r.status === 'open');
        navigate(hasOpenRegister ? '/' : '/cash-register');
      }
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          <Logo className="scale-125 transform origin-center" />
        </div>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Ingrese al sistema
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative">
        <button
          onClick={toggleTheme}
          className="absolute top-4 right-4 p-2 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors z-10"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100 dark:border-gray-700 relative">
          
          {/* Cloud Auth Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white flex items-center space-x-2">
              <Cloud className="w-4 h-4 text-blue-500" />
              <span>Acceso Seguro (Nube)</span>
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 mb-4">
              Para identificarte en el sistema, por favor inicia sesión con tu cuenta de Google autorizada.
            </p>

            {firebaseUser ? (
              <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-xl border border-green-200 dark:border-green-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-green-800 dark:text-green-400">Sesión iniciada</p>
                  <p className="text-xs text-green-600 dark:text-green-500">{firebaseUser.email}</p>
                </div>
                <Cloud className="w-5 h-5 text-green-500" />
              </div>
            ) : (
              <button
                onClick={handleCloudLogin}
                disabled={isCloudLoading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
              >
                {isCloudLoading ? 'Conectando...' : 'Iniciar Sesión con Google'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
