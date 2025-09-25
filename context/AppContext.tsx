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
import { Budget, callSheetsApi, Investment, Transaction } from "../database";


interface AppContextType {
  transactions: Transaction[];
  budgets: Budget[];
  investments: Investment[];
  isSyncing: boolean;
  isOnline: boolean;
  lastSyncError: string | null;
  triggerUploadSync: () => Promise<void>; // For uploading pending changes
  triggerFullSync: () => Promise<void>; // For full download (rare)
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
  // NEW: Backend connection test
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
  const lastSyncTime = useRef(0); // Track last sync time to prevent rapid syncs

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
    console.log("=== TESTING BACKEND CONNECTION ===");
    const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

    if (!BACKEND_URL) {
      const error =
        "BACKEND_URL is not configured. Please check your .env file.";
      console.error(error);
      setLastSyncError(error);
      return;
    }

    try {
      console.log(
        "Testing connection to:",
        `${BACKEND_URL}/api/sheets?action=getTransactions`
      );

      // Use your robust, authenticated API function instead of a basic fetch
      await callSheetsApi("GET", { queryString: "?action=getTransactions" });

      // The response is already parsed JSON and status is checked by callSheetsApi
      console.log("✅ Backend connection successful");
      setLastSyncError(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Backend connection failed:", errorMessage);

      if (
        errorMessage.includes("Network request failed") ||
        errorMessage.includes("fetch")
      ) {
        setLastSyncError(
          "Cannot reach backend server. Check internet connection and backend URL."
        );
      } else {
        setLastSyncError(`Connection test failed: ${errorMessage}`);
      }
    }
  };

  const triggerFullSync = async (isFullDownload: boolean = false) => {
    const now = Date.now();
    const SYNC_COOLDOWN = 10000; // 10 seconds cooldown between syncs

    // Prevent rapid successive syncs
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

    lastSyncTime.current = now;
    setIsSyncing(true);
    setLastSyncError(null);
    console.log(`Starting sync process (full download: ${isFullDownload})`);

    try {
      await db.syncData(isFullDownload);
      await refreshLocalData();
      await AsyncStorage.setItem("lastSyncTimestamp", new Date().toISOString());
      console.log("Sync completed successfully");
      setLastSyncError(null); // Clear any previous errors on success
    } catch (error) {
      let errorMessage = "Sync failed";

      if (error instanceof Error) {
        errorMessage = error.message;
        console.error("Sync failed:", errorMessage);

        // Provide more helpful error messages based on error type
        if (errorMessage.includes("Backend URL is not configured")) {
          setLastSyncError("App configuration error: Backend URL missing");
        } else if (
          errorMessage.includes("Network error") ||
          errorMessage.includes("Cannot reach backend")
        ) {
          setLastSyncError(
            "Cannot connect to server. Check your internet connection."
          );
        } else if (errorMessage.includes("timeout")) {
          setLastSyncError("Connection timeout. Please try again.");
        } else if (errorMessage.includes("API keys not configured")) {
          setLastSyncError(
            "Server configuration issue. Please contact support."
          );
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
    // Throttle network checks to every 30 seconds
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

        // Clear network-related errors when coming back online
        if (!wasOnline && nowOnline && lastSyncError?.includes("offline")) {
          setLastSyncError(null);
        }

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
        console.log(`Network status: ${isOnline ? "online" : "offline"}`);

        if (isOnline) {
          // MODIFIED: Test connection first before attempting sync
          console.log("Testing backend connection before sync...");
          await testConnection();

          // Only proceed with sync if no critical connection errors
          if (
            !lastSyncError ||
            (!lastSyncError.includes("Cannot reach backend") &&
              !lastSyncError.includes("Backend URL missing"))
          ) {
            if (!hasData) {
              console.log("=== REASON: First launch with no data ===");
              await triggerFullSync(true);
            } else {
              // Check if weekly sync is needed
              const lastSyncString = await AsyncStorage.getItem(
                "lastFullSyncTimestamp"
              );
              const lastSyncTime = lastSyncString
                ? parseInt(lastSyncString, 10)
                : 0;
              const oneWeek = 7 * 24 * 60 * 60 * 1000;
              const timeSinceLastSync = Date.now() - lastSyncTime;

              console.log(`=== SYNC DECISION LOGIC ===`);
              console.log(`Last sync timestamp: ${lastSyncString || "null"}`);
              console.log(
                `Last sync: ${
                  lastSyncTime === 0
                    ? "Never"
                    : new Date(lastSyncTime).toLocaleString()
                }`
              );
              console.log(
                `Time since last sync: ${Math.round(
                  timeSinceLastSync / (1000 * 60 * 60)
                )} hours`
              );
              console.log(
                `Weekly sync threshold: ${Math.round(
                  oneWeek / (1000 * 60 * 60)
                )} hours (168 hours)`
              );
              console.log(`Needs weekly sync: ${timeSinceLastSync > oneWeek}`);

              if (timeSinceLastSync > oneWeek) {
                console.log("=== REASON: Weekly full sync needed ===");
                await triggerFullSync(true);
              } else {
                console.log(
                  "=== REASON: Checking for pending uploads only ==="
                );
                await triggerFullSync(false);
              }
            }
          } else {
            console.log("Skipping sync due to connection issues");
          }
        } else {
          console.log("App initialized offline - no sync performed");
          setLastSyncError(
            "App started offline. Connect to internet to sync data."
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("App initialization failed:", errorMessage);
        setLastSyncError(`App initialization failed: ${errorMessage}`);
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

  // Transaction functions (unchanged)
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

  // Investment functions (unchanged)
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
    addInvestment,
    updateInvestment,
    deleteInvestment,
    clearSyncError,
    testConnection, // NEW: Expose test function for debugging
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
