import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

// Import themed components and hooks
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { useAppData } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
// REMOVED: No longer importing directly from the database
// import * as db from '../database'; 
import { useThemeColor } from '../hooks/use-theme-color';

export default function SetBudgetModal() {
  const [amount, setAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  // CHANGED: Get the `setBudget` function from the context
  const { setBudget } = useAppData(); 

  // Fetch theme and colors
  const { theme } = useTheme();
  const cardColor = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');
  const saveButtonActiveColor = theme === 'light' ? '#1C1C1E' : cardColor;
  const saveButtonTextColor = theme === 'light' ? '#FFFFFF' : textColor;

  const handleSave = async () => {
    const budgetAmount = parseFloat(amount);
    if (isNaN(budgetAmount) || budgetAmount < 0) { // Allow 0 to reset budget
      Alert.alert("Invalid Input", "Please enter a valid budget amount.");
      return;
    }

    setIsSaving(true);
    try {
      const date = new Date();
      const currentMonthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      // CHANGED: Use the context function which handles local state and background sync correctly.
      await setBudget({ monthYear: currentMonthYear, amount: budgetAmount });
      
      // REMOVED: The unnecessary full sync call.
      // await triggerFullSync(); 
      
      router.back();
    } catch (error) {
      console.error("Failed to save budget:", error);
      Alert.alert("Error", "Could not save budget.");
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Set Budget</ThemedText>
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
              <Feather name="x" size={24} color={textColor} />
          </Pressable>
        </View>

        {/* Main Content Area */}
        <View style={styles.content}>
          <ThemedView style={[styles.card, { backgroundColor: cardColor, shadowColor: textColor }]}>
            <ThemedText style={styles.cardTitle}>Monthly Budget Amount</ThemedText>
            <View style={styles.amountContainer}>
              <ThemedText style={[styles.currencySymbol, { color: secondaryTextColor }]}>₹</ThemedText>
              <TextInput
                style={[styles.amountInput, { color: textColor }]}
                placeholder="0"
                placeholderTextColor={secondaryTextColor}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                autoFocus={true}
              />
            </View>
          </ThemedView>
        </View>

        {/* Save Button */}
        <ThemedView style={styles.bottomContainer}>
          <Pressable 
            style={[styles.saveButton, { backgroundColor: saveButtonActiveColor }, (!amount || isSaving) && styles.saveButtonDisabled]} 
            onPress={handleSave}
            disabled={!amount || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={saveButtonTextColor} />
            ) : (
              <ThemedText style={[styles.saveButtonText, { color: saveButtonTextColor }]}>Save Budget</ThemedText>
            )}
          </Pressable>
        </ThemedView>
      </KeyboardAvoidingView>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
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
    textAlign: 'center',
  },
  amountContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: 'center',
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
    minWidth: 80,
    textAlign: 'center',
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
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