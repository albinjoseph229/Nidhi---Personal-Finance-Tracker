import { Feather } from "@expo/vector-icons";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from "react-native";

import { ThemedText } from "../components/themed-text";
import { ThemedView } from "../components/themed-view";
import { useAppData } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { Investment } from "../database";
import { useThemeColor } from "../hooks/use-theme-color";
import {
    formatDateForDisplay,
    getISTDate,
    parseAndNormalizeToIST,
} from "../utils/dateUtils";

interface Category {
    name: Investment["type"];
    icon: React.ComponentProps<typeof Feather>["name"];
    color: string;
}

const investmentCategories: Category[] = [
    { name: "Stock", icon: "bar-chart-2", color: "#45B7D1" },
    { name: "Gold", icon: "disc", color: "#FECA57" },
    { name: "Silver", icon: "aperture", color: "#BDC3C7" },
    { name: "Crypto", icon: "dollar-sign", color: "#9B59B6" },
    { name: "Mutual Fund", icon: "layers", color: "#4ECDC4" },
    { name: "Other", icon: "archive", color: "#96CEB4" },
];

// --- A simple, self-contained modal for selling ---
const SellInvestmentModal = ({ isVisible, onClose, onSell }: { isVisible: boolean, onClose: () => void, onSell: (price: string) => void }) => {
    const [price, setPrice] = useState('');
    const cardColor = useThemeColor({}, "card");
    const textColor = useThemeColor({}, "text");
    const separatorColor = useThemeColor({}, "tabIconDefault");

    const handleSell = () => {
        if (price && !isNaN(parseFloat(price))) {
            onSell(price);
            setPrice('');
        } else {
            Alert.alert("Invalid Price", "Please enter a valid number.");
        }
    };

    return (
        <Modal transparent visible={isVisible} animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.modalBackdrop} onPress={onClose}>
                <Pressable style={{ width: '80%', padding: 20, backgroundColor: cardColor, borderRadius: 20 }} onPress={() => {}}>
                    <ThemedText style={{ fontSize: 18, fontWeight: '600', textAlign: 'center' }}>Sell Investment</ThemedText>
                    <ThemedText style={{ textAlign: 'center', marginVertical: 8, opacity: 0.7 }}>Enter the final selling price per unit.</ThemedText>
                    <TextInput
                        style={[styles.textInput, { color: textColor, borderBottomColor: separatorColor, textAlign: 'center', fontSize: 24, marginVertical: 16 }]}
                        placeholder="0.00"
                        placeholderTextColor={textColor + '50'}
                        keyboardType="decimal-pad"
                        value={price}
                        onChangeText={setPrice}
                        autoFocus
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
                        <Pressable style={[styles.modalButton, { backgroundColor: '#FF3B30' }]} onPress={onClose}>
                            <ThemedText style={styles.saveButtonText}>Cancel</ThemedText>
                        </Pressable>
                        <Pressable style={[styles.modalButton, { backgroundColor: '#4CAF50' }]} onPress={handleSell}>
                            <ThemedText style={styles.saveButtonText}>Confirm Sell</ThemedText>
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

export default function AddInvestmentScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ uuid?: string }>();
    const { investments, addInvestment, updateInvestment, deleteInvestment, addTransaction } = useAppData();
    const { theme } = useTheme();
    const isEditMode = !!params.uuid;

    const [name, setName] = useState("");
    const [selectedType, setSelectedType] = useState<Investment["type"] | null>(null);
    const [quantity, setQuantity] = useState("");
    const [purchasePrice, setPurchasePrice] = useState("");
    const [currentValue, setCurrentValue] = useState("");
    const [purchaseDate, setPurchaseDate] = useState(getISTDate());
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<"active" | "sold">("active");
    const [soldPrice, setSoldPrice] = useState<number | undefined>(undefined);
    const [isSellModalVisible, setSellModalVisible] = useState(false);

    useEffect(() => {
        if (isEditMode) {
            const investmentToEdit = investments.find((inv) => inv.uuid === params.uuid);
            if (investmentToEdit) {
                setName(investmentToEdit.name);
                setSelectedType(investmentToEdit.type);
                setQuantity(String(investmentToEdit.quantity));
                setPurchasePrice(String(investmentToEdit.purchasePrice));
                setCurrentValue(String(investmentToEdit.currentValue));
                setPurchaseDate(getISTDate(investmentToEdit.purchaseDate));
                setStatus(investmentToEdit.status);
                setSoldPrice(investmentToEdit.soldPrice);
            }
        }
    }, [params.uuid, investments]);

    const cardColor = useThemeColor({}, "card");
    const textColor = useThemeColor({}, "text");
    const secondaryTextColor = useThemeColor({}, "tabIconDefault");
    const backgroundColor = useThemeColor({}, "background");
    const saveButtonActiveColor = theme === "light" ? "#1C1C1E" : cardColor;
    const saveButtonTextColor = theme === "light" ? "#FFFFFF" : textColor;

    const showDatePicker = () => {
        DateTimePickerAndroid.open({
            value: purchaseDate,
            onChange: (event, selectedDate) => {
                if (selectedDate) {
                    const istDate = getISTDate(selectedDate.toISOString());
                    setPurchaseDate(istDate);
                }
            },
            mode: "date",
        });
    };
    
    // FIX 3: Implement the delete functionality
    const handleDelete = () => {
        if (!params.uuid) return;

        Alert.alert(
            "Delete Investment",
            "Are you sure you want to permanently delete this investment? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteInvestment(params.uuid!);
                            if (router.canGoBack()) {
                                router.back();
                            }
                        } catch (error) {
                            Alert.alert("Error", "Failed to delete the investment.");
                        }
                    },
                },
            ]
        );
    };

    const confirmSell = async (priceString: string) => {
        setSellModalVisible(false);
        const investmentToSell = investments.find(inv => inv.uuid === params.uuid);
        if (!investmentToSell) return;

        const numSoldPrice = parseFloat(priceString);
        if (isNaN(numSoldPrice) || numSoldPrice < 0) {
            return Alert.alert("Invalid Price", "The entered price is not a valid number.");
        }

        setIsSaving(true);
        try {
            const updatedInvestmentData: Omit<Investment, 'uuid' | 'isSynced'> = {
                ...investmentToSell,
                status: "sold",
                soldPrice: numSoldPrice,
                currentValue: numSoldPrice,
            };

            await updateInvestment(params.uuid!, updatedInvestmentData);

            const totalPurchasePrice = investmentToSell.purchasePrice * investmentToSell.quantity;
            const totalSoldPrice = numSoldPrice * investmentToSell.quantity;
            const profitOrLoss = totalSoldPrice - totalPurchasePrice;

            await addTransaction({
                type: profitOrLoss >= 0 ? 'income' : 'expense',
                amount: Math.abs(profitOrLoss),
                category: 'Investment',
                date: new Date().toISOString(),
                notes: `Sold ${investmentToSell.name} (${profitOrLoss >= 0 ? 'Profit' : 'Loss'})`
            });

            if (router.canGoBack()) router.back();
        } catch (error) {
            Alert.alert("Error", "Could not update the investment.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        const numQuantity = parseFloat(quantity);
        const numPurchasePrice = parseFloat(purchasePrice);
        const numCurrentValue = parseFloat(currentValue);

        if (!name.trim() || !selectedType || isNaN(numQuantity) || isNaN(numPurchasePrice) || isNaN(numCurrentValue)) {
            return;
        }

        setIsSaving(true);
        const invData = {
            name: name.trim(),
            type: selectedType!,
            quantity: numQuantity,
            purchasePrice: numPurchasePrice,
            purchaseDate: parseAndNormalizeToIST(purchaseDate.toISOString()),
            currentValue: numCurrentValue,
            status: status,
            soldPrice: soldPrice,
        };

        try {
            if (isEditMode) {
                await updateInvestment(params.uuid!, invData);
            } else {
                await addInvestment(invData);
            }
            if (router.canGoBack()) router.back();
        } catch (error) {
            console.error("Failed to save investment:", error);
            Alert.alert("Error", `Could not ${isEditMode ? "update" : "save"} the investment.`);
        } finally {
            setIsSaving(false);
        }
    };

    const isFormValid = name && selectedType && quantity && purchasePrice && currentValue;
    const isSold = status === 'sold';

    return (
        <ThemedView style={styles.container}>
            <StatusBar style={theme === "light" ? "dark" : "light"} />
            <SellInvestmentModal
                isVisible={isSellModalVisible}
                onClose={() => setSellModalVisible(false)}
                onSell={confirmSell}
            />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <View style={styles.header}>
                    <ThemedText style={styles.headerTitle}>{isEditMode ? "Edit" : "Add"} Investment</ThemedText>
                    <View style={styles.headerActions}>
                        {isSold && (<View style={styles.soldBadge}><ThemedText style={styles.soldBadgeText}>SOLD</ThemedText></View>)}
                        {isEditMode && (<Pressable onPress={handleDelete} style={styles.deleteButton}><Feather name="trash-2" size={22} color={"#FF3B30"} /></Pressable>)}
                        <Pressable onPress={() => router.back()} style={styles.closeButton}><Feather name="x" size={24} color={textColor} /></Pressable>
                    </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    <ThemedView style={[styles.card, { backgroundColor: cardColor, shadowColor: textColor }]}>
                        <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>Asset Name</ThemedText>
                        <TextInput style={[styles.textInput, { color: textColor }]} placeholder="e.g., Reliance Industries" placeholderTextColor={secondaryTextColor} value={name} onChangeText={setName} editable={!isSold} />
                    </ThemedView>

                    <ThemedView style={[styles.card, { backgroundColor: cardColor, shadowColor: textColor }]}>
                        <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>Type</ThemedText>
                        <View style={styles.categoryContainer}>
                            {investmentCategories.map((item) => (
                                <Pressable key={item.name} style={[styles.categoryButton, { backgroundColor: selectedType === item.name ? item.color : backgroundColor }]} onPress={() => !isSold && setSelectedType(item.name)}>
                                    <Feather name={item.icon} size={24} color={selectedType === item.name ? "white" : textColor} />
                                    <ThemedText style={[styles.categoryText, { color: selectedType === item.name ? "white" : secondaryTextColor }]}>{item.name}</ThemedText>
                                </Pressable>
                            ))}
                        </View>
                    </ThemedView>

                    <ThemedView style={[styles.card, { backgroundColor: cardColor, shadowColor: textColor }]}>
                        <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>Details</ThemedText>
                        <View style={styles.inputRow}>
                            <View style={styles.inputContainer}><ThemedText style={[styles.detailLabel, { color: secondaryTextColor }]}>Quantity</ThemedText><TextInput style={[styles.textInput, { color: textColor }]} placeholder="e.g., 10" value={quantity} onChangeText={setQuantity} editable={!isSold} keyboardType="decimal-pad" /></View>
                            <View style={styles.inputContainer}><ThemedText style={[styles.detailLabel, { color: secondaryTextColor }]}>Purchase Price</ThemedText><TextInput style={[styles.textInput, { color: textColor }]} placeholder="e.g., 1500" value={purchasePrice} onChangeText={setPurchasePrice} editable={!isSold} keyboardType="decimal-pad" /></View>
                        </View>
                        <View style={styles.inputContainer}><ThemedText style={[styles.detailLabel, { color: secondaryTextColor }]}>Current Value</ThemedText><TextInput style={[styles.textInput, { color: textColor, marginTop: 4 }]} placeholder="e.g., 1650" value={currentValue} onChangeText={setCurrentValue} editable={!isSold} keyboardType="decimal-pad" /></View>
                        
                        {isSold && soldPrice !== undefined && (
                            <View style={[styles.inputContainer, { marginTop: 16 }]}>
                                <ThemedText style={[styles.detailLabel, { color: "#4CAF50" }]}>Sold Price (per unit)</ThemedText>
                                <TextInput style={[styles.textInput, { color: "#4CAF50", fontWeight: 'bold' }]} value={String(soldPrice)} editable={false} />
                            </View>
                        )}
                        
                        <Pressable style={[styles.detailItem, { borderBottomColor: backgroundColor }]} onPress={() => !isSold && showDatePicker()}>
                            <ThemedView style={[styles.detailIconContainer, { backgroundColor: backgroundColor }]}><Feather name="calendar" size={20} color="#3478F6" /></ThemedView>
                            <View style={styles.detailContent}>
                                <ThemedText style={[styles.detailLabel, { color: secondaryTextColor }]}>Purchase Date</ThemedText>
                                <ThemedText style={styles.detailValue}>{purchaseDate ? formatDateForDisplay(purchaseDate.toISOString()) : "Select Date"}</ThemedText>
                            </View>
                            <Feather name="chevron-right" size={16} color={secondaryTextColor} />
                        </Pressable>
                    </ThemedView>
                </ScrollView>

                <ThemedView style={styles.bottomContainer}>
                    {isEditMode && !isSold && (
                        <Pressable style={styles.sellButton} onPress={() => setSellModalVisible(true)} disabled={isSaving}>
                            <ThemedText style={styles.saveButtonText}>Sell Investment</ThemedText>
                        </Pressable>
                    )}
                    <Pressable style={[styles.saveButton, { backgroundColor: saveButtonActiveColor, marginTop: isEditMode && !isSold ? 12 : 0 }, isSold && styles.saveButtonDisabled]} onPress={handleSave} disabled={!isFormValid || isSaving || isSold}>
                        {isSaving ? <ActivityIndicator color={saveButtonTextColor} /> : <ThemedText style={[styles.saveButtonText, { color: saveButtonTextColor }]}>{isEditMode ? "Update" : "Save Investment"}</ThemedText>}
                    </Pressable>
                </ThemedView>
            </KeyboardAvoidingView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingBottom: 20 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
    headerTitle: { fontSize: 28, fontWeight: "bold", flexShrink: 1 },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 16 },
    soldBadge: { backgroundColor: '#4CAF50', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    soldBadgeText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
    deleteButton: {},
    closeButton: { padding: 4 },
    card: { marginHorizontal: 20, marginBottom: 20, borderRadius: 20, padding: 24, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
    cardTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
    textInput: { fontSize: 18, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#E5E5EA" },
    categoryContainer: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
    categoryButton: { width: "48%", aspectRatio: 1.5, borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: 12, padding: 8 },
    categoryText: { fontSize: 13, fontWeight: "600", marginTop: 8, textAlign: "center" },
    inputRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    inputContainer: { flex: 1, marginHorizontal: 4 },
    detailItem: { flexDirection: "row", alignItems: "center", paddingTop: 24, borderTopWidth: 1, marginTop: 24 },
    detailIconContainer: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginRight: 16 },
    detailContent: { flex: 1 },
    detailLabel: { fontSize: 14, opacity: 0.7 },
    detailValue: { fontSize: 16, fontWeight: "500", marginTop: 2 },
    bottomContainer: { paddingHorizontal: 20, paddingVertical: 12, paddingBottom: Platform.OS === "ios" ? 34 : 12, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.2)' },
    saveButton: { borderRadius: 16, paddingVertical: 16, justifyContent: "center", alignItems: "center" },
    sellButton: { backgroundColor: '#4CAF50', borderRadius: 16, paddingVertical: 16, justifyContent: "center", alignItems: "center" },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: { fontSize: 18, fontWeight: "600", color: 'white' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalButton: { flex: 1, marginHorizontal: 8, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
});