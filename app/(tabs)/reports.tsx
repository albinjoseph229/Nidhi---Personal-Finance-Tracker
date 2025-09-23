import { FontAwesome } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { useAppData } from '../../context/AppContext';

interface ChartData {
  name: string;
  amount: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
}

interface MonthlyData {
  month: string;
  amount: number;
  transactions: number;
}

const screenWidth = Dimensions.get('window').width;

// Category grouping mapping
const CATEGORY_GROUPS = {
  'Food & Dining': ['Food', 'Restaurant', 'Groceries', 'Dining'],
  'Transportation': ['Transport', 'Fuel', 'Car', 'Taxi', 'Bus', 'Auto'],
  'Shopping': ['Shopping', 'Clothing', 'Electronics', 'Online Shopping'],
  'Bills & Utilities': ['Bills', 'Electricity', 'Water', 'Internet', 'Phone'],
  'Health & Medical': ['Health', 'Medical', 'Pharmacy', 'Doctor', 'Hospital'],
  'Entertainment': ['Leisure', 'Entertainment', 'Movies', 'Games', 'Sports'],
  'Home & Garden': ['Home', 'Furniture', 'Garden', 'Maintenance'],
  'Education': ['Education', 'Books', 'Courses', 'School', 'College'],
  'Others': ['Other', 'Miscellaneous', 'Cash', 'ATM']
};

const CHART_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', 
  '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF3838',
  '#FF6348', '#2ED573', '#3742FA', '#70A1FF', '#5352ED'
];

type ViewMode = 'current' | 'yearly' | 'monthly';
type ChartType = 'pie' | 'bar' | 'line';

