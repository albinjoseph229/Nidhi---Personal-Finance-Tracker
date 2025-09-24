import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as SQLite from "expo-sqlite";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { formatDateForSheets, parseAndNormalizeToIST } from "./utils/dateUtils";

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_SHEETS_API_KEY;
const API_URL = process.env.EXPO_PUBLIC_GOOGLE_SHEETS_API_URL;

// Add this check to ensure the variables are loaded
if (!API_KEY || !API_URL) {
  throw new Error("API Key or URL is not defined in environment variables. Please check your .env file.");
}

const db = SQLite.openDatabaseSync("expenses.db");

// Debounced uploader with proper timeout type
let uploadTimeout: ReturnType<typeof setTimeout> | null = null;
let isUploading = false;

const queueUnsyncedUpload = () => {
  if (uploadTimeout) {
    clearTimeout(uploadTimeout);
  }
  
  uploadTimeout = setTimeout(() => {
    if (isUploading) return;
    isUploading = true;
    
    uploadUnsyncedTransactions()
      .catch(err => console.error("Background sync failed:", err))
      .finally(() => {
        isUploading = false;
      });
  }, 2000);
};

export interface Transaction {
  id?: number;
  uuid: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string; // Always stored as IST ISO string
  notes: string;
  isSynced: 0 | 1;
  isDeleted?: 0 | 1;
}

export interface Budget {
  monthYear: string;
  amount: number;
}

export const init = () => {
  console.log("Initializing database...");
  
  // Create tables with all required columns from the start
  db.execSync(
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY NOT NULL,
      uuid TEXT UNIQUE,
      type TEXT NOT NULL DEFAULT 'expense',
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      isSynced INTEGER NOT NULL DEFAULT 0,
      isDeleted INTEGER NOT NULL DEFAULT 0
    );`
  );
  
  db.execSync(
    `CREATE TABLE IF NOT EXISTS budgets (
      monthYear TEXT PRIMARY KEY NOT NULL,
      amount REAL NOT NULL
    );`
  );

  // Create indices for better performance
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_transactions_uuid ON transactions(uuid);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_transactions_synced ON transactions(isSynced);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_transactions_deleted ON transactions(isDeleted);`);
  
  // Migration for isDeleted column
  try {
    const result = db.getFirstSync(
      `SELECT count(*) as count FROM pragma_table_info('transactions') WHERE name='isDeleted';`
    ) as { count: number };
    
    if (result && result.count === 0) {
      console.log("Adding isDeleted column...");
      db.execSync(`ALTER TABLE transactions ADD COLUMN isDeleted INTEGER NOT NULL DEFAULT 0;`);
      console.log("Successfully added isDeleted column");
    }
  } catch (e) {
    console.error("Failed to migrate isDeleted column:", e);
  }

  // Migration for uuid column
  try {
    const result = db.getFirstSync(
      `SELECT count(*) as count FROM pragma_table_info('transactions') WHERE name='uuid';`
    ) as { count: number };
    
    if (result && result.count === 0) {
      console.log("Adding uuid column and generating UUIDs...");
      db.execSync(`ALTER TABLE transactions ADD COLUMN uuid TEXT UNIQUE;`);
      
      const existingTxs = db.getAllSync(
        `SELECT id FROM transactions WHERE uuid IS NULL;`
      ) as { id: number }[];
      
      for (const tx of existingTxs) {
        db.runSync(`UPDATE transactions SET uuid = ? WHERE id = ?;`, [uuidv4(), tx.id]);
      }
      console.log(`Generated UUIDs for ${existingTxs.length} existing transactions`);
    }
  } catch (e) {
    console.error("Failed to migrate uuid column:", e);
  }

  console.log("Database initialized successfully");
};

export const addTransaction = async (
  txData: Omit<Transaction, "isSynced" | "id" | "uuid">
): Promise<void> => {
  const newUuid = uuidv4();
  const normalizedDate = parseAndNormalizeToIST(txData.date);

  try {
    await db.runAsync(
      `INSERT INTO transactions (uuid, type, amount, category, date, notes, isSynced, isDeleted) VALUES (?, ?, ?, ?, ?, ?, 0, 0);`,
      [newUuid, txData.type, txData.amount, txData.category, normalizedDate, txData.notes]
    );
    console.log(`Added local transaction: ${newUuid}`);
    queueUnsyncedUpload();
  } catch (error) {
    console.error("Failed to add transaction:", error);
    throw error;
  }
};

export const getAllTransactions = async (): Promise<Transaction[]> => {
  try {
    return await db.getAllAsync<Transaction>(
      `SELECT * FROM transactions WHERE isDeleted = 0 ORDER BY date DESC;`
    );
  } catch (error) {
    console.error("Failed to get transactions:", error);
    return [];
  }
};

