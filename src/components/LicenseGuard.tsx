import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Key, ShieldAlert, Clock, CheckCircle2, Monitor, Cloud, Sun, Moon, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import Logo from './Logo';

export const LicenseGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { license, activateTrial, checkLicense, firebaseUser, theme, toggleTheme, login, forceTrialActivation } = useStore();

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

  const handleForceTrialActivation = () => {
    setError('');
    setSuccess('');
    const result = forceTrialActivation();
    if (result.success) {
      setSuccess(result.message);
      toast.success(result.message);
      login('1234');
    } else {
      setError(result.message);
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

  // Always return children directly to completely remove trial limitations and banners
  return <>{children}</>;
};
