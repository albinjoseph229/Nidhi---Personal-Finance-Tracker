// In app/settings.tsx
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";

// Import our themed components and hooks
import { ThemedText } from "../components/themed-text";
import { ThemedView } from "../components/themed-view";
import { useAppData } from "../context/AppContext";
import { useAuth } from "../context/AuthContext"; // Import useAuth
import { useTheme } from "../context/ThemeContext";
import { useThemeColor } from "../hooks/use-theme-color";
import { generateReportWithGemini } from "../utils/geminiApi";
import { generateFinancialReport as generatePdfReport } from "../utils/pdfExport";

export default function ProfileScreen() {
  const { theme, toggleTheme } = useTheme();
  const { isSyncing, triggerFullSync, transactions, investments } =
    useAppData();
  const router = useRouter();
  const { isAppLockEnabled, toggleAppLock } = useAuth(); // Get auth state and function

  const [isGeneratingAiReport, setIsGeneratingAiReport] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [hasExistingReport, setHasExistingReport] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  // NEW: State for the last AI report generation time
  const [lastAiReportTime, setLastAiReportTime] = useState<string | null>(null);

  // Get dynamic colors for styling
  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const secondaryTextColor = useThemeColor({}, "tabIconDefault");
  const separatorColor = useThemeColor({}, "background");

  useEffect(() => {
    const loadSettingsData = async () => {
      const existingReport = await AsyncStorage.getItem("financial-report");
      setHasExistingReport(!!existingReport);
      const lastSync = await AsyncStorage.getItem("lastSyncTimestamp");
      if (lastSync) {
        setLastSyncTime(new Date(lastSync).toLocaleString());
      }
      // NEW: Load the last report timestamp
      const lastReport = await AsyncStorage.getItem("lastAiReportTimestamp");
      if (lastReport) {
        setLastAiReportTime(new Date(lastReport).toLocaleString());
      }
    };
    loadSettingsData();
  }, [isSyncing]);

  const handleGenerateAiReport = async () => {
    if (transactions.length < 5) {
      return Alert.alert(
        "Not Enough Data",
        "Please add at least 5 transactions to generate a report."
      );
    }
    setIsGeneratingAiReport(true);
    try {
      const report = await generateReportWithGemini(transactions, investments);

      await AsyncStorage.setItem("financial-report", JSON.stringify(report));

      // NEW: Save and set the timestamp on success
      const now = new Date();
      await AsyncStorage.setItem("lastAiReportTimestamp", now.toISOString());
      setLastAiReportTime(now.toLocaleString());

      setHasExistingReport(true);
      router.push("/financial-report");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred.";
      Alert.alert("Error Generating Report", errorMessage);
    } finally {
      setIsGeneratingAiReport(false);
    }
  };

  const handleExportPdf = async () => {
  if (transactions.length === 0 && investments.length === 0) {
    return Alert.alert("No Data", "There are no transactions or investments to export.");
  }

  Alert.alert(
    "Export to PDF",
    "This will generate a PDF file of all your financial data including transactions and investments. Continue?",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Export",
        onPress: async () => {
          setIsExportingPdf(true);
          try {
            // Pass both transactions AND investments to the PDF generator
            await generatePdfReport(transactions, investments);
          } catch (error) {
            Alert.alert(
              "Error",
              "Failed to export PDF report. Please try again."
            );
            console.error("Export failed:", error);
          } finally {
            setIsExportingPdf(false);
          }
        },
      },
    ]
  );
};

  const handleFullSync = async () => {
    Alert.alert(
      "Full Data Sync",
      "This will download the latest data from the server. Do you want to continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sync",
          onPress: async () => {
            try {
              await triggerFullSync();
              Alert.alert("Success", "Full sync completed successfully!");
            } catch (error) {
              Alert.alert(
                "Error",
                "Full sync failed. Please check your connection and try again."
              );
            }
          },
        },
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <StatusBar style={theme === "light" ? "dark" : "light"} />
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Settings</ThemedText>
      </View>

      <ThemedView
        style={[
          styles.card,
          { backgroundColor: cardColor, shadowColor: textColor },
        ]}
      >
        <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>
          Appearance
        </ThemedText>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Feather
            name="moon"
            size={20}
            style={[styles.rowIcon, { color: secondaryTextColor }]}
          />
          <ThemedText style={styles.rowLabel}>Dark Mode</ThemedText>
          <Switch
            value={theme === "dark"}
            onValueChange={toggleTheme}
            trackColor={{ false: "#E9E9EA", true: "#34C759" }}
            thumbColor={"#FFFFFF"}
          />
        </View>
      </ThemedView>

      {/* NEW: Security Card */}
      <ThemedView
        style={[
          styles.card,
          { backgroundColor: cardColor, shadowColor: textColor },
        ]}
      >
        <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>
          Security
        </ThemedText>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Feather
            name="shield"
            size={20}
            style={[styles.rowIcon, { color: secondaryTextColor }]}
          />
          <ThemedText style={styles.rowLabel}>App Lock</ThemedText>
          <Switch
            value={isAppLockEnabled}
            onValueChange={toggleAppLock}
            trackColor={{ false: "#E9E9EA", true: "#34C759" }}
            thumbColor={"#FFFFFF"}
          />
        </View>
      </ThemedView>

      <ThemedView
        style={[
          styles.card,
          { backgroundColor: cardColor, shadowColor: textColor },
        ]}
      >
        <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>
          Data & Reports
        </ThemedText>

        <Pressable
          style={[styles.row, { borderBottomColor: separatorColor }]}
          onPress={handleFullSync}
          disabled={isSyncing}
        >
          <Feather
            name="refresh-cw"
            size={20}
            style={[styles.rowIcon, { color: secondaryTextColor }]}
          />
          <ThemedText
            style={[styles.rowLabel, { opacity: isSyncing ? 0.5 : 1 }]}
          >
            {isSyncing ? "Syncing..." : "Full Data Sync"}
            {lastSyncTime && !isSyncing && (
              <ThemedText style={{ fontSize: 12, color: secondaryTextColor }}>
                {"\n"}Last: {lastSyncTime}
              </ThemedText>
            )}
          </ThemedText>
          {isSyncing ? (
            <ActivityIndicator color={secondaryTextColor} />
          ) : (
            <Feather
              name="chevron-right"
              size={16}
              color={secondaryTextColor}
            />
          )}
        </Pressable>

        <Pressable
          style={[styles.row, { borderBottomColor: separatorColor }]}
          onPress={handleGenerateAiReport}
          disabled={isGeneratingAiReport}
        >
          <Feather
            name="star"
            size={20}
            style={[styles.rowIcon, { color: secondaryTextColor }]}
          />
          <ThemedText
            style={[
              styles.rowLabel,
              { opacity: isGeneratingAiReport ? 0.5 : 1 },
            ]}
          >
            {isGeneratingAiReport
              ? "Generating Report..."
              : "Generate AI Report"}
            {/* NEW: Display the last report time */}
            {lastAiReportTime && !isGeneratingAiReport && (
              <ThemedText style={{ fontSize: 12, color: secondaryTextColor }}>
                {"\n"}Last: {lastAiReportTime}
              </ThemedText>
            )}
          </ThemedText>
          {isGeneratingAiReport ? (
            <ActivityIndicator color={secondaryTextColor} />
          ) : (
            <Feather
              name="chevron-right"
              size={16}
              color={secondaryTextColor}
            />
          )}
        </Pressable>

        {hasExistingReport && (
          <Pressable
            style={[styles.row, { borderBottomColor: separatorColor }]}
            onPress={() => router.push("/financial-report")}
          >
            <Feather
              name="file-text"
              size={20}
              style={[styles.rowIcon, { color: secondaryTextColor }]}
            />
            <ThemedText style={styles.rowLabel}>View Last AI Report</ThemedText>
            <Feather
              name="chevron-right"
              size={16}
              color={secondaryTextColor}
            />
          </Pressable>
        )}

        <Pressable
          style={[styles.row, { borderBottomWidth: 0 }]}
          onPress={handleExportPdf}
          disabled={isExportingPdf}
        >
          <Feather
            name="download"
            size={20}
            style={[styles.rowIcon, { color: secondaryTextColor }]}
          />
          <ThemedText
            style={[styles.rowLabel, { opacity: isExportingPdf ? 0.5 : 1 }]}
          >
            {isExportingPdf ? "Exporting PDF..." : "Export to PDF"}
          </ThemedText>
          {isExportingPdf ? (
            <ActivityIndicator color={secondaryTextColor} />
          ) : (
            <Feather
              name="chevron-right"
              size={16}
              color={secondaryTextColor}
            />
          )}
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: "bold", lineHeight: 34 },
  card: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    paddingHorizontal: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "500",
    paddingTop: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  rowIcon: { marginRight: 16 },
  rowLabel: { fontSize: 16, flex: 1 },
});