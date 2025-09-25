import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { formatDateForSheets, parseAndNormalizeToIST } from "./utils/dateUtils";

// --- REMOVED: Direct Google Sheets API configuration ---
// const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
// const API_URL = process.env.GOOGLE_SHEETS_API_URL;
// if (!API_KEY || !API_URL) { ... }

// --- NEW: Backend URL configuration ---
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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
    
    Promise.all([
      uploadUnsyncedTransactions(),
      uploadUnsyncedInvestments()
    ])
      .catch(err => console.error("Background sync failed:", err))
      .finally(() => {
        isUploading = false;
      });
  }, 2000);
};

// --- NEW: Secure API communication function ---
async function callSheetsApi(method: 'GET' | 'POST', params: any): Promise<any> {
  if (!BACKEND_URL) {
    console.error('BACKEND_URL is missing. Current value:', BACKEND_URL);
    throw new Error("Backend URL is not configured in .env file. Please set EXPO_PUBLIC_BACKEND_URL");
  }

  const CLIENT_API_KEY = process.env.EXPO_PUBLIC_CLIENT_API_KEY;
  console.log('CLIENT_API_KEY loaded:', CLIENT_API_KEY ? `${CLIENT_API_KEY.substring(0, 8)}...` : 'undefined');
  if (!CLIENT_API_KEY) {
    throw new Error("Client API key is not configured. Please set EXPO_PUBLIC_CLIENT_API_KEY in .env file");
  }

  const url = `${BACKEND_URL}/api/sheets${params.queryString || ''}`;
  console.log(`Calling backend API: ${method} ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLIENT_API_KEY,
      },
      ...(method === 'POST' && { body: JSON.stringify(params) }),
      signal: controller.signal, // ✅ attach AbortController
    });

    clearTimeout(timeoutId);

    console.log(`Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: `Server error: ${response.status} ${response.statusText}` };
      }

      throw new Error(errorData.error || `API call failed with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('API call successful');
    return result;

  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error("Network timeout - request took longer than 10 seconds");
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('Network error - cannot reach backend:', error.message);
      throw new Error(`Network error: Cannot reach backend at ${BACKEND_URL}. Check your internet connection and backend URL.`);
    }
    console.error('API call error:', error);
    throw error;
  }
}


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

export interface Investment {
  uuid: string;
  name: string;
  type: 'Stock' | 'Gold' | 'Silver' | 'Crypto' | 'Mutual Fund' | 'Other';
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
  currentValue: number;
  status: 'active' | 'sold';
  soldPrice?: number;
  isSynced: 0 | 1;
  isDeleted?: 0 | 1;
}

export const init = () => {
  console.log("Initializing database...");
  
  // Create transactions table
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
  
  // Create budgets table
  db.execSync(
    `CREATE TABLE IF NOT EXISTS budgets (
      monthYear TEXT PRIMARY KEY NOT NULL,
      amount REAL NOT NULL
    );`
  );

  // Create investments table
  db.execSync(
    `CREATE TABLE IF NOT EXISTS investments (
      uuid TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      purchasePrice REAL NOT NULL,
      purchaseDate TEXT NOT NULL,
      currentValue REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      soldPrice REAL,
      isSynced INTEGER NOT NULL DEFAULT 0,
      isDeleted INTEGER NOT NULL DEFAULT 0
    );`
  );

  // Create indices for better performance
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_transactions_uuid ON transactions(uuid);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_transactions_synced ON transactions(isSynced);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_transactions_deleted ON transactions(isDeleted);`);
  
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_investments_uuid ON investments(uuid);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_investments_synced ON investments(isSynced);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_investments_deleted ON investments(isDeleted);`);
  
  // Migration for isDeleted column in transactions
  try {
    const result = db.getFirstSync(
      `SELECT count(*) as count FROM pragma_table_info('transactions') WHERE name='isDeleted';`
    ) as { count: number };
    
    if (result && result.count === 0) {
      console.log("Adding isDeleted column to transactions...");
      db.execSync(`ALTER TABLE transactions ADD COLUMN isDeleted INTEGER NOT NULL DEFAULT 0;`);
      console.log("Successfully added isDeleted column to transactions");
    }
  } catch (e) {
    console.error("Failed to migrate isDeleted column for transactions:", e);
  }

  // Migration for uuid column in transactions
  try {
    const result = db.getFirstSync(
      `SELECT count(*) as count FROM pragma_table_info('transactions') WHERE name='uuid';`
    ) as { count: number };
    
    if (result && result.count === 0) {
      console.log("Adding uuid column and generating UUIDs for transactions...");
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
    console.error("Failed to migrate uuid column for transactions:", e);
  }

  console.log("Database initialized successfully");
};

// --- TRANSACTION FUNCTIONS (unchanged) ---
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

// --- BUDGET FUNCTIONS ---
export const getAllBudgets = async (): Promise<Budget[]> => {
  try {
    return await db.getAllAsync<Budget>(`SELECT * FROM budgets;`);
  } catch (error) {
    console.error("Failed to get budgets:", error);
    return [];
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

// --- MODIFIED: Budget function now uses secure backend ---
export const setBudgetForMonth = async (budget: Budget): Promise<void> => {
  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO budgets (monthYear, amount) VALUES (?, ?);`,
      [budget.monthYear, budget.amount]
    );
    
    // Background sync budget via secure backend
    callSheetsApi('POST', {
      action: "setBudget",
      data: { MonthYear: budget.monthYear, BudgetAmount: budget.amount },
    })
    .then(() => console.log(`Budget for ${budget.monthYear} synced successfully`))
    .catch((error) => console.error("Background budget sync failed:", error));
    
  } catch (error) {
    console.error("Failed to set budget:", error);
    throw error;
  }
};

