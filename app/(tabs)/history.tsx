// In app/(tabs)/history.tsx

import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import {
  LayoutAnimation,
  RefreshControl,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

// Import your themed components and hooks
import { SearchBar } from '../../components/SearchBar';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useAppData } from '../../context/AppContext';
import { Transaction } from '../../database';
import { useThemeColor } from '../../hooks/use-theme-color';

interface TransactionSection {
  title: string;
  total: number;
  data: Transaction[];
  originalData: Transaction[];
}

export default function HistoryScreen() {
  const { transactions, isSyncing, triggerFullSync } = useAppData();
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const theme = useColorScheme() ?? 'light';

  // Fetch all necessary colors from the theme once
  const cardColor = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');
  const separatorColor = useThemeColor({}, 'background');

  // Your data processing logic remains unchanged
  const sections = useMemo(() => {
    // ... (logic remains the same)
    const filteredTransactions = transactions.filter(tx =>
      tx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.notes && tx.notes.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    const grouped = filteredTransactions.reduce((acc, tx) => {
      const monthYear = new Date(tx.date).toLocaleString('en-US', { month: 'long', year: 'numeric' });
      if (!acc[monthYear]) {
        acc[monthYear] = { total: 0, data: [] };
      }
      acc[monthYear].data.push(tx);
      acc[monthYear].total += tx.amount;
      return acc;
    }, {} as { [key: string]: { total: number, data: Transaction[] } });
    const sortedKeys = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return sortedKeys.map(monthYear => ({
      title: monthYear,
      total: grouped[monthYear].total,
      data: collapsedSections.has(monthYear) ? [] : grouped[monthYear].data,
      originalData: grouped[monthYear].data,
    }));
  }, [transactions, searchQuery, collapsedSections]);

  const toggleSection = (sectionTitle: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
    // ... (function remains the same)
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('food')) return 'shopping-bag';
    if (categoryLower.includes('transport')) return 'truck';
    if (categoryLower.includes('shopping')) return 'shopping-cart';
    if (categoryLower.includes('entertainment')) return 'film';
    if (categoryLower.includes('health')) return 'heart';
    if (categoryLower.includes('bill')) return 'file-text';
    return 'trending-down';
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount).replace('₹', '₹ ');
  };

  const renderTransactionItem = ({ item, index, section }: { item: Transaction, index: number, section: any }) => {
    const isLastItem = index === section.data.length - 1;
    return (
      <View style={[styles.item, { backgroundColor: cardColor }, isLastItem && styles.lastItem]}>
        <ThemedView style={styles.itemIcon}>
          <Feather 
            name={getCategoryIcon(item.category)} 
            size={20} 
            color={textColor}
          />
        </ThemedView>
        <View style={styles.itemDetails}>
          <ThemedText style={styles.itemCategory}>{item.category}</ThemedText>
          <ThemedText style={[styles.itemDate, { color: secondaryTextColor }]} numberOfLines={1}>
            {item.notes || new Date(item.date).toLocaleDateString('en-IN', { weekday: 'long' })}
          </ThemedText>
        </View>
        <ThemedText style={styles.itemAmount}>
          {formatAmount(item.amount)}
        </ThemedText>
      </View>
    );
  };
  
  return (
    <ThemedView style={styles.container}>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />

      {/* Custom Header */}
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>History</ThemedText>
      </View>
      
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.uuid}
        ListHeaderComponent={
          <View style={styles.searchContainer}>
            {/* Assuming SearchBar is or will be made theme-aware */}
            <SearchBar placeholder="Search transactions..." value={searchQuery} onChangeText={setSearchQuery} />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <TouchableOpacity 
            style={[styles.sectionHeader, { backgroundColor: cardColor, borderBottomColor: separatorColor }]}
            onPress={() => toggleSection(section.title)}
            activeOpacity={0.8}
          >
            <View>
              <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
              <ThemedText style={[styles.sectionSubTitle, { color: secondaryTextColor }]}>
                {section.originalData.length} transaction{section.originalData.length !== 1 ? 's' : ''}
              </ThemedText>
            </View>
            <View style={styles.sectionRightContent}>
              <ThemedText style={styles.sectionTotal}>{formatAmount(section.total)}</ThemedText>
              <Feather 
                name={collapsedSections.has(section.title) ? 'chevron-down' : 'chevron-up'} 
                size={20} 
                color={secondaryTextColor}
              />
            </View>
          </TouchableOpacity>
        )}
        renderItem={renderTransactionItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="search" size={48} color={secondaryTextColor} style={{ opacity: 0.5 }}/>
            <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>No Transactions Found</ThemedText>
            <ThemedText style={[styles.emptySubtext, { color: secondaryTextColor }]}>
              {searchQuery ? 'Try a different search term.' : 'Your transaction history is empty.'}
            </ThemedText>
          </View>
        }
        contentContainerStyle={styles.listContentContainer}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={isSyncing} 
            onRefresh={onRefresh}
            tintColor={textColor}
          />
        }
      />
    </ThemedView>
  );
}

// Styles now only contain layout and typography, no colors.
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  listContentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  searchContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionSubTitle: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionRightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTotal: {
    fontSize: 16,
    fontWeight: '500',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    // borderBottomWidth will be applied dynamically
  },
  lastItem: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 16,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  itemDetails: {
    flex: 1,
  },
  itemCategory: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemDate: {
    fontSize: 14,
    marginTop: 2,
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});