import { useColorScheme } from 'react-native';

import { getTheme, type ThemeMode } from '../../theme/index.js';

/** Resolves the device colour scheme into our two-mode field theme. */
export function useFieldTheme() {
  const scheme = useColorScheme();
  const mode: ThemeMode = scheme === 'dark' ? 'dark' : 'light';
  return getTheme(mode);
}
