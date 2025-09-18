import { FontAwesome } from "@expo/vector-icons";
import { Link } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAppData } from "../../context/AppContext";

export default function OverviewScreen() {
  // Get global data and the new sync function from the context
  const { transactions, budgets, isSyncing, triggerFullSync } = useAppData();

  const { monthlyTotal, budgetLeft, hasTransactionsThisMonth } = useMemo(() => {
    // ... (calculation logic is correct, no changes needed here)
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const transactionsThisMonth = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
    });
    
    const total = transactionsThisMonth.reduce((sum, tx) => sum + tx.amount, 0);

    const currentMonthYear = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const budget = budgets.find(b => b.monthYear === currentMonthYear);
    const budgetAmount = budget?.amount || 0;
    
    return {
      monthlyTotal: total,
      budgetLeft: budgetAmount - total,
      hasTransactionsThisMonth: transactionsThisMonth.length > 0
    };
  }, [transactions, budgets]);

  const onRefresh = async () => {
    await triggerFullSync();
  };

  if (isSyncing && transactions.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading your data...</Text>
      </View>
    );
  }

  return (
    // THE FIX: Wrap content in a ScrollView with RefreshControl
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={isSyncing} onRefresh={onRefresh} />
      }
    >
      {hasTransactionsThisMonth ? (
        <View style={styles.content}>
          <Text style={styles.totalAmount}>₹{monthlyTotal.toFixed(2)}</Text>
          {budgetLeft > 0 && <Text style={styles.budgetLeft}>₹{budgetLeft.toFixed(2)} left</Text>}
          <Text style={styles.thisMonth}>This month</Text>
        </View>
      ) : (
        <View style={styles.noDataContainer}>
          <Image
            source={require('../../assets/images/no-data.png')}
            style={styles.noDataImage}
          />
          <Text style={styles.noDataText}>No data found</Text>
          <Text style={styles.noDataSubText}>Pull down to refresh</Text>
        </View>
      )}

      <Link href="/add-expense" asChild>
        <Pressable style={styles.fab}>
          <FontAwesome name="plus" size={24} color="white" />
        </Pressable>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#FFFFFF",
    justifyContent: 'center',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  totalAmount: {
    fontSize: 52,
    fontWeight: "bold",
    color: "#333",
  },
  budgetLeft: {
    fontSize: 18,
    color: "gray",
    marginTop: 5,
  },
  thisMonth: {
    fontSize: 16,
    color: "gray",
    marginTop: 2,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noDataImage: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  noDataText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#555",
  },
  noDataSubText: {
    fontSize: 16,
    color: "gray",
    marginTop: 5,
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
  },
});