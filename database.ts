// database.ts
// Offline-first database layer with Supabase cloud sync
// Local operations use expo-sqlite, sync uses Supabase client

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "./lib/supabase";
import { parseAndNormalizeToIST } from "./utils/dateUtils";

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

    // Get user ID from Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) {
        console.log("No authenticated session, skipping background sync");
        isUploading = false;
        return;
      }

      const userId = session.user.id;
      Promise.all([
        uploadUnsyncedTransactions(userId),
        uploadUnsyncedInvestments(userId),
      ])
        .catch((err) => console.error("Background sync failed:", err))
        .finally(() => {
          isUploading = false;
        });
    });
  }, 2000);
};

// --- INTERFACES ---

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

// --- DATABASE INITIALIZATION ---

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

// --- LOCAL TRANSACTION FUNCTIONS ---

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

// --- LOCAL BUDGET FUNCTIONS ---

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

export const setBudgetForMonth = async (budget: Budget): Promise<void> => {
  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO budgets (monthYear, amount) VALUES (?, ?);`,
      [budget.monthYear, budget.amount]
    );

    // Background sync budget to Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) return;

      supabase
        .from('budgets')
        .upsert(
          {
            user_id: session.user.id,
            month_year: budget.monthYear,
            amount: budget.amount,
          },
          { onConflict: 'user_id,month_year' }
        )
        .then(({ error }) => {
          if (error) {
            console.error("Background budget sync failed:", error.message);
          } else {
            console.log(`Budget for ${budget.monthYear} synced successfully`);
          }
        });
    });
  } catch (error) {
    console.error("Failed to set budget:", error);
    throw error;
  }
};

// --- LOCAL INVESTMENT FUNCTIONS ---

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

// --- SUPABASE SYNC FUNCTIONS ---

export const uploadUnsyncedTransactions = async (userId: string): Promise<void> => {
  try {
    const unsyncedTxs = await db.getAllAsync<Transaction>(
      `SELECT * FROM transactions WHERE isSynced = 0;`
    );

    if (unsyncedTxs.length === 0) {
      console.log("No unsynced transactions to upload");
      return;
    }

    console.log(`Uploading ${unsyncedTxs.length} unsynced transactions to Supabase...`);

    for (const tx of unsyncedTxs) {
      try {
        if (tx.isDeleted) {
          // Delete from Supabase
          const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', tx.uuid);

          if (error) {
            console.error(`Failed to delete transaction ${tx.uuid} from Supabase:`, error.message);
            continue;
          }

          // Permanently remove locally after successful cloud delete
          await db.runAsync(`DELETE FROM transactions WHERE uuid = ?;`, [tx.uuid]);
          console.log(`Permanently deleted transaction ${tx.uuid} after sync`);
        } else {
          // Upsert to Supabase
          const { error } = await supabase
            .from('transactions')
            .upsert(
              {
                id: tx.uuid,
                user_id: userId,
                type: tx.type,
                amount: tx.amount,
                category: tx.category,
                date: tx.date,
                notes: tx.notes || '',
              },
              { onConflict: 'id' }
            );

          if (error) {
            console.error(`Failed to upsert transaction ${tx.uuid}:`, error.message);
            continue;
          }

          // Mark as synced locally
          await db.runAsync(`UPDATE transactions SET isSynced = 1 WHERE uuid = ?;`, [tx.uuid]);
          console.log(`Successfully synced transaction ${tx.uuid}`);
        }
      } catch (error) {
        console.error(`Failed to sync transaction ${tx.uuid}:`, error);

        // Check for network errors
        if (error instanceof Error && (error.message.includes('network') || error.message.includes('timeout') || error.message.includes('fetch'))) {
          console.log("Network error - will retry later");
          break;
        }
      }
    }
  } catch (error) {
    console.error("Failed to upload unsynced transactions:", error);
    throw error;
  }
};

export const uploadUnsyncedInvestments = async (userId: string): Promise<void> => {
  try {
    const unsyncedInvs = await db.getAllAsync<Investment>(
      `SELECT * FROM investments WHERE isSynced = 0;`
    );

    if (unsyncedInvs.length === 0) {
      console.log("No unsynced investments to upload");
      return;
    }

    console.log(`Uploading ${unsyncedInvs.length} unsynced investments to Supabase...`);

    for (const inv of unsyncedInvs) {
      try {
        if (inv.isDeleted) {
          // Delete from Supabase
          const { error } = await supabase
            .from('investments')
            .delete()
            .eq('id', inv.uuid);

          if (error) {
            console.error(`Failed to delete investment ${inv.uuid} from Supabase:`, error.message);
            continue;
          }

          await db.runAsync(`DELETE FROM investments WHERE uuid = ?;`, [inv.uuid]);
          console.log(`Permanently deleted investment ${inv.uuid} after sync`);
        } else {
          // Upsert to Supabase
          const { error } = await supabase
            .from('investments')
            .upsert(
              {
                id: inv.uuid,
                user_id: userId,
                name: inv.name,
                type: inv.type,
                quantity: inv.quantity,
                purchase_price: inv.purchasePrice,
                purchase_date: inv.purchaseDate,
                current_value: inv.currentValue,
                status: inv.status,
                sold_price: inv.soldPrice || null,
              },
              { onConflict: 'id' }
            );

          if (error) {
            console.error(`Failed to upsert investment ${inv.uuid}:`, error.message);
            continue;
          }

          await db.runAsync(`UPDATE investments SET isSynced = 1 WHERE uuid = ?;`, [inv.uuid]);
          console.log(`Successfully synced investment ${inv.uuid}`);
        }
      } catch (error) {
        console.error(`Failed to sync investment ${inv.uuid}:`, error);

        if (error instanceof Error && (error.message.includes('network') || error.message.includes('timeout') || error.message.includes('fetch'))) {
          console.log("Network error - will retry later");
          break;
        }
      }
    }
  } catch (error) {
    console.error("Failed to upload unsynced investments:", error);
    throw error;
  }
};

// --- FULL SYNC (Upload + Download) ---

export const syncData = async (isFullSync: boolean, userId: string): Promise<void> => {
  console.log(`Starting sync process (full: ${isFullSync})...`);

  try {
    // Always upload pending changes first
    await uploadUnsyncedTransactions(userId);
    await uploadUnsyncedInvestments(userId);

    if (!isFullSync) {
      console.log("Upload-only sync completed");
      return;
    }

    console.log("Performing full data download from Supabase...");

    // Download all data from Supabase
    const [txResponse, budgetResponse, invResponse] = await Promise.all([
      supabase.from('transactions').select('*'),
      supabase.from('budgets').select('*'),
      supabase.from('investments').select('*'),
    ]);

    if (txResponse.error) throw new Error(`Failed to fetch transactions: ${txResponse.error.message}`);
    if (budgetResponse.error) throw new Error(`Failed to fetch budgets: ${budgetResponse.error.message}`);
    if (invResponse.error) throw new Error(`Failed to fetch investments: ${invResponse.error.message}`);

    // Process transactions
    const cloudTransactions = txResponse.data || [];
    console.log(`Downloaded ${cloudTransactions.length} transactions from Supabase`);

    await db.withTransactionAsync(async () => {
      for (const cloudTx of cloudTransactions) {
        if (!cloudTx.id) continue;

        const normalizedDate = parseAndNormalizeToIST(cloudTx.date);
        const existing = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM transactions WHERE uuid = ?;`,
          [cloudTx.id]
        );

        let transactionType = (cloudTx.type || "expense").toString().toLowerCase();
        transactionType = transactionType === "income" ? "income" : "expense";

        if (!existing || existing.count === 0) {
          await db.runAsync(
            `INSERT INTO transactions (uuid, type, amount, category, date, notes, isSynced, isDeleted) VALUES (?, ?, ?, ?, ?, ?, 1, 0);`,
            [cloudTx.id, transactionType, parseFloat(cloudTx.amount || 0),
             cloudTx.category || "Other", normalizedDate, cloudTx.notes || ""]
          );
        } else {
          await db.runAsync(
            `UPDATE transactions SET type = ?, amount = ?, category = ?, date = ?, notes = ?, isSynced = 1, isDeleted = 0 WHERE uuid = ?;`,
            [transactionType, parseFloat(cloudTx.amount || 0), cloudTx.category || "Other",
             normalizedDate, cloudTx.notes || "", cloudTx.id]
          );
        }
      }
    });

    // Process budgets
    const cloudBudgets = budgetResponse.data || [];
    console.log(`Downloaded ${cloudBudgets.length} budgets from Supabase`);

    await db.withTransactionAsync(async () => {
      for (const budget of cloudBudgets) {
        const monthYear = budget.month_year;
        const amount = budget.amount;

        if (monthYear && amount !== undefined) {
          await db.runAsync(
            `INSERT OR REPLACE INTO budgets (monthYear, amount) VALUES (?, ?);`,
            [monthYear, parseFloat(amount)]
          );
        }
      }
    });

    // Process investments
    const cloudInvestments = invResponse.data || [];
    console.log(`Downloaded ${cloudInvestments.length} investments from Supabase`);

    await db.withTransactionAsync(async () => {
      for (const cloudInv of cloudInvestments) {
        if (!cloudInv.id) continue;

        const normalizedPurchaseDate = parseAndNormalizeToIST(cloudInv.purchase_date);
        const existing = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM investments WHERE uuid = ?;`,
          [cloudInv.id]
        );

        if (!existing || existing.count === 0) {
          await db.runAsync(
            `INSERT INTO investments (uuid, name, type, quantity, purchasePrice, purchaseDate, currentValue, status, soldPrice, isSynced, isDeleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0);`,
            [cloudInv.id, cloudInv.name || "Unknown Investment", cloudInv.type || "Other",
             parseFloat(cloudInv.quantity || 0), parseFloat(cloudInv.purchase_price || 0),
             normalizedPurchaseDate, parseFloat(cloudInv.current_value || 0),
             (cloudInv.status || "active").toLowerCase() === "sold" ? "sold" : "active",
             cloudInv.sold_price ? parseFloat(cloudInv.sold_price) : null]
          );
        } else {
          await db.runAsync(
            `UPDATE investments SET name = ?, type = ?, quantity = ?, purchasePrice = ?, purchaseDate = ?, currentValue = ?, status = ?, soldPrice = ?, isSynced = 1, isDeleted = 0 WHERE uuid = ?;`,
            [cloudInv.name || "Unknown Investment", cloudInv.type || "Other",
             parseFloat(cloudInv.quantity || 0), parseFloat(cloudInv.purchase_price || 0),
             normalizedPurchaseDate, parseFloat(cloudInv.current_value || 0),
             (cloudInv.status || "active").toLowerCase() === "sold" ? "sold" : "active",
             cloudInv.sold_price ? parseFloat(cloudInv.sold_price) : null,
             cloudInv.id]
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
      if (error.message.includes('network') || error.message.includes('Network') || error.message.includes('fetch')) {
        throw new Error("Network error - please check your internet connection");
      } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        throw new Error("Sync timeout - please try again");
      } else if (error.message.includes('JWT') || error.message.includes('token')) {
        throw new Error("Authentication expired - please sign in again");
      }
    }

    throw error;
  }
};

// --- SYNC STATUS ---

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