// app/settings.tsx
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View,
} from "react-native";
import { ThemedText } from "../components/themed-text";
import { ThemedView } from "../components/themed-view";
import { useAppData } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useThemeColor } from "../hooks/use-theme-color";
import { hasAIKey, getAIConfig } from "../lib/aiKeyStore";
import { supabase } from "../lib/supabase";
import { generateReportWithGemini } from "../utils/geminiApi";
import { generateFinancialReport as generatePdfReport } from "../utils/pdfExport";

export default function ProfileScreen() {
  const { theme, toggleTheme } = useTheme();
  const { isSyncing, triggerFullSync, transactions, investments } = useAppData();
  const { isAppLockEnabled, toggleAppLock, signOut, user } = useAuth();
  const router = useRouter();

  const [isGeneratingAiReport, setIsGeneratingAiReport] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [hasExistingReport, setHasExistingReport] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastAiReportTime, setLastAiReportTime] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiProviderName, setAiProviderName] = useState<string | null>(null);

  const [isChangePasswordVisible, setChangePasswordVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const secondaryTextColor = useThemeColor({}, "tabIconDefault");
  const separatorColor = useThemeColor({}, "background");

  useEffect(() => {
    const loadSettingsData = async () => {
      const existingReport = await AsyncStorage.getItem("financial-report");
      setHasExistingReport(!!existingReport);
      const lastSync = await AsyncStorage.getItem("lastSyncTimestamp");
      if (lastSync) setLastSyncTime(new Date(lastSync).toLocaleString());
      const lastReport = await AsyncStorage.getItem("lastAiReportTimestamp");
      if (lastReport) setLastAiReportTime(new Date(lastReport).toLocaleString());
      // Check AI config
      const configured = await hasAIKey();
      setAiConfigured(configured);
      const config = await getAIConfig();
      setAiProviderName(config.provider === 'gemini' ? 'Gemini' : config.provider === 'chatgpt' ? 'ChatGPT' : null);
    };
    loadSettingsData();
  }, [isSyncing]);

  const handleGenerateAiReport = async () => {
    if (!aiConfigured) {
      return Alert.alert("AI Not Configured", "Please set up your AI API key first.", [
        { text: "Cancel", style: "cancel" },
        { text: "Configure", onPress: () => router.push("/ai-settings" as any) },
      ]);
    }
    if (transactions.length < 5) {
      return Alert.alert("Not Enough Data", "Please add at least 5 transactions to generate a report.");
    }
    setIsGeneratingAiReport(true);
    try {
      const report = await generateReportWithGemini(transactions, investments);
      await AsyncStorage.setItem("financial-report", JSON.stringify(report));
      const now = new Date();
      await AsyncStorage.setItem("lastAiReportTimestamp", now.toISOString());
      setLastAiReportTime(now.toLocaleString());
      setHasExistingReport(true);
      router.push("/financial-report");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      Alert.alert("Error Generating Report", errorMessage);
    } finally { setIsGeneratingAiReport(false); }
  };

  const handleExportPdf = async () => {
    if (transactions.length === 0 && investments.length === 0) {
      return Alert.alert("No Data", "There are no transactions or investments to export.");
    }
    Alert.alert("Export to PDF", "Generate a PDF of all your financial data?", [
      { text: "Cancel", style: "cancel" },
      { text: "Export", onPress: async () => {
        setIsExportingPdf(true);
        try { await generatePdfReport(transactions, investments); }
        catch { Alert.alert("Error", "Failed to export PDF. Please try again."); }
        finally { setIsExportingPdf(false); }
      }},
    ]);
  };

  const handleFullSync = async () => {
    Alert.alert("Full Data Sync", "Download the latest data from Supabase?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sync", onPress: async () => {
        try { await triggerFullSync(); Alert.alert("Success", "Full sync completed!"); }
        catch { Alert.alert("Error", "Sync failed. Check your connection."); }
      }},
    ]);
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Your local data will be kept. You can sign in again to sync.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  };

  const submitNewPassword = async () => {
    if (newPassword.length < 6) {
      return Alert.alert("Weak Password", "Password must be at least 6 characters.");
    }
    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert("Success", "Your password has been updated.");
      setChangePasswordVisible(false);
      setNewPassword('');
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <StatusBar style={theme === "light" ? "dark" : "light"} />
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Settings</ThemedText>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Account */}
        <ThemedView style={[styles.card, { backgroundColor: cardColor }]}>
        <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>Account</ThemedText>
        <View style={[styles.row, { borderBottomColor: separatorColor }]}>
          <Feather name="user" size={20} style={[styles.rowIcon, { color: secondaryTextColor }]} />
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.rowLabel}>{user?.email || 'Not signed in'}</ThemedText>
            <ThemedText style={{ fontSize: 12, color: secondaryTextColor }}>Synced via Supabase</ThemedText>
          </View>
        </View>
        <Pressable style={[styles.row, { borderBottomColor: separatorColor }]} onPress={() => setChangePasswordVisible(true)}>
          <Feather name="lock" size={20} style={[styles.rowIcon, { color: secondaryTextColor }]} />
          <ThemedText style={styles.rowLabel}>Change Password</ThemedText>
          <Feather name="chevron-right" size={16} color={secondaryTextColor} />
        </Pressable>
        <Pressable style={[styles.row, { borderBottomWidth: 0 }]} onPress={handleSignOut}>
          <Feather name="log-out" size={20} style={[styles.rowIcon, { color: '#FF3B30' }]} />
          <ThemedText style={[styles.rowLabel, { color: '#FF3B30' }]}>Sign Out</ThemedText>
          <Feather name="chevron-right" size={16} color="#FF3B30" />
        </Pressable>
      </ThemedView>

      {/* Appearance */}
      <ThemedView style={[styles.card, { backgroundColor: cardColor }]}>
        <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>Appearance</ThemedText>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Feather name="moon" size={20} style={[styles.rowIcon, { color: secondaryTextColor }]} />
          <ThemedText style={styles.rowLabel}>Dark Mode</ThemedText>
          <Switch value={theme === "dark"} onValueChange={toggleTheme}
            trackColor={{ false: "#E9E9EA", true: "#34C759" }} thumbColor="#FFF" />
        </View>
      </ThemedView>

      {/* Security */}
      <ThemedView style={[styles.card, { backgroundColor: cardColor }]}>
        <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>Security</ThemedText>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Feather name="shield" size={20} style={[styles.rowIcon, { color: secondaryTextColor }]} />
          <ThemedText style={styles.rowLabel}>App Lock</ThemedText>
          <Switch value={isAppLockEnabled} onValueChange={toggleAppLock}
            trackColor={{ false: "#E9E9EA", true: "#34C759" }} thumbColor="#FFF" />
        </View>
      </ThemedView>

      {/* AI Configuration */}
      <ThemedView style={[styles.card, { backgroundColor: cardColor }]}>
        <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>AI Configuration</ThemedText>
        <Pressable style={[styles.row, { borderBottomWidth: 0 }]} onPress={() => router.push("/ai-settings" as any)}>
          <Feather name="cpu" size={20} style={[styles.rowIcon, { color: secondaryTextColor }]} />
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.rowLabel}>
              {aiConfigured ? `${aiProviderName} Key Active` : 'Set Up AI Key'}
            </ThemedText>
            <ThemedText style={{ fontSize: 12, color: secondaryTextColor }}>
              {aiConfigured ? 'Tap to change provider or key' : 'Required for AI reports'}
            </ThemedText>
          </View>
          <View style={[styles.statusDot, { backgroundColor: aiConfigured ? '#34C759' : '#FF9500' }]} />
          <Feather name="chevron-right" size={16} color={secondaryTextColor} />
        </Pressable>
      </ThemedView>

      {/* Data & Reports */}
      <ThemedView style={[styles.card, { backgroundColor: cardColor }]}>
        <ThemedText style={[styles.cardTitle, { color: secondaryTextColor }]}>Data & Reports</ThemedText>

        <Pressable style={[styles.row, { borderBottomColor: separatorColor }]}
          onPress={handleFullSync} disabled={isSyncing}>
          <Feather name="refresh-cw" size={20} style={[styles.rowIcon, { color: secondaryTextColor }]} />
          <ThemedText style={[styles.rowLabel, { opacity: isSyncing ? 0.5 : 1 }]}>
            {isSyncing ? "Syncing..." : "Full Data Sync"}
            {lastSyncTime && !isSyncing && (
              <ThemedText style={{ fontSize: 12, color: secondaryTextColor }}>{"\n"}Last: {lastSyncTime}</ThemedText>
            )}
          </ThemedText>
          {isSyncing ? <ActivityIndicator color={secondaryTextColor} /> :
            <Feather name="chevron-right" size={16} color={secondaryTextColor} />}
        </Pressable>

        <Pressable style={[styles.row, { borderBottomColor: separatorColor }]}
          onPress={handleGenerateAiReport} disabled={isGeneratingAiReport}>
          <Feather name="star" size={20} style={[styles.rowIcon, { color: secondaryTextColor }]} />
          <ThemedText style={[styles.rowLabel, { opacity: isGeneratingAiReport ? 0.5 : 1 }]}>
            {isGeneratingAiReport ? "Generating Report..." : "Generate AI Report"}
            {lastAiReportTime && !isGeneratingAiReport && (
              <ThemedText style={{ fontSize: 12, color: secondaryTextColor }}>{"\n"}Last: {lastAiReportTime}</ThemedText>
            )}
          </ThemedText>
          {isGeneratingAiReport ? <ActivityIndicator color={secondaryTextColor} /> :
            <Feather name="chevron-right" size={16} color={secondaryTextColor} />}
        </Pressable>

        {hasExistingReport && (
          <Pressable style={[styles.row, { borderBottomColor: separatorColor }]}
            onPress={() => router.push("/financial-report")}>
            <Feather name="file-text" size={20} style={[styles.rowIcon, { color: secondaryTextColor }]} />
            <ThemedText style={styles.rowLabel}>View Last AI Report</ThemedText>
            <Feather name="chevron-right" size={16} color={secondaryTextColor} />
          </Pressable>
        )}

        <Pressable style={[styles.row, { borderBottomWidth: 0 }]}
          onPress={handleExportPdf} disabled={isExportingPdf}>
          <Feather name="download" size={20} style={[styles.rowIcon, { color: secondaryTextColor }]} />
          <ThemedText style={[styles.rowLabel, { opacity: isExportingPdf ? 0.5 : 1 }]}>
            {isExportingPdf ? "Exporting PDF..." : "Export to PDF"}
          </ThemedText>
          {isExportingPdf ? <ActivityIndicator color={secondaryTextColor} /> :
            <Feather name="chevron-right" size={16} color={secondaryTextColor} />}
        </Pressable>
      </ThemedView>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal visible={isChangePasswordVisible} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalContent, { backgroundColor: cardColor }]}>
            <ThemedText style={styles.modalTitle}>Change Password</ThemedText>
            <TextInput
              style={[styles.modalInput, { color: textColor, borderColor: secondaryTextColor + '40', backgroundColor: separatorColor }]}
              placeholder="New Password (min 6 chars)"
              placeholderTextColor={secondaryTextColor}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              editable={!isUpdatingPassword}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtn} onPress={() => { setChangePasswordVisible(false); setNewPassword(''); }} disabled={isUpdatingPassword}>
                <ThemedText style={{ color: secondaryTextColor, fontWeight: '600' }}>Cancel</ThemedText>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: '#007AFF', borderRadius: 8 }]} onPress={submitNewPassword} disabled={isUpdatingPassword}>
                {isUpdatingPassword ? <ActivityIndicator color="#FFF" size="small" /> : <ThemedText style={{ color: '#FFF', fontWeight: '600' }}>Update</ThemedText>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: "bold", lineHeight: 34 },
  card: { marginHorizontal: 20, marginBottom: 16, borderRadius: 20, paddingHorizontal: 24, elevation: 2 },
  cardTitle: { fontSize: 13, fontWeight: "500", paddingTop: 16, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1 },
  rowIcon: { marginRight: 16 },
  rowLabel: { fontSize: 16, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', padding: 24, borderRadius: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  modalInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 24 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtn: { paddingVertical: 12, paddingHorizontal: 20 },
});