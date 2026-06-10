// context/AuthContext.tsx
// Supabase Auth + Biometric Lock

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
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

    return () => subscription.unsubscribe();
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      return { error: error.message };
    }
    return { error: null };
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