// app/sign-in.tsx
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, TextInput, View, Image
} from 'react-native';
import Animated, { 
  useAnimatedStyle, useSharedValue, withDelay, withTiming, runOnJS, Easing
} from 'react-native-reanimated';
import { ThemedText } from '../components/themed-text';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Colors } from '../constants/theme';

export default function SignInScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const { theme } = useTheme();
  const colors = Colors[theme === 'dark' ? 'dark' : 'light'];
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  // Animation values
  const logoOpacity = useSharedValue(1);
  const logoScale = useSharedValue(1);
  const formOpacity = useSharedValue(0);
  const formTranslateY = useSharedValue(20);

  useEffect(() => {
    // Sequence: Wait 1.5s -> fade out logo -> hide welcome container -> fade in form
    logoOpacity.value = withDelay(1500, withTiming(0, { duration: 500, easing: Easing.out(Easing.ease) }, (finished) => {
      if (finished) {
        runOnJS(setShowWelcome)(false);
      }
    }));
    logoScale.value = withDelay(1500, withTiming(0.9, { duration: 500 }));
  }, [logoOpacity, logoScale]);

  useEffect(() => {
    if (!showWelcome) {
      formOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) });
      formTranslateY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) });
    }
  }, [showWelcome, formOpacity, formTranslateY]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const formStyle = useAnimatedStyle(() => ({
    opacity: formOpacity.value,
    transform: [{ translateY: formTranslateY.value }],
  }));

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      return Alert.alert('Missing Fields', 'Please enter your email and password.');
    }
    if (password.length < 6) {
      return Alert.alert('Weak Password', 'Password must be at least 6 characters.');
    }
    if (isSignUp && password !== confirmPassword) {
      return Alert.alert('Password Mismatch', 'Your passwords do not match.');
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
    } catch { 
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const result = await signInWithGoogle();
    if (result?.error) Alert.alert('Error', result.error);
    setIsLoading(false);
  };

  if (showWelcome) {
    return (
      <View style={[styles.welcomeContainer, { backgroundColor: colors.background }]}>
        <Animated.View style={[styles.brandSection, logoStyle]}>
          <View style={[styles.logoBox, { backgroundColor: colors.card }]}>
            <Image source={require('../assets/images/nidhi-favicon.png')} style={{ width: 60, height: 60 }} resizeMode="contain" />
          </View>
          <ThemedText style={[styles.appName, { color: colors.text }]}>Nidhi</ThemedText>
        </Animated.View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        <Animated.View style={[styles.formCard, { backgroundColor: colors.background }, formStyle]}>
          <ThemedText style={[styles.formTitle, { color: colors.text }]}>
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </ThemedText>
          <ThemedText style={[styles.formSub, { color: colors.tabIconDefault }]}>
            {isSignUp ? 'Sign up to sync across devices' : 'Sign in to access your data'}
          </ThemedText>

          <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.tabIconDefault + '30' }]}>
                <Feather name="mail" size={18} color={colors.tabIconDefault} style={styles.inputIcon} />
                <TextInput style={[styles.input, { color: colors.text }]} placeholder="Email"
                  placeholderTextColor={colors.tabIconDefault} value={email} onChangeText={setEmail}
                  keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!isLoading} />
              </View>

              <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.tabIconDefault + '30' }]}>
                <Feather name="lock" size={18} color={colors.tabIconDefault} style={styles.inputIcon} />
                <TextInput style={[styles.input, { color: colors.text }]} placeholder="Password"
                  placeholderTextColor={colors.tabIconDefault} value={password} onChangeText={setPassword}
                  secureTextEntry={!showPassword} autoCapitalize="none" editable={!isLoading} />
                <Pressable onPress={() => setShowPassword(!showPassword)}>
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.tabIconDefault} />
                </Pressable>
              </View>

              {isSignUp && (
                <Animated.View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.tabIconDefault + '30' }]}>
                  <Feather name="shield" size={18} color={colors.tabIconDefault} style={styles.inputIcon} />
                  <TextInput style={[styles.input, { color: colors.text }]} placeholder="Confirm Password"
                    placeholderTextColor={colors.tabIconDefault} value={confirmPassword} onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword} autoCapitalize="none" editable={!isLoading} />
                </Animated.View>
              )}

              <Pressable style={[styles.primaryBtn, isLoading && { opacity: 0.7 }]}
                onPress={handleAuth} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#FFF" /> :
                  <ThemedText style={styles.primaryBtnText}>{isSignUp ? 'Sign Up' : 'Sign In'}</ThemedText>}
              </Pressable>

              <View style={styles.dividerWrap}>
                <View style={[styles.divider, { backgroundColor: colors.tabIconDefault + '40' }]} />
                <ThemedText style={[styles.dividerText, { color: colors.tabIconDefault }]}>OR</ThemedText>
                <View style={[styles.divider, { backgroundColor: colors.tabIconDefault + '40' }]} />
              </View>

              <Pressable style={[styles.googleBtn, { backgroundColor: colors.card, borderColor: colors.tabIconDefault + '30' }]}
                onPress={handleGoogleSignIn} disabled={isLoading}>
                <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' }} style={styles.googleIcon} />
                <ThemedText style={[styles.googleBtnText, { color: colors.text }]}>Continue with Google</ThemedText>
              </Pressable>

              <Pressable style={styles.toggleBtn} onPress={() => setIsSignUp(!isSignUp)} disabled={isLoading}>
                <ThemedText style={[styles.toggleText, { color: colors.tabIconDefault }]}>
                  {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                  <ThemedText style={{ color: '#007AFF', fontWeight: '600' }}>
                    {isSignUp ? 'Sign In' : 'Sign Up'}
                  </ThemedText>
                </ThemedText>
              </Pressable>
        </Animated.View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  welcomeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brandSection: { alignItems: 'center' },
  logoBox: { width: 100, height: 100, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  appName: { fontSize: 42, fontWeight: '800', letterSpacing: -1, lineHeight: 52, paddingBottom: 8 },
  formCard: { paddingVertical: 20 },
  formTitle: { fontSize: 32, fontWeight: '800', marginBottom: 8, letterSpacing: -0.5 },
  formSub: { fontSize: 16, marginBottom: 32 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 16, borderWidth: 1 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, paddingVertical: 14 },
  primaryBtn: { backgroundColor: '#007AFF', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 16, elevation: 2, shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  primaryBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  toggleBtn: { alignItems: 'center', marginTop: 24, paddingVertical: 12 },
  toggleText: { fontSize: 15 },
  dividerWrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  divider: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 16, fontSize: 13, fontWeight: '600' },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, borderWidth: 1 },
  googleIcon: { width: 24, height: 24, marginRight: 12 },
  googleBtnText: { fontSize: 16, fontWeight: '600' },
});
