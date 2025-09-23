// In app/(tabs)/reports.tsx

import { Feather } from "@expo/vector-icons";
import { Link } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { BarChart, LineChart, PieChart } from "react-native-chart-kit";

// Import themed components and hooks
import { ThemedText } from "../../components/themed-text";
import { ThemedView } from "../../components/themed-view";
import { useAppData } from "../../context/AppContext";
import { useTheme } from "../../context/ThemeContext";
import { useThemeColor } from "../../hooks/use-theme-color";

// Data interfaces and constants
interface ChartData {
  name: string;
  amount: number;
  color: string;
}
interface MonthlyData {
  income: number[];
  expenses: number[];
  labels: string[];
}
const screenWidth = Dimensions.get("window").width;

const CATEGORY_GROUPS: { [key: string]: string[] } = {
  "Food & Dining": ["Food", "Restaurant", "Groceries", "Dining"],
  Transportation: ["Transport", "Fuel", "Car", "Taxi", "Bus", "Auto"],
  Shopping: ["Shopping", "Clothing", "Electronics", "Online Shopping"],
  "Bills & Utilities": ["Bills", "Electricity", "Water", "Internet", "Phone"],
  "Health & Medical": ["Health", "Medical", "Pharmacy", "Doctor", "Hospital"],
  Entertainment: ["Leisure", "Entertainment", "Movies", "Games", "Sports"],
  "Home & Garden": ["Home", "Furniture", "Garden", "Maintenance"],
  Education: ["Education", "Books", "Courses", "School", "College"],
  Others: ["Other", "Miscellaneous", "Cash", "ATM"],
};

const CHART_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FECA57",
  "#FF9FF3",
  "#54A0FF",
  "#5F27CD",
  "#00D2D3",
  "#FF3838",
];
type ViewMode = "current" | "yearly" | "monthly";
type ChartType = "pie" | "bar";
type ChartDataType = "income" | "expense";

