// In context/ThemeContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isLoading: boolean;
}

const THEME_STORAGE_KEY = '@expense_tracker_theme';

// Create the context with a default value
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Create the provider component
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemTheme = useColorScheme() ?? 'light';
  const [theme, setThemeState] = useState<Theme>(systemTheme);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load saved theme preference on app start
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme && ['light', 'dark'].includes(savedTheme)) {
          setThemeState(savedTheme as Theme);
        } else {
          // If no saved theme, use system theme
          setThemeState(systemTheme);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
        // Fallback to system theme on error
        setThemeState(systemTheme);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTheme();
  }, [systemTheme]);

  // Update theme when system theme changes (only if user hasn't manually set a theme)
  useEffect(() => {
    const checkForSavedTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (!savedTheme) {
          // Only follow system theme if user hasn't set a preference
          setThemeState(systemTheme);
        }
      } catch (error) {
        console.error('Error checking saved theme:', error);
      }
    };
    
    if (!isLoading) {
      checkForSavedTheme();
    }
  }, [systemTheme, isLoading]);

  const setTheme = async (newTheme: Theme) => {
    try {
      setThemeState(newTheme);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const toggleTheme = () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Create a custom hook to easily use the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};