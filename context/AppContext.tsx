// context/AppContext.tsx
// Global state management with Supabase sync awareness

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
import { Budget, Investment, Transaction } from "../database";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

interface AppContextType {
  transactions: Transaction[];
  budgets: Budget[];
  investments: Investment[];
  isSyncing: boolean;
  isOnline: boolean;
  lastSyncError: string | null;
  triggerUploadSync: () => Promise<void>;
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
  addInvestment: (
    invData: Omit<Investment, "isSynced" | "uuid">
  ) => Promise<void>;
  updateInvestment: (
    uuid: string,
    invData: Omit<Investment, "isSynced" | "uuid">
  ) => Promise<void>;
  deleteInvestment: (uuid: string) => Promise<void>;
  clearSyncError: () => void;
  testConnection: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  // Use refs to prevent infinite loops and track initialization
  const isInitialized = useRef(false);
  const lastNetworkCheck = useRef(0);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncTime = useRef(0);

  const refreshLocalData = async (): Promise<{ hasData: boolean }> => {
    try {
      const [localTxs, localBudgets, localInvestments] = await Promise.all([
        db.getAllTransactions(),
        db.getAllBudgets(),
        db.getAllInvestments(),
      ]);
      setTransactions(localTxs);
      setBudgets(localBudgets);
      setInvestments(localInvestments);
      return { hasData: localTxs.length > 0 || localInvestments.length > 0 };
    } catch (error) {
      console.error("Failed to refresh local data", error);
      return { hasData: false };
    }
  };

  const testConnection = async () => {
    console.log("=== TESTING SUPABASE CONNECTION ===");

    try {
      // Test Supabase connectivity with a simple query
      const { error } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true });

      if (error) {
        // RLS errors are fine — they mean the connection works but no data for this user yet
        if (error.code === 'PGRST301' || error.message.includes('JWT')) {
          console.log("⚠️ Supabase connection OK but auth issue:", error.message);
          setLastSyncError("Authentication issue - please sign in again");
          return;
        }
        throw error;
      }

