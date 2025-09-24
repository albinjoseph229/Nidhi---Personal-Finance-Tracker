// In app/(tabs)/index.tsx

import { Feather } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

// Import themed components and hooks
import { ThemedText } from "../../components/themed-text";
import { ThemedView } from "../../components/themed-view";
import { useAppData } from "../../context/AppContext";
import { useTheme } from "../../context/ThemeContext";
import { useThemeColor } from "../../hooks/use-theme-color";

interface WeeklyDataPoint {
  day: string;
  amount: number;
  date: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const { transactions, budgets, isSyncing, triggerUploadSync } = useAppData();
  const { theme } = useTheme();

  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const secondaryTextColor = useThemeColor({}, "tabIconDefault");
  const separatorColor = useThemeColor({}, "background");

  const {
    totalIncome,
    totalExpenses,
    savings,
    recentTransactions,
    dynamicWeeklyData,
  } = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const parseTransactionDate = (dateStr: string): Date => {
      let date: Date;
      if (dateStr.includes("T")) {
        date = new Date(dateStr);
      } else if (dateStr.includes("/")) {
        date = new Date(dateStr);
      } else if (dateStr.includes("-")) {
        date = new Date(dateStr + "T00:00:00.000Z");
      } else {
        date = new Date(dateStr);
      }
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date format: ${dateStr}, using current date`);
        date = new Date();
      }
      return date;
    };

    const transactionsThisMonth = transactions.filter((tx) => {
      try {
        const txDate = parseTransactionDate(tx.date);
        return (
          txDate.getMonth() === currentMonth &&
          txDate.getFullYear() === currentYear
        );
      } catch (error) {
        console.error(`Error parsing transaction date: ${tx.date}`, error);
        return false;
      }
    });

    const income = transactionsThisMonth
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + tx.amount, 0);

    const expenses = transactionsThisMonth
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + tx.amount, 0);

    const recent = transactions
      .sort((a, b) => {
        const dateA = parseTransactionDate(a.date);
        const dateB = parseTransactionDate(b.date);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 3);

    const weekData: WeeklyDataPoint[] = [];
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      weekData.push({
        day: days[d.getDay()],
        amount: 0,
        date: d.toISOString().split("T")[0],
      });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const weeklyTransactions = transactions.filter((tx) => {
      try {
        const txDate = parseTransactionDate(tx.date);
        return tx.type === "expense" && txDate >= sevenDaysAgo;
      } catch (error) {
        console.error(`Error parsing weekly transaction date: ${tx.date}`, error);
        return false;
      }
    });

    const dailyTotals: { [key: string]: number } = {};
    weeklyTransactions.forEach((tx) => {
      try {
        const txDate = parseTransactionDate(tx.date);
        const dateKey = txDate.toISOString().split("T")[0];
        dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + tx.amount;
      } catch (error) {
        console.error(`Error processing weekly transaction: ${tx.date}`, error);
      }
    });

    weekData.forEach((dayData) => {
      if (dailyTotals[dayData.date]) {
        dayData.amount = dailyTotals[dayData.date];
      }
    });

    return {
      totalIncome: income,
      totalExpenses: expenses,
      savings: income - expenses,
      recentTransactions: recent,
      dynamicWeeklyData: weekData,
    };
  }, [transactions]);

  const onRefresh = async () => {
    await triggerUploadSync();
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(amount)
      .replace("₹", "₹ ");
  };

  const getCategoryIcon = (category: string) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes("food")) return "shopping-bag";
    if (categoryLower.includes("transport")) return "truck";
    if (categoryLower.includes("shopping")) return "shopping-cart";
    if (categoryLower.includes("entertainment")) return "film";
    if (categoryLower.includes("health")) return "heart";
    if (categoryLower.includes("bill")) return "file-text";
    if (categoryLower.includes("salary")) return "dollar-sign";
    if (categoryLower.includes("freelance")) return "briefcase";
    if (categoryLower.includes("investment")) return "trending-up";
    if (categoryLower.includes("gift")) return "gift";
    return "trending-down";
  };

  if (isSyncing && transactions.length === 0) {
    return (
      <ThemedView style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={textColor} />
        <ThemedText>Loading your data...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <StatusBar style={theme === "light" ? "dark" : "light"} />
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isSyncing}
            onRefresh={onRefresh}
            tintColor={textColor}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Home</ThemedText>
        </View>

        {/* Financial Summary Card */}
        <ThemedView
          style={[
            styles.summaryCard,
            { backgroundColor: cardColor, shadowColor: textColor },
          ]}
        >
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <ThemedText
                style={[styles.summaryLabel, { color: secondaryTextColor }]}
              >
                Income
              </ThemedText>
              <ThemedText style={[styles.summaryAmount, { color: "#34C759" }]}>
                {formatAmount(totalIncome)}
              </ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText
                style={[styles.summaryLabel, { color: secondaryTextColor }]}
              >
                Expenses
              </ThemedText>
              <ThemedText style={[styles.summaryAmount, { color: "#FF3B30" }]}>
                {formatAmount(totalExpenses)}
              </ThemedText>
            </View>
          </View>
          <View style={[styles.savingsRow, { borderTopColor: separatorColor }]}>
            <ThemedText
              style={[styles.savingsLabel, { color: secondaryTextColor }]}
            >
              Savings This Month
            </ThemedText>
            <ThemedText style={styles.savingsAmount}>
              {formatAmount(savings)}
            </ThemedText>
          </View>
        </ThemedView>

        {/* Analytics Card */}
        <ThemedView
          lightColor="#1C1C1E"
          darkColor={cardColor}
          style={[styles.analyticsCard, { shadowColor: textColor }]}
        >
          <View style={styles.analyticsHeader}>
            <ThemedText
              lightColor="#FFFFFF"
              darkColor={textColor}
              style={styles.analyticsTitle}
            >
              Weekly Spend
            </ThemedText>
            <ThemedText
              style={[styles.analyticsMonth, { color: secondaryTextColor }]}
            >
              This month
            </ThemedText>
          </View>
          <View style={styles.chartContainer}>
            {dynamicWeeklyData.map((item) => {
              const maxAmount = Math.max(
                ...dynamicWeeklyData.map((d) => d.amount),
                1
              );
              const barHeight = (item.amount / maxAmount) * 80;
              return (
                <View key={item.date} style={styles.barWrapper}>
                  <View style={[styles.bar, { height: barHeight }]} />
                  <ThemedText
                    style={[styles.barLabel, { color: secondaryTextColor }]}
                  >
                    {item.day}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </ThemedView>

        {/* Recent Transactions */}
        <ThemedView
          style={[
            styles.upcomingSection,
            { backgroundColor: cardColor, shadowColor: textColor },
          ]}
        >
          <View style={styles.upcomingHeader}>
            <ThemedText style={styles.upcomingTitle}>Recent</ThemedText>
            <Link href="/history" asChild>
              <ThemedText style={styles.seeAllText}>See All</ThemedText>
            </Link>
          </View>
          {recentTransactions.length > 0 ? (
            recentTransactions.map((tx) => (
              <View
                key={tx.uuid}
                style={[
                  styles.transactionItem,
                  { borderBottomColor: separatorColor },
                ]}
              >
                <ThemedView style={styles.transactionIconContainer}>
                  <Feather
                    name={getCategoryIcon(tx.category)}
                    size={20}
                    color={tx.type === "income" ? "#34C759" : textColor}
                  />
                </ThemedView>
                <View style={styles.transactionDetails}>
                  <ThemedText style={styles.transactionName}>
                    {tx.category}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.transactionInfo,
                      { color: secondaryTextColor },
                    ]}
                  >
                    {new Date(tx.date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </ThemedText>
                </View>
                <ThemedText
                  style={[
                    styles.transactionAmount,
                    { color: tx.type === "income" ? "#34C759" : textColor },
                  ]}
                >
                  {formatAmount(tx.amount)}
                </ThemedText>
              </View>
            ))
          ) : (
            <ThemedText
              style={[styles.noTransactionsText, { color: secondaryTextColor }]}
            >
              No recent transactions.
            </ThemedText>
          )}
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: {
    paddingTop: 20,
    paddingBottom: 100,
    paddingHorizontal: 20,
  },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 30,
    marginBottom: 20,
  },
  headerTitle: { fontSize: 28, fontWeight: "bold" },
  summaryCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryLabel: { fontSize: 14, marginBottom: 4 },
  summaryAmount: { fontSize: 22, fontWeight: "600" },
  savingsRow: { borderTopWidth: 1, paddingTop: 16, alignItems: "center" },
  savingsLabel: { fontSize: 16, fontWeight: "500" },
  savingsAmount: { fontSize: 28, fontWeight: "bold", marginTop: 4 },
  analyticsCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  analyticsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  analyticsTitle: { fontSize: 18, fontWeight: "600" },
  analyticsMonth: { fontSize: 14 },
  chartContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 100,
  },
  barWrapper: { alignItems: "center" },
  bar: { width: 12, backgroundColor: "#8E8E93", borderRadius: 6 },
  barLabel: { marginTop: 8, fontSize: 12 },
  upcomingSection: {
    borderRadius: 20,
    padding: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  upcomingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  upcomingTitle: { fontSize: 18, fontWeight: "600" },
  seeAllText: { fontSize: 14, color: "#007AFF", fontWeight: "500" },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  transactionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  transactionDetails: { flex: 1 },
  transactionName: { fontSize: 16, fontWeight: "500" },
  transactionInfo: { fontSize: 14, marginTop: 2 },
  transactionAmount: { fontSize: 16, fontWeight: "600" },
  noTransactionsText: { textAlign: "center", paddingVertical: 20 },
});