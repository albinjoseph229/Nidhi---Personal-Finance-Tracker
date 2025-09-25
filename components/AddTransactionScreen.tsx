import { Feather } from "@expo/vector-icons";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from "react-native";

import { useAppData } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { useThemeColor } from "../hooks/use-theme-color";
import {
    formatDateForDisplay,
    getISTDate,
    parseAndNormalizeToIST,
} from "../utils/dateUtils";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

interface Category {
  name: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  color: string;
}

const EXPENSE_CATEGORIES: Category[] = [
  { name: "Food", icon: "coffee", color: "#FF6B6B" },
  { name: "Transport", icon: "truck", color: "#4ECDC4" },
  { name: "Shopping", icon: "shopping-bag", color: "#45B7D1" },
  { name: "Bills", icon: "file-text", color: "#96CEB4" },
  { name: "Health", icon: "heart", color: "#FECA57" },
  { name: "Leisure", icon: "smile", color: "#FF9FF3" },
  { name: "Home", icon: "home", color: "#54A0FF" },
  { name: "Education", icon: "book-open", color: "#5F27CD" },
  { name: "Other", icon: "archive", color: "#00D2D3" },
];

const INCOME_CATEGORIES: Category[] = [
  { name: "Salary", icon: "dollar-sign", color: "#45B7D1" },
  { name: "Freelance", icon: "briefcase", color: "#4ECDC4" },
  { name: "Investment", icon: "trending-up", color: "#96CEB4" },
  { name: "Gift", icon: "gift", color: "#FECA57" },
  { name: "Rental", icon: "home", color: "#54A0FF" },
  { name: "Other", icon: "archive", color: "#00D2D3" },
];

