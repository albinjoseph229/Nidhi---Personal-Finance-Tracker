import { useTheme } from '@react-navigation/native'; // 👈 1. Import useTheme
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useData } from './context/DataContext'; // Corrected the path

export default function AddExpenseScreen() {
  const theme = useTheme(); // 👈 2. Get the current theme
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false); 

  const { addTransaction } = useData(); 
  const router = useRouter(); 

  const handleSave = async () => {
    if (!amount || !category) {
      Alert.alert("Error", "Amount and Category are required.");
      return;
    }
    
    setIsSaving(true);
    
    await addTransaction({
      Category: category,
      Amount: parseFloat(amount),
      Notes: notes,
    });
    
    router.back(); 
  };

  // 👇 3. Pass the theme to our dynamic styles function
  const styles = getThemedStyles(theme);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Amount</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., 500"
        placeholderTextColor="gray" // Set placeholder color
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />
      <Text style={styles.label}>Category</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Food"
        placeholderTextColor="gray"
        value={category}
        onChangeText={setCategory}
      />
      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={styles.input}
        placeholder="(Optional)"
        placeholderTextColor="gray"
        value={notes}
        onChangeText={setNotes}
      />
      <Button 
        title={isSaving ? "Saving..." : "Save Expense"} 
        onPress={handleSave} 
        disabled={isSaving}
        color={theme.colors.primary} // 👈 4. Use theme color for the button
      />
    </View>
  );
}

// 👇 5. Create a function to generate theme-aware styles
const getThemedStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: theme.colors.background, // Use theme background
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    color: theme.colors.text, // Use theme text
  },
  input: {
    height: 50,
    borderColor: theme.colors.border, // Use theme border
    color: theme.colors.text, // Use theme text for the input value
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 20,
    paddingHorizontal: 15,
    fontSize: 16,
  },
});