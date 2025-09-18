import { FontAwesome } from "@expo/vector-icons";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAppData } from "../context/AppContext"; // Import the context hook

// Define the structure for a category
interface Category {
  name: string;
  icon: React.ComponentProps<typeof FontAwesome>["name"];
}

// List of available categories
const categories: Category[] = [
  { name: "Food", icon: "cutlery" },
  { name: "Transport", icon: "car" },
  { name: "Shopping", icon: "shopping-bag" },
  { name: "Bills", icon: "file-text-o" },
  { name: "Health", icon: "heartbeat" },
  { name: "Leisure", icon: "smile-o" },
  { name: "Home", icon: "home" },
  { name: "Education", icon: "book" },
  { name: "Other", icon: "inbox" },
];

export default function AddExpenseScreen() {
  const router = useRouter();
  const { addTransaction } = useAppData(); // Get the new function from context

  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const showDatePicker = () => {
    DateTimePickerAndroid.open({
      value: date,
      onChange: (event, selectedDate) => {
        const currentDate = selectedDate || date;
        setDate(currentDate);
      },
      mode: "date",
    });
  };

  const handleSave = async () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return Alert.alert("Invalid Amount", "Please enter an amount greater than zero.");
    }
    if (!selectedCategory) {
      return Alert.alert("Select Category", "Please select a category for this expense.");
    }

    setIsSaving(true);

    try {
      // Call the context function, which handles saving, refreshing, and syncing
      await addTransaction({
        amount: numericAmount,
        category: selectedCategory,
        date: date.toISOString(),
        notes: notes,
      });
      
      router.back();
    } catch (error) {
      console.error("Failed to save expense:", error);
      Alert.alert("Error", "Could not save expense.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.amountContainer}>
        <Text style={styles.currencySymbol}>₹</Text>
        <TextInput
          style={styles.amountInput}
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          autoFocus={true}
        />
      </View>

      <Text style={styles.sectionTitle}>Category</Text>
      <FlatList
        data={categories}
        numColumns={3}
        scrollEnabled={false}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => {
          const isSelected = selectedCategory === item.name;
          return (
            <Pressable
              style={[styles.categoryButton, isSelected && styles.selectedCategory]}
              onPress={() => setSelectedCategory(item.name)}
            >
              <FontAwesome
                name={item.icon}
                size={24}
                color={isSelected ? "white" : "#333"}
              />
              <Text style={[styles.categoryText, isSelected && { color: "white" }]}>
                {item.name}
              </Text>
            </Pressable>
          );
        }}
        contentContainerStyle={styles.categoryList}
      />

      <Text style={styles.sectionTitle}>Details</Text>
      <View style={styles.detailsContainer}>
        <Pressable style={styles.detailItem} onPress={showDatePicker}>
          <FontAwesome name="calendar" size={24} color="#555" />
          <Text style={styles.detailText}>{date.toLocaleDateString("en-GB")}</Text>
        </Pressable>
        <View style={styles.detailItem}>
          <FontAwesome name="pencil" size={24} color="#555" />
          <TextInput
            style={styles.notesInput}
            placeholder="Add a note..."
            value={notes}
            onChangeText={setNotes}
          />
        </View>
      </View>

      <Pressable style={styles.fab} onPress={handleSave} disabled={isSaving}>
        {isSaving ? (
          <ActivityIndicator color="white" />
        ) : (
          <FontAwesome name="check" size={24} color="white" />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", padding: 20 },
  amountContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  currencySymbol: { fontSize: 40, fontWeight: "300", marginRight: 5 },
  amountInput: { fontSize: 60, fontWeight: "bold" },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#555",
    marginBottom: 10,
    marginTop: 20,
  },
  categoryList: { alignItems: "center" },
  categoryButton: {
    width: 100,
    height: 80,
    borderRadius: 10,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    margin: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
  },
  selectedCategory: { backgroundColor: "#4CAF50" },
  categoryText: { marginTop: 5, fontSize: 12, color: "#333" },
  detailsContainer: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 10,
    elevation: 2,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  detailText: { fontSize: 16, marginLeft: 15 },
  notesInput: { fontSize: 16, marginLeft: 15, flex: 1 },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
  },
});