export function AddTransactionScreen({ type }: { type: "income" | "expense" }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ uuid?: string }>();
  const { transactions, addTransaction, updateTransaction, deleteTransaction } =
    useAppData();
  const { theme } = useTheme();

  const isEditMode = !!params.uuid;

  // --- Dynamic Content based on 'type' prop ---
  const isIncome = type === "income";
  const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const screenTitle = isIncome ? "Income" : "Expense";
  const categoryTitle = isIncome ? "Source" : "Category";
  // ---

  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [date, setDate] = useState(getISTDate());
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      const transactionToEdit = transactions.find(
        (tx) => tx.uuid === params.uuid
      );
      if (transactionToEdit) {
        setAmount(String(transactionToEdit.amount));
        setSelectedCategory(transactionToEdit.category);
        setDate(getISTDate(transactionToEdit.date));
        setNotes(transactionToEdit.notes);
      }
    }
  }, [params.uuid, transactions]);

  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const secondaryTextColor = useThemeColor({}, "tabIconDefault");
  const backgroundColor = useThemeColor({}, "background");
  const saveButtonActiveColor = theme === "light" ? "#1C1C1E" : cardColor;
  const saveButtonTextColor = theme === "light" ? "#FFFFFF" : textColor;

  const showDatePicker = () => {
    DateTimePickerAndroid.open({
      value: date,
      onChange: (event, selectedDate) => {
        if (selectedDate) {
          const istDate = getISTDate(selectedDate.toISOString());
          setDate(istDate);
        }
      },
      mode: "date",
    });
  };

  const handleDelete = () => {
    if (!params.uuid) return;
    Alert.alert(
      `Delete ${screenTitle}`,
      `Are you sure you want to permanently delete this ${type} record?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTransaction(params.uuid!);
              if (router.canGoBack()) {
                router.back();
              }
            } catch (error) {
              Alert.alert("Error", "Failed to delete the transaction.");
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return Alert.alert(
        "Invalid Amount",
        "Please enter an amount greater than zero."
      );
    }
    if (!selectedCategory) {
      return Alert.alert(
        `Select ${categoryTitle}`,
        `Please select a ${categoryTitle.toLowerCase()} for this ${type}.`
      );
    }

    setIsSaving(true);
    const istDateString = parseAndNormalizeToIST(date.toISOString());
    const txData = {
      type: type, // Dynamically set the type
      amount: numericAmount,
      category: selectedCategory,
      date: istDateString,
      notes: notes,
    };

    try {
      if (isEditMode) {
        await updateTransaction(params.uuid!, txData);
      } else {
        await addTransaction(txData);
      }
      if (router.canGoBack()) {
        router.back();
      }
    } catch (error) {
      console.error(`Failed to save ${type}:`, error);
      Alert.alert(
        "Error",
        `Could not ${isEditMode ? "update" : "save"} the ${type}.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <StatusBar style={theme === "light" ? "dark" : "light"} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>
            {isEditMode ? `Edit ${screenTitle}` : `Add ${screenTitle}`}
          </ThemedText>
          <View style={styles.headerActions}>
            {isEditMode && (
              <Pressable onPress={handleDelete} style={styles.deleteButton}>
                <Feather name="trash-2" size={22} color={"#FF3B30"} />
              </Pressable>
            )}
            <Pressable onPress={() => router.back()} style={styles.closeButton}>
              <Feather name="x" size={24} color={textColor} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Amount Card */}
          <ThemedView
            style={[
              styles.card,
              { backgroundColor: cardColor, shadowColor: textColor },
            ]}
          >
            <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>
              Amount
            </ThemedText>
            <View style={styles.amountContainer}>
              <ThemedText style={[styles.currencySymbol, { color: secondaryTextColor }]}>
                ₹
              </ThemedText>
              <TextInput
                style={[styles.amountInput, { color: textColor }]}
                placeholder="0"
                placeholderTextColor={secondaryTextColor}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                autoFocus={!isEditMode}
              />
            </View>
          </ThemedView>

          {/* Category Card */}
          <ThemedView
            style={[
              styles.card,
              { backgroundColor: cardColor, shadowColor: textColor },
            ]}
          >
            <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>
              {categoryTitle}
            </ThemedText>
            <FlatList
              data={categories} // Use dynamic categories list
              numColumns={3}
              scrollEnabled={false}
              keyExtractor={(item) => item.name}
              renderItem={({ item }) => {
                const isSelected = selectedCategory === item.name;
                return (
                  <Pressable
                    style={[
                      styles.categoryButton,
                      {
                        backgroundColor: isSelected
                          ? item.color
                          : backgroundColor,
                      },
                    ]}
                    onPress={() => setSelectedCategory(item.name)}
                  >
                    <Feather
                      name={item.icon}
                      size={24}
                      color={isSelected ? "white" : textColor}
                    />
                    <ThemedText
                      style={[
                        styles.categoryText,
                        { color: isSelected ? "white" : secondaryTextColor },
                      ]}
                    >
                      {item.name}
                    </ThemedText>
                  </Pressable>
                );
              }}
              columnWrapperStyle={{ justifyContent: "space-between" }}
            />
          </ThemedView>
          
          {/* Details Card */}
          <ThemedView
            style={[
              styles.card,
              { backgroundColor: cardColor, shadowColor: textColor },
            ]}
          >
            <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>
              Details
            </ThemedText>
            <Pressable
              style={[
                styles.detailItem,
                { borderBottomColor: backgroundColor },
              ]}
              onPress={showDatePicker}
            >
              <ThemedView style={[ styles.detailIconContainer, { backgroundColor: backgroundColor }]} >
                <Feather name="calendar" size={20} color="#3478F6" />
              </ThemedView>
              <View style={styles.detailContent}>
                <ThemedText style={[styles.detailLabel, { color: secondaryTextColor }]}>
                  Date
                </ThemedText>
                <ThemedText style={styles.detailValue}>
                  {date
                    ? formatDateForDisplay(date.toISOString())
                    : "Select Date"}
                </ThemedText>
              </View>
              <Feather
                name="chevron-right"
                size={16}
                color={secondaryTextColor}
              />
            </Pressable>
            <View style={[styles.detailItem, { borderBottomWidth: 0 }]}>
              <ThemedView style={[ styles.detailIconContainer, { backgroundColor: backgroundColor }]} >
                <Feather name="edit-3" size={20} color="#34C759" />
              </ThemedView>
              <View style={styles.detailContent}>
                <ThemedText style={[styles.detailLabel, { color: secondaryTextColor }]}>
                  Notes
                </ThemedText>
                <TextInput
                  style={[styles.notesInput, { color: textColor }]}
                  placeholder="Optional"
                  placeholderTextColor={secondaryTextColor}
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>
            </View>
          </ThemedView>
        </ScrollView>

        <ThemedView style={styles.bottomContainer}>
          <Pressable
            style={[
              styles.saveButton,
              { backgroundColor: saveButtonActiveColor },
              (!amount || !selectedCategory || isSaving) &&
                styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!amount || !selectedCategory || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={saveButtonTextColor} />
            ) : (
              <ThemedText style={[styles.saveButtonText, { color: saveButtonTextColor }]}>
                {isEditMode ? `Update ${screenTitle}` : `Save ${screenTitle}`}
              </ThemedText>
            )}
          </Pressable>
        </ThemedView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

// You can keep the styles from add-expense.tsx here, they are compatible
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: { fontSize: 28, fontWeight: "bold" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  deleteButton: {},
  closeButton: { padding: 4 },
  card: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: "600", marginBottom: 20 },
  amountContainer: { flexDirection: "row", alignItems: "flex-start" },
  currencySymbol: {
    fontSize: 32,
    fontWeight: "600",
    marginRight: 8,
    marginTop: 12,
  },
  amountInput: { fontSize: 64, fontWeight: "400", flex: 1 },
  categoryButton: {
    width: "30%",
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    padding: 8,
  },
  categoryText: { fontSize: 13, fontWeight: "600", marginTop: 8, textAlign: 'center' },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  detailIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 16, fontWeight: "500", marginTop: 2 },
  notesInput: {
    fontSize: 16,
    fontWeight: "500",
    paddingVertical: 0,
    marginTop: 2,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 12,
  },
  saveButton: {
    borderRadius: 16,
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { fontSize: 18, fontWeight: "600" },
});