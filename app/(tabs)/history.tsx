import { FontAwesome } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Platform,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SearchBar } from '../../components/SearchBar';
import { useAppData } from '../../context/AppContext';
import { Transaction } from '../../database';

interface TransactionSection {
  title: string;
  total: number;
  data: Transaction[];
  isCollapsed?: boolean;
}

export default function HistoryScreen() {
  const { transactions, isSyncing, triggerFullSync } = useAppData();
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const sections = useMemo(() => {
    const filteredTransactions = transactions.filter(tx =>
      tx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.notes.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const grouped = filteredTransactions.reduce((acc, tx) => {
      const monthYear = new Date(tx.date).toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!acc[monthYear]) {
        acc[monthYear] = { total: 0, data: [] };
      }
      acc[monthYear].data.push(tx);
      acc[monthYear].total += tx.amount;
      return acc;
    }, {} as { [key: string]: { total: number, data: Transaction[] } });
    
    return Object.keys(grouped)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime()) // Sort by date descending
      .map(monthYear => ({
        title: monthYear,
        total: grouped[monthYear].total,
        data: collapsedSections.has(monthYear) ? [] : grouped[monthYear].data,
        isCollapsed: collapsedSections.has(monthYear),
        originalDataCount: grouped[monthYear].data.length
      }));
  }, [transactions, searchQuery, collapsedSections]);

  const toggleSection = (sectionTitle: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionTitle)) {
        newSet.delete(sectionTitle);
      } else {
        newSet.add(sectionTitle);
      }
      return newSet;
    });
  };

  const onRefresh = async () => {
    await triggerFullSync();
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

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.uuid}
        refreshControl={
          <RefreshControl 
            refreshing={isSyncing} 
            onRefresh={onRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
        renderSectionHeader={({ section }) => (
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => toggleSection(section.title)}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderContent}>
              <View style={styles.sectionTitleContainer}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.transactionCount}>
                  {section.originalDataCount} transaction{section.originalDataCount !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.sectionRightContent}>
                <Text style={[
                  styles.sectionTotal,
                  { color: section.total < 0 ? '#FF3B30' : '#34C759' }
                ]}>
                  {formatAmount(Math.abs(section.total))}
                </Text>
                <FontAwesome 
                  name={section.isCollapsed ? 'chevron-down' : 'chevron-up'} 
                  size={14} 
                  color="#666" 
                  style={styles.chevronIcon}
                />
              </View>
            </View>
          </TouchableOpacity>
        )}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={[styles.itemIcon, { backgroundColor: getCategoryColor(item.category) }]}>
              <FontAwesome 
                name={getCategoryIcon(item.category)} 
                size={18} 
                color="white" 
              />
            </View>
            <View style={styles.itemDetails}>
              <Text style={styles.itemCategory}>{item.category}</Text>
              <Text style={styles.itemNotes} numberOfLines={1}>
                {item.notes || 'No description'}
              </Text>
              <Text style={styles.itemDate}>
                {new Date(item.date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short'
                })}
              </Text>
            </View>
            <View style={styles.itemAmountContainer}>
              <Text style={styles.itemAmount}>
                {formatAmount(item.amount)}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome name="search" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No transactions found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try adjusting your search terms' : 'Start adding transactions to see them here'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={true}
      />
    </View>
  );
}

const getCategoryColor = (category: string) => {
  const colors = ['#007AFF', '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#5AC8FA', '#AF52DE', '#FF2D92'];
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8f9fa' 
  },
  searchContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  sectionHeader: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1d1d1f',
    marginBottom: 2,
  },
  transactionCount: {
    fontSize: 12,
    color: '#8e8e93',
    fontWeight: '500',
  },
  sectionRightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTotal: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  itemCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1d1d1f',
    marginBottom: 2,
  },
  itemNotes: {
    fontSize: 14,
    color: '#8e8e93',
    marginBottom: 2,
    lineHeight: 18,
  },
  itemDate: {
    fontSize: 12,
    color: '#c7c7cc',
    fontWeight: '500',
  },
  itemAmountContainer: {
    alignItems: 'flex-end',
  },
  itemAmount: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8e8e93',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#c7c7cc',
    textAlign: 'center',
    lineHeight: 22,
  },
});