// context/AuthContext.tsx
// Supabase Auth + Biometric Lock

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as LocalAuthentication from 'expo-local-authentication';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Ensure web browser auth sessions are dismissed properly
WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  // Supabase Auth
  session: Session | null;
  user: User | null;
  isAuthLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  // Biometric Lock (kept from original)
  isAppLockEnabled: boolean;
  isAuthenticated: boolean;
  authenticate: () => Promise<void>;
  toggleAppLock: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// In-memory flag to prevent re-authentication on hot-reloads
let sessionAuthenticated = false;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Supabase Auth state
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Biometric Lock state (kept from original)
  const [isAppLockEnabled, setIsAppLockEnabled] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Listen to Supabase auth state changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthLoading(false);
    });

    // Listen for auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setIsAuthLoading(false);
      }
    );

    // Handle deep links for email verification
    const handleDeepLink = async (url: string | null) => {
      if (!url) return;
      try {
        const parsedUrl = Linking.parse(url);
        
        // Handle PKCE flow
        if (parsedUrl.queryParams?.code) {
          await supabase.auth.exchangeCodeForSession(parsedUrl.queryParams.code as string);
          return;
        }

        // Handle Implicit flow
        const accessToken = parsedUrl.queryParams?.access_token as string;
        const refreshToken = parsedUrl.queryParams?.refresh_token as string;
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          return;
        }
        
        // Manual fallback for hash fragment
        if (url.includes('#')) {
          const fragment = url.split('#')[1];
          // Use string split to avoid URLSearchParams dependency issues
          const params = fragment.split('&').reduce((acc, curr) => {
            const [key, value] = curr.split('=');
            acc[key] = value;
            return acc;
          }, {} as Record<string, string>);
          
          if (params.access_token && params.refresh_token) {
            await supabase.auth.setSession({ 
              access_token: params.access_token, 
              refresh_token: params.refresh_token 
            });
          }
        }
      } catch (e) {
        console.error("Error parsing deep link:", e);
      }
    };

    // Check initial URL (if app was closed)
    Linking.getInitialURL().then(handleDeepLink);

    // Listen for incoming URLs while app is open
    const urlSubscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.unsubscribe();
      urlSubscription.remove();
    };
  }, []);

  // Load biometric lock setting
  useEffect(() => {
    const loadSettings = async () => {
      const appLockSetting = await AsyncStorage.getItem('isAppLockEnabled');
      const isEnabled = appLockSetting === 'true';
      setIsAppLockEnabled(isEnabled);
      if (!isEnabled) {
        setIsAuthenticated(true);
        sessionAuthenticated = true;
      }
    };
    loadSettings();
  }, []);

  // Re-lock app when going to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        sessionAuthenticated = false;
        if (isAppLockEnabled) {
          setIsAuthenticated(false);
        }
      }
    });
    return () => subscription.remove();
  }, [isAppLockEnabled]);

  // Also handle Supabase token refresh when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
    return () => subscription.remove();
  }, []);

  // --- Auth Methods ---

  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  };

  const signUpWithEmail = async (
    email: string,
    password: string
  ): Promise<{ error: string | null }> => {
    // Generate the correct deep link for the current environment (Expo Go or Production build)
    const redirectUrl = Linking.createURL('/auth/callback');
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  };

  const verifyOtp = async (email: string, token: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    try {
      const redirectUrl = Linking.createURL('/auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true, // We handle the browser in React Native
        },
      });
      
      if (error) return { error: error.message };
      
      if (data?.url) {
        await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        // The global Linking.addEventListener inside useEffect will catch the redirect
        // and complete the login via exchangeCodeForSession or setSession.
      }
      return { error: null };
    } catch (e: any) {
      return { error: e.message || 'Something went wrong with Google Sign In' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // --- Biometric Lock Methods (unchanged) ---

  const authenticate = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    if (hasHardware && supportedTypes.length > 0) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access Nidhi',
      });

      if (result.success) {
        setIsAuthenticated(true);
        sessionAuthenticated = true;
      }
    }
  };

  const toggleAppLock = async () => {
    const newValue = !isAppLockEnabled;
    if (newValue) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm to enable App Lock',
      });
      if (!result.success) {
        return;
      }
    }
    await AsyncStorage.setItem('isAppLockEnabled', String(newValue));
    setIsAppLockEnabled(newValue);
    if (!newValue) {
      setIsAuthenticated(true);
      sessionAuthenticated = true;
    }
  };

  const value: AuthContextType = {
    // Supabase Auth
    session,
    user: session?.user ?? null,
    isAuthLoading,
    signInWithEmail,
    signUpWithEmail,
    verifyOtp,
    signInWithGoogle,
    signOut,
    // Biometric Lock
    isAppLockEnabled,
    isAuthenticated: isAuthenticated || sessionAuthenticated,
    authenticate,
    toggleAppLock,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};