import * as Network from 'expo-network';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import * as db from '../database';
import { Budget, Transaction } from '../database';

interface AppContextType {
  transactions: Transaction[];
  budgets: Budget[];
  isSyncing: boolean;
  isOnline: boolean;
  lastSyncError: string | null;
  triggerFullSync: () => Promise<void>;
  addTransaction: (txData: Omit<Transaction, 'isSynced' | 'id' | 'uuid'>) => Promise<void>;
  setBudget: (budget: Budget) => Promise<void>;
  clearSyncError: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isSyncing, setIsSyncing] = useState(false); // Changed: Don't start as syncing
  const [isOnline, setIsOnline] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Monitor network status
  useEffect(() => {
    const checkNetworkStatus = async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        // Handle potential undefined values
        const isConnected = networkState.isConnected ?? false;
        const isReachable = networkState.isInternetReachable ?? false;
        setIsOnline(isConnected && isReachable);
      } catch (error) {
        console.error("Failed to check network status:", error);
        setIsOnline(false);
      }
    };

    checkNetworkStatus();
    const interval = setInterval(checkNetworkStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const refreshLocalData = async (): Promise<{ hasData: boolean }> => {
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

  const performFullSync = async (): Promise<void> => {
    if (!isOnline) {
      console.log("Skipping sync - device is offline");
      return;
    }

    setIsSyncing(true);
    setLastSyncError(null);
    
    try {
      await db.syncData();
      console.log("Full sync completed successfully");
    } catch (error) {
      console.error("Full sync failed:", error);
      setLastSyncError(error instanceof Error ? error.message : "Sync failed");
    } finally {
      await refreshLocalData();
      setIsSyncing(false);
    }
  };

  // Function to handle adding a transaction
  const addTransaction = async (txData: Omit<Transaction, 'isSynced' | 'id' | 'uuid'>): Promise<void> => {
    try {
      // 1. Save to local DB (always works)
      await db.addTransaction(txData);
      
      // 2. Refresh the app's state immediately
      await refreshLocalData();
      
      // 3. If online, the addTransaction function will handle background sync
      console.log("Transaction added successfully");
    } catch (error) {
      console.error("Failed to add transaction:", error);
      throw error;
    }
  };

  // Function to set budget
  const setBudget = async (budget: Budget): Promise<void> => {
    try {
      await db.setBudgetForMonth(budget);
      await refreshLocalData();
      console.log("Budget set successfully");
    } catch (error) {
      console.error("Failed to set budget:", error);
      throw error;
    }
  };

  const clearSyncError = () => {
    setLastSyncError(null);
  };

  // Initialize the app
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 1. Initialize database
        db.init();
        
        // 2. Load local data first (fast)
        const { hasData } = await refreshLocalData();
        setIsInitialized(true);
        
        // 3. If we have network and no local data, or if we want fresh data, sync
        if (isOnline) {
          if (!hasData) {
            // No local data, sync immediately
            await performFullSync();
          } else {
            // Has local data, sync in background
            performFullSync().catch(error => {
              console.error("Background sync failed:", error);
            });
          }
        }
      } catch (error) {
        console.error("App initialization failed:", error);
        setIsInitialized(true); // Still set as initialized to show the app
      }
    };

    initializeApp();
  }, []);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && isInitialized) {
      // Small delay to ensure stable connection
      const timer = setTimeout(() => {
        performFullSync().catch(error => {
          console.error("Auto-sync failed:", error);
        });
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isOnline, isInitialized]);

  const value: AppContextType = {
    transactions,
    budgets,
    isSyncing,
    isOnline,
    lastSyncError,
    triggerFullSync: performFullSync,
    addTransaction,
    setBudget,
    clearSyncError,
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