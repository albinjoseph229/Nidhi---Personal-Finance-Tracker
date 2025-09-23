import { FontAwesome } from "@expo/vector-icons";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAppData } from "../context/AppContext";

interface Category {
  name: string;
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}

const categories: Category[] = [
  { name: "Food", icon: "cutlery", color: "#FF6B6B" },
  { name: "Transport", icon: "car", color: "#4ECDC4" },
  { name: "Shopping", icon: "shopping-bag", color: "#45B7D1" },
  { name: "Bills", icon: "file-text-o", color: "#96CEB4" },
  { name: "Health", icon: "heartbeat", color: "#FECA57" },
  { name: "Leisure", icon: "smile-o", color: "#FF9FF3" },
  { name: "Home", icon: "home", color: "#54A0FF" },
  { name: "Education", icon: "book", color: "#5F27CD" },
  { name: "Other", icon: "inbox", color: "#00D2D3" },
];

export default function AddExpenseScreen() {
  const router = useRouter();
  const { addTransaction } = useAppData();

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

  const getSelectedCategoryColor = () => {
    const category = categories.find(c => c.name === selectedCategory);
    return category?.color || "#007AFF";
  };

  const formatAmount = (value: string) => {
    if (!value) return "";
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) return value;
    return new Intl.NumberFormat('en-IN').format(numericValue);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Add Expense</Text>
          <Text style={styles.headerSubtitle}>Track your spending</Text>
        </View>

        {/* Amount Input Card */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Amount</Text>
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor="#C7C7CC"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              autoFocus={true}
              returnKeyType="done"
            />
          </View>
          {amount && !isNaN(parseFloat(amount)) && (
            <Text style={styles.formattedAmount}>
              {formatAmount(amount)}
            </Text>
          )}
        </View>

        {/* Category Selection */}
        <View style={styles.sectionCard}>
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
                  style={[
                    styles.categoryButton,
                    isSelected && { 
                      backgroundColor: item.color,
                      transform: [{ scale: 0.95 }] 
                    }
                  ]}
                  onPress={() => setSelectedCategory(item.name)}
                >
                  <View style={[
                    styles.categoryIconContainer,
                    { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : item.color + '20' }
                  ]}>
                    <FontAwesome
                      name={item.icon}
                      size={16}
                      color={isSelected ? "white" : item.color}
                    />
                  </View>
                  <Text style={[
                    styles.categoryText, 
                    { color: isSelected ? "white" : "#1D1D1F" }
                  ]}>
                    {item.name}
                  </Text>
                </Pressable>
              );
            }}
            contentContainerStyle={styles.categoryGrid}
          />
        </View>

        {/* Details Card */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Details</Text>
          
          {/* Date Picker */}
          <Pressable style={styles.detailItem} onPress={showDatePicker}>
            <View style={styles.detailIconContainer}>
              <FontAwesome name="calendar" size={16} color="#007AFF" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>
                {date.toLocaleDateString("en-IN", { 
                  weekday: 'short',
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color="#C7C7CC" />
          </Pressable>

          {/* Notes Input */}
          <View style={styles.detailItem}>
            <View style={styles.detailIconContainer}>
              <FontAwesome name="pencil" size={16} color="#34C759" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Notes</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Add a note (optional)"
                placeholderTextColor="#C7C7CC"
                value={notes}
                onChangeText={setNotes}
                multiline={true}
                returnKeyType="done"
              />
            </View>
          </View>
        </View>

        {/* Summary Card */}
        {amount && selectedCategory && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Summary</Text>
            <View style={styles.summaryContent}>
              <View style={[
                styles.summaryIcon, 
                { backgroundColor: getSelectedCategoryColor() + '20' }
              ]}>
                <FontAwesome 
                  name={categories.find(c => c.name === selectedCategory)?.icon || 'money'} 
                  size={20} 
                  color={getSelectedCategoryColor()} 
                />
              </View>
              <View style={styles.summaryDetails}>
                <Text style={styles.summaryAmount}>
                  ₹{parseFloat(amount).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.summaryCategory}>{selectedCategory}</Text>
                {notes && <Text style={styles.summaryNotes}>{notes}</Text>}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Save Button */}
      <View style={styles.bottomContainer}>
        <Pressable 
          style={[
            styles.saveButton,
            (!amount || !selectedCategory || isSaving) && styles.saveButtonDisabled
          ]} 
          onPress={handleSave} 
          disabled={!amount || !selectedCategory || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <FontAwesome name="check" size={16} color="white" />
              <Text style={styles.saveButtonText}>Save Expense</Text>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F8F9FA" 
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    backgroundColor: "white",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1D1D1F',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  amountCard: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  amountLabel: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 8,
  },
  amountContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  currencySymbol: { 
    fontSize: 32, 
    fontWeight: "300", 
    color: '#1D1D1F',
    marginRight: 8 
  },
  amountInput: { 
    fontSize: 48, 
    fontWeight: "700",
    color: '#1D1D1F',
    textAlign: 'center',
    minWidth: 100,
  },
  formattedAmount: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    fontWeight: '500',
  },
  sectionCard: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1D1D1F",
    marginBottom: 16,
  },
  categoryGrid: { 
    justifyContent: 'center',
  },
  categoryButton: {
    width: 90,
    height: 90,
    borderRadius: 16,
    backgroundColor: "#F8F9FA",
    justifyContent: "center",
    alignItems: "center",
    margin: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryText: { 
    fontSize: 11, 
    fontWeight: '600',
    textAlign: 'center',
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  detailIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 2,
  },
  detailValue: { 
    fontSize: 16, 
    color: '#1D1D1F',
    fontWeight: '500',
  },
  notesInput: { 
    fontSize: 16, 
    color: '#1D1D1F',
    fontWeight: '500',
    paddingVertical: 4,
  },
  summaryCard: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#007AFF20',
    ...Platform.select({
      ios: {
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
    marginBottom: 12,
  },
  summaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  summaryDetails: {
    flex: 1,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1D1D1F',
    marginBottom: 4,
  },
  summaryCategory: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  summaryNotes: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
    fontStyle: 'italic',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  saveButton: {
    backgroundColor: "#007AFF",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: "#C7C7CC",
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});