export default function ReportsScreen() {
  const { transactions, budgets, isSyncing, triggerFullSync } = useAppData();
  const [viewMode, setViewMode] = useState<ViewMode>("current");
  const [chartType, setChartType] = useState<ChartType>("pie");
  const [chartDataType, setChartDataType] = useState<ChartDataType>("expense");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { theme } = useTheme();

  // Fetch theme colors dynamically
  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const secondaryTextColor = useThemeColor({}, "tabIconDefault");
  const backgroundColor = useThemeColor({}, "background");
  const activeColor = theme === "light" ? "#1C1C1E" : textColor;
  const activeTextColor = theme === "light" ? "#FFFFFF" : "#121212";

  const groupCategory = (category: string): string => {
    for (const [group, categories] of Object.entries(CATEGORY_GROUPS)) {
      if (
        categories.some((cat) =>
          category.toLowerCase().includes(cat.toLowerCase())
        )
      ) {
        return group;
      }
    }
    return "Others";
  };

  const {
    currentMonthIncomeData,
    currentMonthExpenseData,
    yearlyIncomeData,
    yearlyExpenseData,
    monthlyTrends,
    totalIncome,
    totalExpenses,
    monthlyBudget,
    availableYears,
  } = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const years = [
      ...new Set(transactions.map((tx) => new Date(tx.date).getFullYear())),
    ].sort((a, b) => b - a);

    const processTransactions = (txs: typeof transactions) => {
      const incomeByCategory = txs
        .filter((t) => t.type === "income")
        .reduce((acc, tx) => {
          const group = groupCategory(tx.category);
          acc[group] = (acc[group] || 0) + tx.amount;
          return acc;
        }, {} as { [key: string]: number });

      const expenseByCategory = txs
        .filter((t) => t.type === "expense")
        .reduce((acc, tx) => {
          const group = groupCategory(tx.category);
          acc[group] = (acc[group] || 0) + tx.amount;
          return acc;
        }, {} as { [key: string]: number });

      const incomeData: ChartData[] = Object.keys(incomeByCategory).map(
        (group, index) => ({
          name: group,
          amount: incomeByCategory[group],
          color: CHART_COLORS[index % CHART_COLORS.length],
        })
      );
      const expenseData: ChartData[] = Object.keys(expenseByCategory).map(
        (group, index) => ({
          name: group,
          amount: expenseByCategory[group],
          color: CHART_COLORS[index % CHART_COLORS.length],
        })
      );

      return { incomeData, expenseData };
    };

    const currentMonthTransactions = transactions.filter((tx) => {
      const txDate = new Date(tx.date);
      return (
        txDate.getMonth() === currentMonth &&
        txDate.getFullYear() === currentYear
      );
    });
    const yearlyTransactions = transactions.filter(
      (tx) => new Date(tx.date).getFullYear() === selectedYear
    );

    const {
      incomeData: currentMonthIncomeData,
      expenseData: currentMonthExpenseData,
    } = processTransactions(currentMonthTransactions);
    const { incomeData: yearlyIncomeData, expenseData: yearlyExpenseData } =
      processTransactions(yearlyTransactions);

    const monthlyTrendsData: MonthlyData = {
      income: Array(12).fill(0),
      expenses: Array(12).fill(0),
      labels: Array.from({ length: 12 }, (_, m) =>
        new Date(selectedYear, m, 1).toLocaleString("default", {
          month: "short",
        })
      ),
    };

    yearlyTransactions.forEach((tx) => {
      const month = new Date(tx.date).getMonth();
      if (tx.type === "income") monthlyTrendsData.income[month] += tx.amount;
      else monthlyTrendsData.expenses[month] += tx.amount;
    });

    const totalIncomeForPeriod = (
      viewMode === "current" ? currentMonthIncomeData : yearlyIncomeData
    ).reduce((sum, item) => sum + item.amount, 0);
    const totalExpensesForPeriod = (
      viewMode === "current" ? currentMonthExpenseData : yearlyExpenseData
    ).reduce((sum, item) => sum + item.amount, 0);

    const currentMonthYear = `${currentYear}-${String(
      currentMonth + 1
    ).padStart(2, "0")}`;
    const budget = budgets.find((b) => b.monthYear === currentMonthYear);

    return {
      currentMonthIncomeData,
      currentMonthExpenseData,
      yearlyIncomeData,
      yearlyExpenseData,
      monthlyTrends: monthlyTrendsData,
      totalIncome: totalIncomeForPeriod,
      totalExpenses: totalExpensesForPeriod,
      monthlyBudget: budget?.amount || 0,
      availableYears: years.length > 0 ? years : [currentYear],
    };
  }, [transactions, budgets, viewMode, selectedYear]);

  const chartConfig = {
    backgroundColor: cardColor,
    backgroundGradientFrom: cardColor,
    backgroundGradientTo: cardColor,
    decimalPlaces: 0,
    color: () => textColor,
    labelColor: () => secondaryTextColor,
    style: { borderRadius: 20 },
    propsForDots: { r: "4", strokeWidth: "2", stroke: textColor },
    propsForLabels: { fontSize: 12, fontWeight: "500" },
  };

  const getCurrentChartData = () => {
    const sourceData =
      viewMode === "current"
        ? { income: currentMonthIncomeData, expense: currentMonthExpenseData }
        : { income: yearlyIncomeData, expense: yearlyExpenseData };
    return sourceData[chartDataType];
  };

  const getBarChartData = () => {
    const data = getCurrentChartData();
    const sortedData = [...data]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    return {
      labels: sortedData.map((item) => {
        // Truncate labels to prevent cutoff
        const label = item.name;
        return label.length > 8 ? label.substring(0, 8) + '...' : label;
      }),
      datasets: [{ data: sortedData.map((item) => item.amount) }],
    };
  };

  const onRefresh = async () => await triggerFullSync();
  const formatAmount = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(amount)
      .replace("₹", "₹ ");

  const budgetProgress =
    monthlyBudget > 0 ? (totalExpenses / monthlyBudget) * 100 : 0;
  const remainingBudget = monthlyBudget - totalExpenses;

  if (isSyncing && transactions.length === 0) {
    return (
      <ThemedView style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={textColor} />
        <ThemedText>Loading reports...</ThemedText>
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
          <ThemedText style={styles.headerTitle}>Reports</ThemedText>
        </View>

        <ThemedView
          style={[
            styles.card,
            { backgroundColor: cardColor, shadowColor: textColor },
          ]}
        >
          <ThemedView
            style={[
              styles.viewModeSelector,
              { backgroundColor: backgroundColor },
            ]}
          >
            {[
              { key: "current", label: "This Month", icon: "calendar" },
              { key: "yearly", label: "Yearly", icon: "bar-chart-2" },
              { key: "monthly", label: "Trend", icon: "activity" },
            ].map((mode) => (
              <Pressable
                key={mode.key}
                style={[
                  styles.viewModeButton,
                  viewMode === mode.key && { backgroundColor: activeColor },
                ]}
                onPress={() => setViewMode(mode.key as ViewMode)}
              >
                <Feather
                  name={mode.icon as any}
                  size={14}
                  color={viewMode === mode.key ? activeTextColor : textColor}
                />
                <ThemedText
                  style={[
                    styles.viewModeText,
                    viewMode === mode.key && { color: activeTextColor },
                  ]}
                >
                  {" "}
                  {mode.label}{" "}
                </ThemedText>
              </Pressable>
            ))}
          </ThemedView>
          {(viewMode === "yearly" || viewMode === "monthly") && (
            <View style={styles.yearSelector}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {availableYears.map((year) => (
                  <Pressable
                    key={year}
                    style={[
                      styles.yearButton,
                      { backgroundColor: backgroundColor },
                      selectedYear === year && { backgroundColor: activeColor },
                    ]}
                    onPress={() => setSelectedYear(year)}
                  >
                    <ThemedText
                      style={[
                        styles.yearButtonText,
                        selectedYear === year && { color: activeTextColor },
                      ]}
                    >
                      {year}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </ThemedView>

        {viewMode === "current" && (
          <ThemedView
            style={[
              styles.card,
              { backgroundColor: cardColor, shadowColor: textColor },
            ]}
          >
            <View style={styles.budgetHeader}>
              <ThemedText style={styles.cardTitle}>Monthly Budget</ThemedText>
              <Link href="/set-budget" asChild>
                <ThemedText style={styles.linkText}>
                  {" "}
                  {monthlyBudget > 0 ? "Edit" : "Set Budget"}{" "}
                </ThemedText>
              </Link>
            </View>
            {monthlyBudget > 0 ? (
              <>
                <View style={styles.budgetStats}>
                  <View style={styles.budgetStatItem}>
                    <ThemedText
                      style={[
                        styles.budgetStatLabel,
                        { color: secondaryTextColor },
                      ]}
                    >
                      Spent
                    </ThemedText>
                    <ThemedText style={styles.budgetStatValue}>
                      {formatAmount(totalExpenses)}
                    </ThemedText>
                  </View>
                  <View style={styles.budgetStatItem}>
                    <ThemedText
                      style={[
                        styles.budgetStatLabel,
                        { color: secondaryTextColor },
                      ]}
                    >
                      Remaining
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.budgetStatValue,
                        { color: remainingBudget >= 0 ? "#34C759" : "#FF3B30" },
                      ]}
                    >
                      {formatAmount(Math.abs(remainingBudget))}
                    </ThemedText>
                  </View>
                  <View style={styles.budgetStatItem}>
                    <ThemedText
                      style={[
                        styles.budgetStatLabel,
                        { color: secondaryTextColor },
                      ]}
                    >
                      Budget
                    </ThemedText>
                    <ThemedText style={styles.budgetStatValue}>
                      {formatAmount(monthlyBudget)}
                    </ThemedText>
                  </View>
                </View>
                <ThemedView
                  style={[
                    styles.progressBar,
                    { backgroundColor: backgroundColor },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(budgetProgress, 100)}%`,
                        backgroundColor:
                          budgetProgress > 100
                            ? "#FF3B30"
                            : budgetProgress > 80
                            ? "#FF9500"
                            : "#34C759",
                      },
                    ]}
                  />
                </ThemedView>
              </>
            ) : (
              <ThemedText style={{ color: secondaryTextColor }}>
                No budget set for this month. Tap 'Set Budget' to start
                tracking.
              </ThemedText>
            )}
          </ThemedView>
        )}

        {viewMode !== "monthly" && (
          <ThemedView
            style={[
              styles.card,
              { backgroundColor: cardColor, shadowColor: textColor },
            ]}
          >
            <ThemedText style={styles.cardTitle}>
              {viewMode === "current"
                ? "This Month's Summary"
                : `${selectedYear} Summary`}
            </ThemedText>
            <View style={styles.summarySection}>
              <ThemedText style={styles.summaryTitle}>Income</ThemedText>
              <ThemedText style={[styles.summaryTotal, { color: "#34C759" }]}>
                {formatAmount(totalIncome)}
              </ThemedText>
              {(viewMode === "current"
                ? currentMonthIncomeData
                : yearlyIncomeData
              )
                .slice(0, 3)
                .map((item) => (
                  <View
                    key={`inc-${item.name}`}
                    style={styles.categoryStatItem}
                  >
                    <View
                      style={[
                        styles.categoryDot,
                        { backgroundColor: item.color },
                      ]}
                    />
                    <ThemedText style={styles.categoryName} numberOfLines={1}>
                      {item.name}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.categoryAmount,
                        { color: secondaryTextColor },
                      ]}
                    >
                      {formatAmount(item.amount)}
                    </ThemedText>
                  </View>
                ))}
            </View>
            <View style={[styles.summarySection, { marginTop: 16 }]}>
              <ThemedText style={styles.summaryTitle}>Expenses</ThemedText>
              <ThemedText style={[styles.summaryTotal, { color: "#FF3B30" }]}>
                {formatAmount(totalExpenses)}
              </ThemedText>
              {(viewMode === "current"
                ? currentMonthExpenseData
                : yearlyExpenseData
              )
                .slice(0, 3)
                .map((item) => (
                  <View
                    key={`exp-${item.name}`}
                    style={styles.categoryStatItem}
                  >
                    <View
                      style={[
                        styles.categoryDot,
                        { backgroundColor: item.color },
                      ]}
                    />
                    <ThemedText style={styles.categoryName} numberOfLines={1}>
                      {item.name}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.categoryAmount,
                        { color: secondaryTextColor },
                      ]}
                    >
                      {formatAmount(item.amount)}
                    </ThemedText>
                  </View>
                ))}
            </View>
            <View
              style={[styles.savingsRow, { borderTopColor: backgroundColor }]}
            >
              <ThemedText style={styles.savingsLabel}>Net Savings</ThemedText>
              <ThemedText style={styles.savingsAmount}>
                {formatAmount(totalIncome - totalExpenses)}
              </ThemedText>
            </View>
          </ThemedView>
        )}

        <ThemedView
          style={[
            styles.card,
            { backgroundColor: cardColor, shadowColor: textColor },
          ]}
        >
          <View style={styles.chartHeader}>
            <ThemedText style={styles.cardTitle}>
              {" "}
              {viewMode === "monthly"
                ? "Monthly Trend"
                : "Visual Breakdown"}{" "}
            </ThemedText>
            {viewMode !== "monthly" && (
              <View style={styles.chartTypeSelector}>
                {[
                  { key: "pie", icon: "pie-chart" },
                  { key: "bar", icon: "bar-chart-2" },
                ].map((type) => (
                  <Pressable
                    key={type.key}
                    onPress={() => setChartType(type.key as ChartType)}
                  >
                    <Feather
                      name={type.icon as any}
                      size={18}
                      color={
                        chartType === type.key ? textColor : secondaryTextColor
                      }
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {viewMode !== "monthly" && (
            <ThemedView
              style={[
                styles.viewModeSelector,
                { backgroundColor, marginBottom: 16, padding: 2 },
              ]}
            >
              {[
                { key: "expense", label: "Expenses" },
                { key: "income", label: "Income" },
              ].map((type) => (
                <Pressable
                  key={type.key}
                  style={[
                    styles.viewModeButton,
                    { paddingVertical: 8 },
                    chartDataType === type.key && {
                      backgroundColor: cardColor,
                    },
                  ]}
                  onPress={() => setChartDataType(type.key as ChartDataType)}
                >
                  <ThemedText style={[styles.viewModeText, { fontSize: 13 }]}>
                    {" "}
                    {type.label}{" "}
                  </ThemedText>
                </Pressable>
              ))}
            </ThemedView>
          )}

          {getCurrentChartData().length > 0 ||
          monthlyTrends.income.some((v) => v > 0) ||
          monthlyTrends.expenses.some((v) => v > 0) ? (
            <View style={styles.chartContainer}>
              {viewMode === "monthly" ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <LineChart
                    data={{
                      labels: monthlyTrends.labels,
                      datasets: [
                        {
                          data: monthlyTrends.income,
                          color: () => "#34C759",
                          strokeWidth: 2,
                        },
                        {
                          data: monthlyTrends.expenses,
                          color: () => "#FF3B30",
                          strokeWidth: 2,
                        },
                      ],
                      legend: ["Income", "Expenses"],
                    }}
                    width={960}
                    height={220}
                    chartConfig={chartConfig}
                    bezier
                    style={styles.chart}
                  />
                </ScrollView>
              ) : chartType === "pie" ? (
                <>
                  <View style={styles.pieChartContainer}>
                    <PieChart
                      data={getCurrentChartData()}
                      width={screenWidth - 40}
                      height={220}
                      chartConfig={chartConfig}
                      accessor="amount"
                      backgroundColor="transparent"
                      paddingLeft="80"
                      center={[20, 0]}
                      absolute
                      hasLegend={false}
                    />
                  </View>
                  <View style={styles.legendContainer}>
                    {getCurrentChartData().map((item) => (
                      <View key={item.name} style={styles.legendItem}>
                        <View
                          style={[
                            styles.legendDot,
                            { backgroundColor: item.color },
                          ]}
                        />
                        <ThemedText style={styles.legendText} numberOfLines={1}>
                          {item.name}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barChartScrollContainer}>
                  <View style={styles.barChartContainer}>
                    <BarChart
                      data={getBarChartData()}
                      width={Math.max(
                        screenWidth - 40,
                        getBarChartData().labels.length * 80
                      )}
                      height={300}
                      chartConfig={chartConfig}
                      yAxisLabel=""
                      yAxisSuffix=""
                      style={styles.chart}
                      fromZero
                      showBarTops={false}
                      showValuesOnTopOfBars={false}
                    />
                  </View>
                </ScrollView>
              )}
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Feather
                name="pie-chart"
                size={48}
                color={secondaryTextColor}
                style={{ opacity: 0.5 }}
              />
              <ThemedText
                style={[styles.noDataText, { color: secondaryTextColor }]}
              >
                Not enough data
              </ThemedText>
            </View>
          )}
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

// Styles are now mostly for layout and typography
const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingBottom: 100 },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: "bold" },
  card: {
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  viewModeSelector: { flexDirection: "row", borderRadius: 12, padding: 4 },
  viewModeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    paddingHorizontal: 5,
  },
  viewModeText: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  yearSelector: { marginTop: 16 },
  yearButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
  },
  yearButtonText: { fontSize: 14, fontWeight: "600" },
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  linkText: { color: "#007AFF", fontWeight: "500", fontSize: 16 },
  budgetStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  budgetStatItem: { alignItems: "center", flex: 1, paddingHorizontal: 5 },
  budgetStatLabel: { fontSize: 14, marginBottom: 4 },
  budgetStatValue: { fontSize: 18, fontWeight: "600", flexShrink: 1 },
  progressBar: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%" },
  summarySection: { width: "100%", marginBottom: 16 },
  summaryTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  summaryTotal: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  savingsRow: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 8,
    alignItems: "center",
    width: "100%",
  },
  savingsLabel: { fontSize: 16, fontWeight: "500" },
  savingsAmount: { fontSize: 28, fontWeight: "bold", marginTop: 4 },
  categoryStatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  categoryName: { flex: 1, fontSize: 15, fontWeight: "500" },
  categoryAmount: { fontSize: 15, fontWeight: "500" },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chartTypeSelector: { flexDirection: "row", gap: 16, marginBottom: 16 },
  chartContainer: { alignItems: "center", marginTop: 16 },
  // Fixed pie chart container for proper positioning
  pieChartContainer: { 
    width: '100%',
    alignItems: 'flex-end',
    paddingLeft: 40,
  },
  // Updated bar chart styles
  barChartScrollContainer: {
    paddingHorizontal: 10,
  },
  barChartContainer: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  chart: { borderRadius: 20 },
  noDataContainer: { alignItems: "center", paddingVertical: 40 },
  noDataText: { fontSize: 16, fontWeight: "600", marginTop: 16 },
  legendContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 20,
    paddingHorizontal: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    width: "50%",
    marginBottom: 10,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendText: { fontSize: 14, flexShrink: 1 },
});