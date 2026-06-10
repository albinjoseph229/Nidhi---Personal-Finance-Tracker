// app/ai-settings.tsx
// BYOK AI configuration screen
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Pressable, ScrollView,
  StyleSheet, Switch, TextInput, View,
} from 'react-native';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { useTheme } from '../context/ThemeContext';
import { useThemeColor } from '../hooks/use-theme-color';
import {
  AIProvider, clearAllAIConfig, deleteAIKey,
  getAIConfig, getAIKey, setAIKey, setAIProvider,
} from '../lib/aiKeyStore';

export default function AISettingsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const cardColor = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const secondaryColor = useThemeColor({}, 'tabIconDefault');
  const bgColor = useThemeColor({}, 'background');

  const [provider, setProvider] = useState<AIProvider>('gemini');
  const [apiKey, setApiKeyInput] = useState('');
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    const config = await getAIConfig();
    if (config.provider) setProvider(config.provider);
    setHasKey(config.hasKey);
    setMaskedKey(config.maskedKey);
    if (config.hasKey) {
      const key = await getAIKey(config.provider!);
      setApiKeyInput(key || '');
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleProviderChange = async (newProvider: AIProvider) => {
    setProvider(newProvider);
    await setAIProvider(newProvider);
    // Load key for new provider
    const key = await getAIKey(newProvider);
    setApiKeyInput(key || '');
    setHasKey(!!key);
    setMaskedKey(key ? `${'•'.repeat(Math.max(0, key.length - 4))}${key.slice(-4)}` : null);
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      return Alert.alert('Error', 'Please enter an API key.');
    }
    setIsSaving(true);
    try {
      await setAIProvider(provider);
      await setAIKey(provider, apiKey.trim());
      setHasKey(true);
      setMaskedKey(`${'•'.repeat(Math.max(0, apiKey.trim().length - 4))}${apiKey.trim().slice(-4)}`);
      Alert.alert('Saved!', `${provider === 'gemini' ? 'Google Gemini' : 'OpenAI ChatGPT'} API key saved securely.`);
    } catch (e) {
      Alert.alert('Error', 'Failed to save API key.');
    } finally { setIsSaving(false); }
  };

  const handleDeleteKey = () => {
    Alert.alert('Delete API Key', 'Are you sure you want to remove this key?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteAIKey(provider);
        setApiKeyInput('');
        setHasKey(false);
        setMaskedKey(null);
      }},
    ]);
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      return Alert.alert('Error', 'Please enter an API key first.');
    }
    setIsTesting(true);
    try {
      if (provider === 'gemini') {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with: OK' }] }] }) }
        );
        if (!res.ok) throw new Error(`Status ${res.status}`);
      } else {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey.trim()}` },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Reply with: OK' }], max_tokens: 5 })
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
      }
      Alert.alert('✅ Success', 'API key is valid and working!');
    } catch (e: any) {
      Alert.alert('❌ Failed', `Key test failed: ${e.message}. Please check your key.`);
    } finally { setIsTesting(false); }
  };

  const providerName = provider === 'gemini' ? 'Google Gemini' : 'OpenAI ChatGPT';

  return (
    <ThemedView style={styles.container}>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={textColor} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>AI Configuration</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status */}
        <View style={[styles.statusBanner, { backgroundColor: hasKey ? '#34C75920' : '#FF950020' }]}>
          <Feather name={hasKey ? 'check-circle' : 'alert-circle'} size={20} color={hasKey ? '#34C759' : '#FF9500'} />
          <ThemedText style={[styles.statusText, { color: hasKey ? '#34C759' : '#FF9500' }]}>
            {hasKey ? `${providerName} key configured` : 'No AI key configured'}
          </ThemedText>
        </View>

        {/* Provider Selection */}
        <ThemedView style={[styles.card, { backgroundColor: cardColor }]}>
          <ThemedText style={[styles.cardTitle, { color: secondaryColor }]}>Provider</ThemedText>
          <Pressable style={[styles.providerOption, provider === 'gemini' && styles.providerSelected,
            provider === 'gemini' && { borderColor: '#4285F4' }]}
            onPress={() => handleProviderChange('gemini')}>
            <View style={styles.providerInfo}>
              <ThemedText style={[styles.providerName, { color: textColor }]}>Google Gemini</ThemedText>
              <ThemedText style={[styles.providerDesc, { color: secondaryColor }]}>Free tier available</ThemedText>
            </View>
            {provider === 'gemini' && <Feather name="check" size={20} color="#4285F4" />}
          </Pressable>
          <Pressable style={[styles.providerOption, provider === 'chatgpt' && styles.providerSelected,
            provider === 'chatgpt' && { borderColor: '#10A37F' }, { borderBottomWidth: 0 }]}
            onPress={() => handleProviderChange('chatgpt')}>
            <View style={styles.providerInfo}>
              <ThemedText style={[styles.providerName, { color: textColor }]}>OpenAI ChatGPT</ThemedText>
              <ThemedText style={[styles.providerDesc, { color: secondaryColor }]}>Pay-per-use</ThemedText>
            </View>
            {provider === 'chatgpt' && <Feather name="check" size={20} color="#10A37F" />}
          </Pressable>
        </ThemedView>

        {/* API Key */}
        <ThemedView style={[styles.card, { backgroundColor: cardColor }]}>
          <ThemedText style={[styles.cardTitle, { color: secondaryColor }]}>API Key</ThemedText>
          <View style={[styles.keyInputWrap, { backgroundColor: bgColor, borderColor: secondaryColor + '30' }]}>
            <Feather name="key" size={18} color={secondaryColor} style={{ marginRight: 12 }} />
            <TextInput
              style={[styles.keyInput, { color: textColor }]}
              placeholder={`Enter ${providerName} API key`}
              placeholderTextColor={secondaryColor}
              value={showKey ? apiKey : (apiKey ? maskedKey || apiKey : '')}
              onChangeText={setApiKeyInput}
              onFocus={() => setShowKey(true)}
              onBlur={() => setShowKey(false)}
              autoCapitalize="none" autoCorrect={false} secureTextEntry={!showKey}
            />
          </View>
          <View style={styles.keyActions}>
            <Pressable style={[styles.actionBtn, { backgroundColor: '#007AFF' }]} onPress={handleSaveKey} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color="#FFF" size="small" /> :
                <><Feather name="save" size={16} color="#FFF" /><ThemedText style={styles.actionBtnText}>Save</ThemedText></>}
            </Pressable>
            <Pressable style={[styles.actionBtn, { backgroundColor: '#34C759' }]} onPress={handleTestKey} disabled={isTesting}>
              {isTesting ? <ActivityIndicator color="#FFF" size="small" /> :
                <><Feather name="zap" size={16} color="#FFF" /><ThemedText style={styles.actionBtnText}>Test</ThemedText></>}
            </Pressable>
            {hasKey && (
              <Pressable style={[styles.actionBtn, { backgroundColor: '#FF3B30' }]} onPress={handleDeleteKey}>
                <Feather name="trash-2" size={16} color="#FFF" /><ThemedText style={styles.actionBtnText}>Delete</ThemedText>
              </Pressable>
            )}
          </View>
        </ThemedView>

        {/* How to get a key */}
        <ThemedView style={[styles.card, { backgroundColor: cardColor }]}>
          <ThemedText style={[styles.cardTitle, { color: secondaryColor }]}>How to get a key</ThemedText>
          {provider === 'gemini' ? (
            <>
              <ThemedText style={[styles.helpText, { color: textColor }]}>
                1. Go to Google AI Studio{'\n'}
                2. Sign in with your Google account{'\n'}
                3. Click "Get API Key" → "Create API Key"{'\n'}
                4. Copy and paste it above
              </ThemedText>
              <Pressable style={styles.linkBtn} onPress={() => Linking.openURL('https://aistudio.google.com/apikey')}>
                <Feather name="external-link" size={16} color="#007AFF" />
                <ThemedText style={styles.linkText}>Open Google AI Studio</ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <ThemedText style={[styles.helpText, { color: textColor }]}>
                1. Go to OpenAI Platform{'\n'}
                2. Sign in or create an account{'\n'}
                3. Go to API Keys → "Create new secret key"{'\n'}
                4. Copy and paste it above
              </ThemedText>
              <Pressable style={styles.linkBtn} onPress={() => Linking.openURL('https://platform.openai.com/api-keys')}>
                <Feather name="external-link" size={16} color="#007AFF" />
                <ThemedText style={styles.linkText}>Open OpenAI Platform</ThemedText>
              </Pressable>
            </>
          )}
        </ThemedView>

        {/* Security note */}
        <View style={[styles.securityNote, { backgroundColor: '#007AFF10' }]}>
          <Feather name="shield" size={16} color="#007AFF" />
          <ThemedText style={[styles.securityText, { color: secondaryColor }]}>
            Your API key is stored securely on your device using encrypted storage. It never leaves your phone.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 40 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 20, gap: 10 },
  statusText: { fontSize: 14, fontWeight: '600' },
  card: { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16, marginBottom: 16, elevation: 2 },
  cardTitle: { fontSize: 13, fontWeight: '500', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  providerOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#00000010', borderWidth: 2, borderColor: 'transparent', borderRadius: 12, paddingHorizontal: 14, marginBottom: 8 },
  providerSelected: { borderWidth: 2 },
  providerInfo: { flex: 1 },
  providerName: { fontSize: 16, fontWeight: '600' },
  providerDesc: { fontSize: 12, marginTop: 2 },
  keyInputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, marginBottom: 14 },
  keyInput: { flex: 1, fontSize: 15, paddingVertical: 14 },
  keyActions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, gap: 6 },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  helpText: { fontSize: 14, lineHeight: 22, marginBottom: 12 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  linkText: { color: '#007AFF', fontSize: 14, fontWeight: '600' },
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 14, gap: 10, marginTop: 4 },
  securityText: { fontSize: 12, flex: 1, lineHeight: 18 },
});
