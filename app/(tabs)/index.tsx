import { FontAwesome } from "@expo/vector-icons";
import { Link } from "expo-router";
import React, { useMemo } from "react";
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
} from "react-native";
import { useAppData } from "../../context/AppContext";

const { width } = Dimensions.get('window');

export default function OverviewScreen() {
  const { transactions, budgets, isSyncing, triggerFullSync } = useAppData();

  const { 
    monthlyTotal, 
    budgetLeft, 
    hasTransactionsThisMonth, 
    budgetAmount,
    budgetPercentage,
    recentTransactions 
  } = useMemo(() => {
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
    
    // Get recent transactions (last 3)
    const recent = transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);

    return {
      monthlyTotal: total,
      budgetLeft: budgetAmount - total,
      budgetAmount,
      budgetPercentage: budgetAmount > 0 ? (total / budgetAmount) * 100 : 0,
      hasTransactionsThisMonth: transactionsThisMonth.length > 0,
      recentTransactions: recent
    };
  }, [transactions, budgets]);

  const onRefresh = async () => {
    await triggerFullSync();
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getProgressColor = () => {
    if (budgetPercentage <= 50) return '#34C759';
    if (budgetPercentage <= 80) return '#FF9500';
    return '#FF3B30';
  };

  const getCategoryIcon = (category: string) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('food') || categoryLower.includes('restaurant')) return 'cutlery';
    if (categoryLower.includes('transport') || categoryLower.includes('fuel')) return 'car';
    if (categoryLower.includes('shopping') || categoryLower.includes('grocery')) return 'shopping-cart';
    if (categoryLower.includes('entertainment') || categoryLower.includes('movie')) return 'film';
    if (categoryLower.includes('health') || categoryLower.includes('medical')) return 'heartbeat';
    if (categoryLower.includes('bill') || categoryLower.includes('utility')) return 'file-text-o';
    return 'money';
  };

  if (isSyncing && transactions.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <View style={styles.loaderContent}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading your data...</Text>
          <Text style={styles.loadingSubText}>This won't take long</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.container}
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
      {hasTransactionsThisMonth ? (
        <>
          {/* Main Balance Card */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceLabel}>Total Spent</Text>
              <View style={styles.monthBadge}>
                <Text style={styles.monthText}>
                  {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </Text>
              </View>
            </View>
            
            <Text style={styles.totalAmount}>{formatAmount(monthlyTotal)}</Text>
            
            {budgetAmount > 0 && (
              <View style={styles.budgetSection}>
                <View style={styles.budgetInfo}>
                  <Text style={styles.budgetLeft}>
                    {budgetLeft > 0 ? formatAmount(budgetLeft) : formatAmount(Math.abs(budgetLeft))} 
                    {budgetLeft > 0 ? ' remaining' : ' over budget'}
                  </Text>
                  <Text style={styles.budgetTotal}>of {formatAmount(budgetAmount)}</Text>
                </View>
                
                {/* Budget Progress Bar */}
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBarTrack}>
                    <View 
                      style={[
                        styles.progressBarFill, 
                        { 
                          width: `${Math.min(budgetPercentage, 100)}%`,
                          backgroundColor: getProgressColor() 
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressPercentage}>
                    {budgetPercentage.toFixed(0)}%
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Quick Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <FontAwesome name="calendar" size={20} color="#007AFF" />
              <Text style={styles.statValue}>
                {transactions.filter(tx => {
                  const txDate = new Date(tx.date);
                  const today = new Date();
                  return txDate.getMonth() === today.getMonth() && 
                         txDate.getFullYear() === today.getFullYear();
                }).length}
              </Text>
              <Text style={styles.statLabel}>This Month</Text>
            </View>

            <View style={styles.statCard}>
              <FontAwesome name="clock-o" size={20} color="#34C759" />
              <Text style={styles.statValue}>
                {transactions.filter(tx => {
                  const txDate = new Date(tx.date);
                  const today = new Date();
                  const diffTime = Math.abs(today.getTime() - txDate.getTime());
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  return diffDays <= 7;
                }).length}
              </Text>
              <Text style={styles.statLabel}>Last 7 Days</Text>
            </View>

            <View style={styles.statCard}>
              <FontAwesome name="line-chart" size={20} color="#FF9500" />
              <Text style={styles.statValue}>
                {formatAmount(monthlyTotal / Math.max(1, new Date().getDate())).replace('₹', '₹')}
              </Text>
              <Text style={styles.statLabel}>Daily Avg</Text>
            </View>
          </View>

          {/* Recent Transactions */}
          {recentTransactions.length > 0 && (
            <View style={styles.recentCard}>
              <View style={styles.recentHeader}>
                <Text style={styles.recentTitle}>Recent Transactions</Text>
                <Link href="/history" asChild>
                  <Pressable style={styles.viewAllButton}>
                    <Text style={styles.viewAllText}>View All</Text>
                    <FontAwesome name="arrow-right" size={12} color="#007AFF" />
                  </Pressable>
                </Link>
              </View>

              {recentTransactions.map((transaction, index) => (
                <View key={transaction.uuid} style={styles.transactionItem}>
                  <View style={styles.transactionIcon}>
                    <FontAwesome 
                      name={getCategoryIcon(transaction.category)} 
                      size={16} 
                      color="#666" 
                    />
                  </View>
                  <View style={styles.transactionDetails}>
                    <Text style={styles.transactionCategory}>{transaction.category}</Text>
                    <Text style={styles.transactionDate}>
                      {new Date(transaction.date).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </Text>
                  </View>
                  <Text style={styles.transactionAmount}>
                    {formatAmount(transaction.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <View style={styles.noDataContainer}>
          <View style={styles.noDataContent}>
            <View style={styles.noDataIconContainer}>
              <FontAwesome name="line-chart" size={64} color="#E5E5EA" />
            </View>
            <Text style={styles.noDataText}>No transactions yet</Text>
            <Text style={styles.noDataSubText}>
              Start tracking your expenses to see your spending overview
            </Text>
            <View style={styles.tipsContainer}>
              <Text style={styles.tipsTitle}>💡 Quick Tips:</Text>
              <Text style={styles.tipsText}>• Tap the + button to add your first expense</Text>
              <Text style={styles.tipsText}>• Pull down to refresh your data</Text>
              <Text style={styles.tipsText}>• Set monthly budgets to track your goals</Text>
            </View>
          </View>
        </View>
      )}

      {/* Enhanced FAB */}
      <Link href="/add-expense" asChild>
        <Pressable style={styles.fab}>
          <FontAwesome name="plus" size={24} color="white" />
        </Pressable>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: "#F8F9FA",
  },
  loaderContent: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#1D1D1F',
  },
  loadingSubText: {
    marginTop: 4,
    fontSize: 14,
    color: '#8E8E93',
  },
  balanceCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
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
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  monthBadge: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  monthText: {
    fontSize: 12,
    color: '#1D1D1F',
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: '#1D1D1F',
    marginBottom: 16,
  },
  budgetSection: {
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    paddingTop: 16,
  },
  budgetInfo: {
    marginBottom: 12,
  },
  budgetLeft: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
  },
  budgetTotal: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 4,
    marginRight: 12,
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1D1D1F',
    minWidth: 40,
    textAlign: 'right',
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1D1D1F',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    textAlign: 'center',
  },
  recentCard: {
    backgroundColor: 'white',
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
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  recentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1D1D1F',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewAllText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  transactionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionCategory: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1D1D1F',
  },
  transactionDate: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noDataContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  noDataIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  noDataText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 8,
    textAlign: 'center',
  },
  noDataSubText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  tipsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
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
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 12,
  },
  tipsText: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 4,
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});