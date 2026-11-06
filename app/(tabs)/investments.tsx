import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useMemo, useState } from "react";
import {
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    View,
} from "react-native";
import { ThemedText } from "../../components/themed-text";
import { ThemedView } from "../../components/themed-view";
import { useAppData } from "../../context/AppContext";
import { useTheme } from "../../context/ThemeContext";
import { useThemeColor } from "../../hooks/use-theme-color";

export default function InvestmentsScreen() {
    const router = useRouter();
    const { investments, isSyncing, triggerUploadSync } = useAppData();
    const { theme, accentColor } = useTheme();

    const [activeFilter, setActiveFilter] = useState<'active' | 'sold'>('active');

    const cardColor = useThemeColor({}, "card");
    const textColor = useThemeColor({}, "text");
    const secondaryTextColor = useThemeColor({}, "tabIconDefault");
    const backgroundColor = useThemeColor({}, "background");
    const primaryColor = accentColor;
    const accentTextColor = theme === "light" ? "#FFFFFF" : "#10201C";

    const { summaryTitle, summaryValue, summaryGainLoss, gainLossPercentage } = useMemo(() => {
        if (activeFilter === 'active') {
            const activeInvestments = investments.filter(inv => inv.status === 'active');
            const invested = activeInvestments.reduce((sum, inv) => sum + inv.purchasePrice * inv.quantity, 0);
            const currentValue = activeInvestments.reduce((sum, inv) => sum + (inv.currentValue * inv.quantity), 0);
            const gainLoss = currentValue - invested;
            const percentage = invested > 0 ? (gainLoss / invested) * 100 : 0;
            return {
                summaryTitle: "Total Portfolio Value",
                summaryValue: currentValue,
                summaryGainLoss: gainLoss,
                gainLossPercentage: percentage
            };
        } else { // 'sold'
            const soldInvestments = investments.filter(inv => inv.status === 'sold');
            const totalRealizedGains = soldInvestments.reduce((sum, inv) => {
                const invested = inv.purchasePrice * inv.quantity;
                const soldFor = (inv.soldPrice || 0) * inv.quantity;
                return sum + (soldFor - invested);
            }, 0);
            return {
                summaryTitle: "Total Realized Gains",
                summaryValue: totalRealizedGains,
                summaryGainLoss: totalRealizedGains,
                gainLossPercentage: 0
            };
        }
    }, [investments, activeFilter]);

    const filteredInvestments = useMemo(() => {
        return investments
            .filter(inv => inv.status === activeFilter)
            .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
    }, [investments, activeFilter]);

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2,
        }).format(amount).replace("₹", "₹ ");
    };

    const InvestmentCard = ({ item }: { item: (typeof investments)[0] }) => {
        const invested = item.purchasePrice * item.quantity;
        const totalCurrentValueForItem = (item.status === 'sold' ? item.soldPrice! : item.currentValue) * item.quantity;
        const gainLoss = totalCurrentValueForItem - invested;
        const percentage = invested > 0 ? (gainLoss / invested) * 100 : 0;
        const isProfit = gainLoss >= 0;

        return (
            <Pressable onPress={() => router.push(`/add-investment?uuid=${item.uuid}`)}>
                <ThemedView style={[styles.card, { backgroundColor: cardColor, shadowColor: textColor }]}>
                    <View style={styles.cardHeader}>
                        <View style={styles.nameBlock}>
                            <View style={[styles.typeIcon, { backgroundColor: `${primaryColor}18` }]}>
                                <Feather name={item.type === "FD" ? "lock" : item.type === "Gold" ? "disc" : "trending-up"} size={16} color={primaryColor} />
                            </View>
                            <View style={styles.nameTextBlock}>
                                <ThemedText style={styles.investmentName}>{item.name}</ThemedText>
                                <ThemedText style={[styles.purchaseDate, { color: secondaryTextColor }]}>
                                    {new Date(item.purchaseDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                </ThemedText>
                            </View>
                        </View>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            {item.status === 'sold' && (
                                <View style={[styles.soldChip, {backgroundColor: secondaryTextColor + '30'}]}>
                                    <ThemedText style={[styles.investmentTypeText, {color: secondaryTextColor}]}>SOLD</ThemedText>
                                </View>
                            )}
                            <ThemedView style={[styles.investmentTypeChip, { backgroundColor: backgroundColor }]}>
                                <ThemedText style={styles.investmentTypeText}>{item.type}</ThemedText>
                            </ThemedView>
                        </View>
                    </View>
                    <View style={styles.cardBody}>
                        <View>
                            <ThemedText style={[styles.valueLabel, { color: secondaryTextColor }]}>
                                {item.status === 'active' ? "Current Value" : "Sold Value"}
                            </ThemedText>
                            <ThemedText style={styles.currentValue}>{formatAmount(totalCurrentValueForItem)}</ThemedText>
                            <ThemedText style={[styles.valueLabel, { color: secondaryTextColor, marginTop: 9 }]}>Invested {formatAmount(invested)}</ThemedText>
                        </View>
                        <View style={{alignItems: 'flex-end', justifyContent: 'center'}}>
                            <View style={[styles.returnBadge, { backgroundColor: isProfit ? "#34C75918" : "#FF3B3018" }]}>
                                <Feather name={isProfit ? "trending-up" : "trending-down"} size={14} color={isProfit ? "#34C759" : "#FF3B30"} />
                                <ThemedText style={[styles.gainLoss, { color: isProfit ? "#34C759" : "#FF3B30" }]}>
                                {isProfit ? "+" : ""}{formatAmount(gainLoss)}
                                </ThemedText>
                            </View>
                            <ThemedText style={[styles.gainLossPercentage, { color: isProfit ? "#34C759" : "#FF3B30" }]}>
                                ({percentage.toFixed(2)}%)
                            </ThemedText>
                        </View>
                    </View>
                </ThemedView>
            </Pressable>
        );
    };

    return (
        <ThemedView style={styles.container}>
            <StatusBar style={theme === "light" ? "dark" : "light"} />
            <View style={styles.header}>
                <ThemedText style={[styles.eyebrow, { color: secondaryTextColor }]}>PORTFOLIO</ThemedText>
                <ThemedText style={styles.headerTitle}>Investments</ThemedText>
                <ThemedText style={[styles.headerSubtitle, { color: secondaryTextColor }]}>Track your wealth as it grows</ThemedText>
            </View>

            <ThemedView style={[styles.summaryContainer, {backgroundColor: primaryColor, shadowColor: textColor}]}>
               <View style={styles.summaryHeader}>
                   <ThemedText style={[styles.summaryLabel, {color: accentTextColor, opacity: 0.75}]}>{summaryTitle}</ThemedText>
                   <Feather name="pie-chart" size={18} color={accentTextColor} />
               </View>
               <ThemedText style={[styles.summaryValue, { color: accentTextColor }]}>{formatAmount(summaryValue)}</ThemedText>
               {activeFilter === 'active' && (
                   <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4}}>
                       <Feather name={summaryGainLoss >= 0 ? "trending-up" : "trending-down"} size={16} color={accentTextColor}/>
                       <ThemedText style={[styles.summaryGainLoss, {color: accentTextColor, marginLeft: 4}]}>
                           {formatAmount(summaryGainLoss)} ({gainLossPercentage.toFixed(2)}%)
                       </ThemedText>
                   </View>
               )}
            </ThemedView>

            <View style={[styles.filterContainer, { backgroundColor: cardColor }]}>
                {/* --- MODIFIED: Using border for selection instead of background color --- */}
                <Pressable
                    onPress={() => setActiveFilter('active')}
                    style={[
                        styles.filterButton,
                        {
                            backgroundColor: activeFilter === 'active' ? primaryColor : 'transparent',
                        }
                    ]}
                >
                    <ThemedText style={[styles.filterText, { color: activeFilter === 'active' ? accentTextColor : textColor }]}>Active</ThemedText>
                </Pressable>
                <Pressable
                    onPress={() => setActiveFilter('sold')}
                    style={[
                        styles.filterButton,
                        {
                            backgroundColor: activeFilter === 'sold' ? primaryColor : 'transparent',
                        }
                    ]}
                >
                    <ThemedText style={[styles.filterText, { color: activeFilter === 'sold' ? accentTextColor : textColor }]}>Sold</ThemedText>
                </Pressable>
            </View>

            <FlatList
                data={filteredInvestments}
                renderItem={({ item }) => <InvestmentCard item={item} />}
                keyExtractor={(item) => item.uuid}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={isSyncing} onRefresh={triggerUploadSync} tintColor={textColor}/>}
                ListEmptyComponent={(
                    <ThemedView style={styles.emptyStateContainer}>
                        <Feather name={activeFilter === 'active' ? 'trending-up' : 'archive'} size={48} color={secondaryTextColor} />
                        <ThemedText style={styles.emptyStateTitle}>No {activeFilter} investments</ThemedText>
                        <ThemedText style={[styles.emptyStateSubtitle, {color: secondaryTextColor}]}>
                            Your {activeFilter === 'active' ? 'active investments will appear here once you add them.' : 'sold investments will appear here once you mark them as sold.'}
                        </ThemedText>
                    </ThemedView>
                )}
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: 42, paddingHorizontal: 20, paddingBottom: 16 },
    eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
    headerTitle: { fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 13, marginTop: 5 },
    summaryContainer: { marginHorizontal: 18, borderRadius: 22, padding: 20, marginBottom: 14, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 3 },
    summaryHeader: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    summaryLabel: { fontSize: 13, fontWeight: '700' },
    summaryValue: { width: '100%', fontSize: 34, fontWeight: '800', marginTop: 12, letterSpacing: -0.6 },
    summaryGainLoss: { fontSize: 14, fontWeight: '700' },
    listContainer: { paddingHorizontal: 18, paddingBottom: 100 },
    card: { borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(125, 137, 133, 0.12)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.025, shadowRadius: 8, elevation: 1 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    nameBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 8 },
    typeIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    nameTextBlock: { flex: 1 },
    investmentName: { fontSize: 16, fontWeight: '700' },
    purchaseDate: { fontSize: 11, marginTop: 3 },
    investmentTypeChip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, marginLeft: 6 },
    soldChip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, marginLeft: 6 },
    investmentTypeText: { fontSize: 10, fontWeight: '700' },
    cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end'},
    valueLabel: { fontSize: 11, marginBottom: 3, fontWeight: '600' },
    currentValue: { fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
    investedValue: { fontSize: 14, fontWeight: '500' },
    returnBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6 },
    gainLoss: { fontSize: 13, fontWeight: '700' },
    gainLossPercentage: { fontSize: 11, marginTop: 5, textAlign: 'right' },
    emptyStateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    emptyStateTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 16 },
    emptyStateSubtitle: { fontSize: 16, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
    filterContainer: { flexDirection: 'row', marginHorizontal: 18, padding: 4, borderRadius: 14, marginBottom: 14 },
    filterButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 9,
        borderRadius: 10,
    },
    filterText: { fontWeight: '600' },
});