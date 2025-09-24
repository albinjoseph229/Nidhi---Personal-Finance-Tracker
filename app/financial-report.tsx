// In app/financial-report.tsx
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { useTheme } from '../context/ThemeContext';
import { useThemeColor } from '../hooks/use-theme-color';
import { StructuredReport } from '../utils/geminiApi'; // <-- Import our new interface

export default function FinancialReportScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const textColor = useThemeColor({}, 'text');
  const cardColor = useThemeColor({}, 'card');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');
  const separatorColor = useThemeColor({}, 'background');

  const [report, setReport] = useState<StructuredReport | null>(null); // State now holds the structured object
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadReport = async () => {
      try {
        const savedReportString = await AsyncStorage.getItem('financial-report');
        if (savedReportString) {
          setReport(JSON.parse(savedReportString)); // Parse the JSON string from storage
        }
      } catch (error) {
        console.error("Failed to load or parse report:", error);
        setReport(null); // Set to null on error
      } finally {
        setIsLoading(false);
      }
    };
    loadReport();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>AI Financial Report</ThemedText>
        <Pressable onPress={() => router.back()}>
          <Feather name="x" size={24} color={textColor} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isLoading ? (
          <ThemedText style={styles.messageText}>Loading report...</ThemedText>
        ) : report ? (
          <ThemedView style={[styles.card, { backgroundColor: cardColor, shadowColor: textColor }]}>
            {/* Summary Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="bar-chart-2" size={20} color={secondaryTextColor} />
                <ThemedText style={styles.sectionTitle}>Summary</ThemedText>
              </View>
              <ThemedText style={styles.bodyText}>{report.summary}</ThemedText>
            </View>
            
            {/* Key Insights Section */}
            <View style={[styles.section, { borderTopColor: separatorColor }]}>
              <View style={styles.sectionHeader}>
                <Feather name="trending-up" size={20} color={secondaryTextColor} />
                <ThemedText style={styles.sectionTitle}>Key Insights</ThemedText>
              </View>
              {report.insights.map((insight, index) => (
                <View key={index} style={styles.bulletItem}>
                  <ThemedText style={styles.bullet}>•</ThemedText>
                  <ThemedText style={styles.bodyText}>{insight}</ThemedText>
                </View>
              ))}
            </View>

            {/* Savings Tips Section */}
            <View style={[styles.section, { borderTopColor: separatorColor }]}>
              <View style={styles.sectionHeader}>
                <Feather name="target" size={20} color={secondaryTextColor} />
                <ThemedText style={styles.sectionTitle}>Savings Tips</ThemedText>
              </View>
              {report.tips.map((tip, index) => (
                <View key={index} style={styles.bulletItem}>
                  <ThemedText style={styles.bullet}>•</ThemedText>
                  <ThemedText style={styles.bodyText}>{tip}</ThemedText>
                </View>
              ))}
            </View>
          </ThemedView>
        ) : (
          <ThemedText style={styles.messageText}>No report has been generated yet, or the last report was invalid.</ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold' },
  scrollContent: { padding: 20, paddingBottom: 50 },
  card: { borderRadius: 20, paddingVertical: 12, paddingHorizontal: 24, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  section: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: 'transparent', // First section has no top border
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 24,
    flex: 1, // Ensure text wraps correctly
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bullet: {
    fontSize: 16,
    marginRight: 8,
    lineHeight: 24,
  },
  messageText: {
    textAlign: 'center',
    fontSize: 16,
    padding: 20,
  }
});