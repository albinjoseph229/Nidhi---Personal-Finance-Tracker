// In components/LockScreen.tsx

import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export function LockScreen() {
  const { authenticate } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <Feather name="lock" size={48} color="#8A8A8E" />
      <ThemedText style={styles.title}>App Locked</ThemedText>
      <ThemedText style={styles.subtitle}>
        Please authenticate to continue.
      </ThemedText>
      <Pressable style={styles.button} onPress={authenticate}>
        <ThemedText style={styles.buttonText}>Unlock</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8A8A8E',
    marginBottom: 40,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});