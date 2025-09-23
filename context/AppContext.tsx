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

  // ... (useEffect for network status is unchanged) ...
  useEffect(() => {
    const checkNetworkStatus = async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        const isConnected = networkState.isConnected ?? false;
        const isReachable = networkState.isInternetReachable ?? false;
        setIsOnline(isConnected && isReachable);
      } catch (error) {
        console.error("Failed to check network status:", error);
        setIsOnline(false);
      }
    };
    checkNetworkStatus();
    const interval = setInterval(checkNetworkStatus, 30000);
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

  const addTransaction = async (
    txData: Omit<Transaction, "isSynced" | "id" | "uuid">
  ): Promise<void> => {
    try {
      await db.addTransaction(txData);
      await refreshLocalData();
      console.log("Transaction added successfully");
    } catch (error) {
      console.error("Failed to add transaction:", error);
      throw error;
    }
  };

  // --- NEW: Function to handle updating a transaction ---
  const updateTransaction = async (
    uuid: string,
    txData: Omit<Transaction, "isSynced" | "id" | "uuid">
  ) => {
    await db.updateTransaction(uuid, txData);
    await refreshLocalData(); // Refresh state to show changes in the UI
  };

  // --- NEW: Function to handle deleting a transaction ---
  const deleteTransaction = async (uuid: string) => {
    await db.deleteTransaction(uuid);
    await refreshLocalData(); // Refresh state to show changes in the UI
  };


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
  
  // ... (useEffect for initializeApp and auto-sync are unchanged) ...
  useEffect(() => {
    const initializeApp = async () => {
      try {
        db.init();
        const { hasData } = await refreshLocalData();
        setIsInitialized(true);
        if (isOnline) {
          if (!hasData) {
            await performFullSync();
          } else {
            performFullSync().catch((error) => {
              console.error("Background sync failed:", error);
            });
          }
        }
      } catch (error) {
        console.error("App initialization failed:", error);
        setIsInitialized(true);
      }
    };
    initializeApp();
  }, []);

  useEffect(() => {
    if (isOnline && isInitialized) {
      const timer = setTimeout(() => {
        performFullSync().catch((error) => {
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
    updateTransaction, // <-- Now correctly defined
    deleteTransaction, // <-- Now correctly defined
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