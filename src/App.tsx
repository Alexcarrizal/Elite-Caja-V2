/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import CashRegister from './pages/CashRegister';
import Reports from './pages/Reports';
import SalesHistory from './pages/SalesHistory';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Remissions from './pages/Remissions';
import Warranties from './pages/Warranties';
import { useStore } from './store/useStore';
import { Toaster } from 'sonner';
import { LicenseGuard } from './components/LicenseGuard';
import Keygen from './pages/Keygen';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';

import { CloudSyncProvider } from './services/cloudSync';

export default function App() {
  const { theme, setFirebaseUser } = useStore();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    return () => unsubscribe();
  }, [setFirebaseUser]);

  return (
    <CloudSyncProvider>
      <HashRouter>
        <Toaster position="top-center" richColors />
        <Routes>
          <Route path="/keygen" element={<Keygen />} />
          <Route path="*" element={
            <LicenseGuard>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="pos" element={<POS />} />
                  <Route path="inventory" element={<Inventory />} />
                  <Route path="cash-register" element={<CashRegister />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="sales" element={<SalesHistory />} />
                  <Route path="remissions" element={<Remissions />} />
                  <Route path="warranties" element={<Warranties />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </LicenseGuard>
          } />
        </Routes>
      </HashRouter>
    </CloudSyncProvider>
  );
}

