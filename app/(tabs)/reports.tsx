import { Link } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, Button, Dimensions, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { useAppData } from '../../context/AppContext';

interface ChartData {
  name: string;
  amount: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
}

const screenWidth = Dimensions.get('window').width;

export default function ReportsScreen() {
  // THE FIX: Use the correct function name 'triggerFullSync' from the context
  const { transactions, budgets, isSyncing, triggerFullSync } = useAppData();

  const { chartData, totalExpenses, monthlyBudget } = useMemo(() => {
    // ... (calculation logic is correct, no changes needed)
    let total = 0;
    const spendingByCategory = transactions
      .filter(t => t.amount > 0)
      .reduce((acc, tx) => {
        total += tx.amount;
        acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
        return acc;
      }, {} as { [key: string]: number });

    const formattedChartData = Object.keys(spendingByCategory).map(category => ({
      name: category,
      amount: spendingByCategory[category],
      color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
      legendFontColor: '#7F7F7F',
      legendFontSize: 15,
    }));

    const today = new Date();
    const currentMonthYear = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const budget = budgets.find(b => b.monthYear === currentMonthYear);

    return { 
      chartData: formattedChartData, 
      totalExpenses: total, 
      monthlyBudget: budget?.amount || 0 
    };
  }, [transactions, budgets]);

  const budgetProgress = monthlyBudget > 0 ? (totalExpenses / monthlyBudget) * 100 : 0;
  const progressWidth = Math.min(budgetProgress, 100);

  // THE FIX: The 'onRefresh' gesture now triggers a full network sync
  const onRefresh = async () => {
    await triggerFullSync();
  };

  if (isSyncing && transactions.length === 0) {
      return (
        <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Syncing your data...</Text>
        </View>
      );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isSyncing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.header}>Monthly Summary</Text>
      
      <View style={styles.budgetSection}>
        <View style={styles.budgetHeader}>
          <Text style={styles.subHeader}>Budget</Text>
          <Link href="/set-budget" asChild>
            <Button title={monthlyBudget > 0 ? "Edit Budget" : "Set Budget"} />
          </Link>
        </View>
        
        {monthlyBudget > 0 ? (
          <View style={styles.budgetContainer}>
            <View style={styles.budgetTextContainer}>
              <Text style={styles.budgetText}>Spent: ₹{totalExpenses.toFixed(2)}</Text>
              <Text style={styles.budgetText}>Budget: ₹{monthlyBudget.toFixed(2)}</Text>
            </View>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progressWidth}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {budgetProgress.toFixed(1)}% of budget used
            </Text>
          </View>
        ) : (
          <Text style={styles.noDataText}>No budget set for this month.</Text>
        )}
      </View>
      
      <Text style={styles.header}>Spending Breakdown</Text>
      {chartData.length > 0 ? (
        <>
          <Text style={styles.totalText}>Total Spent: ₹{totalExpenses.toFixed(2)}</Text>
          <PieChart
            data={chartData}
            width={screenWidth - 16}
            height={220}
            chartConfig={{ color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})` }}
            accessor={"amount"}
            backgroundColor={"transparent"}
            paddingLeft={"15"}
            absolute
          />
        </>
      ) : (
        <Text style={styles.noDataText}>No expense data to display.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loaderContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#f5f5f5'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginVertical: 20 },
  subHeader: { fontSize: 18, fontWeight: '600' },
  totalText: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 10, color: '#333' },
  noDataText: { textAlign: 'center', paddingVertical: 20, fontSize: 16, color: 'gray' },
  budgetSection: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    marginHorizontal: 8,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  budgetContainer: {},
  budgetTextContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  budgetText: { fontSize: 16, color: '#555' },
  progressBarBackground: { height: 20, width: '100%', backgroundColor: '#e0e0e0', borderRadius: 10, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 10 },
  progressText: { 
    fontSize: 14, 
    color: '#666', 
    textAlign: 'center', 
    marginTop: 5 
  },
});