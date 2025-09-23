import axios from "axios";
import * as SQLite from "expo-sqlite";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { API_KEY, API_URL } from "./config";

const db = SQLite.openDatabaseSync("expenses.db");

export interface Transaction {
  id?: number;
  uuid: string;
  amount: number;
  category: string;
  date: string;
  notes: string;
  isSynced: 0 | 1;
}

export interface Budget {
  monthYear: string;
  amount: number;
}

export const init = () => {
  db.execSync(
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY NOT NULL,
      uuid TEXT UNIQUE,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      isSynced INTEGER NOT NULL DEFAULT 0
    );`
  );
  db.execSync(
    `CREATE TABLE IF NOT EXISTS budgets (
      monthYear TEXT PRIMARY KEY NOT NULL,
      amount REAL NOT NULL
    );`
  );
  
  // Create index for better performance
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_transactions_uuid ON transactions(uuid);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_transactions_synced ON transactions(isSynced);`);
  
  try {
    const result = db.getFirstSync(
      `SELECT count(*) as count FROM pragma_table_info('transactions') WHERE name='uuid';`
    ) as { count: number };

    if (result && result.count === 0) {
      db.execSync(`ALTER TABLE transactions ADD COLUMN uuid TEXT UNIQUE;`);
      // Generate UUIDs for existing transactions
      const existingTxs = db.getAllSync(`SELECT id FROM transactions WHERE uuid IS NULL;`) as { id: number }[];
      for (const tx of existingTxs) {
        db.runSync(`UPDATE transactions SET uuid = ? WHERE id = ?;`, [uuidv4(), tx.id]);
      }
    }
  } catch (e) {
    console.error("Failed to migrate transactions table:", e);
  }
  console.log("Database initialized");
};