export const getAllBudgets = async (): Promise<Budget[]> => {
  try {
    return await db.getAllAsync<Budget>(`SELECT * FROM budgets;`);
  } catch (error) {
    console.error("Failed to get budgets:", error);
    return [];
  }
};

export const updateTransaction = async (
  uuid: string,
  txData: Omit<Transaction, "isSynced" | "id" | "uuid">
): Promise<void> => {
  const normalizedDate = parseAndNormalizeToIST(txData.date);

  try {
    await db.runAsync(
      `UPDATE transactions SET type = ?, amount = ?, category = ?, date = ?, notes = ?, isSynced = 0 WHERE uuid = ? AND isDeleted = 0;`,
      [txData.type, txData.amount, txData.category, normalizedDate, txData.notes, uuid]
    );
    console.log(`Updated local transaction: ${uuid}`);
    queueUnsyncedUpload();
  } catch (error) {
    console.error("Failed to update transaction:", error);
    throw error;
  }
};

export const deleteTransaction = async (uuid: string): Promise<void> => {
  try {
    await db.runAsync(
      `UPDATE transactions SET isDeleted = 1, isSynced = 0 WHERE uuid = ?;`,
      [uuid]
    );
    console.log(`Soft-deleted local transaction: ${uuid}`);
    queueUnsyncedUpload();
  } catch (error) {
    console.error("Failed to delete transaction:", error);
    throw error;
  }
};

