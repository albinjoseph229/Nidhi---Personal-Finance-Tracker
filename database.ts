import axios from "axios";
import * as SQLite from "expo-sqlite";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { API_KEY, API_URL } from "./config.js";
import {
  formatDateForSheets,
  parseAndNormalizeToIST
} from "./utils/dateUtils";

const db = SQLite.openDatabaseSync("expenses.db");

export interface Transaction {
  id?: number;
  uuid: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string; // Always stored as IST ISO string
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
      type TEXT NOT NULL DEFAULT 'expense',
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
  db.execSync(
    `CREATE INDEX IF NOT EXISTS idx_transactions_uuid ON transactions(uuid);`
  );
  db.execSync(
    `CREATE INDEX IF NOT EXISTS idx_transactions_synced ON transactions(isSynced);`
  );

  try {
    const result = db.getFirstSync(
      `SELECT count(*) as count FROM pragma_table_info('transactions') WHERE name='uuid';`
    ) as { count: number };

    if (result && result.count === 0) {
      db.execSync(`ALTER TABLE transactions ADD COLUMN uuid TEXT UNIQUE;`);
      // Generate UUIDs for existing transactions
      const existingTxs = db.getAllSync(
        `SELECT id FROM transactions WHERE uuid IS NULL;`
      ) as { id: number }[];
      for (const tx of existingTxs) {
        db.runSync(`UPDATE transactions SET uuid = ? WHERE id = ?;`, [
          uuidv4(),
          tx.id,
        ]);
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
  
  // Normalize date to IST
  const normalizedDate = parseAndNormalizeToIST(txData.date);
  
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO transactions (uuid, type, amount, category, date, notes, isSynced) VALUES (?, ?, ?, ?, ?, ?, 0);`,
      newUuid,
      txData.type,
      txData.amount,
      txData.category,
      normalizedDate,
      txData.notes
    );
  });

  console.log(`Added transaction: ${newUuid}, Date: ${normalizedDate}, Type: ${txData.type}`);

  // Start background sync without waiting for it to complete
  uploadUnsyncedTransactions().catch((error) => {
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

export const updateTransaction = async (
  uuid: string,
  txData: Omit<Transaction, "isSynced" | "id" | "uuid">
): Promise<void> => {
  // Normalize date to IST
  const normalizedDate = parseAndNormalizeToIST(txData.date);
  
  // Update locally first for immediate UI feedback
  await db.runAsync(
    `UPDATE transactions SET type = ?, amount = ?, category = ?, date = ?, notes = ?, isSynced = 0 WHERE uuid = ?;`,
    txData.type,
    txData.amount,
    txData.category,
    normalizedDate,
    txData.notes,
    uuid
  );
  
  // Trigger background sync with properly formatted date for sheets
  axios.post(API_URL, {
    apiKey: API_KEY,
    action: "updateTransaction",
    data: { 
      uuid, 
      type: txData.type,
      amount: txData.amount,
      category: txData.category,
      date: formatDateForSheets(normalizedDate), // Format for Google Sheets
      notes: txData.notes
    },
  }).catch(error => console.error("Background update sync failed:", error));
};

export const deleteTransaction = async (uuid: string): Promise<void> => {
  // Delete locally first
  await db.runAsync(`DELETE FROM transactions WHERE uuid = ?;`, uuid);

  // Trigger background sync
  axios.post(API_URL, {
    apiKey: API_KEY,
    action: "deleteTransaction",
    data: { uuid },
  }).catch(error => console.error("Background delete sync failed:", error));
};

const uploadUnsyncedTransactions = async (): Promise<void> => {
  try {
    const unsyncedTxs = await getUnsyncedTransactions();
    console.log(`Found ${unsyncedTxs.length} unsynced transactions`);

    for (const tx of unsyncedTxs) {
      try {
        await axios.post(API_URL, {
          apiKey: API_KEY,
          action: "addTransaction",
          data: {
            uuid: tx.uuid,
            date: formatDateForSheets(tx.date), // Convert to sheets format (YYYY-MM-DD in IST)
            category: tx.category,
            amount: tx.amount,
            notes: tx.notes,
            type: tx.type,
          },
        });

        // Mark as synced
        await db.runAsync(
          `UPDATE transactions SET isSynced = 1 WHERE uuid = ?;`,
          tx.uuid
        );
        console.log(`Synced transaction ${tx.uuid} with date ${formatDateForSheets(tx.date)}`);
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
    budget.monthYear,
    budget.amount
  );

  // Background sync without waiting
  axios
    .post(API_URL, {
      apiKey: API_KEY,
      action: "setBudget",
      data: { MonthYear: budget.monthYear, BudgetAmount: budget.amount },
    })
    .then(() => {
      console.log(`Budget for ${budget.monthYear} synced successfully.`);
    })
    .catch((error) => {
      console.error("Background budget sync failed:", error);
    });
};

export const syncData = async (): Promise<void> => {
  console.log("Starting full sync process...");
  try {
    // 1. Upload any unsynced transactions first
    await uploadUnsyncedTransactions();

    // 2. Download fresh transactions from Google Sheets
    console.log("Downloading transactions from Google Sheets...");
    const txResponse = await axios.get(
      `${API_URL}?apiKey=${API_KEY}&action=getTransactions`,
      { timeout: 10000 }
    );

    const sheetTransactions = txResponse.data.data || [];
    console.log(
      `Downloaded ${sheetTransactions.length} transactions from sheets`
    );

    // 3. Merge with local data (avoid duplicates)
    await db.withTransactionAsync(async () => {
      for (const sheetTx of sheetTransactions) {
        // Normalize the date from sheets to IST
        const normalizedDate = parseAndNormalizeToIST(sheetTx.Date || sheetTx.date);
        
        // Check if transaction already exists
        const existing = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM transactions WHERE uuid = ?;`,
          sheetTx.uuid
        );

        // Handle type field properly
        let transactionType = 'expense'; // default
        if (sheetTx.Type) {
          transactionType = sheetTx.Type.toString().toLowerCase();
        } else if (sheetTx.type) {
          transactionType = sheetTx.type.toString().toLowerCase();
        }
        // Ensure it's either 'income' or 'expense'
        transactionType = (transactionType === 'income') ? 'income' : 'expense';

        const transactionData = {
          uuid: sheetTx.uuid,
          type: transactionType,
          amount: parseFloat(sheetTx.Amount || sheetTx.amount || 0),
          category: sheetTx.Category || sheetTx.category || 'Other',
          date: normalizedDate,
          notes: sheetTx.Notes || sheetTx.notes || ""
        };

        console.log(`Processing transaction: ${transactionData.uuid}, Date: ${transactionData.date}, Type: ${transactionData.type}`);

        if (!existing || existing.count === 0) {
          // Insert new transaction
          await db.runAsync(
            `INSERT INTO transactions (uuid, type, amount, category, date, notes, isSynced) VALUES (?, ?, ?, ?, ?, ?, 1);`,
            transactionData.uuid,
            transactionData.type,
            transactionData.amount,
            transactionData.category,
            transactionData.date,
            transactionData.notes
          );
          console.log(`Inserted new transaction: ${transactionData.uuid}`);
        } else {
          // Update existing transaction and mark as synced
          await db.runAsync(
            `UPDATE transactions SET type = ?, amount = ?, category = ?, date = ?, notes = ?, isSynced = 1 WHERE uuid = ?;`,
            transactionData.type,
            transactionData.amount,
            transactionData.category,
            transactionData.date,
            transactionData.notes,
            transactionData.uuid
          );
          console.log(`Updated existing transaction: ${transactionData.uuid}`);
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
        // Handle both possible field names
        const monthYear = budget.MonthYear || budget.monthYear;
        const amount = budget.BudgetAmount || budget.amount || budget.budgetAmount;
        
        if (monthYear && amount !== undefined) {
          await db.runAsync(
            `INSERT OR REPLACE INTO budgets (monthYear, amount) VALUES (?, ?);`,
            monthYear,
            parseFloat(amount)
          );
          console.log(`Synced budget for ${monthYear}: ${amount}`);
        }
      }
    });

    console.log("Full sync completed successfully");
  } catch (error) {
    console.error("Sync process failed:", error);
    throw error; // Re-throw to let the caller handle it
  }
};

export const getSyncStatus = async (): Promise<{
  unsyncedCount: number;
  lastSync: string | null;
}> => {
  try {
    const unsynced = await getUnsyncedTransactions();
    return {
      unsyncedCount: unsynced.length,
      lastSync: null,
    };
  } catch (error) {
    console.error("Failed to get sync status:", error);
    return { unsyncedCount: 0, lastSync: null };
  }
};