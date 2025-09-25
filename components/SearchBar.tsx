// In components/SearchBar.tsx

import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

// Import the theme hook to get dynamic colors
import { useThemeColor } from '../hooks/use-theme-color';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export const SearchBar = ({ value, onChangeText, placeholder = "Search by category or note..." }: SearchBarProps) => {
  // Fetch theme-specific colors
  const backgroundColor = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'tabIconDefault');

  return (
    // Apply the dynamic background color to the container
    <View style={[styles.container, { backgroundColor }]}>
      <FontAwesome name="search" size={20} color={placeholderColor} style={styles.icon} />
      <TextInput
        // Apply dynamic colors to the text input
        style={[styles.input, { color: textColor }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
      />
    </View>
  );
};

// Styles are now cleaner, with color properties removed
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 15,
    // The margin was removed to allow for more flexible placement
    // It is recommended to add margin where the component is used, e.g., in `styles.searchContainer`
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
  },
});