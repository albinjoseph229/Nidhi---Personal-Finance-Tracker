import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import * as db from '../database';

export default function SetBudgetModal() {
  const [amount, setAmount] = useState('');
  const router = useRouter();

  const handleSave = async () => {
    const budgetAmount = parseFloat(amount);
    if (isNaN(budgetAmount) || budgetAmount <= 0) {
      Alert.alert("Invalid Input", "Please enter a valid budget amount.");
      return;
    }

    try {
      const date = new Date();
      const currentMonthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      await db.setBudgetForMonth({ monthYear: currentMonthYear, amount: budgetAmount });
      Alert.alert("Success", "Budget has been saved.");
      router.back();

    } catch (error) {
      console.error("Failed to save budget:", error);
      Alert.alert("Error", "Could not save budget.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Set Budget for this Month</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., 50000"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
        autoFocus={true}
      />
      <Button title="Save Budget" onPress={handleSave} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50 },
  label: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  input: { height: 50, borderColor: '#ddd', borderWidth: 1, borderRadius: 8, marginBottom: 20, paddingHorizontal: 15, fontSize: 16 },
});