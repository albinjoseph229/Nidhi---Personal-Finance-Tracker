import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
// 👇 This is the corrected line
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { API_KEY, API_URL } from '../../config';

// Same Transaction type you already have
interface Transaction {
  Date: string;
  Category: string;
  Amount: number;
  Notes: string;
  Type: 'Expense' | 'Income';
}

// Define what our context will provide
interface DataContextType {
  transactions: Transaction[];
  loading: boolean;
  syncData: () => Promise<void>;
  addTransaction: (newTransaction: Omit<Transaction, 'Date' | 'Type'>) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const ASYNC_STORAGE_TRANSACTIONS_KEY = 'transactions-cache';

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Function to sync with Google Sheets
  const syncData = async () => {
    console.log('🔄 Starting background sync...');
    try {
      const response = await axios.get(`${API_URL}?apiKey=${API_KEY}&action=getTransactions`);
      if (response.data.status === "success") {
        const fetchedTransactions = response.data.data.reverse(); // Latest first
        setTransactions(fetchedTransactions);
        await AsyncStorage.setItem(ASYNC_STORAGE_TRANSACTIONS_KEY, JSON.stringify(fetchedTransactions));
        console.log('✅ Sync complete. Cache updated.');
      }
    } catch (error) {
      console.error("❌ Background sync failed:", error);
      // Optional: show a toast or small indicator to the user
    }
  };
  
  // Function to add a new transaction (optimistic update)
  const addTransaction = async (newTransactionData: Omit<Transaction, 'Date' | 'Type'>) => {
    const newTransaction: Transaction = {
      ...newTransactionData,
      Date: new Date().toISOString(),
      Type: "Expense",
    };

    // 1. Optimistically update local state & cache
    const updatedTransactions = [newTransaction, ...transactions];
    setTransactions(updatedTransactions);
    await AsyncStorage.setItem(ASYNC_STORAGE_TRANSACTIONS_KEY, JSON.stringify(updatedTransactions));

    // 2. Push to Google Sheets in the background
    try {
      const payload = {
        apiKey: API_KEY,
        action: "addExpense",
        data: {
          date: newTransaction.Date,
          category: newTransaction.Category,
          amount: newTransaction.Amount,
          notes: newTransaction.Notes,
          type: newTransaction.Type
        }
      };
      await axios.post(API_URL, payload);
      console.log('✅ New expense synced to Google Sheets.');
      // Optional: A full sync after adding can ensure consistency
      await syncData();
    } catch (error) {
      console.error('❌ Failed to sync new expense:', error);
      // Here you would implement a queue for failed submissions
      alert("Your expense is saved locally but failed to sync. We'll try again later.");
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. Try to load from cache first
        const cachedData = await AsyncStorage.getItem(ASYNC_STORAGE_TRANSACTIONS_KEY);
        if (cachedData) {
          setTransactions(JSON.parse(cachedData));
          console.log('💾 Data loaded from cache.');
        }
      } catch (error) {
        console.error("❌ Failed to load from cache:", error);
      } finally {
        setLoading(false);
        // 2. Then, trigger a background sync
        syncData();
      }
    };
    loadData();
  }, []);

  return (
    <DataContext.Provider value={{ transactions, loading, syncData, addTransaction }}>
      {children}
    </DataContext.Provider>
  );
};

// Custom hook to easily use the context
export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};