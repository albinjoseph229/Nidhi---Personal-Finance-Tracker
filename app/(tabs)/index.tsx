// In app/(tabs)/index.tsx

import { Feather } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";

// Import your themed components and hooks
import { ThemedText } from "../../components/themed-text";
import { ThemedView } from "../../components/themed-view";
import { useAppData } from "../../context/AppContext";
import { useThemeColor } from "../../hooks/use-theme-color";

const weeklySpendData = [
  { day: 'Sun', amount: 30 }, { day: 'Mon', amount: 50 }, { day: 'Tue', amount: 90 },
  { day: 'Wed', amount: 45 }, { day: 'Thu', amount: 110 }, { day: 'Fri', amount: 75 },
  { day: 'Sat', amount: 40 },
];

export default function HomeScreen() {
  const router = useRouter(); // Initialize router
  const { transactions, budgets, isSyncing, triggerFullSync } = useAppData();
  const theme = useColorScheme() ?? 'light';

  // Fetch all necessary colors from the theme once
  const cardColor = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');
  const separatorColor = useThemeColor({}, 'background');
  
  const { monthlyTotal, budgetLeft, recentTransactions } = useMemo(() => {
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
    const recent = transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);
    return {
      monthlyTotal: total,
      budgetLeft: budgetAmount - total,
      recentTransactions: recent,
    };
  }, [transactions, budgets]);

  const onRefresh = async () => {
    await triggerFullSync();
  };
  
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount).replace('₹', '₹ ');
  };

  const getCategoryIcon = (category: string) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('food')) return 'shopping-bag';
    if (categoryLower.includes('transport')) return 'truck';
    if (categoryLower.includes('shopping')) return 'shopping-cart';
    if (categoryLower.includes('entertainment')) return 'film';
    if (categoryLower.includes('health')) return 'heart';
    if (categoryLower.includes('bill')) return 'file-text';
    return 'trending-down';
  };

  if (isSyncing && transactions.length === 0) {
    return (
      <ThemedView style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={textColor} />
        <ThemedText style={styles.loadingText}>Loading your data...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isSyncing} onRefresh={onRefresh} tintColor={textColor} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Custom Header */}
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Home</ThemedText>
          <Feather name="bell" size={24} color={textColor} />
        </View>

        {/* Main Spend Card */}
        <ThemedView style={[styles.spendCard, { backgroundColor: cardColor, shadowColor: textColor }]}>
          <ThemedText style={[styles.spendCardLabel, { color: secondaryTextColor }]}>This month spend</ThemedText>
          <ThemedText style={styles.spendCardAmount}>{formatAmount(monthlyTotal)}</ThemedText>
        </ThemedView>

        {/* Analytics Card */}
        <ThemedView lightColor="#1C1C1E" darkColor={cardColor} style={[styles.analyticsCard, { shadowColor: textColor }]}>
          <View style={styles.analyticsHeader}>
            <ThemedText lightColor="#FFFFFF" darkColor={textColor} style={styles.analyticsTitle}>Analytics</ThemedText>
            <ThemedText style={[styles.analyticsMonth, { color: secondaryTextColor }]}>This month</ThemedText>
          </View>
          
          {budgetLeft < 0 && (
            <View style={styles.overBudgetTag}>
               <ThemedText lightColor="#FFFFFF" darkColor={textColor} style={styles.overBudgetText}>{formatAmount(Math.abs(budgetLeft))} over</ThemedText>
            </View>
          )}

          <View style={styles.chartContainer}>
            {weeklySpendData.map((item, index) => {
               const maxAmount = Math.max(...weeklySpendData.map(d => d.amount), 1);
               const barHeight = (item.amount / maxAmount) * 80;
               return (
                 <View key={index} style={styles.barWrapper}>
                   <View style={[styles.bar, { height: barHeight }]} />
                   <ThemedText style={[styles.barLabel, { color: secondaryTextColor }]}>{item.day}</ThemedText>
                 </View>
               );
            })}
          </View>
        </ThemedView>

        {/* Upcoming / Recent Transactions */}
        <ThemedView style={[styles.upcomingSection, { backgroundColor: cardColor, shadowColor: textColor }]}>
          <View style={styles.upcomingHeader}>
            <ThemedText style={styles.upcomingTitle}>Recent</ThemedText>
            <Link href="/history" asChild>
              <ThemedText style={styles.seeAllText}>See All</ThemedText>
            </Link>
          </View>

          {recentTransactions.length > 0 ? (
            recentTransactions.map((tx) => (
              <View key={tx.uuid} style={[styles.transactionItem, { borderBottomColor: separatorColor }]}>
                <ThemedView style={styles.transactionIconContainer}>
                  <Feather name={getCategoryIcon(tx.category)} size={20} color={textColor} />
                </ThemedView>
                <View style={styles.transactionDetails}>
                  <ThemedText style={styles.transactionName}>{tx.category}</ThemedText>
                  <ThemedText style={[styles.transactionInfo, { color: secondaryTextColor }]}>
                    {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </ThemedText>
                </View>
                <ThemedText style={styles.transactionAmount}>
                  {formatAmount(tx.amount)}
                </ThemedText>
              </View>
            ))
          ) : (
            <ThemedText style={[styles.noTransactionsText, { color: secondaryTextColor }]}>No recent transactions.</ThemedText>
          )}
        </ThemedView>
      </ScrollView>

      {/* Floating Action Button (FAB) */}
      <Pressable 
        style={[styles.fab, { backgroundColor: theme === 'light' ? '#1C1C1E' : cardColor, shadowColor: textColor }]}
        onPress={() => router.push('/add-expense')}
      >
        <Feather name="plus" size={24} color={theme === 'light' ? 'white' : textColor} />
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 30,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  spendCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  spendCardLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  spendCardAmount: {
    fontSize: 40,
    fontWeight: 'bold',
    lineHeight: 48,
  },
  analyticsCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    position: 'relative',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  analyticsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  analyticsMonth: {
    fontSize: 14,
  },
  overBudgetTag: {
    position: 'absolute',
    top: 60,
    left: '50%',
    transform: [{ translateX: -40 }],
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  overBudgetText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 100,
  },
  barWrapper: {
    alignItems: 'center',
  },
  bar: {
    width: 12,
    backgroundColor: '#8E8E93',
    borderRadius: 6,
  },
  barLabel: {
    marginTop: 8,
    fontSize: 12,
  },
  upcomingSection: {
    borderRadius: 20,
    padding: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  upcomingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  upcomingTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  seeAllText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  transactionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionName: {
    fontSize: 16,
    fontWeight: '500',
  },
  transactionInfo: {
    fontSize: 14,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  noTransactionsText: {
    textAlign: 'center',
    paddingVertical: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
});