      console.log("✅ Supabase connection successful");
      setLastSyncError(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Supabase connection failed:", errorMessage);

      if (
        errorMessage.includes("Network request failed") ||
        errorMessage.includes("fetch")
      ) {
        setLastSyncError(
          "Cannot reach Supabase. Check internet connection."
        );
      } else {
        setLastSyncError(`Connection test failed: ${errorMessage}`);
      }
    }
  };

  const getUserId = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  };

  const triggerFullSync = async (isFullDownload: boolean = false) => {
    const now = Date.now();
    const SYNC_COOLDOWN = 10000;

    if (now - lastSyncTime.current < SYNC_COOLDOWN) {
      console.log(
        `Sync cooldown active. Last sync was ${Math.round(
          (now - lastSyncTime.current) / 1000
        )}s ago`
      );
      return;
    }

    if (isSyncing) {
      console.log("Sync already in progress, skipping");
      return;
    }

    if (!isOnline) {
      setLastSyncError(
        "You are offline. Sync will resume when connection is restored."
      );
      console.log("Cannot sync while offline");
      return;
    }

    // Get user ID — skip sync if not authenticated
    const userId = await getUserId();
    if (!userId) {
      console.log("No authenticated user, skipping sync");
      return;
    }

    lastSyncTime.current = now;
    setIsSyncing(true);
    setLastSyncError(null);
    console.log(`Starting sync process (full download: ${isFullDownload})`);

    try {
      await db.syncData(isFullDownload, userId);
      await refreshLocalData();
      await AsyncStorage.setItem("lastSyncTimestamp", new Date().toISOString());
      console.log("Sync completed successfully");
      setLastSyncError(null);
    } catch (error) {
      let errorMessage = "Sync failed";

      if (error instanceof Error) {
        errorMessage = error.message;
        console.error("Sync failed:", errorMessage);

        if (errorMessage.includes("Network error") || errorMessage.includes("Cannot reach") || errorMessage.includes("fetch")) {
          setLastSyncError("Cannot connect to server. Check your internet connection.");
        } else if (errorMessage.includes("timeout")) {
          setLastSyncError("Connection timeout. Please try again.");
        } else if (errorMessage.includes("Authentication") || errorMessage.includes("JWT") || errorMessage.includes("token")) {
          setLastSyncError("Authentication expired. Please sign in again.");
        } else {
          setLastSyncError(`Sync failed: ${errorMessage}`);
        }
      } else {
        console.error("Sync failed with unknown error:", error);
        setLastSyncError("Sync failed with unknown error");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Network monitoring with throttling
  const checkNetworkStatus = async () => {
    const now = Date.now();
    if (now - lastNetworkCheck.current < 30000) {
      return;
    }
    lastNetworkCheck.current = now;

    try {
      const networkState = await Network.getNetworkStateAsync();
      const wasOnline = isOnline;
      const nowOnline = !!(
        networkState.isConnected && networkState.isInternetReachable
      );

      if (wasOnline !== nowOnline) {
        console.log(
          `Network status changed: ${nowOnline ? "online" : "offline"}`
        );
        setIsOnline(nowOnline);

        if (!wasOnline && nowOnline && lastSyncError?.includes("offline")) {
          setLastSyncError(null);
        }

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

  // App initialization effect
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

        await checkNetworkStatus();
        console.log(`Network status: ${isOnline ? "online" : "offline"}`);

        if (isOnline) {
          console.log("Testing Supabase connection before sync...");
          await testConnection();

          const userId = await getUserId();
          if (userId) {
            if (!hasData) {
              console.log("=== REASON: First launch with no data ===");
              await triggerFullSync(true);
            } else {
              const lastSyncString = await AsyncStorage.getItem("lastFullSyncTimestamp");
              const lastSyncTimeVal = lastSyncString ? parseInt(lastSyncString, 10) : 0;
              const oneWeek = 7 * 24 * 60 * 60 * 1000;
              const timeSinceLastSync = Date.now() - lastSyncTimeVal;

              if (timeSinceLastSync > oneWeek) {
                console.log("=== REASON: Weekly full sync needed ===");
                await triggerFullSync(true);
              } else {
                console.log("=== REASON: Checking for pending uploads only ===");
                await triggerFullSync(false);
              }
            }
          } else {
            console.log("No authenticated user — skipping cloud sync");
          }
        } else {
          console.log("App initialized offline - no sync performed");
          setLastSyncError("App started offline. Connect to internet to sync data.");
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("App initialization failed:", errorMessage);
        setLastSyncError(`App initialization failed: ${errorMessage}`);
      } finally {
        isInitialized.current = true;
        console.log("=== APP INITIALIZATION COMPLETE ===");
      }
    };

    initializeApp();
  }, []);

  // Network monitoring effect
  useEffect(() => {
    const interval = setInterval(checkNetworkStatus, 60000);
    return () => {
      clearInterval(interval);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [isOnline]);

  // Transaction functions
  const addTransaction = async (
    txData: Omit<Transaction, "isSynced" | "id" | "uuid">
  ): Promise<void> => {
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

  const addInvestment = async (
    invData: Omit<Investment, "isSynced" | "uuid">
  ): Promise<void> => {
    try {
      await db.addInvestment(invData);
      await refreshLocalData();
      console.log("Investment added locally");
    } catch (error) {
      console.error("Failed to add investment:", error);
      throw error;
    }
  };

  const updateInvestment = async (
    uuid: string,
    invData: Omit<Investment, "isSynced" | "uuid">
  ): Promise<void> => {
    try {
      await db.updateInvestment(uuid, invData);
      await refreshLocalData();
      console.log("Investment updated locally");
    } catch (error) {
      console.error("Failed to update investment:", error);
      throw error;
    }
  };

  const deleteInvestment = async (uuid: string): Promise<void> => {
    try {
      await db.deleteInvestment(uuid);
      await refreshLocalData();
      console.log("Investment deleted locally");
    } catch (error) {
      console.error("Failed to delete investment:", error);
      throw error;
    }
  };

  const clearSyncError = () => setLastSyncError(null);

  const value: AppContextType = {
    transactions,
    budgets,
    investments,
    isSyncing,
    isOnline,
    lastSyncError,
    triggerUploadSync: () => {
      console.log("=== UPLOAD SYNC TRIGGERED FROM UI ===");
      return triggerFullSync(false);
    },
    triggerFullSync: () => {
      console.log("=== FULL SYNC TRIGGERED FROM UI ===");
      return triggerFullSync(true);
    },
    addTransaction,
    updateTransaction,
    deleteTransaction,
    setBudget,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    clearSyncError,
    testConnection,
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
