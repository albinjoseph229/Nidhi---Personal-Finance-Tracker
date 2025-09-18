import { FontAwesome } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { SearchBar } from '../../components/SearchBar';
import { useAppData } from '../../context/AppContext';
import { Transaction } from '../../database';

interface TransactionSection {
  title: string;
  total: number;
  data: Transaction[];
}

export default function HistoryScreen() {
  // Get the sync status and trigger function from the context
  const { transactions, isSyncing, triggerFullSync } = useAppData();
  const [searchQuery, setSearchQuery] = useState('');

  const sections = useMemo(() => {
    // ... (Your filtering and grouping logic is correct, no changes needed)
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
    
    return Object.keys(grouped).map(monthYear => ({
      title: monthYear,
      total: grouped[monthYear].total,
      data: grouped[monthYear].data,
    }));
  }, [transactions, searchQuery]);
  
  // Define the onRefresh function to trigger the full sync
  const onRefresh = async () => {
    await triggerFullSync();
  };

  return (
    <View style={styles.container}>
      <SearchBar value={searchQuery} onChangeText={setSearchQuery} />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.uuid}
        // Add the RefreshControl component here
        refreshControl={
          <RefreshControl refreshing={isSyncing} onRefresh={onRefresh} />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionTotal}>₹{section.total.toFixed(2)}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={styles.itemIcon}>
                <FontAwesome name="shopping-cart" size={24} color="#333" />
            </View>
            <View style={styles.itemDetails}>
              <Text style={styles.itemCategory}>{item.category}</Text>
              <Text style={styles.itemNotes}>{item.notes}</Text>
            </View>
            <Text style={styles.itemAmount}>- ₹{item.amount.toFixed(2)}</Text>
          </View>
        )}
        ListEmptyComponent={
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No transactions found.</Text>
            </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: 'gray',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionTotal: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemIcon: {
    marginRight: 15,
    width: 40,
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
  },
  itemCategory: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemNotes: {
    fontSize: 12,
    color: 'gray',
    marginTop: 2,
  },
  itemAmount: {
    fontSize: 16,
    color: 'red',
    fontWeight: 'bold',
  },
});