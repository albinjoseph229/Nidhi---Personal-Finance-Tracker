import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
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
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  // Use a ref to ensure the initialization logic runs only once.
  const isInitialized = useRef(false);

  // FIX: Simplified because the database function `getAllTransactions` now handles filtering.
  const refreshLocalData = async (): Promise<{ hasData: boolean }> => {
    try {
      const [localTxs, localBudgets] = await Promise.all([
        db.getAllTransactions(),
        db.getAllBudgets(),
      ]);
      setTransactions(localTxs);
      setBudgets(localBudgets);
      return { hasData: localTxs.length > 0 };
    } catch (error) {
      console.error("Failed to refresh local data", error);
      return { hasData: false };
    }
  };

  const triggerFullSync = async (isFullDownload: boolean = false) => {
    if (isSyncing) return;
    if (!isOnline) {
      setLastSyncError("You are offline. Sync will resume when connection is back.");
      return;
    }
    
    setIsSyncing(true);
    setLastSyncError(null);
    try {
      await db.syncData(isFullDownload);
      console.log("Sync check completed.");
    } catch (error) {
      console.error("Sync failed:", error);
      setLastSyncError(error instanceof Error ? error.message : "Sync failed");
    } finally {
      await refreshLocalData();
      setIsSyncing(false);
    }
  };
  
  // FIX: Unified effect for initialization and continuous network monitoring.
  useEffect(() => {
    const handleAppLogic = async () => {
      // 1. Always check the current network status.
      const networkState = await Network.getNetworkStateAsync();
      const isConnected = !!(networkState.isConnected && networkState.isInternetReachable);
      const cameOnline = !isOnline && isConnected; // Detects transition from offline to online
      setIsOnline(isConnected);

      // 2. On the very first run, initialize the DB and perform initial sync logic.
      if (!isInitialized.current) {
        isInitialized.current = true; // Mark as initialized
        await db.init();
        const { hasData } = await refreshLocalData();
        
        if (isConnected) {
          if (!hasData) {
            console.log("First launch with no data. Performing initial full sync.");
            triggerFullSync(true); // Full download
          } else {
            const lastSyncString = await AsyncStorage.getItem('lastFullSyncTimestamp');
            const lastSyncTime = lastSyncString ? parseInt(lastSyncString, 10) : 0;
            const oneWeek = 7 * 24 * 60 * 60 * 1000;

            if (Date.now() - lastSyncTime > oneWeek) {
              console.log("It has been over a week. Performing weekly full sync.");
              triggerFullSync(true); // Full download
            } else {
              console.log("Weekly sync not needed. Uploading any pending changes.");
              triggerFullSync(false); // Upload only
            }
          }
        } else {
          console.log("App initialized offline.");
        }
      } else if (cameOnline) {
        // 3. If already initialized and we just came online, upload any pending changes.
        console.log("App is back online! Uploading pending changes...");
        triggerFullSync(false); // Upload only
      }
    };

    handleAppLogic(); // Run immediately on component mount

    const interval = setInterval(handleAppLogic, 30000); // Re-check every 30 seconds
    return () => clearInterval(interval);
  }, [isOnline]); // Dependency on `isOnline` allows detecting the offline -> online transition.


  // CUD functions are clean and delegate responsibility to the database layer.
  const addTransaction = async (txData: Omit<Transaction, "isSynced" | "id" | "uuid">): Promise<void> => {
    await db.addTransaction(txData);
    await refreshLocalData();
  };

  const updateTransaction = async (uuid: string, txData: Omit<Transaction, "isSynced" | "id" | "uuid">) => {
    await db.updateTransaction(uuid, txData);
    await refreshLocalData();
  };

  const deleteTransaction = async (uuid: string) => {
    await db.deleteTransaction(uuid);
    await refreshLocalData();
  };

  const setBudget = async (budget: Budget): Promise<void> => {
    await db.setBudgetForMonth(budget);
    await refreshLocalData();
  };

  const clearSyncError = () => setLastSyncError(null);

  const value: AppContextType = {
    transactions,
    budgets,
    isSyncing,
    isOnline,
    lastSyncError,
    triggerFullSync: () => triggerFullSync(true), 
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