// --- INVESTMENT FUNCTIONS (unchanged) ---
export const addInvestment = async (invData: Omit<Investment, "isSynced" | "uuid">): Promise<void> => {
  const newUuid = uuidv4();
  const normalizedPurchaseDate = parseAndNormalizeToIST(invData.purchaseDate);

  try {
    await db.runAsync(
      `INSERT INTO investments (uuid, name, type, quantity, purchasePrice, purchaseDate, currentValue, status, soldPrice, isSynced, isDeleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0);`,
      [newUuid, invData.name, invData.type, invData.quantity, invData.purchasePrice, normalizedPurchaseDate, invData.currentValue, invData.status, invData.soldPrice || null]
    );
    console.log(`Added local investment: ${newUuid}`);
    queueUnsyncedUpload();
  } catch (error) {
    console.error("Failed to add investment:", error);
    throw error;
  }
};

export const updateInvestment = async (uuid: string, invData: Omit<Investment, "isSynced" | "uuid">): Promise<void> => {
  const normalizedPurchaseDate = parseAndNormalizeToIST(invData.purchaseDate);

  try {
    await db.runAsync(
      `UPDATE investments SET name = ?, type = ?, quantity = ?, purchasePrice = ?, purchaseDate = ?, currentValue = ?, status = ?, soldPrice = ?, isSynced = 0 WHERE uuid = ? AND isDeleted = 0;`,
      [invData.name, invData.type, invData.quantity, invData.purchasePrice, normalizedPurchaseDate, invData.currentValue, invData.status, invData.soldPrice || null, uuid]
    );
    console.log(`Updated local investment: ${uuid}`);
    queueUnsyncedUpload();
  } catch (error) {
    console.error("Failed to update investment:", error);
    throw error;
  }
};

export const deleteInvestment = async (uuid: string): Promise<void> => {
  try {
    await db.runAsync(
      `UPDATE investments SET isDeleted = 1, isSynced = 0 WHERE uuid = ?;`,
      [uuid]
    );
    console.log(`Soft-deleted local investment: ${uuid}`);
    queueUnsyncedUpload();
  } catch (error) {
    console.error("Failed to delete investment:", error);
    throw error;
  }
};

export const getAllInvestments = async (): Promise<Investment[]> => {
  try {
    return await db.getAllAsync<Investment>(
      `SELECT * FROM investments WHERE isDeleted = 0 ORDER BY purchaseDate DESC;`
    );
  } catch (error) {
    console.error("Failed to get investments:", error);
    return [];
  }
};

