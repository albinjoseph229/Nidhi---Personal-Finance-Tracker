// In components/AddTransactionModal.tsx

import { Feather } from "@expo/vector-icons";
import { Href, useRouter } from "expo-router";
import React from "react";
import { Modal, Pressable, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { useThemeColor } from "../hooks/use-theme-color";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

interface Props {
  isVisible: boolean;
  onClose: () => void;
}

export function AddTransactionModal({ isVisible, onClose }: Props) {
  const router = useRouter();
  const { theme } = useTheme();

  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const secondaryTextColor = useThemeColor({}, "tabIconDefault");
  const separatorColor = useThemeColor({}, "background");

  const handleNavigate = (path: Href) => {
    onClose(); // Close the modal first
    router.push(path); // Then navigate
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.contentContainer}>
          <ThemedView
            style={[
              styles.card,
              { backgroundColor: cardColor, shadowColor: textColor },
            ]}
          >
            <ThemedText style={[styles.title, { color: secondaryTextColor }]}>
              Add a new record
            </ThemedText>

            <Pressable
              style={[styles.optionRow, { borderBottomColor: separatorColor }]}
              onPress={() => handleNavigate("/add-expense")}
            >
              <Feather name="arrow-down-circle" size={24} color="#FF3B30" />
              <ThemedText style={styles.optionText}>Add Expense</ThemedText>
            </Pressable>

            {/* --- NEW INVESTMENT OPTION --- */}
            <Pressable
              style={[styles.optionRow, { borderBottomColor: separatorColor }]}
              onPress={() => handleNavigate("/add-investment")}
            >
              <Feather name="trending-up" size={24} color="#4A90E2" />
              <ThemedText style={styles.optionText}>Add Investment</ThemedText>
            </Pressable>
            {/* ----------------------------- */}

            <Pressable
              style={styles.optionRow}
              onPress={() => handleNavigate("/add-income")}
            >
              <Feather name="arrow-up-circle" size={24} color="#34C759" />
              <ThemedText style={styles.optionText}>Add Income</ThemedText>
            </Pressable>
          </ThemedView>

          <Pressable
            style={[styles.cancelButton, { backgroundColor: cardColor }]}
            onPress={onClose}
          >
            <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  contentContainer: {
    marginHorizontal: 10,
    marginBottom: 20,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 18,
    marginLeft: 16,
  },
  cancelButton: {
    marginTop: 10,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: "600",
  },
});