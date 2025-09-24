// In app/(tabs)/profile.tsx
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

// Import our themed components and hooks
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useAppData } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { useThemeColor } from '../../hooks/use-theme-color';
import { generateFinancialReport } from '../../utils/pdfExport';

export default function ProfileScreen() {
  const { theme, toggleTheme } = useTheme();
  const { isSyncing, triggerFullSync, transactions } = useAppData();
  const [isExporting, setIsExporting] = useState(false);

  // Get dynamic colors for styling
  const cardColor = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');
  const separatorColor = useThemeColor({}, 'background');

  const handleExportData = async () => {
    if (transactions.length === 0) {
      return Alert.alert("No Data", "There are no transactions to export.");
    }

    Alert.alert(
      "Export Financial Report",
      `This will generate a detailed PDF report for all your data. Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Export", 
          onPress: async () => {
            setIsExporting(true);
            try {
              await generateFinancialReport(transactions);
            } catch (error) {
              Alert.alert("Error", "Failed to export report. Please try again.");
              console.error('Export failed:', error);
            } finally {
              setIsExporting(false);
            }
          }
        }
      ]
    );
  };

  const handleFullSync = async () => {
    Alert.alert(
      "Full Data Sync",
      "This will download the latest data from the server. Do you want to continue?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Sync", 
          onPress: async () => {
            try {
              await triggerFullSync();
              Alert.alert("Success", "Full sync completed successfully!");
            } catch (error) {
              Alert.alert("Error", "Full sync failed. Please check your connection and try again.");
            }
          }
        }
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Settings</ThemedText>
      </View>
      
      <ThemedView style={[styles.card, { backgroundColor: cardColor, shadowColor: textColor }]}>
        <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>Appearance</ThemedText>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Feather name="moon" size={20} style={[styles.rowIcon, { color: secondaryTextColor }]} />
          <ThemedText style={styles.rowLabel}>Dark Mode</ThemedText>
          <Switch
            value={theme === 'dark'}
            onValueChange={toggleTheme}
            trackColor={{ false: "#E9E9EA", true: "#34C759" }}
            thumbColor={"#FFFFFF"}
          />
        </View>
      </ThemedView>

      <ThemedView style={[styles.card, { backgroundColor: cardColor, shadowColor: textColor }]}>
        <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>Data</ThemedText>
        
        <Pressable 
          style={[styles.row, { borderBottomColor: separatorColor }]} 
          onPress={handleFullSync}
          disabled={isSyncing}
        >
          <Feather 
            name="refresh-cw" 
            size={20} 
            style={[styles.rowIcon, { color: secondaryTextColor }]} 
          />
          <ThemedText style={[styles.rowLabel, { opacity: isSyncing ? 0.5 : 1 }]}>
            {isSyncing ? "Syncing..." : "Full Data Sync"}
          </ThemedText>
          {isSyncing ? (
            <ActivityIndicator color={secondaryTextColor} />
          ) : (
            <Feather name="chevron-right" size={16} color={secondaryTextColor} />
          )}
        </Pressable>

        <Pressable 
          style={[styles.row, { borderBottomWidth: 0 }]} 
          onPress={handleExportData}
          disabled={isExporting}
        >
          <Feather 
            name="download" 
            size={20} 
            style={[styles.rowIcon, { color: secondaryTextColor }]} 
          />
          <ThemedText style={[styles.rowLabel, { opacity: isExporting ? 0.5 : 1 }]}>
            {isExporting ? "Exporting..." : "Export Financial Report"}
          </ThemedText>
          {isExporting ? (
            <ActivityIndicator color={secondaryTextColor} />
          ) : (
            <Feather name="chevron-right" size={16} color={secondaryTextColor} />
          )}
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold' },
  card: { 
    marginHorizontal: 20, 
    marginBottom: 20, 
    borderRadius: 20, 
    paddingHorizontal: 24, 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 12, 
    elevation: 2 
  },
  cardTitle: { fontSize: 14, fontWeight: '500', paddingTop: 16, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
  rowIcon: { marginRight: 16 },
  rowLabel: { fontSize: 16, flex: 1 },
});