// --- MODIFIED: Upload functions now use secure backend ---
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

        console.log(`Syncing ${action} for UUID: ${tx.uuid}`);
        
        await callSheetsApi('POST', { action, data: payloadData });

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
        
        // Check for network errors
        if (error instanceof Error && (error.message.includes('network') || error.message.includes('timeout'))) {
          console.log("Network error - will retry later");
          break; // Stop trying other transactions if network is down
        }
        // Continue with other transactions for non-network errors
      }
    }
  } catch (error) {
    console.error("Failed to upload unsynced transactions:", error);
    throw error;
  }
};

// --- MODIFIED: Investment upload now uses secure backend ---
export const uploadUnsyncedInvestments = async (): Promise<void> => {
  try {
    const unsyncedInvs = await db.getAllAsync<Investment>(
      `SELECT * FROM investments WHERE isSynced = 0;`
    );
    
    if (unsyncedInvs.length === 0) {
      console.log("No unsynced investments to upload");
      return;
    }
    
    console.log(`Uploading ${unsyncedInvs.length} unsynced investments...`);

    for (const inv of unsyncedInvs) {
      try {
        let action: string;
        let payloadData: any;

        if (inv.isDeleted) {
          action = "deleteInvestment";
          payloadData = { uuid: inv.uuid };
        } else {
          // Check if investment already exists in Google Sheets
          const existingCheck = await callSheetsApi('GET', { queryString: '?action=getInvestments' });
          const existingInvestments = existingCheck?.data || [];
          const existsInSheets = existingInvestments.some((existing: any) => existing.uuid === inv.uuid);
          
          action = existsInSheets ? "updateInvestment" : "addInvestment";
          payloadData = {
            uuid: inv.uuid,
            name: inv.name,
            type: inv.type,
            quantity: inv.quantity,
            purchasePrice: inv.purchasePrice,
            purchaseDate: formatDateForSheets(inv.purchaseDate),
            currentValue: inv.currentValue,
            status: inv.status,
            soldPrice: inv.soldPrice || null
          };
        }

        console.log(`Syncing ${action} for investment UUID: ${inv.uuid}`);
        
        await callSheetsApi('POST', { action, data: payloadData });

        // Handle successful sync
        if (inv.isDeleted) {
          await db.runAsync(`DELETE FROM investments WHERE uuid = ?;`, [inv.uuid]);
          console.log(`Permanently deleted investment ${inv.uuid} after sync`);
        } else {
          await db.runAsync(`UPDATE investments SET isSynced = 1 WHERE uuid = ?;`, [inv.uuid]);
          console.log(`Successfully synced investment ${inv.uuid}`);
        }
        
      } catch (error) {
        console.error(`Failed to sync investment ${inv.uuid}:`, error);
        
        // Check for network errors
        if (error instanceof Error && (error.message.includes('network') || error.message.includes('timeout'))) {
          console.log("Network error - will retry later");
          break; // Stop trying other investments if network is down
        }
        // Continue with other investments for non-network errors
      }
    }
  } catch (error) {
    console.error("Failed to upload unsynced investments:", error);
    throw error;
  }
};

