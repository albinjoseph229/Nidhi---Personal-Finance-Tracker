// In app/(tabs)/profile.tsx
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

// Import our themed components and hooks
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useAppData } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { useThemeColor } from '../../hooks/use-theme-color';

export default function ProfileScreen() {
  const { theme, toggleTheme } = useTheme();
  const { isSyncing, triggerFullSync } = useAppData();

  const cardColor = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');

  const handleExportData = () => {
    Alert.alert("Coming Soon", "The data export feature will be available in a future update.");
  };

  const handleFullSync = async () => {
    Alert.alert(
      "Full Data Sync",
      "This will download all data from the server and may take some time. Do you want to continue?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Sync", 
          onPress: async () => {
            try {
              await triggerFullSync();
              Alert.alert("Success", "Full sync completed successfully!");
            } catch (error) {
              Alert.alert("Error", "Full sync failed. Please try again.");
            }
          }
        }
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
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
          style={[styles.row, { borderBottomColor: secondaryTextColor, borderBottomWidth: 0.5 }]} 
          onPress={handleFullSync}
          disabled={isSyncing}
        >
          <Feather 
            name="refresh-cw" 
            size={20} 
            style={[
              styles.rowIcon, 
              { color: isSyncing ? secondaryTextColor : textColor }
            ]} 
          />
          <ThemedText style={[styles.rowLabel, { opacity: isSyncing ? 0.5 : 1 }]}>
            {isSyncing ? "Syncing..." : "Full Data Sync"}
          </ThemedText>
          <Feather 
            name="chevron-right" 
            size={16} 
            color={secondaryTextColor} 
            style={{ opacity: isSyncing ? 0.5 : 1 }}
          />
        </Pressable>

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
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  rowIcon: { marginRight: 16 },
  rowLabel: { fontSize: 16, flex: 1 },
});