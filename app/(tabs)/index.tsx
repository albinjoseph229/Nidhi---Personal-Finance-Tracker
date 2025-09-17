import { FontAwesome } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native'; // 👈 1. Import the useTheme hook
import { Link } from 'expo-router';
import React from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useData } from '../context/DataContext';

export default function DashboardScreen() {
  const theme = useTheme(); // 👈 2. Get the current theme object
  const { transactions, loading, syncData } = useData();

  // 👇 3. Pass the theme to a function that creates our dynamic styles
  const styles = getThemedStyles(theme);

  return (
    <View style={styles.container}>
      {loading && transactions.length === 0 ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item, index) => `${item.Date}-${index}`}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <View>
                <Text style={styles.itemCategory}>{item.Category}</Text>
                <Text style={styles.itemNotes}>{item.Notes}</Text>
              </View>
              <Text style={styles.itemAmount}>₹{item.Amount}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No transactions yet. Add one!</Text>}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={syncData} tintColor={theme.colors.text} />
          }
        />
      )}
      
      <Link href="/add-expense" asChild>
        <Pressable style={styles.fab}>
          <FontAwesome name="plus" size={24} color="white" />
        </Pressable>
      </Link>
    </View>
  );
}

// 👇 4. Create a function that generates styles based on the theme
const getThemedStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background, // Use theme background
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: theme.colors.card, // Use theme card color for list items
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border, // Use theme border color
    alignItems: 'center',
  },
  itemCategory: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text, // Use theme text color
  },
  itemNotes: {
    fontSize: 12,
    color: 'gray', // Gray works well for secondary text in both themes
  },
  itemAmount: {
    fontSize: 16,
    color: 'red', // Kept as red to signify an expense
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: theme.colors.text, // Use theme text color
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007BFF', // Brand color, usually stays the same
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
});