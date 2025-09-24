// In context/AppContext.tsx
import * as Network from "expo-network";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import * as db from "../database";
import { Budget, Transaction } from "../database";

interface AppContextType {
  transactions: Transaction[];
  budgets: Budget[];
  isSyncing: boolean;
  isOnline: boolean;
  lastSyncError: string | null;
  triggerFullSync: () => Promise<void>;
  addTransaction: (
    txData: Omit<Transaction, "isSynced" | "id" | "uuid">
  ) => Promise<void>;
  updateTransaction: (
    uuid: string,
    txData: Omit<Transaction, "isSynced" | "id" | "uuid">
  ) => Promise<void>;
  deleteTransaction: (uuid: string) => Promise<void>;
  setBudget: (budget: Budget) => Promise<void>;
  clearSyncError: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const [needsSync, setNeedsSync] = useState(false);

  // Network status check with longer intervals
  useEffect(() => {
    const checkNetworkStatus = async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        const isConnected = networkState.isConnected ?? false;
        const isReachable = networkState.isInternetReachable ?? false;
        const wasOffline = !isOnline;
        const nowOnline = isConnected && isReachable;
        
        setIsOnline(nowOnline);
        
        // If we just came back online and need sync, trigger it
        if (wasOffline && nowOnline && needsSync) {
          setTimeout(() => performFullSync().catch(console.error), 1000);
        }
      } catch (error) {
        console.error("Failed to check network status:", error);
        setIsOnline(false);
      }
    };
    
    checkNetworkStatus();
    // Increased interval from 30s to 2 minutes
    const interval = setInterval(checkNetworkStatus, 120000);
    return () => clearInterval(interval);
  }, [isOnline, needsSync]);

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

  const shouldSync = (): boolean => {
    if (!isOnline) return false;
    
    const now = Date.now();
    const SYNC_COOLDOWN = 5 * 60 * 1000; // 5 minutes minimum between syncs
    
    // Always sync if it's been more than 5 minutes since last sync and we need it
    if (needsSync && (now - lastSyncTime > SYNC_COOLDOWN)) {
      return true;
    }
    
    return false;
  };

  const performFullSync = async (): Promise<void> => {
    if (!shouldSync() && needsSync === false) {
      console.log("Skipping sync - conditions not met");
      return;
    }

    console.log("Starting background sync...");
    setIsSyncing(true);
    setLastSyncError(null);
    
    try {
      await db.syncData();
      setLastSyncTime(Date.now());
      setNeedsSync(false);
      console.log("Background sync completed successfully");
    } catch (error) {
      console.error("Background sync failed:", error);
      setLastSyncError(error instanceof Error ? error.message : "Sync failed");
    } finally {
      await refreshLocalData();
      setIsSyncing(false);
    }
  };

  const addTransaction = async (
    txData: Omit<Transaction, "isSynced" | "id" | "uuid">
  ): Promise<void> => {
    try {
      await db.addTransaction(txData);
      await refreshLocalData();
      setNeedsSync(true); // Mark that we need sync
      console.log("Transaction added successfully");
      
      // Trigger sync in background if online
      if (isOnline) {
        setTimeout(() => performFullSync().catch(console.error), 2000);
      }
    } catch (error) {
      console.error("Failed to add transaction:", error);
      throw error;
    }
  };

  const updateTransaction = async (
    uuid: string,
    txData: Omit<Transaction, "isSynced" | "id" | "uuid">
  ) => {
    try {
      await db.updateTransaction(uuid, txData);
      await refreshLocalData();
      setNeedsSync(true); // Mark that we need sync
      console.log("Transaction updated successfully");
      
      // Trigger sync in background if online
      if (isOnline) {
        setTimeout(() => performFullSync().catch(console.error), 2000);
      }
    } catch (error) {
      console.error("Failed to update transaction:", error);
      throw error;
    }
  };

  const deleteTransaction = async (uuid: string) => {
    try {
      await db.deleteTransaction(uuid);
      await refreshLocalData();
      setNeedsSync(true); // Mark that we need sync
      console.log("Transaction deleted successfully");
      
      // Trigger sync in background if online
      if (isOnline) {
        setTimeout(() => performFullSync().catch(console.error), 2000);
      }
    } catch (error) {
      console.error("Failed to delete transaction:", error);
      throw error;
    }
  };

  const setBudget = async (budget: Budget): Promise<void> => {
    try {
      await db.setBudgetForMonth(budget);
      await refreshLocalData();
      setNeedsSync(true); // Mark that we need sync
      console.log("Budget set successfully");
      
      // Trigger sync in background if online
      if (isOnline) {
        setTimeout(() => performFullSync().catch(console.error), 2000);
      }
    } catch (error) {
      console.error("Failed to set budget:", error);
      throw error;
    }
  };

  const clearSyncError = () => {
    setLastSyncError(null);
  };
  
  // Initial app setup - only sync if no data or first time
  useEffect(() => {
    const initializeApp = async () => {
      try {
        db.init();
        const { hasData } = await refreshLocalData();
        setIsInitialized(true);
        
        // Only sync on first launch if no data exists
        if (!hasData && isOnline) {
          setNeedsSync(true);
          await performFullSync();
        } else if (!hasData) {
          setNeedsSync(true); // Will sync when online
        }
      } catch (error) {
        console.error("App initialization failed:", error);
        setIsInitialized(true);
      }
    };
    initializeApp();
  }, []);

  // Remove the aggressive auto-sync effect - let it be demand-driven
  useEffect(() => {
    if (isOnline && isInitialized && needsSync) {
      const timer = setTimeout(() => {
        performFullSync().catch((error) => {
          console.error("Demand-driven sync failed:", error);
        });
      }, 5000); // Longer delay
      return () => clearTimeout(timer);
    }
  }, [isOnline, isInitialized, needsSync]);

  const value: AppContextType = {
    transactions,
    budgets,
    isSyncing,
    isOnline,
    lastSyncError,
    triggerFullSync: performFullSync,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    setBudget,
    clearSyncError,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppData = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppData must be used within an AppProvider");
  }
  return context;
};