/**
 * Main theme configuration
 * Import and use this in your components
 */

import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import colors, { darkColors } from './colors';
import typography from './typography';
import { spacing, borderRadius, shadows } from './spacing';

export const theme = {
  dark: false,
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
};

export const darkTheme = {
  ...theme,
  dark: true,
  colors: darkColors,
  shadows: Object.fromEntries(Object.entries(shadows).map(([name, shadow]) => [
    name, { ...shadow, shadowColor: darkColors.shadow },
  ])),
};

/** Shared native components follow the device appearance on either platform. */
export const useAppTheme = () => useColorScheme() === 'dark' ? darkTheme : theme;

/** Keep screen styles stable until the system appearance actually changes. */
export function useThemedStyles(createStyles) {
  const currentTheme = useAppTheme();
  const styles = useMemo(() => createStyles(currentTheme), [createStyles, currentTheme]);
  return { theme: currentTheme, styles };
}

export default theme;
