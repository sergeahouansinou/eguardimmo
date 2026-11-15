'use client';

import { useEffect } from 'react';
import { useStoredValue } from './storedValue';

export const THEMES = ['light', 'dark', 'auto'] as const;
export type ThemeChoice = (typeof THEMES)[number];

export function useTheme(): [ThemeChoice, (theme: ThemeChoice) => void] {
  const [theme, setTheme] = useStoredValue('eg-theme', THEMES, 'auto');
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);
  return [theme, setTheme];
}
