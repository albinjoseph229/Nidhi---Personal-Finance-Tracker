/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';


export const Colors = {
  light: {
    text: '#1C1C1E', // Dark text for high contrast
    background: '#F0F2F5', // Light grey background
    card: '#FFFFFF', // White cards
    tabIconDefault: '#9E9E9E', // Grey for inactive tabs
    tabIconSelected: '#2D3A45', // Darker color for active tab
    tint: '#1C1C1E', // General tint color
  },
  dark: {
    text: '#F5F5F5', // Light grey/off-white text
    background: '#121212', // True dark background
    card: '#1E1E1E', // Slightly lighter card background
    tabIconDefault: '#8A8A8E', // Dimmed grey for inactive tabs
    tabIconSelected: '#F5F5F5', // Light color for active tab
    tint: '#F5F5F5', // General tint color
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
