/**
 * useSettings Hook
 *
 * Custom hook for accessing and updating application settings.
 */

import { useContext } from 'react';
import { SettingsContext } from './SettingsContext';
import type { SettingsContextType } from './types';

/**
 * Hook to access settings and theme
 */
export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }

  return context;
}
