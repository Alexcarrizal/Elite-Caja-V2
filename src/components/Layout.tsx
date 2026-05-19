import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useStore, defaultSettings } from '../store/useStore';
import { AnimatePresence, motion } from 'motion/react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Wallet, 
  BarChart3, 
  ListOrdered,
  Users,
  Settings, 
  LogOut,
  Sun,
  Moon,
  ClipboardList,
  ShieldCheck,
  Database,
  X,
  FileText,
  Building
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import Logo from './Logo';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const { 
    currentUser, 
    firebaseUser,
    logout, 
    theme, 
    toggleTheme, 
    settings = defaultSettings 
  } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { cashRegisters = [] } = useStore();
  const [showBackupReminder, setShowBackupReminder] = React.useState(false);
  const hasPromptedRegister = React.useRef(false);

  React.useEffect(() => {
    if (currentUser && !hasPromptedRegister.current) {
      hasPromptedRegister.current = true;
      const hasOpenRegister = cashRegisters.some(r => r.status === 'open');
      if (!hasOpenRegister && location.pathname !== '/cash-register') {
        navigate('/cash-register', { state: { autoOpen: true } });
      }
    }
  }, [currentUser, cashRegisters, navigate, location.pathname]);

  React.useEffect(() => {
    if (settings.backupFrequency && settings.backupFrequency !== 'never') {
      const lastBackup = settings.lastBackupDate ? new Date(settings.lastBackupDate) : null;
      const now = new Date();
      
      if (!lastBackup) {
        setShowBackupReminder(true);
        return;
      }

      const diffTime = Math.abs(now.getTime() - lastBackup.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (settings.backupFrequency === 'weekly' && diffDays >= 7) {
        setShowBackupReminder(true);
      } else if (settings.backupFrequency === 'biweekly' && diffDays >= 14) {
        setShowBackupReminder(true);
      } else if (settings.backupFrequency === 'monthly' && diffDays >= 30) {
        setShowBackupReminder(true);
      } else {
        setShowBackupReminder(false);
      }
    } else {
      setShowBackupReminder(false);
    }
  }, [settings.backupFrequency, settings.lastBackupDate]);

  React.useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  if (!currentUser) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch(e) {
      console.error('Failed to sign out of Firebase', e);
    }
    useStore.getState().clearDatabase();
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/pos', icon: ShoppingCart, label: 'Punto de Venta' },
    { to: '/inventory', icon: Package, label: 'Inventario' },
    { to: '/suppliers', icon: Building, label: 'Proveedores' },
    { to: '/cash-register', icon: Wallet, label: 'Caja' },
    { to: '/sales', icon: ListOrdered, label: 'Historial de Ventas' },
    { to: '/remissions', icon: ClipboardList, label: 'Notas de Remisión' },
    { to: '/warranties', icon: ShieldCheck, label: 'Garantías' },
    { to: '/customers', icon: Users, label: 'Clientes' },
    { to: '/reports', icon: BarChart3, label: 'Reportes' },
    { to: '/settings', icon: Settings, label: 'Configuración' },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden transition-colors duration-200 bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-white">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r transition-colors duration-200 bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="h-20 flex items-center justify-center px-4 border-b border-inherit bg-white dark:bg-gray-800">
          <Logo className="scale-[0.6] origin-left" />
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200" 
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/50"
              )}
            >
              <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-inherit">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold overflow-hidden">
                {firebaseUser?.photoURL ? (
                  <img src={firebaseUser.photoURL} alt={currentUser.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  currentUser.name.charAt(0)
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium truncate">{currentUser.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{currentUser.role}</p>
              </div>
            </div>
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button 
              onClick={() => {
                import('../utils/generateSummaryPdf').then(m => m.generateSummaryPdf());
              }}
              title="Descargar Características (PDF)"
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400"
            >
              <FileText size={18} />
            </button>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-lg transition-colors"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {showBackupReminder && (
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border-b border-yellow-200 dark:border-yellow-800 p-4 flex items-center justify-between">
            <div className="flex items-center text-yellow-800 dark:text-yellow-200">
              <Database className="w-5 h-5 mr-3 flex-shrink-0" />
              <p className="text-sm font-medium">
                Recordatorio: Es hora de realizar un respaldo de tu base de datos.
                <button 
                  onClick={() => navigate('/settings')} 
                  className="ml-2 underline font-bold hover:text-yellow-900 dark:hover:text-yellow-100"
                >
                  Ir a Configuración
                </button>
              </p>
            </div>
            <button 
              onClick={() => setShowBackupReminder(false)}
              className="p-1 rounded-md hover:bg-yellow-100 dark:hover:bg-yellow-800/50 text-yellow-700 dark:text-yellow-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