export const uploadUnsyncedTransactions = async (): Promise<void> => {
  try {
    const unsyncedTxs = await db.getAllAsync<Transaction>(
      `SELECT * FROM transactions WHERE isSynced = 0;`
    );
    
    if (unsyncedTxs.length === 0) {
      console.log("No unsynced transactions to upload");
      return;
    }
    
    console.log(`Uploading ${unsyncedTxs.length} unsynced transactions...`);

    for (const tx of unsyncedTxs) {
      try {
        let action: string;
        let payloadData: any;

        if (tx.isDeleted) {
          action = "deleteTransaction";
          payloadData = { uuid: tx.uuid };
        } else {
          action = "addTransaction";
          payloadData = {
            uuid: tx.uuid,
            date: formatDateForSheets(tx.date),
            category: tx.category,
            amount: tx.amount,
            notes: tx.notes,
            type: tx.type,
          };
        }
        
        const payload = { 
          apiKey: API_KEY, 
          action, 
          data: payloadData 
        };

        console.log(`Syncing ${action} for UUID: ${tx.uuid}`);
        
        const response = await axios.post(API_URL, payload, {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (response.status !== 200) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Handle successful sync
        if (tx.isDeleted) {
          await db.runAsync(`DELETE FROM transactions WHERE uuid = ?;`, [tx.uuid]);
          console.log(`Permanently deleted transaction ${tx.uuid} after sync`);
        } else {
          await db.runAsync(`UPDATE transactions SET isSynced = 1 WHERE uuid = ?;`, [tx.uuid]);
          console.log(`Successfully synced transaction ${tx.uuid}`);
        }
        
      } catch (error) {
        console.error(`Failed to sync transaction ${tx.uuid}:`, error);
        
        if (axios.isAxiosError(error)) {
          if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED') {
            console.log("Network error - will retry later");
            break; // Stop trying other transactions if network is down
          }
        }
        // Continue with other transactions for non-network errors
      }
    }
  } catch (error) {
    console.error("Failed to upload unsynced transactions:", error);
    throw error;
  }
};

export const getBudgetForMonth = async (monthYear: string): Promise<Budget | null> => {
  try {
    const result = await db.getFirstAsync<Budget>(
      `SELECT * FROM budgets WHERE monthYear = ?;`,
      [monthYear]
    );
    return result || null;
  } catch (error) {
    console.error("Failed to get budget:", error);
    return null;
  }
};

export const setBudgetForMonth = async (budget: Budget): Promise<void> => {
  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO budgets (monthYear, amount) VALUES (?, ?);`,
      [budget.monthYear, budget.amount]
    );
    
    // Background sync budget
    axios.post(API_URL, {
      apiKey: API_KEY,
      action: "setBudget",
      data: { MonthYear: budget.monthYear, BudgetAmount: budget.amount },
    }, { timeout: 10000 })
    .then(() => console.log(`Budget for ${budget.monthYear} synced successfully`))
    .catch((error) => console.error("Background budget sync failed:", error));
    
  } catch (error) {
    console.error("Failed to set budget:", error);
    throw error;
  }
};

export const syncData = async (isFullSync: boolean): Promise<void> => {
  console.log(`Starting sync process (full: ${isFullSync})...`);
  
  try {
    // Always upload pending changes first
    await uploadUnsyncedTransactions();

    if (!isFullSync) {
      console.log("Upload-only sync completed");
      return;
    }

    console.log("Performing full data download from Google Sheets...");
    
    // Download transactions
    const txResponse = await axios.get(
      `${API_URL}?apiKey=${API_KEY}&action=getTransactions`,
      { timeout: 15000 }
    );

    if (txResponse.status !== 200) {
      throw new Error(`Failed to fetch transactions: HTTP ${txResponse.status}`);
    }

    const sheetTransactions = txResponse.data?.data || [];
    console.log(`Downloaded ${sheetTransactions.length} transactions from sheets`);

    // Process transactions in a database transaction for consistency
    await db.withTransactionAsync(async () => {
      for (const sheetTx of sheetTransactions) {
        if (!sheetTx.uuid) continue;

        const normalizedDate = parseAndNormalizeToIST(sheetTx.Date || sheetTx.date);
        const existing = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM transactions WHERE uuid = ?;`,
          [sheetTx.uuid]
        );

        let transactionType = (sheetTx.Type || sheetTx.type || "expense").toString().toLowerCase();
        transactionType = transactionType === "income" ? "income" : "expense";

        const transactionData = {
          uuid: sheetTx.uuid,
          type: transactionType,
          amount: parseFloat(sheetTx.Amount || sheetTx.amount || 0),
          category: sheetTx.Category || sheetTx.category || "Other",
          date: normalizedDate,
          notes: sheetTx.Notes || sheetTx.notes || "",
        };

        if (!existing || existing.count === 0) {
          await db.runAsync(
            `INSERT INTO transactions (uuid, type, amount, category, date, notes, isSynced, isDeleted) VALUES (?, ?, ?, ?, ?, ?, 1, 0);`,
            [transactionData.uuid, transactionData.type, transactionData.amount,
             transactionData.category, transactionData.date, transactionData.notes]
          );
        } else {
          await db.runAsync(
            `UPDATE transactions SET type = ?, amount = ?, category = ?, date = ?, notes = ?, isSynced = 1, isDeleted = 0 WHERE uuid = ?;`,
            [transactionData.type, transactionData.amount, transactionData.category,
             transactionData.date, transactionData.notes, transactionData.uuid]
          );
        }
      }
    });

    // Download budgets
    console.log("Downloading budgets from Google Sheets...");
    const budgetResponse = await axios.get(
      `${API_URL}?apiKey=${API_KEY}&action=getBudgets`,
      { timeout: 15000 }
    );

    if (budgetResponse.status !== 200) {
      throw new Error(`Failed to fetch budgets: HTTP ${budgetResponse.status}`);
    }

    const sheetBudgets = budgetResponse.data?.data || [];
    console.log(`Downloaded ${sheetBudgets.length} budgets from sheets`);

    await db.withTransactionAsync(async () => {
      for (const budget of sheetBudgets) {
        const monthYear = budget.MonthYear || budget.monthYear;
        const amount = budget.BudgetAmount || budget.amount || budget.budgetAmount;

        if (monthYear && amount !== undefined) {
          await db.runAsync(
            `INSERT OR REPLACE INTO budgets (monthYear, amount) VALUES (?, ?);`,
            [monthYear, parseFloat(amount)]
          );
        }
      }
    });

    // Update last sync timestamp
    await AsyncStorage.setItem('lastFullSyncTimestamp', Date.now().toString());
    console.log("Full sync completed successfully");

  } catch (error) {
    console.error("Sync process failed:", error);
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'NETWORK_ERROR') {
        throw new Error("Network error - please check your internet connection");
      } else if (error.code === 'ECONNABORTED') {
        throw new Error("Sync timeout - please try again");
      } else if (error.response) {
        throw new Error(`Server error: ${error.response.status} ${error.response.statusText}`);
      }
    }
    
    throw error;
  }
};

const getUnsyncedTransactions = async (): Promise<Transaction[]> => {
  try {
    return await db.getAllAsync<Transaction>(`SELECT * FROM transactions WHERE isSynced = 0;`);
  } catch (error) {
    console.error("Failed to get unsynced transactions:", error);
    return [];
  }
};

export const getSyncStatus = async (): Promise<{ unsyncedCount: number; lastSync: string | null; }> => {
  try {
    const unsynced = await getUnsyncedTransactions();
    const lastSyncString = await AsyncStorage.getItem('lastFullSyncTimestamp');
    const lastSyncDate = lastSyncString ? new Date(parseInt(lastSyncString, 10)) : null;

    return {
      unsyncedCount: unsynced.length,
      lastSync: lastSyncDate ? lastSyncDate.toLocaleString('en-IN') : 'Never',
    };
  } catch (error) {
    console.error("Failed to get sync status:", error);
    return { unsyncedCount: 0, lastSync: 'Error' };
  }
};