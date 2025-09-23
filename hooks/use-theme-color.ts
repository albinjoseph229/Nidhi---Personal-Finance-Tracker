// In hooks/use-theme-color.ts
import { Colors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext'; // <-- Import useTheme

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const { theme } = useTheme(); // <-- Use our context to get the theme
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}