export default function ReportsScreen() {
  const { transactions, budgets, isSyncing, triggerFullSync } = useAppData();
  const [viewMode, setViewMode] = useState<ViewMode>('current');
  const [chartType, setChartType] = useState<ChartType>('pie');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Group categories function
  const groupCategory = (category: string): string => {
    for (const [group, categories] of Object.entries(CATEGORY_GROUPS)) {
      if (categories.some(cat => 
        category.toLowerCase().includes(cat.toLowerCase()) ||
        cat.toLowerCase().includes(category.toLowerCase())
      )) {
        return group;
      }
    }
    return 'Others';
  };

  const { 
    currentMonthData, 
    yearlyData, 
    monthlyTrends, 
    totalExpenses, 
    monthlyBudget,
    availableYears 
  } = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Get available years from transactions
    const years = [...new Set(transactions.map(tx => new Date(tx.date).getFullYear()))].sort((a, b) => b - a);

    // Current month data
    const currentMonthTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear && tx.amount > 0;
    });

    const currentMonthTotal = currentMonthTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const currentMonthByCategory = currentMonthTransactions.reduce((acc, tx) => {
      const group = groupCategory(tx.category);
      acc[group] = (acc[group] || 0) + tx.amount;
      return acc;
    }, {} as { [key: string]: number });

    const currentMonthChartData = Object.keys(currentMonthByCategory).map((group, index) => ({
      name: group,
      amount: currentMonthByCategory[group],
      color: CHART_COLORS[index % CHART_COLORS.length],
      legendFontColor: '#7F7F7F',
      legendFontSize: 12,
    }));

    // Yearly data for selected year
    const yearlyTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getFullYear() === selectedYear && tx.amount > 0;
    });

    const yearlyTotal = yearlyTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const yearlyByCategory = yearlyTransactions.reduce((acc, tx) => {
      const group = groupCategory(tx.category);
      acc[group] = (acc[group] || 0) + tx.amount;
      return acc;
    }, {} as { [key: string]: number });

    const yearlyChartData = Object.keys(yearlyByCategory).map((group, index) => ({
      name: group,
      amount: yearlyByCategory[group],
      color: CHART_COLORS[index % CHART_COLORS.length],
      legendFontColor: '#7F7F7F',
      legendFontSize: 12,
    }));

    // Monthly trends for the year
    const monthlyData: MonthlyData[] = [];
    for (let month = 0; month < 12; month++) {
      const monthTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate.getMonth() === month && 
               txDate.getFullYear() === selectedYear && 
               tx.amount > 0;
      });
      
      const monthTotal = monthTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      
      monthlyData.push({
        month: new Date(selectedYear, month, 1).toLocaleString('default', { month: 'short' }),
        amount: monthTotal,
        transactions: monthTransactions.length
      });
    }

    // Budget info
    const currentMonthYear = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const budget = budgets.find(b => b.monthYear === currentMonthYear);

    return {
      currentMonthData: currentMonthChartData,
      yearlyData: yearlyChartData,
      monthlyTrends: monthlyData,
      totalExpenses: viewMode === 'current' ? currentMonthTotal : yearlyTotal,
      monthlyBudget: budget?.amount || 0,
      availableYears: years
    };
  }, [transactions, budgets, viewMode, selectedYear]);

  const getCurrentChartData = () => {
    switch (viewMode) {
      case 'current':
        return currentMonthData;
      case 'yearly':
        return yearlyData;
      default:
        return currentMonthData;
    }
  };

  const getBarChartData = () => {
    if (viewMode === 'monthly') {
      return {
        labels: monthlyTrends.map(m => m.month),
        datasets: [{
          data: monthlyTrends.map(m => m.amount)
        }]
      };
    }
    
    const data = getCurrentChartData();
    return {
      labels: data.slice(0, 6).map(item => item.name.split(' ')[0]), // Shortened labels
      datasets: [{
        data: data.slice(0, 6).map(item => item.amount)
      }]
    };
  };

  const budgetProgress = monthlyBudget > 0 ? (totalExpenses / monthlyBudget) * 100 : 0;
  const progressWidth = Math.min(budgetProgress, 100);

  const onRefresh = async () => {
    await triggerFullSync();
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isSyncing && transactions.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Syncing your data...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl 
          refreshing={isSyncing} 
          onRefresh={onRefresh}
          colors={['#007AFF']}
          tintColor="#007AFF"
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reports & Analytics</Text>
        <Text style={styles.headerSubtitle}>Track your spending patterns</Text>
      </View>

      {/* View Mode Selector */}
      <View style={styles.selectorCard}>
        <Text style={styles.selectorTitle}>Time Period</Text>
        <View style={styles.viewModeSelector}>
          {[
            { key: 'current', label: 'This Month', icon: 'calendar' },
            { key: 'yearly', label: `${selectedYear}`, icon: 'calendar-o' },
            { key: 'monthly', label: 'Monthly Trend', icon: 'line-chart' }
          ].map(mode => (
            <Pressable
              key={mode.key}
              style={[
                styles.viewModeButton,
                viewMode === mode.key && styles.viewModeButtonActive
              ]}
              onPress={() => setViewMode(mode.key as ViewMode)}
            >
              <FontAwesome 
                name={mode.icon as any} 
                size={14} 
                color={viewMode === mode.key ? 'white' : '#007AFF'} 
              />
              <Text style={[
                styles.viewModeText,
                viewMode === mode.key && styles.viewModeTextActive
              ]}>
                {mode.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Year Selector */}
        {(viewMode === 'yearly' || viewMode === 'monthly') && (
          <View style={styles.yearSelector}>
            <Text style={styles.yearSelectorTitle}>Year:</Text>
            <View style={styles.yearButtons}>
              {availableYears.map(year => (
                <Pressable
                  key={year}
                  style={[
                    styles.yearButton,
                    selectedYear === year && styles.yearButtonActive
                  ]}
                  onPress={() => setSelectedYear(year)}
                >
                  <Text style={[
                    styles.yearButtonText,
                    selectedYear === year && styles.yearButtonTextActive
                  ]}>
                    {year}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Budget Section (only for current month) */}
      {viewMode === 'current' && (
        <View style={styles.budgetCard}>
          <View style={styles.budgetHeader}>
            <Text style={styles.budgetTitle}>Monthly Budget</Text>
            <Link href="/set-budget" asChild>
              <Pressable style={styles.budgetButton}>
                <FontAwesome name="edit" size={14} color="#007AFF" />
                <Text style={styles.budgetButtonText}>
                  {monthlyBudget > 0 ? "Edit" : "Set Budget"}
                </Text>
              </Pressable>
            </Link>
          </View>
          
          {monthlyBudget > 0 ? (
            <View style={styles.budgetContent}>
              <View style={styles.budgetStats}>
                <View style={styles.budgetStat}>
                  <Text style={styles.budgetStatLabel}>Spent</Text>
                  <Text style={styles.budgetStatValue}>{formatAmount(totalExpenses)}</Text>
                </View>
                <View style={styles.budgetStat}>
                  <Text style={styles.budgetStatLabel}>Budget</Text>
                  <Text style={styles.budgetStatValue}>{formatAmount(monthlyBudget)}</Text>
                </View>
                <View style={styles.budgetStat}>
                  <Text style={styles.budgetStatLabel}>Remaining</Text>
                  <Text style={[
                    styles.budgetStatValue,
                    { color: monthlyBudget - totalExpenses >= 0 ? '#34C759' : '#FF3B30' }
                  ]}>
                    {formatAmount(Math.abs(monthlyBudget - totalExpenses))}
                  </Text>
                </View>
              </View>
              
              <View style={styles.progressContainer}>
                <View style={styles.progressBarBackground}>
                  <View style={[
                    styles.progressBarFill, 
                    { 
                      width: `${progressWidth}%`,
                      backgroundColor: budgetProgress > 100 ? '#FF3B30' : budgetProgress > 80 ? '#FF9500' : '#34C759'
                    }
                  ]} />
                </View>
                <Text style={styles.progressText}>
                  {budgetProgress.toFixed(1)}% used
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.noBudgetContainer}>
              <FontAwesome name="info-circle" size={20} color="#8E8E93" />
              <Text style={styles.noBudgetText}>Set a monthly budget to track your progress</Text>
            </View>
          )}
        </View>
      )}

      {/* Chart Type Selector */}
      {viewMode !== 'monthly' && (
        <View style={styles.chartTypeCard}>
          <Text style={styles.chartTypeTitle}>Chart Type</Text>
          <View style={styles.chartTypeSelector}>
            {[
              { key: 'pie', label: 'Pie Chart', icon: 'pie-chart' },
              { key: 'bar', label: 'Bar Chart', icon: 'bar-chart' }
            ].map(type => (
              <Pressable
                key={type.key}
                style={[
                  styles.chartTypeButton,
                  chartType === type.key && styles.chartTypeButtonActive
                ]}
                onPress={() => setChartType(type.key as ChartType)}
              >
                <FontAwesome 
                  name={type.icon as any} 
                  size={12} 
                  color={chartType === type.key ? 'white' : '#007AFF'} 
                />
                <Text style={[
                  styles.chartTypeText,
                  chartType === type.key && styles.chartTypeTextActive
                ]}>
                  {type.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Summary Stats */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>
          {viewMode === 'current' ? 'This Month' : 
           viewMode === 'yearly' ? `${selectedYear} Summary` : 
           `${selectedYear} Monthly Trend`}
        </Text>
        <Text style={styles.totalAmount}>{formatAmount(totalExpenses)}</Text>
        
        {viewMode !== 'monthly' && (
          <View style={styles.categoryStats}>
            <Text style={styles.categoryStatsTitle}>Top Categories</Text>
            {getCurrentChartData().slice(0, 3).map((item, index) => (
              <View key={item.name} style={styles.categoryStatItem}>
                <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                <Text style={styles.categoryName}>{item.name}</Text>
                <Text style={styles.categoryAmount}>{formatAmount(item.amount)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Charts */}
      <View style={styles.chartCard}>
        {getCurrentChartData().length > 0 || viewMode === 'monthly' ? (
          <>
            {viewMode === 'monthly' ? (
              <LineChart
                data={{
                  labels: monthlyTrends.map(m => m.month),
                  datasets: [{
                    data: monthlyTrends.map(m => m.amount),
                    strokeWidth: 3
                  }]
                }}
                width={screenWidth - 40}
                height={220}
                chartConfig={{
                  backgroundColor: 'white',
                  backgroundGradientFrom: 'white',
                  backgroundGradientTo: 'white',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForLabels: { fontSize: 10 }
                }}
                bezier
                style={styles.chart}
              />
            ) : chartType === 'pie' ? (
              <PieChart
                data={getCurrentChartData()}
                width={screenWidth - 40}
                height={220}
                chartConfig={{ color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})` }}
                accessor="amount"
                backgroundColor="white"
                paddingLeft="15"
                absolute
                style={styles.chart}
              />
            ) : (
              <BarChart
                data={getBarChartData()}
                width={screenWidth - 40}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{
                  backgroundColor: 'white',
                  backgroundGradientFrom: 'white',
                  backgroundGradientTo: 'white',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForLabels: { fontSize: 10 }
                }}
                style={styles.chart}
              />
            )}
          </>
        ) : (
          <View style={styles.noDataContainer}>
            <FontAwesome name="pie-chart" size={48} color="#E5E5EA" />
            <Text style={styles.noDataText}>No expense data to display</Text>
            <Text style={styles.noDataSubtext}>
              Add some transactions to see your spending patterns
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8F9FA' 
  },
  loaderContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#F8F9FA'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1D1D1F',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  selectorCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 12,
  },
  viewModeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 4,
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  viewModeButtonActive: {
    backgroundColor: '#007AFF',
  },
  viewModeText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  viewModeTextActive: {
    color: 'white',
  },
  // --- IMPROVED STYLES START HERE ---
  yearSelector: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  yearSelectorTitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  yearButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    flex: 1,
  },
  // --- IMPROVED STYLES END HERE ---
  yearButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  yearButtonActive: {
    backgroundColor: '#007AFF',
  },
  yearButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  yearButtonTextActive: {
    color: 'white',
  },
  budgetCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  budgetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1D1D1F',
  },
  budgetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF20',
    borderRadius: 8,
  },
  budgetButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  budgetContent: {},
  budgetStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  budgetStat: {
    alignItems: 'center',
    flex: 1,
  },
  budgetStatLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 4,
  },
  budgetStatValue: {
    fontSize: 16,
    color: '#1D1D1F',
    fontWeight: '700',
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressBarBackground: { 
    height: 8, 
    width: '100%', 
    backgroundColor: '#F2F2F7', 
    borderRadius: 4, 
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: { 
    height: '100%', 
    borderRadius: 4 
  },
  progressText: { 
    fontSize: 12, 
    color: '#8E8E93',
    fontWeight: '500',
  },
  noBudgetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  noBudgetText: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
  },
  chartTypeCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  chartTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 12,
  },
  chartTypeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 4,
  },
  chartTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  chartTypeButtonActive: {
    backgroundColor: '#007AFF',
  },
  chartTypeText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  chartTypeTextActive: {
    color: 'white',
  },
  summaryCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  summaryTitle: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1D1D1F',
    marginBottom: 20,
  },
  categoryStats: {
    width: '100%',
  },
  // --- IMPROVED STYLE START HERE ---
  categoryStatsTitle: {
    fontSize: 14,
    color: '#1D1D1F',
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'left',
    width: '100%',
  },
  // --- IMPROVED STYLE END HERE ---
  categoryStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  categoryName: {
    flex: 1,
    fontSize: 14,
    color: '#1D1D1F',
    fontWeight: '500',
  },
  categoryAmount: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
  },
  chartCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  chart: {
    borderRadius: 16,
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noDataText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
    marginBottom: 8,
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    textAlign: 'center',
  },
});