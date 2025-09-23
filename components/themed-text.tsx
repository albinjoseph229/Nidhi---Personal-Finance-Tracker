// Updated ThemedText component with Samsung-specific fixes
import { useThemeColor } from '@/hooks/use-theme-color';
import { StyleSheet, Text, type TextProps } from 'react-native';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        // Samsung-specific fixes
        styles.samsungFix,
        style,
      ]}
      // Force text scaling off to prevent Samsung's font scaling issues
      allowFontScaling={false}
      // Ensure text doesn't get clipped
      numberOfLines={0}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'System', // Use system font explicitly
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    fontFamily: 'System',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 40, // Increased from 32 to prevent clipping
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 28, // Added explicit line height
    fontFamily: 'System',
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    color: '#0a7ea4',
    fontFamily: 'System',
  },
  // Samsung-specific fixes
  samsungFix: {
    includeFontPadding: false, // Android-specific: removes extra padding
    textAlignVertical: 'center', // Android-specific: better alignment
    // Ensure minimum height for text containers
    minHeight: 20,
  },
});

// Alternative approach: Create a wrapper component for problematic areas
export function SamsungSafeText({ children, style, ...props }: TextProps) {
  return (
    <Text
      {...props}
      allowFontScaling={false}
      style={[
        {
          includeFontPadding: false,
          textAlignVertical: 'center',
          fontFamily: 'System',
          // Force a minimum width to prevent text clipping
          minWidth: 'auto',
          flexShrink: 0,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// Specific fixes for your home screen styles:
export const samsungCompatibleStyles = StyleSheet.create({
  // Fix for the "See All" text specifically
  seeAllText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    fontFamily: 'System',
    includeFontPadding: false,
    textAlignVertical: 'center',
    minWidth: 50, // Ensure minimum width
    textAlign: 'right',
    paddingHorizontal: 2, // Small padding to prevent edge clipping
  },
  
  // Fix for header container
  upcomingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    minHeight: 24, // Ensure minimum height
    paddingHorizontal: 2, // Prevent edge clipping
  },
  
  // General text container fix
  textContainer: {
    flexShrink: 0,
    minWidth: 'auto',
  },
});