export const addTransaction = async (
  txData: Omit<Transaction, "isSynced" | "id" | "uuid">
): Promise<void> => {
  const newUuid = uuidv4();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO transactions (uuid, amount, category, date, notes, isSynced) VALUES (?, ?, ?, ?, ?, 0);`,
      newUuid, txData.amount, txData.category, txData.date, txData.notes
    );
  });
  
  // Start background sync without waiting
  uploadUnsyncedTransactions().catch(error => {
    console.error("Background transaction sync failed:", error);
  });
};

export const getAllTransactions = async (): Promise<Transaction[]> => {
  return await db.getAllAsync<Transaction>(
    `SELECT * FROM transactions ORDER BY date DESC;`
  );
};

export const getAllBudgets = async (): Promise<Budget[]> => {
  return await db.getAllAsync<Budget>(`SELECT * FROM budgets;`);
};

const getUnsyncedTransactions = async (): Promise<Transaction[]> => {
  return await db.getAllAsync<Transaction>(
    `SELECT * FROM transactions WHERE isSynced = 0;`
  );
};

// NEW: Function to upload unsynced transactions
const uploadUnsyncedTransactions = async (): Promise<void> => {
  try {
    const unsyncedTxs = await getUnsyncedTransactions();
    console.log(`Found ${unsyncedTxs.length} unsynced transactions`);
    
    for (const tx of unsyncedTxs) {
      try {
        await axios.post(API_URL, {
          apiKey: API_KEY,
          action: "addExpense",
          data: {
            uuid: tx.uuid,
            date: tx.date,
            category: tx.category,
            amount: tx.amount,
            notes: tx.notes,
            type: "expense" // Add default type if needed
          }
        });
        
        // Mark as synced
        await db.runAsync(
          `UPDATE transactions SET isSynced = 1 WHERE uuid = ?;`,
          tx.uuid
        );
        console.log(`Synced transaction ${tx.uuid}`);
      } catch (error) {
        console.error(`Failed to sync transaction ${tx.uuid}:`, error);
        // Continue with other transactions
      }
    }
  } catch (error) {
    console.error("Failed to upload unsynced transactions:", error);
  }
};

export const getBudgetForMonth = async (
  monthYear: string
): Promise<Budget | null> => {
  const result = await db.getFirstAsync<Budget>(
    `SELECT * FROM budgets WHERE monthYear = ?;`,
    monthYear
  );
  console.log(`Querying budget for ${monthYear}:`, result);
  return result;
};

export const setBudgetForMonth = async (budget: Budget): Promise<void> => {
  // Save locally first
  await db.runAsync(
    `INSERT OR REPLACE INTO budgets (monthYear, amount) VALUES (?, ?);`,
    budget.monthYear, budget.amount
  );
  
  // Background sync without waiting
  axios.post(API_URL, {
    apiKey: API_KEY,
    action: "setBudget",
    data: { MonthYear: budget.monthYear, BudgetAmount: budget.amount },
  })
  .then(() => {
    console.log(`Budget for ${budget.monthYear} synced successfully.`);
  })
  .catch(error => {
    console.error("Background budget sync failed:", error);
  });
};

// IMPROVED: Better sync with error handling and deduplication
export const syncData = async (): Promise<void> => {
  console.log("Starting full sync process...");
  try {
    // 1. Upload any unsynced transactions first
    await uploadUnsyncedTransactions();

    // 2. Download fresh transactions from Google Sheets
    console.log("Downloading transactions from Google Sheets...");
    const txResponse = await axios.get(
      `${API_URL}?apiKey=${API_KEY}&action=getTransactions`,
      { timeout: 10000 } // 10 second timeout
    );
    
    const sheetTransactions = txResponse.data.data || [];
    console.log(`Downloaded ${sheetTransactions.length} transactions from sheets`);
    
    // 3. Merge with local data (avoid duplicates)
    await db.withTransactionAsync(async () => {
      for (const sheetTx of sheetTransactions) {
        // Check if transaction already exists
        const existing = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM transactions WHERE uuid = ?;`,
          sheetTx.uuid
        );
        
        if (!existing || existing.count === 0) {
          // Insert new transaction
          await db.runAsync(
            `INSERT INTO transactions (uuid, amount, category, date, notes, isSynced) VALUES (?, ?, ?, ?, ?, 1);`,
            sheetTx.uuid, sheetTx.Amount, sheetTx.Category, sheetTx.Date, sheetTx.Notes || ''
          );
        } else {
          // Update existing transaction and mark as synced
          await db.runAsync(
            `UPDATE transactions SET amount = ?, category = ?, date = ?, notes = ?, isSynced = 1 WHERE uuid = ?;`,
            sheetTx.Amount, sheetTx.Category, sheetTx.Date, sheetTx.Notes || '', sheetTx.uuid
          );
        }
      }
    });

    // 4. Download and sync budgets
    console.log("Downloading budgets from Google Sheets...");
    const budgetResponse = await axios.get(
      `${API_URL}?apiKey=${API_KEY}&action=getBudgets`,
      { timeout: 10000 }
    );
    
    const sheetBudgets = budgetResponse.data.data || [];
    console.log(`Downloaded ${sheetBudgets.length} budgets from sheets`);
    
    await db.withTransactionAsync(async () => {
      for (const budget of sheetBudgets) {
        await db.runAsync(
          `INSERT OR REPLACE INTO budgets (monthYear, amount) VALUES (?, ?);`,
          budget.MonthYear, budget.BudgetAmount
        );
      }
    });

    console.log("Full sync completed successfully");
  } catch (error) {
    console.error("Sync process failed:", error);
    throw error; // Re-throw to let the caller handle it
  }
};

// NEW: Function to get sync status
export const getSyncStatus = async (): Promise<{ unsyncedCount: number; lastSync: string | null }> => {
  try {
    const unsynced = await getUnsyncedTransactions();
    // You could also store last sync time in a separate table
    return {
      unsyncedCount: unsynced.length,
      lastSync: null // Implement if you want to track last sync time
    };
  } catch (error) {
    console.error("Failed to get sync status:", error);
    return { unsyncedCount: 0, lastSync: null };
  }
};