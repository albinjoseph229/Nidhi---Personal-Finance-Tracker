// In context/AuthContext.tsx

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';

interface AuthContextType {
  isAppLockEnabled: boolean;
  isAuthenticated: boolean;
  authenticate: () => Promise<void>;
  toggleAppLock: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// A simple in-memory flag to prevent re-authentication on hot-reloads
let sessionAuthenticated = false;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAppLockEnabled, setIsAppLockEnabled] = useState(false);
  // isAuthenticated is true if the user has successfully unlocked the app in the current session
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load the app lock setting from storage when the app starts
  useEffect(() => {
    const loadSettings = async () => {
      const appLockSetting = await AsyncStorage.getItem('isAppLockEnabled');
      const isEnabled = appLockSetting === 'true';
      setIsAppLockEnabled(isEnabled);
      // If the lock is disabled, the user is considered authenticated by default
      if (!isEnabled) {
        setIsAuthenticated(true);
        sessionAuthenticated = true;
      }
    };
    loadSettings();
  }, []);
  
  // This effect handles re-locking the app when it comes back from the background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // When app goes to background, reset the session authentication flag
        sessionAuthenticated = false;
        if(isAppLockEnabled) {
          setIsAuthenticated(false);
        }
      }
    });
    return () => subscription.remove();
  }, [isAppLockEnabled]);


  // Function to trigger the biometric prompt
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

  // Function to enable or disable the app lock feature
  const toggleAppLock = async () => {
    const newValue = !isAppLockEnabled;
    // If enabling, require authentication first
    if (newValue) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm to enable App Lock',
      });
      if (!result.success) {
        return; // User failed to authenticate, do not enable
      }
    }
    await AsyncStorage.setItem('isAppLockEnabled', String(newValue));
    setIsAppLockEnabled(newValue);
    // If disabling the lock, the user should be considered authenticated
    if (!newValue) {
      setIsAuthenticated(true);
      sessionAuthenticated = true;
    }
  };

  const value: AuthContextType = {
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