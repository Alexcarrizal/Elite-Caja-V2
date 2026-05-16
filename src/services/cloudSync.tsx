import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { collection, doc, setDoc, deleteDoc, getDocs, getDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from './firebase';
import { toast } from 'sonner';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType | string;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType | string, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  toast.error(errInfo.error);
  throw new Error(JSON.stringify(errInfo));
};

const syncItem = async (uid: string, collectionName: string, item: any) => {
  try {
    // Strip undefined values which Firebase rejects
    const cleanItem = JSON.parse(JSON.stringify(item));
    await setDoc(doc(db, 'stores', uid, collectionName, cleanItem.id), cleanItem);
  } catch (error) {
    handleFirestoreError(error, 'write', `stores/${uid}/${collectionName}/${item.id}`);
  }
};

const deleteItem = async (uid: string, collectionName: string, itemId: string) => {
  try {
    await deleteDoc(doc(db, 'stores', uid, collectionName, itemId));
  } catch (error) {
    handleFirestoreError(error, 'delete', `stores/${uid}/${collectionName}/${itemId}`);
  }
};

const syncSettings = async (uid: string, settings: any) => {
  try {
    const cleanSettings = JSON.parse(JSON.stringify({ ...settings, ownerId: uid }));
    await setDoc(doc(db, 'stores', uid), cleanSettings);
  } catch (error) {
    handleFirestoreError(error, 'write', `stores/${uid}`);
  }
};

export const CloudSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, clearDatabase } = useStore();
  const [isSyncingDown, setIsSyncingDown] = useState(false);
  const stateRef = useRef(useStore.getState());
  const initialLoadDone = useRef(false);

  // 1. Download data on login
  useEffect(() => {
    const downloadData = async () => {
      if (!firebaseUser) {
        initialLoadDone.current = false;
        return;
      }

      const uid = firebaseUser.uid;
      setIsSyncingDown(true);
      const toastId = toast.loading('Sincronizando base de datos desde la nube...');

      try {
        // Fetch Settings and License
        const settingsSnap = await getDoc(doc(db, 'stores', uid));
        let newSettings = useStore.getState().settings;
        let newLicense = useStore.getState().license;

        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          if (data.license) {
            newLicense = data.license;
          }
          delete data.ownerId; // remove internal field
          delete data.license; // remove license field
          
          if (Object.keys(data).length > 0) {
            newSettings = { ...newSettings, ...data } as any;
          }
        }

        // Fetch collections in parallel
        const fetchCollection = async (col: string) => {
          const snap = await getDocs(collection(db, 'stores', uid, col));
          return snap.docs.map(d => d.data());
        };

        const [products, customers, sales, inventoryMovements, cashRegisters] = await Promise.all([
          fetchCollection('products'),
          fetchCollection('customers'),
          fetchCollection('sales'),
          fetchCollection('inventoryMovements'),
          fetchCollection('cashRegisters')
        ]);

        // Overwrite local state entirely with cloud state
        useStore.setState({
          settings: newSettings,
          license: newLicense,
          products: products as any,
          customers: customers as any,
          sales: sales as any,
          inventoryMovements: inventoryMovements as any,
          cashRegisters: cashRegisters as any,
        });

        // Re-check the downloaded license to ensure it's not expired
        useStore.getState().checkLicense();

        toast.success('Sincronización completada', { id: toastId });
      } catch (error) {
        console.error(error);
        toast.error('Error al sincronizar datos', { id: toastId });
      } finally {
        setIsSyncingDown(false);
        // Important: set ref AFTER the downward sync so we don't immediately push it back up!
        stateRef.current = useStore.getState();
        initialLoadDone.current = true;
      }
    };

    downloadData();
  }, [firebaseUser]);

  // 2. Upload changes when state changes
  useEffect(() => {
    const unsubscribe = useStore.subscribe((state) => {
      const uid = state.firebaseUser?.uid;
      const prev = stateRef.current;
      
      // Do not sync UP if we are currently syncing DOWN or if the user is not logged in
      if (!uid || isSyncingDown || !initialLoadDone.current) {
        stateRef.current = state;
        return;
      }

      // Settings & License
      if (state.settings !== prev.settings || state.license !== prev.license) {
        const cleanSettings = JSON.parse(JSON.stringify({ 
          ...state.settings, 
          license: state.license,
          ownerId: uid 
        }));
        setDoc(doc(db, 'stores', uid), cleanSettings).catch((e) => handleFirestoreError(e, 'write', `stores/${uid}`));
      }

      // Collections diffing helper
      const diffCollection = (colName: string, currentItems: any[] = [], prevItems: any[] = []) => {
        if (!currentItems || !prevItems) return;
        // Find added or updated items (reference equality check works due to Zustand's immutability)
        currentItems.forEach(item => {
          const oldItem = prevItems.find(o => o.id === item.id);
          if (oldItem !== item) {
            syncItem(uid, colName, item);
          }
        });

        // Find deleted items
        prevItems.forEach(oldItem => {
          if (!currentItems.find(i => i.id === oldItem.id)) {
            deleteItem(uid, colName, oldItem.id);
          }
        });
      };

      if (state.products !== prev.products) {
        diffCollection('products', state.products, prev.products);
      }
      if (state.customers !== prev.customers) {
        diffCollection('customers', state.customers, prev.customers);
      }
      if (state.sales !== prev.sales) {
        diffCollection('sales', state.sales, prev.sales);
      }
      if (state.inventoryMovements !== prev.inventoryMovements) {
        diffCollection('inventoryMovements', state.inventoryMovements, prev.inventoryMovements);
      }
      if (state.cashRegisters !== prev.cashRegisters) {
        diffCollection('cashRegisters', state.cashRegisters, prev.cashRegisters);
      }

      stateRef.current = state;
    });

    return unsubscribe;
  }, [isSyncingDown]);

  return <>{children}</>;
};
