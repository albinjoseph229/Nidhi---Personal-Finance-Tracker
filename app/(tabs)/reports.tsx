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
  month: string;
  amount: number;
}
const screenWidth = Dimensions.get("window").width;

const CATEGORY_GROUPS = {
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

const CHART_COLORS = [ "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FECA57", "#FF9FF3", "#54A0FF", "#5F27CD", "#00D2D3", "#FF3838" ];
type ViewMode = "current" | "yearly" | "monthly";
type ChartType = "pie" | "bar";

export default function ReportsScreen() {
  const { transactions, budgets, isSyncing, triggerFullSync } = useAppData();
  const [viewMode, setViewMode] = useState<ViewMode>("current");
  const [chartType, setChartType] = useState<ChartType>("pie");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { theme } = useTheme();

  // Fetch theme colors dynamically
  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const secondaryTextColor = useThemeColor({}, "tabIconDefault");
  const backgroundColor = useThemeColor({}, "background");
  const activeColor = theme === "light" ? "#1C1C1E" : textColor;
  const activeTextColor = theme === "light" ? "#FFFFFF" : "#121212";

  // Data processing logic
  const groupCategory = (category: string): string => {
    for (const [group, categories] of Object.entries(CATEGORY_GROUPS)) {
      if (categories.some((cat) => category.toLowerCase().includes(cat.toLowerCase()))) {
        return group;
      }
    }
    return "Others";
  };

  const { currentMonthData, yearlyData, monthlyTrends, totalExpenses, monthlyBudget, availableYears } = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const years = [...new Set(transactions.map((tx) => new Date(tx.date).getFullYear()))].sort((a, b) => b - a);
    const currentMonthTransactions = transactions.filter((tx) => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear && tx.amount > 0;
    });
    const currentMonthTotal = currentMonthTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const currentMonthByCategory = currentMonthTransactions.reduce((acc, tx) => {
      const group = groupCategory(tx.category);
      acc[group] = (acc[group] || 0) + tx.amount;
      return acc;
    }, {} as { [key: string]: number });
    const currentMonthChartData: ChartData[] = Object.keys(currentMonthByCategory).map((group, index) => ({
      name: group,
      amount: currentMonthByCategory[group],
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
    const yearlyTransactions = transactions.filter((tx) => new Date(tx.date).getFullYear() === selectedYear && tx.amount > 0);
    const yearlyTotal = yearlyTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const yearlyByCategory = yearlyTransactions.reduce((acc, tx) => {
      const group = groupCategory(tx.category);
      acc[group] = (acc[group] || 0) + tx.amount;
      return acc;
    }, {} as { [key: string]: number });
    const yearlyChartData: ChartData[] = Object.keys(yearlyByCategory).map((group, index) => ({
      name: group,
      amount: yearlyByCategory[group],
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
    const monthlyData: MonthlyData[] = Array.from({ length: 12 }, (_, month) => {
      const monthTransactions = transactions.filter((tx) => {
        const txDate = new Date(tx.date);
        return txDate.getMonth() === month && txDate.getFullYear() === selectedYear && tx.amount > 0;
      });
      const monthTotal = monthTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      return {
        month: new Date(selectedYear, month, 1).toLocaleString("default", { month: "short" }),
        amount: monthTotal,
      };
    });
    const currentMonthYear = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    const budget = budgets.find((b) => b.monthYear === currentMonthYear);
    return {
      currentMonthData: currentMonthChartData,
      yearlyData: yearlyChartData,
      monthlyTrends: monthlyData,
      totalExpenses: viewMode === "current" ? currentMonthTotal : yearlyTotal,
      monthlyBudget: budget?.amount || 0,
      availableYears: years.length > 0 ? years : [currentYear],
    };
  }, [transactions, budgets, viewMode, selectedYear]);

  // Dynamic Chart Config
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

  const getCurrentChartData = () => viewMode === "current" ? currentMonthData : yearlyData;
  
  // Updated bar chart data with shorter labels
  const getBarChartData = () => {
    const data = getCurrentChartData();
    const sortedData = [...data].sort((a, b) => b.amount - a.amount).slice(0, 5);
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
  const formatAmount = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 0, }).format(amount).replace("₹", "₹ ");
  
  const budgetProgress = monthlyBudget > 0 ? (totalExpenses / monthlyBudget) * 100 : 0;
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
        refreshControl={ <RefreshControl refreshing={isSyncing} onRefresh={onRefresh} tintColor={textColor} /> }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Reports</ThemedText>
        </View>

        <ThemedView style={[styles.card, { backgroundColor: cardColor, shadowColor: textColor }]}>
          <ThemedView style={[styles.viewModeSelector, { backgroundColor: backgroundColor }]}>
            {[ { key: "current", label: "This Month", icon: "calendar" }, { key: "yearly", label: "Yearly", icon: "bar-chart-2" }, { key: "monthly", label: "Trend", icon: "activity" }].map((mode) => (
              <Pressable key={mode.key} style={[styles.viewModeButton, viewMode === mode.key && { backgroundColor: activeColor }]} onPress={() => setViewMode(mode.key as ViewMode)}>
                <Feather name={mode.icon as any} size={14} color={viewMode === mode.key ? activeTextColor : textColor} />
                <ThemedText style={[styles.viewModeText, viewMode === mode.key && { color: activeTextColor }]}> {mode.label} </ThemedText>
              </Pressable>
            ))}
          </ThemedView>
          {(viewMode === "yearly" || viewMode === "monthly") && (
            <View style={styles.yearSelector}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {availableYears.map((year) => (
                  <Pressable key={year} style={[styles.yearButton, { backgroundColor: backgroundColor }, selectedYear === year && { backgroundColor: activeColor }]} onPress={() => setSelectedYear(year)}>
                    <ThemedText style={[styles.yearButtonText, selectedYear === year && { color: activeTextColor }]}>{year}</ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </ThemedView>

        {viewMode === "current" && (
          <ThemedView style={[styles.card, { backgroundColor: cardColor, shadowColor: textColor }]}>
            <View style={styles.budgetHeader}>
              <ThemedText style={styles.cardTitle}>Monthly Budget</ThemedText>
              <Link href="/set-budget" asChild>
                <ThemedText style={styles.linkText}> {monthlyBudget > 0 ? "Edit" : "Set Budget"} </ThemedText>
              </Link>
            </View>
            {monthlyBudget > 0 ? (
              <>
                <View style={styles.budgetStats}>
                  <View style={styles.budgetStatItem}><ThemedText style={[styles.budgetStatLabel, { color: secondaryTextColor }]}>Spent</ThemedText><ThemedText style={styles.budgetStatValue}>{formatAmount(totalExpenses)}</ThemedText></View>
                  <View style={styles.budgetStatItem}><ThemedText style={[styles.budgetStatLabel, { color: secondaryTextColor }]}>Remaining</ThemedText><ThemedText style={[styles.budgetStatValue, { color: remainingBudget >= 0 ? "#34C759" : "#FF3B30" }]}>{formatAmount(Math.abs(remainingBudget))}</ThemedText></View>
                  <View style={styles.budgetStatItem}><ThemedText style={[styles.budgetStatLabel, { color: secondaryTextColor }]}>Budget</ThemedText><ThemedText style={styles.budgetStatValue}>{formatAmount(monthlyBudget)}</ThemedText></View>
                </View>
                <ThemedView style={[styles.progressBar, { backgroundColor: backgroundColor }]}>
                  <View style={[styles.progressFill, { width: `${Math.min(budgetProgress, 100)}%`, backgroundColor: budgetProgress > 100 ? "#FF3B30" : budgetProgress > 80 ? "#FF9500" : "#34C759" }]} />
                </ThemedView>
              </>
            ) : ( <ThemedText style={{ color: secondaryTextColor }}>No budget set for this month. Tap 'Set Budget' to start tracking.</ThemedText> )}
          </ThemedView>
        )}

        <ThemedView style={[styles.card, { backgroundColor: cardColor, shadowColor: textColor }]}>
          <ThemedText style={styles.cardTitle}> {viewMode === "monthly" ? `${selectedYear} Trend` : "Top Categories"} </ThemedText>
          {getCurrentChartData().length > 0 ? (
            getCurrentChartData().slice(0, 4).map((item) => (
                <View key={item.name} style={styles.categoryStatItem}>
                  <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                  <ThemedText style={styles.categoryName} numberOfLines={1}>{item.name}</ThemedText>
                  <ThemedText style={[styles.categoryAmount, { color: secondaryTextColor }]}>{formatAmount(item.amount)}</ThemedText>
                </View>
            ))
          ) : ( <ThemedText style={{ color: secondaryTextColor }}>No expenses recorded for this period.</ThemedText> )}
        </ThemedView>
        
        <ThemedView style={[styles.card, { backgroundColor: cardColor, shadowColor: textColor }]}>
          <View style={styles.chartHeader}>
            <ThemedText style={styles.cardTitle}> {viewMode === "monthly" ? "Monthly Trend" : "Category Breakdown"} </ThemedText>
            {viewMode !== "monthly" && (
              <View style={styles.chartTypeSelector}>
                {[ { key: "pie", icon: "pie-chart" }, { key: "bar", icon: "bar-chart-2" }].map((type) => (
                  <Pressable key={type.key} onPress={() => setChartType(type.key as ChartType)}>
                    <Feather name={type.icon as any} size={18} color={chartType === type.key ? textColor : secondaryTextColor} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          {getCurrentChartData().length > 0 || monthlyTrends.some((m) => m.amount > 0) ? (
            <View style={styles.chartContainer}>
              {viewMode !== "monthly" && chartType === "pie" ? (
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
                        <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                        <ThemedText style={styles.legendText} numberOfLines={1}>{item.name}</ThemedText>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barChartScrollContainer}>
                  {viewMode === "monthly" ? (
                    <LineChart 
                      data={{ labels: monthlyTrends.map((m) => m.month), datasets: [{ data: monthlyTrends.map((m) => m.amount) }] }} 
                      width={960} 
                      height={220} 
                      chartConfig={chartConfig} 
                      bezier 
                      style={styles.chart} 
                    />
                  ) : (
                    <View style={styles.barChartContainer}>
                      <BarChart 
                        data={getBarChartData()} 
                        width={Math.max(screenWidth - 40, getBarChartData().labels.length * 80)} 
                        height={300} 
                        chartConfig={chartConfig} 
                        yAxisLabel="" 
                        yAxisSuffix="" 
                        style={{
                          borderRadius: 20,
                          marginVertical: 8,
                        }} 
                        fromZero 
                        showBarTops={false}
                        showValuesOnTopOfBars={false}
                      />
                    </View>
                  )}
                </ScrollView>
              )}
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Feather name="pie-chart" size={48} color={secondaryTextColor} style={{ opacity: 0.5 }} />
              <ThemedText style={[styles.noDataText, { color: secondaryTextColor }]}>Not enough data</ThemedText>
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
  card: { borderRadius: 20, marginHorizontal: 20, marginBottom: 20, padding: 24, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  viewModeSelector: { flexDirection: "row", borderRadius: 12, padding: 4 },
  viewModeButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 10, gap: 8, paddingHorizontal: 5 },
  viewModeText: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  yearSelector: { marginTop: 16 },
  yearButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, marginRight: 8 },
  yearButtonText: { fontSize: 14, fontWeight: "600" },
  budgetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  linkText: { color: "#007AFF", fontWeight: "500", fontSize: 16 },
  budgetStats: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  budgetStatItem: { alignItems: "center", flex: 1, paddingHorizontal: 5 },
  budgetStatLabel: { fontSize: 14, marginBottom: 4 },
  budgetStatValue: { fontSize: 18, fontWeight: "600", flexShrink: 1 },
  progressBar: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%" },
  categoryStatItem: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  categoryName: { flex: 1, fontSize: 15, fontWeight: "500" },
  categoryAmount: { fontSize: 15, fontWeight: "500" },
  chartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chartTypeSelector: { flexDirection: "row", gap: 16, marginBottom: 16 },
  chartContainer: { alignItems: "center", marginTop: 16 },
  // Updated pie chart container for right positioning
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
  barChart: {
    marginVertical: 8,
  },
  noDataContainer: { alignItems: "center", paddingVertical: 40 },
  noDataText: { fontSize: 16, fontWeight: "600", marginTop: 16 },
  legendContainer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 20, paddingHorizontal: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", width: "50%", marginBottom: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendText: { fontSize: 14, flexShrink: 1 },
});