// --- MODIFIED: Sync function now uses secure backend ---
export const syncData = async (isFullSync: boolean): Promise<void> => {
  console.log(`Starting sync process (full: ${isFullSync})...`);
  
  try {
    // Always upload pending changes first
    await uploadUnsyncedTransactions();
    await uploadUnsyncedInvestments();

    if (!isFullSync) {
      console.log("Upload-only sync completed");
      return;
    }

    console.log("Performing full data download from Google Sheets...");
    
    // Download all data securely via backend
    const [txResponse, budgetResponse, invResponse] = await Promise.all([
      callSheetsApi('GET', { queryString: '?action=getTransactions' }),
      callSheetsApi('GET', { queryString: '?action=getBudgets' }),
      callSheetsApi('GET', { queryString: '?action=getInvestments' }),
    ]);

    // Process transactions
    const sheetTransactions = txResponse?.data || [];
    console.log(`Downloaded ${sheetTransactions.length} transactions from sheets`);

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

    // Process budgets
    const sheetBudgets = budgetResponse?.data || [];
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

    // Process investments
    const sheetInvestments = invResponse?.data || [];
    console.log(`Downloaded ${sheetInvestments.length} investments from sheets`);

    await db.withTransactionAsync(async () => {
      for (const sheetInv of sheetInvestments) {
        if (!sheetInv.uuid) continue;

        const normalizedPurchaseDate = parseAndNormalizeToIST(sheetInv.purchaseDate);
        const existing = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM investments WHERE uuid = ?;`,
          [sheetInv.uuid]
        );

        const investmentData = {
          uuid: sheetInv.uuid,
          name: sheetInv.name || "Unknown Investment",
          type: sheetInv.type || "Other",
          quantity: parseFloat(sheetInv.quantity || 0),
          purchasePrice: parseFloat(sheetInv.purchasePrice || 0),
          purchaseDate: normalizedPurchaseDate,
          currentValue: parseFloat(sheetInv.currentValue || 0),
          status: (sheetInv.status || "active").toLowerCase() === "sold" ? "sold" : "active",
          soldPrice: sheetInv.soldPrice ? parseFloat(sheetInv.soldPrice) : null,
        };

        if (!existing || existing.count === 0) {
          await db.runAsync(
            `INSERT INTO investments (uuid, name, type, quantity, purchasePrice, purchaseDate, currentValue, status, soldPrice, isSynced, isDeleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0);`,
            [investmentData.uuid, investmentData.name, investmentData.type, investmentData.quantity,
             investmentData.purchasePrice, investmentData.purchaseDate, investmentData.currentValue,
             investmentData.status, investmentData.soldPrice]
          );
        } else {
          await db.runAsync(
            `UPDATE investments SET name = ?, type = ?, quantity = ?, purchasePrice = ?, purchaseDate = ?, currentValue = ?, status = ?, soldPrice = ?, isSynced = 1, isDeleted = 0 WHERE uuid = ?;`,
            [investmentData.name, investmentData.type, investmentData.quantity, investmentData.purchasePrice,
             investmentData.purchaseDate, investmentData.currentValue, investmentData.status,
             investmentData.soldPrice, investmentData.uuid]
          );
        }
      }
    });

    // Update last sync timestamp
    await AsyncStorage.setItem('lastFullSyncTimestamp', Date.now().toString());
    console.log("Full sync completed successfully");

  } catch (error) {
    console.error("Sync process failed:", error);
    
    if (error instanceof Error) {
      if (error.message.includes('network') || error.message.includes('Network')) {
        throw new Error("Network error - please check your internet connection");
      } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        throw new Error("Sync timeout - please try again");
      } else if (error.message.includes('Backend URL is not configured')) {
        throw new Error("Backend configuration error - please contact support");
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

const getUnsyncedInvestments = async (): Promise<Investment[]> => {
  try {
    return await db.getAllAsync<Investment>(`SELECT * FROM investments WHERE isSynced = 0;`);
  } catch (error) {
    console.error("Failed to get unsynced investments:", error);
    return [];
  }
};

export const getSyncStatus = async (): Promise<{ 
  unsyncedTransactionsCount: number; 
  unsyncedInvestmentsCount: number; 
  lastSync: string | null; 
}> => {
  try {
    const unsyncedTxs = await getUnsyncedTransactions();
    const unsyncedInvs = await getUnsyncedInvestments();
    const lastSyncString = await AsyncStorage.getItem('lastFullSyncTimestamp');
    const lastSyncDate = lastSyncString ? new Date(parseInt(lastSyncString, 10)) : null;

    return {
      unsyncedTransactionsCount: unsyncedTxs.length,
      unsyncedInvestmentsCount: unsyncedInvs.length,
      lastSync: lastSyncDate ? lastSyncDate.toLocaleString('en-IN') : 'Never',
    };
  } catch (error) {
    console.error("Failed to get sync status:", error);
    return { 
      unsyncedTransactionsCount: 0, 
      unsyncedInvestmentsCount: 0, 
      lastSync: 'Error' 
    };
  }
};