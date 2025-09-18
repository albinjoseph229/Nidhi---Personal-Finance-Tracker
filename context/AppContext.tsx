import * as Network from 'expo-network';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import * as db from '../database';
import { Budget, Transaction } from '../database';

interface AppContextType {
  transactions: Transaction[];
  budgets: Budget[];
  isSyncing: boolean;
  triggerFullSync: () => Promise<void>;
  addTransaction: (txData: Omit<Transaction, 'isSynced' | 'id' | 'uuid'>) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isSyncing, setIsSyncing] = useState(true);

  const refreshLocalData = async () => {
    try {
      const [localTxs, localBudgets] = await Promise.all([
        db.getAllTransactions(),
        db.getAllBudgets(),
      ]);
      setTransactions(localTxs);
      setBudgets(localBudgets);
      return { hasData: localTxs.length > 0 || localBudgets.length > 0 };
    } catch (error) {
      console.error("Failed to refresh local data", error);
      return { hasData: false };
    }
  };
  
  const performFullSync = async () => {
    setIsSyncing(true);
    try {
      const networkState = await Network.getNetworkStateAsync();
      if (networkState.isConnected && networkState.isInternetReachable) {
        await db.syncData();
      }
    } catch (error) {
      console.error("Full sync failed", error);
    } finally {
      await refreshLocalData();
      setIsSyncing(false);
    }
  };
  
  // New function to handle adding a transaction
  const addTransaction = async (txData: Omit<Transaction, 'isSynced'|'id'|'uuid'>) => {
    // 1. Save to local DB
    await db.addTransaction(txData);
    // 2. Refresh the app's state with the new data
    await refreshLocalData();
    // 3. Start the background sync, but don't wait for it
    performFullSync();
  };

  useEffect(() => {
    db.init();
    performFullSync();
  }, []);

  const value = {
    transactions,
    budgets,
    isSyncing,
    triggerFullSync: performFullSync,
    addTransaction, // Expose the new function
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppData = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppData must be used within an AppProvider');
  }
  return context;
};