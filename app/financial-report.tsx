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
import { StructuredReport } from '../utils/geminiApi';

export default function FinancialReportScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const textColor = useThemeColor({}, 'text');
  const cardColor = useThemeColor({}, 'card');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');
  const separatorColor = useThemeColor({}, 'background');
  const accentColor = useThemeColor({}, 'tint');

  const [report, setReport] = useState<StructuredReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadReport = async () => {
      try {
        const savedReportString = await AsyncStorage.getItem('financial-report');
        if (savedReportString) {
          setReport(JSON.parse(savedReportString));
        }
      } catch (error) {
        console.error("Failed to load or parse report:", error);
        setReport(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadReport();
  }, []);

  // ADDED: Helper function to get color based on financial health status
  const getHealthColor = (status: 'Poor' | 'Fair' | 'Good' | 'Excellent') => {
    switch (status) {
      case 'Excellent':
        return '#4CAF50'; // Green
      case 'Good':
        return '#2196F3'; // Blue
      case 'Fair':
        return '#FFC107'; // Amber
      case 'Poor':
        return '#F44336'; // Red
      default:
        return secondaryTextColor;
    }
  };

  // NEW COMPONENT: A card to display a single key metric
  const MetricItem = ({ icon, label, value }: { icon: string; label:string; value: string; }) => (
    <View style={[styles.metricItem, { backgroundColor: separatorColor }]}>
      <Feather name={icon as any} size={20} color={secondaryTextColor} />
      <View style={styles.metricTextContainer}>
        <ThemedText style={[styles.metricLabel, { color: secondaryTextColor }]}>{label}</ThemedText>
        <ThemedText style={styles.metricValue}>{value}</ThemedText>
      </View>
    </View>
  );

  const SectionCard = ({ children, icon, title, color }: {
    children: React.ReactNode;
    icon: string;
    title: string;
    color: string;
  }) => (
    <ThemedView style={[styles.sectionCard, { backgroundColor: cardColor, shadowColor: textColor }]}>
      <View style={[styles.sectionHeader, { borderBottomColor: separatorColor }]}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <Feather name={icon as any} size={18} color={color} />
        </View>
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      </View>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </ThemedView>
  );

  const BulletPoint = ({ text, index }: { text: string; index: number }) => (
    <View style={styles.bulletContainer}>
      <View style={[styles.bulletNumber, { backgroundColor: accentColor + '20' }]}>
        <ThemedText style={[styles.bulletNumberText, { color: accentColor }]}>
          {index + 1}
        </ThemedText>
      </View>
      <ThemedText style={styles.bulletText}>{text}</ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />

      {/* Enhanced Header */}
      <View style={[styles.header, { borderBottomColor: separatorColor }]}>
        <View>
          <ThemedText style={styles.headerTitle}>Financial Report</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: secondaryTextColor }]}>
            AI-Powered Insights
          </ThemedText>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={[styles.closeButton, { backgroundColor: separatorColor }]}
        >
          <Feather name="x" size={20} color={textColor} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <View style={[styles.loadingCard, { backgroundColor: cardColor }]}>
              <Feather name="refresh-cw" size={32} color={secondaryTextColor} />
              <ThemedText style={[styles.loadingText, { color: secondaryTextColor }]}>
                Analyzing your financial data...
              </ThemedText>
            </View>
          </View>
        ) : report ? (
          <>
            {/* Report Title */}
            <View style={styles.titleContainer}>
              <ThemedText style={styles.reportTitle}>{report.title}</ThemedText>
              <View style={[styles.titleUnderline, { backgroundColor: accentColor }]} />
            </View>

            {/* Summary Section */}
            <SectionCard
              icon="pie-chart"
              title="Executive Summary"
              color="#4CAF50"
            >
              <ThemedText style={styles.summaryText}>
                {report.summary}
              </ThemedText>
            </SectionCard>

            {/* ADDED: Financial Health & Key Metrics Section */}
            {report.financialHealth && report.keyMetrics && (
              <SectionCard
                icon="shield"
                title="Financial Health"
                color={getHealthColor(report.financialHealth.status)}
              >
                <View style={styles.healthContainer}>
                  <View style={[styles.scoreCircle, { borderColor: getHealthColor(report.financialHealth.status) + '40' }]}>
                    <ThemedText style={[styles.scoreText, { color: getHealthColor(report.financialHealth.status) }]}>
                      {report.financialHealth.score}
                    </ThemedText>
                    <ThemedText style={[styles.scoreLabel, { color: getHealthColor(report.financialHealth.status) }]}>
                      {report.financialHealth.status}
                    </ThemedText>
                  </View>
                  <View style={styles.concernsContainer}>
                    <ThemedText style={styles.concernsTitle}>Primary Concerns</ThemedText>
                    {report.financialHealth.primaryConcerns.map((concern, index) => (
                      <View key={index} style={styles.concernItem}>
                        <Feather name="alert-triangle" size={14} color="#F44336" style={{ marginRight: 6, marginTop: 3 }} />
                        <ThemedText style={styles.concernText}>{concern}</ThemedText>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Key Metrics */}
                <View style={styles.metricsGrid}>
                  <MetricItem icon="arrow-down-circle" label="Total Income" value={`₹${report.keyMetrics.totalIncome.toFixed(2)}`} />
                  <MetricItem icon="arrow-up-circle" label="Total Expenses" value={`₹${report.keyMetrics.totalExpenses.toFixed(2)}`} />
                  <MetricItem icon="briefcase" label="Net Savings" value={`₹${report.keyMetrics.netSavings.toFixed(2)}`} />
                  <MetricItem icon="trending-up" label="Savings Rate" value={`${report.keyMetrics.savingsRate.toFixed(1)}%`} />
                </View>
                <View style={[styles.topCategoryBanner, { backgroundColor: separatorColor }]}>
                  <Feather name="shopping-bag" size={16} color={secondaryTextColor} />
                  <ThemedText style={[styles.topCategoryText, { color: secondaryTextColor }]}>
                    Top spending category is <ThemedText style={{ fontWeight: '700', color: textColor }}>{report.keyMetrics.topSpendingCategory}</ThemedText>.
                  </ThemedText>
                </View>
              </SectionCard>
            )}

            {/* Key Insights Section */}
            <SectionCard
              icon="search" // MODIFIED: More relevant icon
              title="Key Insights"
              color="#2196F3"
            >
              <View style={styles.insightsGrid}>
                {/* MODIFIED: Mapping with more distinct icons */}
                {report.insights.map((insight, index) => {
                  const insightIcons = ['activity', 'eye', 'bar-chart-2'];
                  const insightTitles = ['Spending Pattern', 'Financial Habit', 'Notable Trend'];
                  return (
                    <View key={index} style={styles.insightItem}>
                      <View style={[styles.insightIcon, { backgroundColor: '#2196F3' + '15' }]}>
                        <Feather
                          name={insightIcons[index % insightIcons.length] as any}
                          size={16}
                          color="#2196F3"
                        />
                      </View>
                      <View style={styles.insightContent}>
                        <ThemedText style={styles.insightTitle}>
                          {insightTitles[index % insightTitles.length]}
                        </ThemedText>
                        <ThemedText style={styles.insightText}>
                          {insight}
                        </ThemedText>
                      </View>
                    </View>
                  );
                })}
              </View>
            </SectionCard>

            {/* Savings Tips Section */}
            <SectionCard
              icon="target"
              title="Personalized Recommendations"
              color="#FF9800"
            >
              <View style={styles.tipsContainer}>
                {report.tips.map((tip, index) => (
                  <BulletPoint key={index} text={tip} index={index} />
                ))}
              </View>
              <View style={[styles.tipsBanner, { backgroundColor: '#FF9800' + '10', borderColor: '#FF9800' + '30' }]}>
                <Feather name="zap" size={16} color="#FF9800" />
                <ThemedText style={[styles.tipsBannerText, { color: '#FF9800' }]}>
                  Implementing these tips could boost your savings significantly!
                </ThemedText>
              </View>
            </SectionCard>

            {/* Action Items Footer */}
            <View style={[styles.actionFooter, { backgroundColor: cardColor, shadowColor: textColor }]}>
              <View style={styles.actionHeader}>
                <Feather name="check-circle" size={20} color={accentColor} />
                <ThemedText style={styles.actionTitle}>Next Steps</ThemedText>
              </View>
              <ThemedText style={styles.actionText}>
                Review your largest spending categories and try implementing the first recommendation this week.
              </ThemedText>
            </View>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyCard, { backgroundColor: cardColor }]}>
              <Feather name="file-text" size={48} color={secondaryTextColor} />
              <ThemedText style={styles.emptyTitle}>No Report Available</ThemedText>
              <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
                Generate your first financial report by adding some transactions and requesting an analysis.
              </ThemedText>
            </View>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
    opacity: 0.8
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    opacity: 0.8
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 32,
    paddingBottom: 16
  },
  reportTitle: {
    fontSize: 26,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8
  },
  titleUnderline: {
    width: 60,
    height: 3,
    borderRadius: 2
  },
  sectionCard: {
    borderRadius: 16,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 4 }, // MODIFIED: Increased shadow
    shadowOpacity: 0.08, // MODIFIED: Increased shadow
    shadowRadius: 12, // MODIFIED: Increased shadow
    elevation: 5
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1, // MODIFIED: Added flex: 1 to allow text wrapping
    flexWrap: 'wrap' // MODIFIED: Explicitly allow wrapping
  },
  sectionContent: {
    padding: 20,
    paddingTop: 16
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '400',
    textAlign: 'justify'
  },
  // ADDED: New styles for Health Score section
  healthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20
  },
  scoreText: {
    fontSize: 36,
    fontWeight: '700'
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: -4
  },
  concernsContainer: {
    flex: 1
  },
  concernsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.8
  },
  concernItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4
  },
  concernText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1
  },
  // ADDED: New styles for Key Metrics section
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%', // Two items per row
    padding: 12,
    borderRadius: 12,
  },
  metricTextContainer: {
    marginLeft: 10,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  topCategoryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  topCategoryText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  insightsGrid: {
    gap: 16
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2
  },
  insightContent: {
    flex: 1
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.8
  },
  insightText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    flexWrap: 'wrap'
  },
  tipsContainer: {
    marginBottom: 16
  },
  bulletContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  bulletNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 1
  },
  bulletNumberText: {
    fontSize: 12,
    fontWeight: '600'
  },
  bulletText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
    fontWeight: '400',
    flexWrap: 'wrap'
  },
  tipsBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1
  },
  tipsBannerText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
    flexWrap: 'wrap'
  },
  actionFooter: {
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8
  },
  actionText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
    flexWrap: 'wrap'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80
  },
  loadingCard: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center'
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80
  },
  emptyCard: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: 300
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22
  }
});