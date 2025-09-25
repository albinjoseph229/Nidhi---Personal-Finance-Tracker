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
  View,
} from "react-native";

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
  const { transactions, investments, isSyncing, triggerUploadSync } =
    useAppData();
  const { theme } = useTheme();

  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const secondaryTextColor = useThemeColor({}, "tabIconDefault");
  const separatorColor = useThemeColor({}, "background");

  // --- ✅ START: UPDATED CALCULATION LOGIC ---
  const {
    totalSavings,
    totalIncome,
    totalExpenses,
    recentTransactions,
    dynamicWeeklyData,
    totalInvestmentValue,
    netWorth,
  } = useMemo(() => {
    // --- New: Calculate totals across ALL transactions ---
    const allTimeIncome = transactions
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + tx.amount, 0);

    const allTimeExpenses = transactions
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + tx.amount, 0);

    const cumulativeSavings = allTimeIncome - allTimeExpenses;

    const investmentValue = investments
      .filter((inv) => inv.status === "active")
      .reduce((sum, inv) => sum + inv.currentValue * inv.quantity, 0);

    // --- New: Correct Net Worth calculation ---
    const correctNetWorth = cumulativeSavings + investmentValue;

    const parseTransactionDate = (dateStr: string): Date => {
      let date: Date;
      if (dateStr.includes("T")) {
        date = new Date(dateStr);
      } else if (dateStr.includes("-")) {
        date = new Date(dateStr + "T00:00:00.000Z");
      } else {
        date = new Date(dateStr);
      }
      if (isNaN(date.getTime())) {
        date = new Date();
      }
      return date;
    };
    
    // --- Other calculations (Recent, Weekly) remain the same ---
    const recent = [...transactions]
      .sort(
        (a, b) =>
          parseTransactionDate(b.date).getTime() -
          parseTransactionDate(a.date).getTime()
      )
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
      const txDate = parseTransactionDate(tx.date);
      return tx.type === "expense" && txDate >= sevenDaysAgo;
    });

    const dailyTotals: { [key: string]: number } = {};
    weeklyTransactions.forEach((tx) => {
      const txDate = parseTransactionDate(tx.date);
      const dateKey = txDate.toISOString().split("T")[0];
      dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + tx.amount;
    });

    weekData.forEach((dayData) => {
      if (dailyTotals[dayData.date]) {
        dayData.amount = dailyTotals[dayData.date];
      }
    });

    // --- Return new and existing values ---
    return {
      totalSavings: cumulativeSavings,
      totalIncome: allTimeIncome,
      totalExpenses: allTimeExpenses,
      recentTransactions: recent,
      dynamicWeeklyData: weekData,
      totalInvestmentValue: investmentValue,
      netWorth: correctNetWorth,
    };
  }, [transactions, investments]);
  // --- ✅ END: UPDATED CALCULATION LOGIC ---

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
          <Pressable onPress={() => router.push("/settings")}>
            <Feather name="settings" size={24} color={secondaryTextColor} />
          </Pressable>
        </View>

        {/* --- ✅ START: UPDATED SUMMARY CARD UI --- */}
        <ThemedView
          style={[
            styles.summaryCard,
            { backgroundColor: cardColor, shadowColor: textColor },
          ]}
        >
          <ThemedText
            style={[styles.summaryLabel, { color: secondaryTextColor }]}
          >
            Net Worth
          </ThemedText>
          <ThemedText style={styles.netWorthAmount}>
            {formatAmount(netWorth)}
          </ThemedText>

          <View
            style={[styles.summaryDivider, { backgroundColor: separatorColor }]}
          />

          {/* Total Savings Item (Replaces monthly savings) */}
          <View style={styles.summaryListItem}>
            <View style={styles.summaryItemLeft}>
              <View style={styles.summaryIconContainer}>
                <Feather name="shield" size={20} color="#34C759" />
              </View>
              <View>
                <ThemedText style={styles.summaryItemTitle}>Total Savings</ThemedText>
                <ThemedText
                  style={[
                    styles.summaryItemSubtitle,
                    { color: secondaryTextColor },
                  ]}
                >
                  (Cash Balance)
                </ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.summaryAmount, { color: "#34C759" }]}>
              {formatAmount(totalSavings)}
            </ThemedText>
          </View>

          {/* NEW: Total Income Item */}
          <View style={styles.summaryListItem}>
            <View style={styles.summaryItemLeft}>
              <View style={styles.summaryIconContainer}>
                <Feather name="arrow-up-circle" size={20} color={textColor} />
              </View>
              <View>
                <ThemedText style={styles.summaryItemTitle}>
                  Total Income
                </ThemedText>
                <ThemedText
                  style={[
                    styles.summaryItemSubtitle,
                    { color: secondaryTextColor },
                  ]}
                >
                  (All-Time)
                </ThemedText>
              </View>
            </View>
            <ThemedText style={styles.summaryAmount}>
              {formatAmount(totalIncome)}
            </ThemedText>
          </View>
          
          {/* Total Expenses Item (Replaces monthly expenses) */}
          <View style={styles.summaryListItem}>
            <View style={styles.summaryItemLeft}>
              <View style={styles.summaryIconContainer}>
                <Feather name="arrow-down-circle" size={20} color={textColor} />
              </View>
              <View>
                <ThemedText style={styles.summaryItemTitle}>
                  Total Expenses
                </ThemedText>
                <ThemedText
                  style={[
                    styles.summaryItemSubtitle,
                    { color: secondaryTextColor },
                  ]}
                >
                  (All-Time)
                </ThemedText>
              </View>
            </View>
            <ThemedText style={styles.summaryAmount}>
              {formatAmount(totalExpenses)}
            </ThemedText>
          </View>

          {/* Investments Item (No change) */}
          <View style={styles.summaryListItem}>
            <View style={styles.summaryItemLeft}>
              <View style={styles.summaryIconContainer}>
                <Feather name="trending-up" size={20} color="#007AFF" />
              </View>
              <View>
                <ThemedText style={styles.summaryItemTitle}>
                  Investments
                </ThemedText>
                <ThemedText
                  style={[
                    styles.summaryItemSubtitle,
                    { color: secondaryTextColor },
                  ]}
                >
                  (Active Value)
                </ThemedText>
              </View>
            </View>
            <ThemedText style={styles.summaryAmount}>
              {formatAmount(totalInvestmentValue)}
            </ThemedText>
          </View>
        </ThemedView>
        {/* --- ✅ END: UPDATED SUMMARY CARD UI --- */}

        {/* --- MODIFIED: Analytics Card header is now a static label --- */}
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
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 14,
    marginBottom: 2,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: "600",
  },
  netWorthAmount: {
    fontSize: 32,
    fontWeight: "bold",
    marginTop: 4,
  },
  summaryDivider: {
    height: 1,
    width: "100%",
    marginTop: 16,
    marginBottom: 8,
  },
  summaryListItem: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingVertical: 12,
    justifyContent: "space-between",
  },
  summaryItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryItemTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  summaryItemSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  summaryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    backgroundColor: "rgba(128, 128, 128, 0.1)",
  },
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
  analyticsMonth: { fontSize: 16 },
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