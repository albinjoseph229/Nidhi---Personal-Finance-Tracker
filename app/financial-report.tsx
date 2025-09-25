// In app/financial-report.tsx
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { useTheme } from '../context/ThemeContext';
import { useThemeColor } from '../hooks/use-theme-color';
import { StructuredReport } from '../utils/geminiApi';

const { width } = Dimensions.get('window');

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

  // Helper function to get color based on financial health status
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

  // Helper function to get a lighter, transparent version of the health color for the background
  const getHealthBackgroundColor = (status: 'Poor' | 'Fair' | 'Good' | 'Excellent') => {
    const baseColor = getHealthColor(status);
    // Add '15' to the hex color for 15% opacity (e.g., #RRGGBB15)
    return baseColor + '15'; 
  }

  // Helper function to get color based on profit/loss
  const getProfitLossColor = (amount: number) => {
    return amount >= 0 ? '#4CAF50' : '#F44336';
  };

  // A card to display a single key metric
  const MetricItem = ({ icon, label, value, valueColor }: { 
    icon: string; 
    label: string; 
    value: string; 
    valueColor?: string; 
  }) => (
    <View style={[styles.metricItem, { backgroundColor: separatorColor }]}>
      <Feather name={icon as any} size={20} color={secondaryTextColor} />
      <View style={styles.metricTextContainer}>
        <ThemedText style={[styles.metricLabel, { color: secondaryTextColor }]}>{label}</ThemedText>
        <ThemedText style={[styles.metricValue, valueColor && { color: valueColor }]}>{value}</ThemedText>
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

  // Investment-specific bullet point with different styling
  const InvestmentBulletPoint = ({ text, index }: { text: string; index: number }) => (
    <View style={styles.bulletContainer}>
      <View style={[styles.bulletNumber, { backgroundColor: '#FF9800' + '20' }]}>
        <Feather name="trending-up" size={12} color="#FF9800" />
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
            AI-Powered Insights & Investment Analysis
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
                Analyzing your financial and investment data...
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

            {/* Financial Health & Key Metrics Section */}
            {report.financialHealth && report.keyMetrics && (
              <SectionCard
                icon="shield"
                title="Financial Health"
                color={getHealthColor(report.financialHealth.status)}
              >
                <View style={styles.healthContainer}>
                  <View 
                    style={[
                      styles.scoreCircle, 
                      { 
                        borderColor: getHealthColor(report.financialHealth.status) + '40',
                        backgroundColor: getHealthBackgroundColor(report.financialHealth.status), // NEW: Dynamic background color
                      }
                    ]}
                  >
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
                  <MetricItem 
                    icon="arrow-down-circle" 
                    label="Total Income" 
                    value={`₹${report.keyMetrics.totalIncome.toFixed(2)}`} 
                    valueColor="#4CAF50"
                  />
                  <MetricItem 
                    icon="arrow-up-circle" 
                    label="Total Expenses" 
                    value={`₹${report.keyMetrics.totalExpenses.toFixed(2)}`} 
                    valueColor="#F44336"
                  />
                  <MetricItem 
                    icon="briefcase" 
                    label="Net Savings" 
                    value={`₹${report.keyMetrics.netSavings.toFixed(2)}`} 
                    valueColor={getProfitLossColor(report.keyMetrics.netSavings)}
                  />
                  <MetricItem 
                    icon="trending-up" 
                    label="Savings Rate" 
                    value={`${report.keyMetrics.savingsRate}%`} 
                    valueColor={report.keyMetrics.savingsRate > 20 ? "#4CAF50" : report.keyMetrics.savingsRate > 10 ? "#FFC107" : "#F44336"}
                  />
                </View>
                <View style={[styles.topCategoryBanner, { backgroundColor: separatorColor }]}>
                  <Feather name="shopping-bag" size={16} color={secondaryTextColor} />
                  <ThemedText style={[styles.topCategoryText, { color: secondaryTextColor }]}>
                    Top spending category is <ThemedText style={{ fontWeight: '700', color: textColor }}>{report.keyMetrics.topSpendingCategory}</ThemedText>.
                  </ThemedText>
                </View>
              </SectionCard>
            )}

            {/* Investment Portfolio Section */}
            {report.investmentMetrics && (
              <SectionCard
                icon="trending-up"
                title="Investment Portfolio"
                color="#9C27B0"
              >
                <View style={styles.investmentSummary}>
                  <View style={styles.investmentHeader}>
                    <View style={[styles.performanceIndicator, { backgroundColor: getProfitLossColor(report.investmentMetrics.totalProfitLoss) + '15' }]}>
                      <Feather 
                        name={report.investmentMetrics.totalProfitLoss >= 0 ? "trending-up" : "trending-down"} 
                        size={20} 
                        color={getProfitLossColor(report.investmentMetrics.totalProfitLoss)} 
                      />
                      <ThemedText style={[styles.performanceText, { color: getProfitLossColor(report.investmentMetrics.totalProfitLoss) }]}>
                        {report.investmentMetrics.profitLossPercentage >= 0 ? '+' : ''}{report.investmentMetrics.profitLossPercentage}%
                      </ThemedText>
                    </View>
                    <View style={styles.investmentCounts}>
                      <ThemedText style={[styles.investmentCountText, { color: secondaryTextColor }]}>
                        {report.investmentMetrics.activeInvestments} Active • {report.investmentMetrics.soldInvestments} Sold
                      </ThemedText>
                    </View>
                  </View>

                  {/* Investment Metrics Grid */}
                  <View style={styles.metricsGrid}>
                    <MetricItem 
                      icon="dollar-sign" 
                      label="Total Investment" 
                      value={`₹${report.investmentMetrics.totalInvestment.toFixed(2)}`} 
                      valueColor="#9C27B0"
                    />
                    <MetricItem 
                      icon="briefcase" 
                      label="Current Value" 
                      value={`₹${report.investmentMetrics.currentValue.toFixed(2)}`} 
                      valueColor="#2196F3"
                    />
                    <MetricItem 
                      icon="activity" 
                      label="Profit/Loss" 
                      value={`₹${report.investmentMetrics.totalProfitLoss.toFixed(2)}`} 
                      valueColor={getProfitLossColor(report.investmentMetrics.totalProfitLoss)}
                    />
                    <MetricItem 
                      icon="pie-chart" 
                      label="Diversification" 
                      value={`${report.investmentMetrics.portfolioDiversification}/100`} 
                      valueColor={report.investmentMetrics.portfolioDiversification > 75 ? "#4CAF50" : report.investmentMetrics.portfolioDiversification > 50 ? "#FFC107" : "#F44336"}
                    />
                  </View>

                  {/* Best/Worst Performing Types */}
                  <View style={styles.performanceTypeContainer}>
                    <View style={styles.performanceTypeItem}>
                      <Feather name="award" size={16} color="#4CAF50" />
                      <ThemedText style={[styles.performanceTypeLabel, { color: secondaryTextColor }]}>Best Performing</ThemedText>
                      <ThemedText style={[styles.performanceTypeValue, { color: '#4CAF50' }]}>
                        {report.investmentMetrics.bestPerformingType}
                      </ThemedText>
                    </View>
                    <View style={[styles.divider, { backgroundColor: separatorColor }]} />
                    <View style={styles.performanceTypeItem}>
                      <Feather name="trending-down" size={16} color="#F44336" />
                      <ThemedText style={[styles.performanceTypeLabel, { color: secondaryTextColor }]}>Needs Attention</ThemedText>
                      <ThemedText style={[styles.performanceTypeValue, { color: '#F44336' }]}>
                        {report.investmentMetrics.worstPerformingType}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </SectionCard>
            )}

            {/* Financial Insights Section */}
            <SectionCard
              icon="zap"
              title="Key Insights"
              color="#FF9800"
            >
              <View style={styles.insightsContainer}>
                {report.insights.map((insight, index) => (
                  <BulletPoint key={index} text={insight} index={index} />
                ))}
              </View>
            </SectionCard>

            {/* Investment Insights Section (if available) */}
            {report.investmentInsights && report.investmentInsights.length > 0 && (
              <SectionCard
                icon="trending-up"
                title="Investment Insights"
                color="#9C27B0"
              >
                <View style={styles.insightsContainer}>
                  {report.investmentInsights.map((insight, index) => (
                    <InvestmentBulletPoint key={index} text={insight} index={index} />
                  ))}
                </View>
              </SectionCard>
            )}

            {/* Financial Tips Section */}
            <SectionCard
              icon="bookmark"
              title="Recommendations"
              color="#2196F3"
            >
              <View style={styles.tipsContainer}>
                {report.tips.map((tip, index) => (
                  <View key={index} style={styles.tipItem}>
                    <View style={[styles.tipIcon, { backgroundColor: '#2196F3' + '20' }]}>
                      <Feather name="check-circle" size={14} color="#2196F3" />
                    </View>
                    <ThemedText style={styles.tipText}>{tip}</ThemedText>
                  </View>
                ))}
              </View>
            </SectionCard>

            {/* Investment Tips Section (if available) */}
            {report.investmentTips && report.investmentTips.length > 0 && (
              <SectionCard
                icon="target"
                title="Investment Recommendations"
                color="#FF5722"
              >
                <View style={styles.tipsContainer}>
                  {report.investmentTips.map((tip, index) => (
                    <View key={index} style={styles.tipItem}>
                      <View style={[styles.tipIcon, { backgroundColor: '#FF5722' + '20' }]}>
                        <Feather name="arrow-up-right" size={14} color="#FF5722" />
                      </View>
                      <ThemedText style={styles.tipText}>{tip}</ThemedText>
                    </View>
                  ))}
                </View>
              </SectionCard>
            )}

            {/* Footer */}
            <View style={styles.footer}>
              <View style={[styles.footerCard, { backgroundColor: cardColor }]}>
                <Feather name="info" size={20} color={secondaryTextColor} />
                <ThemedText style={[styles.footerText, { color: secondaryTextColor }]}>
                  This report is generated using AI analysis of your financial data. 
                  Always consult with a qualified financial advisor for personalized advice.
                </ThemedText>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.noReportContainer}>
            <View style={[styles.noReportCard, { backgroundColor: cardColor }]}>
              <Feather name="file-text" size={48} color={secondaryTextColor} />
              <ThemedText style={[styles.noReportTitle, { color: textColor }]}>
                No Report Available
              </ThemedText>
              <ThemedText style={[styles.noReportText, { color: secondaryTextColor }]}>
                Generate a financial report from your transactions to see insights here.
              </ThemedText>
              <Pressable
                onPress={() => router.back()}
                style={[styles.backButton, { backgroundColor: accentColor }]}
              >
                <ThemedText style={[styles.backButtonText, { color: 'white' }]}>
                  Go Back
                </ThemedText>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  titleContainer: {
    marginTop: 24,
    marginBottom: 20,
    alignItems: 'center',
  },
  reportTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  titleUnderline: {
    width: 60,
    height: 3,
    marginTop: 8,
    borderRadius: 2,
  },
  sectionCard: {
    borderRadius: 16,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionContent: {
    padding: 20,
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 24,
  },
  healthContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    alignItems: 'center',
  },
  scoreCircle: {
    width: 120,   // MODIFIED: Increased size
    height: 120,  // MODIFIED: Increased size
    borderRadius: 60, // MODIFIED: Half of new width/height
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    // Background color is now set dynamically in JSX
  },
  scoreText: {
    fontSize: 28, // MODIFIED: Increased font size
    fontWeight: 'bold',
  },
  scoreLabel: {
    fontSize: 13, // MODIFIED: Slightly increased font size for readability
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  concernsContainer: {
    flex: 1,
  },
  concernsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  concernItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  concernText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 16,
  },
  metricItem: {
    width: (width - 72) / 2,
    margin: 6,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
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
  },
  topCategoryText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  investmentSummary: {
    marginBottom: 16,
  },
  investmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  performanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  performanceText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  investmentCounts: {
    alignItems: 'flex-end',
  },
  investmentCountText: {
    fontSize: 14,
  },
  performanceTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  performanceTypeItem: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 40,
    marginHorizontal: 16,
  },
  performanceTypeLabel: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 2,
  },
  performanceTypeValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  insightsContainer: {
    gap: 16,
  },
  bulletContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  bulletNumberText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  tipsContainer: {
    gap: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    marginTop: 20,
  },
  footerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
  },
  footerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  noReportContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  noReportCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: 300,
  },
  noReportTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  noReportText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});