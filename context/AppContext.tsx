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
  triggerUploadSync: () => Promise<void>;  // For uploading pending changes
  triggerFullSync: () => Promise<void>;    // For full download (rare)
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

  // Use refs to prevent infinite loops and track initialization
  const isInitialized = useRef(false);
  const lastNetworkCheck = useRef(0);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncTime = useRef(0);  // Track last sync time to prevent rapid syncs

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
    const now = Date.now();
    const SYNC_COOLDOWN = 10000; // 10 seconds cooldown between syncs
    
    // Prevent rapid successive syncs
    if (now - lastSyncTime.current < SYNC_COOLDOWN) {
      console.log(`Sync cooldown active. Last sync was ${Math.round((now - lastSyncTime.current) / 1000)}s ago`);
      return;
    }
    
    if (isSyncing) {
      console.log("Sync already in progress, skipping");
      return;
    }
    
    if (!isOnline) {
      setLastSyncError("You are offline. Sync will resume when connection is restored.");
      console.log("Cannot sync while offline");
      return;
    }
    
    lastSyncTime.current = now; // Update last sync time
    setIsSyncing(true);
    setLastSyncError(null);
    console.log(`Starting sync process (full download: ${isFullDownload})`);
    
    try {
      await db.syncData(isFullDownload);
      await refreshLocalData();
      console.log("Sync completed successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sync failed";
      console.error("Sync failed:", errorMessage);
      setLastSyncError(errorMessage);
    } finally {
      setIsSyncing(false);
    }
  };

  // Network monitoring with throttling
  const checkNetworkStatus = async () => {
    const now = Date.now();
    // Throttle network checks to every 30 seconds
    if (now - lastNetworkCheck.current < 30000) {
      return;
    }
    lastNetworkCheck.current = now;

    try {
      const networkState = await Network.getNetworkStateAsync();
      const wasOnline = isOnline;
      const nowOnline = !!(networkState.isConnected && networkState.isInternetReachable);
      
      if (wasOnline !== nowOnline) {
        console.log(`Network status changed: ${nowOnline ? 'online' : 'offline'}`);
        setIsOnline(nowOnline);
        
        // If we just came back online, trigger upload sync after a delay
        if (!wasOnline && nowOnline && isInitialized.current) {
          if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
          }
          syncTimeoutRef.current = setTimeout(() => {
            console.log("Back online - uploading pending changes");
            triggerFullSync(false);
          }, 3000);
        }
      }
    } catch (error) {
      console.error("Network check failed:", error);
      setIsOnline(false);
    }
  };

  // App initialization effect - runs only once
  useEffect(() => {
    const initializeApp = async () => {
      if (isInitialized.current) {
        console.log("App already initialized, skipping...");
        return;
      }
      
      console.log("=== STARTING APP INITIALIZATION ===");
      
      try {
        console.log("Initializing database...");
        await db.init();
        const { hasData } = await refreshLocalData();
        console.log(`Local data exists: ${hasData}`);
        
        // Check initial network status
        await checkNetworkStatus();
        console.log(`Network status: ${isOnline ? 'online' : 'offline'}`);
        
        if (isOnline) {
          if (!hasData) {
            console.log("=== REASON: First launch with no data ===");
            await triggerFullSync(true);
          } else {
            // Check if weekly sync is needed
            const lastSyncString = await AsyncStorage.getItem('lastFullSyncTimestamp');
            const lastSyncTime = lastSyncString ? parseInt(lastSyncString, 10) : 0;
            const oneWeek = 7 * 24 * 60 * 60 * 1000;
            const timeSinceLastSync = Date.now() - lastSyncTime;

            console.log(`=== SYNC DECISION LOGIC ===`);
            console.log(`Last sync timestamp: ${lastSyncString || 'null'}`);
            console.log(`Last sync: ${lastSyncTime === 0 ? 'Never' : new Date(lastSyncTime).toLocaleString()}`);
            console.log(`Time since last sync: ${Math.round(timeSinceLastSync / (1000 * 60 * 60))} hours`);
            console.log(`Weekly sync threshold: ${Math.round(oneWeek / (1000 * 60 * 60))} hours (168 hours)`);
            console.log(`Needs weekly sync: ${timeSinceLastSync > oneWeek}`);

            if (timeSinceLastSync > oneWeek) {
              console.log("=== REASON: Weekly full sync needed ===");
              await triggerFullSync(true);
            } else {
              console.log("=== REASON: Checking for pending uploads only ===");
              await triggerFullSync(false);
            }
          }
        } else {
          console.log("App initialized offline - no sync performed");
        }
      } catch (error) {
        console.error("App initialization failed:", error);
        setLastSyncError("Failed to initialize app");
      } finally {
        isInitialized.current = true;
        console.log("=== APP INITIALIZATION COMPLETE ===");
      }
    };

    initializeApp();
  }, []); // Empty dependency array - runs only once

  // Network monitoring effect
  useEffect(() => {
    const interval = setInterval(checkNetworkStatus, 60000); // Check every minute
    return () => {
      clearInterval(interval);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [isOnline]); // Only re-run if isOnline changes

  const addTransaction = async (txData: Omit<Transaction, "isSynced" | "id" | "uuid">): Promise<void> => {
    try {
      await db.addTransaction(txData);
      await refreshLocalData();
      console.log("Transaction added locally");
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
      console.log("Transaction updated locally");
    } catch (error) {
      console.error("Failed to update transaction:", error);
      throw error;
    }
  };

  const deleteTransaction = async (uuid: string) => {
    try {
      await db.deleteTransaction(uuid);
      await refreshLocalData();
      console.log("Transaction deleted locally");
    } catch (error) {
      console.error("Failed to delete transaction:", error);
      throw error;
    }
  };

  const setBudget = async (budget: Budget): Promise<void> => {
    try {
      await db.setBudgetForMonth(budget);
      await refreshLocalData();
      console.log("Budget set locally");
    } catch (error) {
      console.error("Failed to set budget:", error);
      throw error;
    }
  };

  const clearSyncError = () => setLastSyncError(null);

  const value: AppContextType = {
    transactions,
    budgets,
    isSyncing,
    isOnline,
    lastSyncError,
    triggerUploadSync: () => {
      console.log("=== UPLOAD SYNC TRIGGERED FROM UI ===");
      return triggerFullSync(false); // Upload pending changes only
    },
    triggerFullSync: () => {
      console.log("=== FULL SYNC TRIGGERED FROM UI ===");
      return triggerFullSync(true); // Full download - should be rare
    },
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