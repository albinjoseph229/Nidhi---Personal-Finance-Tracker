// In app/(tabs)/profile.tsx
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

// Import our themed components and our new hook
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useTheme } from '../../context/ThemeContext';
import { useThemeColor } from '../../hooks/use-theme-color';

export default function ProfileScreen() {
  // Get the theme and the toggle function from our context
  const { theme, toggleTheme } = useTheme();

  // Get dynamic colors for styling
  const cardColor = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');

  const handleExportData = () => {
    Alert.alert("Export Data", "Your transaction data will be exported as a CSV file.");
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Settings</ThemedText>
      </View>

      {/* App Settings Card */}
      <ThemedView style={[styles.card, { backgroundColor: cardColor, shadowColor: textColor }]}>
        <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>Appearance</ThemedText>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Feather name="moon" size={20} style={[styles.rowIcon, { color: secondaryTextColor }]} />
          <ThemedText style={styles.rowLabel}>Dark Mode</ThemedText>
          <Switch
            value={theme === 'dark'} // The value is now based on the global theme
            onValueChange={toggleTheme} // The switch now calls the global toggle function
            trackColor={{ false: "#E9E9EA", true: "#34C759" }}
            thumbColor={"#FFFFFF"}
          />
        </View>
      </ThemedView>
      
      {/* Data Management Card */}
      <ThemedView style={[styles.card, { backgroundColor: cardColor, shadowColor: textColor }]}>
        <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>Data</ThemedText>
        <Pressable style={[styles.row, { borderBottomWidth: 0 }]} onPress={handleExportData}>
          <Feather name="download" size={20} style={[styles.rowIcon, { color: secondaryTextColor }]} />
          <ThemedText style={styles.rowLabel}>Export Data</ThemedText>
          <Feather name="chevron-right" size={16} color={secondaryTextColor} />
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    paddingHorizontal: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '500',
    paddingTop: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  rowIcon: {
    marginRight: 16,
  },
  rowLabel: {
    fontSize: 16,
    flex: 1,
  },
});