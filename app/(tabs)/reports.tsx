import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@react-navigation/native'; // 👈 1. Import the useTheme hook
import axios from 'axios';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PieChart } from 'react-native-chart-kit';

import { API_KEY, API_URL } from '../../config';
import { useData } from '../context/DataContext';

// ... ChartData interface remains the same

const screenWidth = Dimensions.get('window').width;

export default function ReportsScreen() {
  const theme = useTheme(); // 👈 2. Get the current theme object
  const { transactions, loading } = useData();
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [isBudgetLoading, setIsBudgetLoading] = useState(true);

  const { chartData, totalExpenses } = useMemo(() => {
    let total = 0;
    const spendingByCategory = transactions
      .filter(t => t.Type === 'Expense' && t.Amount > 0)
      .reduce((acc, transaction) => {
        const { Category, Amount } = transaction;
        total += Amount;
        acc[Category] = (acc[Category] || 0) + Amount;
        return acc;
      }, {} as { [key: string]: number });

    const formattedChartData = Object.keys(spendingByCategory).map(category => ({
      name: category,
      amount: spendingByCategory[category],
      color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
      legendFontColor: theme.colors.text, // 👈 3. Use theme color for the chart legend
      legendFontSize: 15,
    }));
    
    return { chartData: formattedChartData, totalExpenses: total };
  }, [transactions, theme]); // Add theme to dependency array

  // ... fetchBudget function remains the same

  // --- No changes to the data fetching logic ---
  const fetchBudget = async () => {
    setIsBudgetLoading(true);
    const date = new Date();
    const currentMonthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const BUDGET_CACHE_KEY = `budget-${currentMonthYear}`;

    try {
      const cachedBudget = await AsyncStorage.getItem(BUDGET_CACHE_KEY);
      if (cachedBudget) {
        setMonthlyBudget(JSON.parse(cachedBudget));
      }
      const budgetResponse = await axios.get(`${API_URL}?apiKey=${API_KEY}&action=getBudget&monthYear=${currentMonthYear}`);
      
      if (budgetResponse.data.status === "success") {
        const fetchedBudget = budgetResponse.data.data.budget;
        if (fetchedBudget !== monthlyBudget) {
          setMonthlyBudget(fetchedBudget);
          await AsyncStorage.setItem(BUDGET_CACHE_KEY, JSON.stringify(fetchedBudget));
        }
      }
    } catch (error) {
      console.error("Failed to fetch budget:", error);
    } finally {
      setIsBudgetLoading(false);
    }
  };
  useFocusEffect(useCallback(() => { fetchBudget(); }, []));
  // --- End of data fetching logic ---

  const budgetProgress = monthlyBudget > 0 ? (totalExpenses / monthlyBudget) * 100 : 0;
  const progressWidth = Math.min(budgetProgress, 100);

  // Here we pass the theme to our new dynamic styles function
  const styles = getThemedStyles(theme);

  if (loading && transactions.length === 0) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Monthly Summary</Text>
      
      {isBudgetLoading && monthlyBudget === 0 ? (
        <ActivityIndicator style={{ marginVertical: 20 }} />
      ) : monthlyBudget > 0 ? (
        <View style={styles.budgetContainer}>
          <View style={styles.budgetTextContainer}>
            <Text style={styles.budgetText}>Spent: ₹{totalExpenses.toFixed(2)}</Text>
            <Text style={styles.budgetText}>Budget: ₹{monthlyBudget.toFixed(2)}</Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progressWidth}%` }]} />
          </View>
        </View>
      ) : (
         <Text style={styles.noDataText}>No budget set for this month.</Text>
      )}

      <Text style={styles.header}>Spending Breakdown</Text>
      {chartData.length > 0 ? (
        <PieChart
          data={chartData}
          width={screenWidth - 16}
          height={220}
          chartConfig={{
            color: (opacity = 1) => theme.colors.text, // Use theme color for chart
          }}
          accessor={"amount"}
          backgroundColor={"transparent"}
          paddingLeft={"15"}
          absolute
        />
      ) : (
        <Text style={styles.noDataText}>No expense data to display.</Text>
      )}
    </ScrollView>
  );
}

// 👇 4. Create a function that generates styles based on the theme
const getThemedStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background, // Use theme background color
    padding: 8,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: theme.colors.text, // Use theme text color
  },
  noDataText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: 'gray', // Gray often works for both themes, but theme.colors.border is another option
  },
  budgetContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  budgetTextContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  budgetText: {
    fontSize: 16,
    color: theme.colors.text, // Use theme text color
  },
  progressBarBackground: {
    height: 20,
    width: '100%',
    backgroundColor: theme.colors.border, // Use a neutral theme color
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50', // A brand color, often kept the same in both modes
    borderRadius: 10,
  },
});