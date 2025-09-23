// In app/add-income.tsx

import { Feather } from "@expo/vector-icons";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
    ActivityIndicator, // Add this import
    Alert,
    FlatList, // Add this import
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput, // Add this import
    View,
} from "react-native";

// Import themed components and hooks
import { ThemedText } from "../components/themed-text";
import { ThemedView } from "../components/themed-view";
import { useAppData } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { useThemeColor } from "../hooks/use-theme-color";

interface Category {
  name: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  color: string;
}

// A new, simpler list of categories for income
const incomeCategories: Category[] = [
  { name: "Salary", icon: "dollar-sign", color: "#45B7D1" },
  { name: "Freelance", icon: "briefcase", color: "#4ECDC4" },
  { name: "Investment", icon: "trending-up", color: "#96CEB4" },
  { name: "Gift", icon: "gift", color: "#FECA57" },
  { name: "Rental", icon: "home", color: "#54A0FF" },
  { name: "Other", icon: "archive", color: "#00D2D3" },
];

export default function AddIncomeScreen() {
  const router = useRouter();
  const { addTransaction } = useAppData();
  const { theme } = useTheme();

  // State
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Theme Colors
  const cardColor = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');
  const backgroundColor = useThemeColor({}, 'background');
  const saveButtonActiveColor = theme === 'light' ? '#1C1C1E' : cardColor;
  const saveButtonTextColor = theme === 'light' ? '#FFFFFF' : textColor;

  const showDatePicker = () => {
    DateTimePickerAndroid.open({
      value: date,
      onChange: (event, selectedDate) => setDate(selectedDate || date),
      mode: "date",
    });
  };

  const handleSave = async () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return Alert.alert("Invalid Amount", "Please enter an amount greater than zero.");
    }
    if (!selectedCategory) {
      return Alert.alert("Select Category", "Please select a category for this income.");
    }

    setIsSaving(true);
    try {
      await addTransaction({
        type: 'income',
        amount: numericAmount,
        category: selectedCategory,
        date: date.toISOString(),
        notes: notes,
      });
      router.back();
    } catch (error) {
      console.error("Failed to save income:", error);
      Alert.alert("Error", "Could not save income.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      <KeyboardAvoidingView 
        style={{flex: 1}} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Add Income</ThemedText>
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
              <Feather name="x" size={24} color={textColor} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Amount Input Card */}
          <ThemedView style={[styles.card, { backgroundColor: cardColor, shadowColor: textColor }]}>
            <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>Amount</ThemedText>
            <View style={styles.amountContainer}>
              <ThemedText style={styles.currencySymbol}>₹</ThemedText>
              <TextInput
                style={[styles.amountInput, { color: textColor }]}
                placeholder="0"
                placeholderTextColor={secondaryTextColor}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                autoFocus={true}
              />
            </View>
          </ThemedView>

          {/* Category Selection */}
          <ThemedView style={[styles.card, { backgroundColor: cardColor, shadowColor: textColor }]}>
            <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>Source</ThemedText>
            <FlatList
              data={incomeCategories}
              numColumns={3}
              scrollEnabled={false}
              keyExtractor={(item) => item.name}
              renderItem={({ item }) => {
                const isSelected = selectedCategory === item.name;
                return (
                  <Pressable
                    style={[ styles.categoryButton, { backgroundColor: isSelected ? item.color : backgroundColor } ]}
                    onPress={() => setSelectedCategory(item.name)}
                  >
                    <Feather name={item.icon} size={24} color={isSelected ? "white" : textColor} />
                    <ThemedText style={[ styles.categoryText, { color: isSelected ? "white" : secondaryTextColor } ]}>
                      {item.name}
                    </ThemedText>
                  </Pressable>
                );
              }}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
            />
          </ThemedView>

          {/* Details Card */}
          <ThemedView style={[styles.card, { backgroundColor: cardColor, shadowColor: textColor }]}>
            <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>Details</ThemedText>
            <Pressable style={[styles.detailItem, { borderBottomColor: backgroundColor }]} onPress={showDatePicker}>
              <ThemedView style={[styles.detailIconContainer, { backgroundColor: backgroundColor }]}>
                <Feather name="calendar" size={20} color="#3478F6" />
              </ThemedView>
              <View style={styles.detailContent}>
                <ThemedText style={[styles.detailLabel, { color: secondaryTextColor }]}>Date</ThemedText>
                <ThemedText style={styles.detailValue}>
                  {date.toLocaleDateString("en-IN", { year: 'numeric', month: 'long', day: 'numeric' })}
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={16} color={secondaryTextColor} />
            </Pressable>
            <View style={[styles.detailItem, { borderBottomWidth: 0 }]}>
              <ThemedView style={[styles.detailIconContainer, { backgroundColor: backgroundColor }]}>
                <Feather name="edit-3" size={20} color="#34C759" />
              </ThemedView>
              <View style={styles.detailContent}>
                <ThemedText style={[styles.detailLabel, { color: secondaryTextColor }]}>Notes</ThemedText>
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
          
          <View style={styles.saveButtonContainer}>
            <Pressable 
              style={[ styles.saveButton, { backgroundColor: saveButtonActiveColor }, (!amount || !selectedCategory || isSaving) && styles.saveButtonDisabled ]} 
              onPress={handleSave} 
              disabled={!amount || !selectedCategory || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={theme === 'light' ? 'white' : textColor} />
              ) : (
                <ThemedText style={[styles.saveButtonText, { color: saveButtonTextColor }]}>Save Income</ThemedText>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

// You can copy the exact same StyleSheet from your `add-expense.tsx` file
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
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
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 20,
  },
  amountContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  currencySymbol: { 
    fontSize: 32, 
    fontWeight: "600", 
    marginRight: 8,
    marginTop: 12,
  },
  amountInput: { 
    fontSize: 64, 
    fontWeight: "400",
    flex: 1,
  },
  categoryButton: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    padding: 8,
  },
  categoryText: { 
    fontSize: 13, 
    fontWeight: '600',
    marginTop: 8,
  },
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: { 
    fontSize: 16, 
    fontWeight: '500',
    marginTop: 2,
  },
  notesInput: { 
    fontSize: 16, 
    fontWeight: '500',
    paddingVertical: 0,
    marginTop: 2,
  },
  saveButtonContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  saveButton: {
    borderRadius: 16,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: "#AEAEB2",
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: "600",
  },
});