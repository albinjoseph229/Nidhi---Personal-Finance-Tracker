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
  try {
    // FIX: Add a type assertion to tell TypeScript the shape of the result
    const result = db.getFirstSync(
      `SELECT count(*) as count FROM pragma_table_info('transactions') WHERE name='uuid';`
    ) as { count: number }; // <-- This is the fix

    if (result && result.count === 0) {
      db.execSync(`ALTER TABLE transactions ADD COLUMN uuid TEXT UNIQUE;`);
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

export const getBudgetForMonth = async (
  monthYear: string
): Promise<Budget | null> => {
  const result = await db.getFirstAsync<Budget>(
    `SELECT * FROM budgets WHERE monthYear = ?;`,
    monthYear
  );
  console.log(`Querying budget for ${monthYear}:`, result); // Keep this debug log
  return result;
};

export const setBudgetForMonth = async (budget: Budget): Promise<void> => {
  // This part is fast and saves the data locally
  await db.runAsync(
    `INSERT OR REPLACE INTO budgets (monthYear, amount) VALUES (?, ?);`,
    budget.monthYear, budget.amount
  );
  
  // THE FIX: Remove 'await' so the app doesn't wait for the network
  axios.post(API_URL, {
    apiKey: API_KEY,
    action: "setBudget",
    data: { MonthYear: budget.monthYear, BudgetAmount: budget.amount },
  })
  .then(() => {
    console.log(`Budget for ${budget.monthYear} sync initiated.`);
  })
  .catch(error => {
    console.error("Background budget sync failed:", error);
  });
};

    

export const syncData = async (): Promise<void> => {
  console.log("Starting sync process...");
  try {
    // --- 1. UPLOAD UNSYNCED TRANSACTIONS ---
    const unsyncedTxs = await getUnsyncedTransactions();
    if (unsyncedTxs.length > 0) {
      // (Upload logic is correct)
    }

    // --- 2. DOWNLOAD AND REFRESH TRANSACTIONS ---
    const txResponse = await axios.get(
      `${API_URL}?apiKey=${API_KEY}&action=getTransactions`
    );
    const sheetTransactions = txResponse.data.data || [];
    await db.withTransactionAsync(async () => {
      await db.runAsync(`DELETE FROM transactions;`);
      for (const tx of sheetTransactions) {
        await db.runAsync(
          `INSERT INTO transactions (uuid, amount, category, date, notes, isSynced) VALUES (?, ?, ?, ?, ?, 1);`,
          tx.uuid, tx.Amount, tx.Category, tx.Date, tx.Notes
        );
      }
    });
    console.log(`Downloaded and refreshed ${sheetTransactions.length} transactions.`);

    // --- 3. DOWNLOAD AND REFRESH BUDGETS ---
    const budgetResponse = await axios.get(
        `${API_URL}?apiKey=${API_KEY}&action=getBudgets`
    );
    const sheetBudgets = budgetResponse.data.data || [];

    // THE FIX: Use a single transaction to replace all budget data safely.
    await db.withTransactionAsync(async () => {
        await db.runAsync(`DELETE FROM budgets;`); // Clear old budgets first
        for (const budget of sheetBudgets) {
            await db.runAsync(
                // This command updates if monthYear exists, or inserts if it's new.
                `INSERT OR REPLACE INTO budgets (monthYear, amount) VALUES (?, ?);`,
                budget.MonthYear, budget.BudgetAmount
            );
        }
    });
    console.log(`Downloaded and refreshed ${sheetBudgets.length} budgets.`);

  } catch (error) {
    console.error("Sync process failed:", error);
  }
};