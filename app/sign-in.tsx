// app/sign-in.tsx
import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import { ThemedText } from '../components/themed-text';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Colors } from '../constants/theme';

export default function SignInScreen() {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const { theme } = useTheme();
  const colors = Colors[theme === 'dark' ? 'dark' : 'light'];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      return Alert.alert('Missing Fields', 'Please enter both email and password.');
    }
    if (password.length < 6) {
      return Alert.alert('Weak Password', 'Password must be at least 6 characters.');
    }
    setIsLoading(true);
    try {
      const result = isSignUp
        ? await signUpWithEmail(email.trim(), password)
        : await signInWithEmail(email.trim(), password);
      if (isSignUp && !result.error) {
        Alert.alert('Account Created!', 'Check your email to verify, then sign in.',
          [{ text: 'OK', onPress: () => setIsSignUp(false) }]);
        setIsLoading(false);
        return;
      }
      if (result.error) Alert.alert('Authentication Failed', result.error);
    } catch { Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally { setIsLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.brandSection}>
          <View style={[styles.logoBox, { backgroundColor: colors.card }]}>
            <Feather name="dollar-sign" size={40} color="#34C759" />
          </View>
          <ThemedText style={[styles.appName, { color: colors.text }]}>Nidhi</ThemedText>
          <ThemedText style={[styles.tagline, { color: colors.tabIconDefault }]}>
            Your Personal Finance Tracker
          </ThemedText>
        </View>

        <View style={[styles.formCard, { backgroundColor: colors.card }]}>
          <ThemedText style={[styles.formTitle, { color: colors.text }]}>
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </ThemedText>
          <ThemedText style={[styles.formSub, { color: colors.tabIconDefault }]}>
            {isSignUp ? 'Sign up to sync across devices' : 'Sign in to access your data'}
          </ThemedText>

          <View style={[styles.inputWrap, { backgroundColor: colors.background, borderColor: colors.tabIconDefault + '30' }]}>
            <Feather name="mail" size={18} color={colors.tabIconDefault} style={styles.inputIcon} />
            <TextInput style={[styles.input, { color: colors.text }]} placeholder="Email"
              placeholderTextColor={colors.tabIconDefault} value={email} onChangeText={setEmail}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!isLoading} />
          </View>

          <View style={[styles.inputWrap, { backgroundColor: colors.background, borderColor: colors.tabIconDefault + '30' }]}>
            <Feather name="lock" size={18} color={colors.tabIconDefault} style={styles.inputIcon} />
            <TextInput style={[styles.input, { color: colors.text }]} placeholder="Password"
              placeholderTextColor={colors.tabIconDefault} value={password} onChangeText={setPassword}
              secureTextEntry={!showPassword} autoCapitalize="none" editable={!isLoading} />
            <Pressable onPress={() => setShowPassword(!showPassword)}>
              <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.tabIconDefault} />
            </Pressable>
          </View>

          <Pressable style={[styles.primaryBtn, isLoading && { opacity: 0.7 }]}
            onPress={handleAuth} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#FFF" /> :
              <ThemedText style={styles.primaryBtnText}>{isSignUp ? 'Create Account' : 'Sign In'}</ThemedText>}
          </Pressable>

          <Pressable style={styles.toggleBtn} onPress={() => setIsSignUp(!isSignUp)} disabled={isLoading}>
            <ThemedText style={[styles.toggleText, { color: colors.tabIconDefault }]}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <ThemedText style={{ color: '#007AFF', fontWeight: '600' }}>
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </ThemedText>
            </ThemedText>
          </Pressable>
        </View>

        <ThemedText style={[styles.footer, { color: colors.tabIconDefault }]}>
          Your data is encrypted and synced securely via Supabase
        </ThemedText>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brandSection: { alignItems: 'center', marginBottom: 40 },
  logoBox: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 16, elevation: 4 },
  appName: { fontSize: 36, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { fontSize: 16, marginTop: 4 },
  formCard: { borderRadius: 24, padding: 28, elevation: 3 },
  formTitle: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  formSub: { fontSize: 14, marginBottom: 28 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 14, borderWidth: 1 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, paddingVertical: 14 },
  primaryBtn: { backgroundColor: '#007AFF', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8, elevation: 4 },
  primaryBtnText: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  toggleBtn: { alignItems: 'center', marginTop: 20, paddingVertical: 8 },
  toggleText: { fontSize: 14 },
  footer: { textAlign: 'center', fontSize: 12, marginTop: 32 },
});
