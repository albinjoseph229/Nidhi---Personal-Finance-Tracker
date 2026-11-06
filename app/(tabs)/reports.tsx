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
import { LineChart, PieChart } from "react-native-chart-kit";

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
  legendFontColor?: string;
  legendFontSize?: number;
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
  "Home & Garden": ["Home", "Rent", "Furniture", "Garden", "Maintenance"],
  Others: ["Other", "Miscellaneous", "Cash", "ATM"],
};

const CHART_COLORS = [
  "#6B9080",
  "#A4B8A7",
  "#829AB1",
  "#C5A880",
  "#A58FAA",
  "#B98B82",
  "#7E9A9A",
  "#9AA6B2",
  "#B2A58E",
  "#879B87",
];
type ViewMode = "current" | "yearly" | "monthly" | "investments";
type ChartType = "pie" | "bar";
type ChartDataType = "income" | "expense";

export default function ReportsScreen() {
  const { transactions, investments, budgets, isSyncing, triggerUploadSync } =
    useAppData();
  const [viewMode, setViewMode] = useState<ViewMode>("current");
  const [chartType, setChartType] = useState<ChartType>("pie");
  const [chartDataType, setChartDataType] = useState<ChartDataType>("expense");
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { theme, accentColor } = useTheme();

  // Fetch theme colors dynamically
  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const secondaryTextColor = useThemeColor({}, "tabIconDefault");
  const backgroundColor = useThemeColor({}, "background");
  const activeColor = accentColor;
  const activeTextColor = "#FFFFFF";

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
    investmentAllocationData,
    totalInvestmentValue,
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

    const activeInvestments = investments.filter(
      (inv) => inv.status === "active"
    );

    const investmentByType = activeInvestments.reduce((acc, inv) => {
      const value = inv.currentValue * inv.quantity;
      acc[inv.type] = (acc[inv.type] || 0) + value;
      return acc;
    }, {} as { [key: string]: number });

    const invAllocationData: ChartData[] = Object.keys(investmentByType).map(
      (type, index) => ({
        name: type,
        amount: investmentByType[type],
        color: CHART_COLORS[index % CHART_COLORS.length],
        legendFontColor: textColor,
        legendFontSize: 14,
      })
    );

    const totalInvValue = activeInvestments.reduce(
      (sum, inv) => sum + inv.currentValue * inv.quantity,
      0
    );

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
      investmentAllocationData: invAllocationData,
      totalInvestmentValue: totalInvValue,
    };
  }, [transactions, investments, budgets, viewMode, selectedYear]);

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

  const onRefresh = async () => await triggerUploadSync();
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
          <ThemedText style={[styles.eyebrow, { color: secondaryTextColor }]}>
            INSIGHTS
          </ThemedText>
          <ThemedText style={styles.headerTitle}>Reports</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: secondaryTextColor }]}>
            Understand where your money is going
          </ThemedText>
        </View>

        <ThemedView
          style={[
            styles.card,
            { backgroundColor: cardColor, shadowColor: textColor },
          ]}
        >
          <View style={styles.viewModeContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {[
                { key: "current", label: "This Month", icon: "calendar" },
                { key: "yearly", label: "Yearly", icon: "bar-chart-2" },
                { key: "monthly", label: "Trend", icon: "activity" },
                { key: "investments", label: "Investments", icon: "trending-up" },
              ].map((mode) => (
                <Pressable
                  key={mode.key}
                  style={[
                    styles.viewModePill,
                    { backgroundColor: backgroundColor },
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
                      styles.viewModePillText,
                      viewMode === mode.key && { color: activeTextColor },
                    ]}
                  >
                    {mode.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
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

        {viewMode === "investments" && (
          <ThemedView
            style={[
              styles.card,
              { backgroundColor: cardColor, shadowColor: textColor },
            ]}
          >
            <ThemedText style={styles.cardTitle}>
              Investment Allocation
            </ThemedText>
            <ThemedText style={styles.summaryTotal}>
              {formatAmount(totalInvestmentValue)}
            </ThemedText>

            {investmentAllocationData.length > 0 ? (
              <View style={styles.chartContainer}>
                <PieChart
                  data={investmentAllocationData}
                  width={screenWidth - 40}
                  height={220}
                  chartConfig={chartConfig}
                  accessor="amount"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  center={[10, 0]}
                  absolute
                />
              </View>
            ) : (
              <View style={styles.noDataContainer}>
                <Feather
                  name="trending-up"
                  size={48}
                  color={secondaryTextColor}
                  style={{ opacity: 0.5 }}
                />
                <ThemedText
                  style={[styles.noDataText, { color: secondaryTextColor }]}
                >
                  No active investments found
                </ThemedText>
              </View>
            )}
          </ThemedView>
        )}

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
                <ThemedText style={[styles.linkText, { color: activeColor }]}>
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
                      style={[styles.budgetStatLabel, { color: secondaryTextColor }]}
                    >
                      Spent
                    </ThemedText>
                    <ThemedText style={styles.budgetStatValue}>
                      {formatAmount(totalExpenses)}
                    </ThemedText>
                  </View>

                  <View style={styles.budgetStatItem}>
                    <ThemedText
                      style={[styles.budgetStatLabel, { color: secondaryTextColor }]}
                    >
                      {remainingBudget >= 0 ? "Remaining" : "Over"}
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
                      style={[styles.budgetStatLabel, { color: secondaryTextColor }]}
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

        {(viewMode === "current" || viewMode === "yearly") && (
          <ThemedView
            style={[
              styles.card,
              { backgroundColor: cardColor, shadowColor: textColor },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${isSummaryExpanded ? "Collapse" : "Expand"} monthly summary`}
              onPress={() => setIsSummaryExpanded((expanded) => !expanded)}
              style={styles.summaryCardHeader}
            >
              <View style={styles.collapsibleTitle}>
                <ThemedText style={styles.cardTitle}>
                  {viewMode === "current"
                    ? "This month's summary"
                    : `${selectedYear} summary`}
                </ThemedText>
                <ThemedText style={[styles.cardCaption, { color: secondaryTextColor }]}>
                  A quick view of your cash flow
                </ThemedText>
              </View>
              <Feather name={isSummaryExpanded ? "chevron-up" : "chevron-down"} size={19} color={secondaryTextColor} />
            </Pressable>
            {isSummaryExpanded && <View style={styles.summaryContent}>
            <View style={styles.summaryMetrics}>
              <View style={[styles.summaryMetric, { borderColor: "#2F6B4F40" }]}>
                <View style={styles.summaryMetricLabel}>
                <View style={[styles.metricIcon, { backgroundColor: "#2F6B4F" }]}>
                    <Feather name="arrow-up" size={13} color="#FFFFFF" />
                  </View>
                  <ThemedText style={[styles.summaryTitle, { color: secondaryTextColor }]}>Income</ThemedText>
                </View>
                <ThemedText style={[styles.summaryTotal, { color: "#2F6B4F" }]}>
                  {formatAmount(totalIncome)}
                </ThemedText>
              </View>
              <View style={[styles.summaryMetric, { borderColor: "#A94A4A40" }]}>
                <View style={styles.summaryMetricLabel}>
                  <View style={[styles.metricIcon, { backgroundColor: "#A94A4A" }]}>
                    <Feather name="arrow-down" size={13} color="#FFFFFF" />
                  </View>
                  <ThemedText style={[styles.summaryTitle, { color: secondaryTextColor }]}>Expenses</ThemedText>
                </View>
                <ThemedText style={[styles.summaryTotal, { color: "#A94A4A" }]}>
                  {formatAmount(totalExpenses)}
                </ThemedText>
              </View>
            </View>
            <View style={[styles.summarySection, { borderTopColor: backgroundColor }]}>
              <View style={styles.categorySectionHeader}>
                <ThemedText style={styles.summaryTitle}>Income categories</ThemedText>
                <ThemedText style={[styles.categoryHint, { color: secondaryTextColor }]}>Top 3</ThemedText>
              </View>
              {(viewMode === "current"
                ? currentMonthIncomeData
                : yearlyIncomeData
              )
                .slice(0, 3)
                .map((item) => (
                  <View
                    key={`inc-${item.name}`}
                    style={[styles.categoryStatItem, { borderBottomColor: backgroundColor }]}
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
            <View style={[styles.summarySection, styles.expenseSummarySection, { borderTopColor: backgroundColor }]}>
              <View style={styles.categorySectionHeader}>
                <ThemedText style={styles.summaryTitle}>Expense categories</ThemedText>
                <ThemedText style={[styles.categoryHint, { color: secondaryTextColor }]}>Top 3</ThemedText>
              </View>
              {(viewMode === "current"
                ? currentMonthExpenseData
                : yearlyExpenseData
              )
                .slice(0, 3)
                .map((item) => (
                  <View
                    key={`exp-${item.name}`}
                    style={[styles.categoryStatItem, { borderBottomColor: backgroundColor }]}
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
              <View style={styles.savingsLabelGroup}>
                <View style={[styles.metricIcon, { backgroundColor: "#A94A4A" }]}>
                  <Feather name={totalIncome - totalExpenses >= 0 ? "trending-up" : "trending-down"} size={14} color="#FFFFFF" />
                </View>
                <View>
                  <ThemedText style={styles.savingsLabel}>Net savings</ThemedText>
                  <ThemedText style={[styles.savingsCaption, { color: textColor }]}>Income minus expenses</ThemedText>
                </View>
              </View>
              <ThemedText style={[styles.savingsAmount, { color: "#A94A4A" }]}>
                {formatAmount(totalIncome - totalExpenses)}
              </ThemedText>
            </View>
            </View>}
          </ThemedView>
        )}

        {(viewMode === "current" || viewMode === "yearly") && (
          <ThemedView
            style={[
              styles.card,
              { backgroundColor: cardColor, shadowColor: textColor },
            ]}
          >
            <View style={styles.chartHeader}>
              <View style={styles.collapsibleTitle}>
                <ThemedText style={styles.cardTitle}>Visual breakdown</ThemedText>
                <ThemedText style={[styles.cardCaption, { color: secondaryTextColor }]}>
                  Compare income and expenses by category
                </ThemedText>
              </View>
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
                        chartType === type.key ? accentColor : secondaryTextColor
                      }
                    />
                  </Pressable>
                ))}
              </View>
            </View>

            <ThemedView
              style={[
                styles.segmentedControl,
                { backgroundColor, marginBottom: 16, padding: 2 },
              ]}
            >
              <View style={styles.segmentedRow}>
                {[
                  { key: "expense", label: "Expenses" },
                  { key: "income", label: "Income" },
                ].map((type) => (
                  <Pressable
                    key={type.key}
                    style={[
                      styles.segmentedButton,
                      { paddingVertical: 8 },
                      chartDataType === type.key && {
                        backgroundColor: cardColor,
                        shadowColor: textColor,
                        shadowOpacity: 0.06,
                        shadowRadius: 4,
                        elevation: 1,
                      },
                    ]}
                    onPress={() => setChartDataType(type.key as ChartDataType)}
                  >
                    <ThemedText
                      style={[
                        styles.segmentedText,
                        { fontSize: 13 },
                        chartDataType === type.key && { color: accentColor },
                      ]}
                    >
                      {" "}
                      {type.label}{" "}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </ThemedView>

            {getCurrentChartData().length > 0 ? (
              <View style={styles.chartContainer}>
                {chartType === "pie" ? (
                  <>
                    <View style={styles.pieChartContainer}>
                      <PieChart
                        data={getCurrentChartData()}
                        width={screenWidth - 40}
                        height={220}
                        chartConfig={chartConfig}
                        accessor="amount"
                        backgroundColor="transparent"
                        paddingLeft="60"
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
                          <ThemedText
                            style={styles.legendText}
                            numberOfLines={1}
                          >
                            {item.name}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </>
                ) : (
                  <View style={styles.rankBarList}>
                    {getCurrentChartData()
                      .slice()
                      .sort((a, b) => b.amount - a.amount)
                      .slice(0, 5)
                      .map((item) => {
                        const maxAmount = Math.max(
                          ...getCurrentChartData().map((entry) => entry.amount),
                          1
                        );
                        return (
                          <View key={item.name} style={styles.rankBarRow}>
                            <View style={styles.rankBarHeader}>
                              <ThemedText style={styles.rankBarLabel} numberOfLines={1}>
                                {item.name}
                              </ThemedText>
                              <ThemedText style={[styles.rankBarValue, { color: secondaryTextColor }]}>
                                {formatAmount(item.amount)}
                              </ThemedText>
                            </View>
                            <View style={[styles.rankBarTrack, { backgroundColor }]}>
                              <View
                                style={[
                                  styles.rankBarFill,
                                  { width: `${Math.max((item.amount / maxAmount) * 100, 4)}%`, backgroundColor: item.color },
                                ]}
                              />
                            </View>
                          </View>
                        );
                      })}
                  </View>
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
        )}

        {viewMode === "monthly" && (
          <ThemedView
            style={[
              styles.card,
              { backgroundColor: cardColor, shadowColor: textColor },
            ]}
          >
            <View style={styles.chartHeader}>
              <ThemedText style={styles.cardTitle}>Monthly Trend</ThemedText>
            </View>
            {monthlyTrends.income.some((v) => v > 0) ||
            monthlyTrends.expenses.some((v) => v > 0) ? (
              <View style={styles.chartContainer}>
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
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingBottom: 100, paddingTop: 4 },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { paddingTop: 42, paddingHorizontal: 20, paddingBottom: 18 },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 4 },
  headerTitle: { fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, marginTop: 5 },
  card: {
    borderRadius: 18,
    marginHorizontal: 18,
    marginBottom: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(125, 137, 133, 0.12)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.025,
    shadowRadius: 8,
    elevation: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10, letterSpacing: -0.1 },
  cardCaption: { fontSize: 12, marginTop: -5, marginBottom: 12, lineHeight: 17 },
  segmentedControl: {
    borderRadius: 12,
    padding: 4,
    flexDirection: "column",
    gap: 4,
  },
  segmentedRow: {
    flexDirection: "row",
    gap: 4,
  },
  segmentedButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    paddingHorizontal: 5,
  },
  segmentedText: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  viewModeContainer: {
    marginBottom: 2,
  },
  viewModePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 6,
  },
  viewModePillText: { fontSize: 12, fontWeight: "700" },
  yearSelector: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(125, 137, 133, 0.14)" },
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
    marginBottom: 4,
  },
  linkText: { fontWeight: "700", fontSize: 13 },
  budgetStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingVertical: 6,
  },
  budgetStatItem: { alignItems: "center", flex: 1, paddingHorizontal: 5 },
  budgetStatLabel: { fontSize: 11, marginBottom: 5, fontWeight: "600", letterSpacing: 0.2 },
  budgetStatValue: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
  progressBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%" },
  summaryCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 2 },
  collapsibleTitle: { flex: 1 },
  summaryContent: { marginTop: 4 },
  summaryMetrics: { flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 2 },
  summaryMetric: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1 },
  summaryMetricLabel: { flexDirection: "row", alignItems: "center", gap: 7 },
  metricIcon: { width: 22, height: 22, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  summarySection: { width: "100%", marginTop: 16, paddingTop: 14, borderTopWidth: 1 },
  expenseSummarySection: { marginTop: 4 },
  categorySectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  summaryTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3, textTransform: "uppercase" },
  categoryHint: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  summaryTotal: { fontSize: 21, fontWeight: "800", marginTop: 10, letterSpacing: -0.4 },
  savingsRow: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 10,
    alignItems: "center",
    width: "100%",
  },
  savingsLabelGroup: { flexDirection: "row", alignItems: "center", gap: 9 },
  savingsLabel: { fontSize: 14, fontWeight: "700" },
  savingsCaption: { fontSize: 12, fontWeight: "500", marginTop: 2, opacity: 0.8 },
  savingsAmount: { fontSize: 25, fontWeight: "800", marginTop: 4, letterSpacing: -0.4 },
  categoryStatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  categoryDot: { width: 7, height: 7, borderRadius: 4, marginRight: 10 },
  categoryName: { flex: 1, fontSize: 14, fontWeight: "600" },
  categoryAmount: { fontSize: 13, fontWeight: "600" },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerChevron: { marginHorizontal: 8 },
  chartTypeSelector: { flexDirection: "row", gap: 4, marginBottom: 10, backgroundColor: "rgba(125, 137, 133, 0.1)", borderRadius: 9, padding: 3 },
  chartContainer: { alignItems: "center", marginTop: 10 },
  pieChartContainer: {
    width: "100%",
    alignItems: "center",
  },
  rankBarList: { width: "100%", gap: 14, marginTop: 6 },
  rankBarRow: { width: "100%" },
  rankBarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  rankBarLabel: { flex: 1, fontSize: 13, fontWeight: "600", marginRight: 12 },
  rankBarValue: { fontSize: 12, fontWeight: "600" },
  rankBarTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  rankBarFill: { height: "100%", borderRadius: 4 },
  chart: { borderRadius: 14 },
  noDataContainer: { alignItems: "center", paddingVertical: 34 },
  noDataText: { fontSize: 15, fontWeight: "600", marginTop: 14 },
  legendContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 16,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    width: "50%",
    marginBottom: 8,
  },
  legendDot: { width: 7, height: 7, borderRadius: 4, marginRight: 7 },
  legendText: { fontSize: 13, flexShrink: 1 },
});