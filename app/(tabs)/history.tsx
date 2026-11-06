// In app/(tabs)/history.tsx

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
// Import Layout from Reanimated
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';

// ... (rest of your imports are the same)
import { SearchBar } from '../../components/SearchBar';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useAppData } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Transaction } from '../../database';
import { useThemeColor } from '../../hooks/use-theme-color';

export default function HistoryScreen() {
  // ... (all your existing state, hooks, and memos are correct)
  const router = useRouter();
  const { transactions, isSyncing, triggerUploadSync } = useAppData();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const { theme, accentColor } = useTheme();

  const cardColor = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');
  const separatorColor = useThemeColor({}, 'background');

  const processedData = useMemo(() => {
    // ... (no changes here)
    const filteredTransactions = transactions.filter(
      (tx) =>
        tx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.notes && tx.notes.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const grouped = filteredTransactions.reduce(
      (acc, tx) => {
        const monthYear = new Date(tx.date).toLocaleString('en-US', {
          month: 'long',
          year: 'numeric',
        });
        if (!acc[monthYear]) {
          acc[monthYear] = { totalIncome: 0, totalExpenses: 0, data: [] };
        }

        if (tx.type === 'income') {
          acc[monthYear].totalIncome += tx.amount;
        } else {
          acc[monthYear].totalExpenses += tx.amount;
        }
        acc[monthYear].data.push(tx);

        return acc;
      },
      {} as { [key: string]: { totalIncome: number; totalExpenses: number; data: Transaction[] } }
    );

    const sortedKeys = Object.keys(grouped).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );

    return sortedKeys.map((monthYear) => ({
      title: monthYear,
      totalIncome: grouped[monthYear].totalIncome,
      totalExpenses: grouped[monthYear].totalExpenses,
      savings: grouped[monthYear].totalIncome - grouped[monthYear].totalExpenses,
      originalData: grouped[monthYear].data,
    }));
  }, [transactions, searchQuery]);

  const sections = useMemo(() => {
    return processedData.map((section) => ({
      ...section,
      data: expandedSections.has(section.title) ? section.originalData : [],
    }));
  }, [processedData, expandedSections]);

  const toggleSection = useCallback((sectionTitle: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionTitle)) {
        newSet.delete(sectionTitle);
      } else {
        newSet.add(sectionTitle);
      }
      return newSet;
    });
  }, []);

  // ... (onRefresh, getCategoryIcon, formatAmount are the same)
  const onRefresh = async () => {
    await triggerUploadSync();
  };

  const getCategoryIcon = (category: string) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('food')) return 'shopping-bag';
    if (categoryLower.includes('transport')) return 'truck';
    if (categoryLower.includes('shopping')) return 'shopping-cart';
    if (categoryLower.includes('entertainment')) return 'film';
    if (categoryLower.includes('health')) return 'heart';
    if (categoryLower.includes('bill')) return 'file-text';
    if (categoryLower.includes('salary')) return 'dollar-sign';
    if (categoryLower.includes('freelance')) return 'briefcase';
    if (categoryLower.includes('investment')) return 'trending-up';
    if (categoryLower.includes('gift')) return 'gift';
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

  const renderTransactionItem = useCallback(({ item, index, section }: { item: Transaction, index: number, section: any }) => {
    const isLastItem = index === section.originalData.length - 1;
    const isFirstItem = index === 0;
    
    // Use Animated.View with the new `layout` prop for smooth animations
    return (
      <Animated.View
        // ✨ KEY CHANGE: Add the layout prop to animate layout changes.
        // This will smoothly animate the item's position as it's added or removed.
        layout={Layout.duration(300)}
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
      >
        <Pressable
          onPress={() => {
            const pathname = item.type === 'income' ? '/add-income' : '/add-expense';
            router.push({ pathname, params: { uuid: item.uuid } });
          }}
          style={({ pressed }) => [
            { opacity: pressed ? 0.7 : 1 }
          ]}
        >
          <View style={[
            styles.item, 
            { backgroundColor: cardColor, borderBottomColor: separatorColor }, 
            isFirstItem && styles.firstItem,
            isLastItem && styles.lastItem
          ]}>
            <ThemedView style={[styles.itemIcon, { backgroundColor: separatorColor }]}>
              <Feather
                name={getCategoryIcon(item.category)}
                size={20}
                color={item.type === 'income' ? '#34C759' : textColor}
              />
            </ThemedView>
            <View style={styles.itemDetails}>
              <ThemedText style={styles.itemCategory}>{item.category}</ThemedText>
              <ThemedText style={[styles.itemDate, { color: secondaryTextColor }]}>
                {new Date(item.date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </ThemedText>
              {item.notes ? (
                <ThemedText style={[styles.itemNotes, { color: secondaryTextColor }]} numberOfLines={1}>
                  {item.notes}
                </ThemedText>
              ) : null}
            </View>
            <ThemedText style={[styles.itemAmount, { color: item.type === 'income' ? '#34C759' : textColor }]}>
              {item.type === 'income' ? '+' : '-'}{formatAmount(item.amount)}
            </ThemedText>
          </View>
        </Pressable>
      </Animated.View>
    );
  }, [cardColor, separatorColor, secondaryTextColor, textColor, router]);

  const renderSectionHeader = useCallback(({ section }: { section: any }) => {
    // ... (no changes here)
    const isCollapsed = !expandedSections.has(section.title);
    
    return (
      <TouchableOpacity
        style={[
          styles.sectionHeader,
          { backgroundColor: cardColor, borderBottomColor: separatorColor },
          isCollapsed ? styles.collapsedSectionHeader : styles.expandedSectionHeader
        ]}
        onPress={() => toggleSection(section.title)}
        activeOpacity={0.8}
      >
        <View style={styles.sectionTopRow}>
          <View style={styles.sectionHeaderLeft}>
          <View style={styles.monthTitleRow}>
            <View style={[styles.monthIcon, { backgroundColor: `${accentColor}18` }]}>
              <Feather name="calendar" size={16} color={accentColor} />
            </View>
            <View>
              <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
              <ThemedText style={[styles.sectionSubTitle, { color: secondaryTextColor }]}>
                {section.originalData.length} transaction{section.originalData.length !== 1 ? 's' : ''}
              </ThemedText>
            </View>
          </View>
          </View>
          <View style={styles.chevronContainer}>
            <Feather
              name={expandedSections.has(section.title) ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={secondaryTextColor}
            />
          </View>
        </View>
        <View style={styles.sectionHeaderRight}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryLabelGroup}>
              <View style={[styles.summaryDot, { backgroundColor: '#34C759' }]} />
              <ThemedText style={styles.summaryLabel}>Income</ThemedText>
            </View>
            <ThemedText style={[styles.summaryValue, { color: '#34C759' }]}>
              {formatAmount(section.totalIncome)}
            </ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryLabelGroup}>
              <View style={[styles.summaryDot, { backgroundColor: '#FF6B6B' }]} />
              <ThemedText style={styles.summaryLabel}>Expenses</ThemedText>
            </View>
            <ThemedText style={[styles.summaryValue, { color: '#FF3B30' }]}>
              {formatAmount(section.totalExpenses)}
            </ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, styles.summaryLabelBold]}>Net</ThemedText>
            <ThemedText style={[styles.summaryValue, styles.summaryValueBold, { color: section.savings >= 0 ? '#34C759' : '#FF3B30' }]}>
              {formatAmount(section.savings)}
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [expandedSections, cardColor, separatorColor, secondaryTextColor, accentColor, toggleSection]);

  return (
    <ThemedView style={styles.container}>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      <View style={styles.header}>
        <View>
          <ThemedText style={styles.eyebrow}>ACTIVITY</ThemedText>
          <ThemedText style={styles.headerTitle}>History</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: secondaryTextColor }]}>
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} recorded
          </ThemedText>
        </View>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.uuid}
        // ✨ OPTIONAL: The extraData prop is no longer needed.
        // SectionList will re-render when the `sections` prop changes, which it does.
        // extraData={expandedSections} 
        ListHeaderComponent={
          <View style={styles.searchContainer}>
            <SearchBar placeholder="Search transactions..." value={searchQuery} onChangeText={setSearchQuery} />
          </View>
        }
        renderSectionHeader={renderSectionHeader}
        renderItem={renderTransactionItem}
        ListEmptyComponent={
          // ... (no changes here)
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: cardColor }]}>
              <Feather name={searchQuery ? 'search' : 'inbox'} size={30} color={secondaryTextColor} />
            </View>
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
          <RefreshControl refreshing={isSyncing} onRefresh={onRefresh} tintColor={textColor} />
        }
        removeClippedSubviews={false}
        maxToRenderPerBatch={10}
        windowSize={10}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 48, paddingHorizontal: 20, paddingBottom: 16 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
  headerTitle: { fontSize: 30, fontWeight: '800', lineHeight: 36, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, marginTop: 5 },
  listContentContainer: { paddingHorizontal: 18, paddingBottom: 100 },
  searchContainer: { marginBottom: 16 },
  sectionHeader: { 
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 18,
    borderBottomWidth: 1,
  },
  expandedSectionHeader: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 1,
  },
  collapsedSectionHeader: {
    marginBottom: 16,
    borderBottomWidth: 0,
  },
  sectionTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeaderLeft: { flex: 1, marginRight: 10 },
  monthTitleRow: { flexDirection: 'row', alignItems: 'center' },
  monthIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionSubTitle: { fontSize: 12, marginTop: 2 },
  sectionHeaderRight: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(125, 137, 133, 0.14)' },
  summaryRow: { flex: 1, alignItems: 'center', marginVertical: 2, flexDirection: 'column', gap: 3 },
  summaryLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryDot: { width: 6, height: 6, borderRadius: 3 },
  summaryLabel: { fontSize: 11, color: '#7D8985' },
  summaryValue: { fontSize: 11, fontWeight: '600' },
  summaryLabelBold: { fontWeight: '700' },
  summaryValueBold: { fontWeight: '700' },
  chevronContainer: { padding: 4, marginLeft: 2 },
  item: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    minHeight: 76,
  },
  firstItem: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  lastItem: { 
    borderBottomWidth: 0, 
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    marginBottom: 16 
  },
  itemIcon: { 
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12
  },
  itemDetails: { flex: 1, marginRight: 8 },
  itemCategory: { fontSize: 15, fontWeight: '600' },
  itemDate: { fontSize: 12, marginTop: 3 },
  itemNotes: { fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  itemAmount: { fontSize: 14, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 32 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySubtext: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 21 },
});