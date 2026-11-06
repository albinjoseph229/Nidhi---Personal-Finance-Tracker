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
  const { theme, accentColor } = useTheme();

  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const secondaryTextColor = useThemeColor({}, "tabIconDefault");
  const separatorColor = useThemeColor({}, "background");
  const backgroundColor = useThemeColor({}, "background");
  const accentTextColor = "#FFFFFF";

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
          <View>
            <ThemedText style={[styles.eyebrow, { color: secondaryTextColor }]}>
              YOUR OVERVIEW
            </ThemedText>
            <ThemedText style={styles.headerTitle}>Good to see you</ThemedText>
          </View>
          <Pressable
            accessibilityLabel="Open settings"
            accessibilityRole="button"
            onPress={() => router.push("/settings")}
            style={({ pressed }) => [
              styles.settingsButton,
              { backgroundColor: cardColor, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="settings" size={20} color={textColor} />
          </Pressable>
        </View>

        <ThemedView
          style={[
            styles.summaryCard,
            {
              backgroundColor: accentColor,
              shadowColor: textColor,
              borderColor: theme === "light" ? "#24554B" : "#A8E3D4",
            },
          ]}
        >
          <ThemedText
            style={[styles.summaryLabel, { color: accentTextColor, opacity: 0.75 }]}
          >
            Net Worth
          </ThemedText>
          <ThemedText style={[styles.netWorthAmount, { color: accentTextColor }]}>
            {formatAmount(netWorth)}
          </ThemedText>

          <View
            style={[styles.summaryDivider, { backgroundColor: accentTextColor, opacity: 0.2 }]}
          />

          <View style={styles.summaryGrid}>
            <View style={styles.summaryGridItem}>
              <ThemedText style={[styles.summaryItemSubtitle, { color: accentTextColor, opacity: 0.7 }]}>
                Cash balance
              </ThemedText>
              <ThemedText style={[styles.summaryAmount, { color: accentTextColor }]}>
                {formatAmount(totalSavings)}
              </ThemedText>
            </View>
            <View style={[styles.summaryGridDivider, { backgroundColor: accentTextColor, opacity: 0.2 }]} />
            <View style={styles.summaryGridItem}>
              <ThemedText style={[styles.summaryItemSubtitle, { color: accentTextColor, opacity: 0.7 }]}>
                Investments
              </ThemedText>
              <ThemedText style={[styles.summaryAmount, { color: accentTextColor }]}>
                {formatAmount(totalInvestmentValue)}
              </ThemedText>
            </View>
          </View>
        </ThemedView>

        <View style={styles.quickActions}>
          <ThemedText style={styles.sectionHeading}>Quick actions</ThemedText>
          <View style={styles.quickActionRow}>
            {[
              { label: "Expense", icon: "arrow-down", route: "/add-expense", color: "#FF6B6B" },
              { label: "Income", icon: "arrow-up", route: "/add-income", color: "#34C759" },
              { label: "Invest", icon: "trending-up", route: "/add-investment", color: "#4E9FE6" },
            ].map((action) => (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                accessibilityLabel={`Add ${action.label.toLowerCase()}`}
                onPress={() => router.push(action.route as "/add-expense" | "/add-income" | "/add-investment")}
                style={({ pressed }) => [
                  styles.quickAction,
                  { backgroundColor: cardColor, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: `${action.color}20` }]}>
                  <Feather name={action.icon as "arrow-down" | "arrow-up" | "trending-up"} size={18} color={action.color} />
                </View>
                <ThemedText style={styles.quickActionLabel}>{action.label}</ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <ThemedView
          style={[styles.breakdownCard, { backgroundColor: cardColor, shadowColor: textColor }]}
        >
          <View style={styles.sectionHeader}>
            <View>
              <ThemedText style={styles.sectionHeading}>All-time breakdown</ThemedText>
              <ThemedText style={[styles.sectionCaption, { color: secondaryTextColor }]}>
                Income and spending at a glance
              </ThemedText>
            </View>
            <Feather name="bar-chart-2" size={20} color={secondaryTextColor} />
          </View>
          <View style={styles.breakdownRows}>
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLabel}>
                <View style={[styles.breakdownDot, { backgroundColor: "#34C759" }]} />
                <ThemedText>Income</ThemedText>
              </View>
              <ThemedText style={[styles.breakdownValue, { color: "#34C759" }]}>
                {formatAmount(totalIncome)}
              </ThemedText>
            </View>
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLabel}>
                <View style={[styles.breakdownDot, { backgroundColor: "#FF6B6B" }]} />
                <ThemedText>Expenses</ThemedText>
              </View>
              <ThemedText style={styles.breakdownValue}>{formatAmount(totalExpenses)}</ThemedText>
            </View>
          </View>
        </ThemedView>

        {/* --- Weekly spending --- */}
        <ThemedView
          style={[styles.analyticsCard, { backgroundColor: cardColor, shadowColor: textColor }]}
        >
          <View style={styles.analyticsHeader}>
            <View>
              <ThemedText style={styles.analyticsTitle}>Weekly spending</ThemedText>
              <ThemedText style={[styles.sectionCaption, { color: secondaryTextColor }]}>
                Last 7 days
              </ThemedText>
            </View>
            <Feather name="activity" size={20} color={secondaryTextColor} />
          </View>
          <View style={styles.chartContainer}>
            {dynamicWeeklyData.map((item) => {
              const maxAmount = Math.max(
                ...dynamicWeeklyData.map((d) => d.amount),
                1
              );
              const barHeight = item.amount > 0 ? Math.max((item.amount / maxAmount) * 80, 8) : 4;
              return (
                <View key={item.date} style={styles.barWrapper}>
                  <View
                    style={[
                      styles.bar,
                      { height: barHeight, backgroundColor: item.amount > 0 ? accentColor : separatorColor },
                    ]}
                  />
                  <ThemedText style={[styles.barLabel, { color: secondaryTextColor }]}>
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
            <View>
              <ThemedText style={styles.upcomingTitle}>Recent activity</ThemedText>
              <ThemedText style={[styles.sectionCaption, { color: secondaryTextColor }]}>
                Your latest transactions
              </ThemedText>
            </View>
            <Link href="/history" asChild>
              <Pressable accessibilityRole="button">
                <ThemedText style={[styles.seeAllText, { color: accentColor }]}>See all</ThemedText>
              </Pressable>
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
                <ThemedView style={[styles.transactionIconContainer, { backgroundColor: backgroundColor }]}>
                  <Feather
                    name={getCategoryIcon(tx.category)}
                    size={18}
                    color={tx.type === "income" ? "#34C759" : textColor}
                  />
                </ThemedView>
                <View style={styles.transactionDetails}>
                  <ThemedText style={styles.transactionName}>
                    {tx.category}
                  </ThemedText>
                  <ThemedText style={[styles.transactionInfo, { color: secondaryTextColor }]}>
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
            <ThemedText style={[styles.noTransactionsText, { color: secondaryTextColor }]}>
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
    paddingTop: 26,
    paddingBottom: 100,
    paddingHorizontal: 18,
  },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 22,
    marginBottom: 18,
  },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  settingsButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryCard: {
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 28,
    marginBottom: 18,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
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
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "800",
    marginTop: 5,
    letterSpacing: -0.7,
  },
  summaryDivider: {
    height: 1,
    width: "100%",
    marginTop: 18,
    marginBottom: 4,
  },
  summaryGrid: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingTop: 10,
  },
  summaryGridItem: { flex: 1, gap: 5 },
  summaryGridDivider: { width: 1, height: 32, marginHorizontal: 16 },
  summaryItemSubtitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  quickActions: { marginBottom: 18 },
  sectionHeading: { fontSize: 17, fontWeight: "700" },
  sectionCaption: { fontSize: 12, marginTop: 4 },
  quickActionRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  quickAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 88,
    borderRadius: 18,
    paddingVertical: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  quickActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  quickActionLabel: { fontSize: 12, fontWeight: "600" },
  breakdownCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  breakdownRows: { marginTop: 16, gap: 14 },
  breakdownRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  breakdownLabel: { flexDirection: "row", alignItems: "center", gap: 9 },
  breakdownDot: { width: 8, height: 8, borderRadius: 4 },
  breakdownValue: { fontSize: 15, fontWeight: "700" },
  analyticsCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  analyticsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  analyticsTitle: { fontSize: 17, fontWeight: "700" },
  analyticsMonth: { fontSize: 16 },
  chartContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 100,
  },
  barWrapper: { alignItems: "center" },
  bar: { width: 14, borderRadius: 7 },
  barLabel: { marginTop: 8, fontSize: 12 },
  upcomingSection: {
    borderRadius: 20,
    padding: 18,
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
  upcomingTitle: { fontSize: 17, fontWeight: "700" },
  seeAllText: { fontSize: 13, fontWeight: "700" },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  transactionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 13,
  },
  transactionDetails: { flex: 1 },
  transactionName: { fontSize: 16, fontWeight: "500" },
  transactionInfo: { fontSize: 14, marginTop: 2 },
  transactionAmount: { fontSize: 16, fontWeight: "600" },
  noTransactionsText: { textAlign: "center", paddingVertical: 20 },
});