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
    const { theme } = useTheme();

    const [activeFilter, setActiveFilter] = useState<'active' | 'sold'>('active');

    const cardColor = useThemeColor({}, "card");
    const textColor = useThemeColor({}, "text");
    const secondaryTextColor = useThemeColor({}, "tabIconDefault");
    const backgroundColor = useThemeColor({}, "background");
    const primaryColor = useThemeColor({}, "tint");

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
                        <ThemedText style={styles.investmentName}>{item.name}</ThemedText>
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
                            <ThemedText style={[styles.valueLabel, { color: secondaryTextColor, marginTop: 8 }]}>Invested</ThemedText>
                            <ThemedText style={[styles.investedValue, {color: textColor}]}>{formatAmount(invested)}</ThemedText>
                        </View>
                        <View style={{alignItems: 'flex-end', justifyContent: 'center'}}>
                            <ThemedText style={[styles.gainLoss, { color: isProfit ? "#34C759" : "#FF3B30" }]}>
                                {isProfit ? "+" : ""}{formatAmount(gainLoss)}
                            </ThemedText>
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
                <ThemedText style={styles.headerTitle}>Investments</ThemedText>
            </View>

            <ThemedView style={[styles.summaryContainer, {backgroundColor: cardColor}]}>
               <ThemedText style={[styles.summaryLabel, {color: secondaryTextColor}]}>{summaryTitle}</ThemedText>
               <ThemedText style={styles.summaryValue}>{formatAmount(summaryValue)}</ThemedText>
               {activeFilter === 'active' && (
                   <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4}}>
                       <Feather name={summaryGainLoss >= 0 ? "trending-up" : "trending-down"} size={16} color={summaryGainLoss >= 0 ? "#34C759" : "#FF3B30"}/>
                       <ThemedText style={[styles.summaryGainLoss, {color: summaryGainLoss >= 0 ? "#34C759" : "#FF3B30", marginLeft: 4}]}>
                           {formatAmount(summaryGainLoss)} ({gainLossPercentage.toFixed(2)}%)
                       </ThemedText>
                   </View>
               )}
            </ThemedView>

            <View style={styles.filterContainer}>
                {/* --- MODIFIED: Using border for selection instead of background color --- */}
                <Pressable
                    onPress={() => setActiveFilter('active')}
                    style={[
                        styles.filterButton,
                        {
                            borderColor: activeFilter === 'active' ? primaryColor : 'transparent',
                        }
                    ]}
                >
                    <ThemedText style={[styles.filterText, { color: activeFilter === 'active' ? primaryColor : textColor }]}>Active</ThemedText>
                </Pressable>
                <Pressable
                    onPress={() => setActiveFilter('sold')}
                    style={[
                        styles.filterButton,
                        {
                            borderColor: activeFilter === 'sold' ? primaryColor : 'transparent',
                        }
                    ]}
                >
                    <ThemedText style={[styles.filterText, { color: activeFilter === 'sold' ? primaryColor : textColor }]}>Sold</ThemedText>
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
    header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
    headerTitle: { fontSize: 28, fontWeight: "bold" },
    summaryContainer: { marginHorizontal: 20, borderRadius: 20, padding: 20, marginBottom: 12, alignItems: 'center' },
    summaryLabel: { fontSize: 14, fontWeight: '500' },
    summaryValue: { fontSize: 32, fontWeight: 'bold', marginTop: 4 },
    summaryGainLoss: { fontSize: 16, fontWeight: '600' },
    listContainer: { paddingHorizontal: 20, paddingBottom: 100 },
    card: { borderRadius: 16, padding: 16, marginBottom: 16, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    investmentName: { fontSize: 18, fontWeight: '600', flex: 1 },
    investmentTypeChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
    soldChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
    investmentTypeText: { fontSize: 12, fontWeight: '500' },
    cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
    valueLabel: { fontSize: 14, marginBottom: 2 },
    currentValue: { fontSize: 20, fontWeight: 'bold' },
    investedValue: { fontSize: 14, fontWeight: '500' },
    gainLoss: { fontSize: 16, fontWeight: '600' },
    gainLossPercentage: { fontSize: 14, marginTop: 2 },
    emptyStateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    emptyStateTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 16 },
    emptyStateSubtitle: { fontSize: 16, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
    filterContainer: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 20 },
    // --- MODIFIED: Added borderWidth to the button style ---
    filterButton: {
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
        borderWidth: 2, // Applied a border to maintain size consistency
    },
    filterText: { fontWeight: '600' },
});