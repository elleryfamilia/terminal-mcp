/**
 * Settings Context Provider
 *
 * React context for managing application settings and theme.
 * Handles persistence via electron IPC and provides live updates.
 */

import {
  createContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type {
  AppSettings,
  SettingsUpdate,
  SettingsContextType,
  Theme,
} from './types';
import { defaultSettings } from './defaults';
import { getTheme } from './themes';

/**
 * Settings context with default values
 */
export const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  theme: getTheme(defaultSettings.appearance.theme),
  updateSettings: () => {},
  resetSettings: () => {},
  isLoaded: false,
});

/**
 * Apply theme CSS variables to the document
 */
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const { colors } = theme;

  // Base colors
  root.style.setProperty('--bg-primary', colors.background);
  root.style.setProperty('--fg-primary', colors.foreground);

  // Accent
  root.style.setProperty('--accent', colors.accent);
  root.style.setProperty('--accent-hover', colors.accentHover);

  // Status
  root.style.setProperty('--status-success', colors.success);
  root.style.setProperty('--status-warning', colors.warning);
  root.style.setProperty('--status-error', colors.error);

  // Surfaces
  root.style.setProperty('--surface-0', colors.surface0);
  root.style.setProperty('--surface-1', colors.surface1);
  root.style.setProperty('--surface-2', colors.surface2);

  // Borders
  root.style.setProperty('--border', colors.border);

  // Terminal ANSI colors
  root.style.setProperty('--ansi-black', colors.ansi.black);
  root.style.setProperty('--ansi-red', colors.ansi.red);
  root.style.setProperty('--ansi-green', colors.ansi.green);
  root.style.setProperty('--ansi-yellow', colors.ansi.yellow);
  root.style.setProperty('--ansi-blue', colors.ansi.blue);
  root.style.setProperty('--ansi-magenta', colors.ansi.magenta);
  root.style.setProperty('--ansi-cyan', colors.ansi.cyan);
  root.style.setProperty('--ansi-white', colors.ansi.white);
  root.style.setProperty('--ansi-bright-black', colors.ansi.brightBlack);
  root.style.setProperty('--ansi-bright-red', colors.ansi.brightRed);
  root.style.setProperty('--ansi-bright-green', colors.ansi.brightGreen);
  root.style.setProperty('--ansi-bright-yellow', colors.ansi.brightYellow);
  root.style.setProperty('--ansi-bright-blue', colors.ansi.brightBlue);
  root.style.setProperty('--ansi-bright-magenta', colors.ansi.brightMagenta);
  root.style.setProperty('--ansi-bright-cyan', colors.ansi.brightCyan);
  root.style.setProperty('--ansi-bright-white', colors.ansi.brightWhite);

  // Set theme data attribute for CSS selectors
  root.setAttribute('data-theme', theme.id);
  root.setAttribute('data-theme-mode', theme.isDark ? 'dark' : 'light');
}

interface SettingsProviderProps {
  children: ReactNode;
}

/**
 * Settings Provider Component
 */
export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // Get the current theme based on settings
  const theme = useMemo(
    () => getTheme(settings.appearance.theme),
    [settings.appearance.theme]
  );

  // Apply theme whenever it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Apply window opacity via Electron (actual window transparency)
  useEffect(() => {
    const opacity = settings.advanced.windowOpacity / 100;
    window.terminalAPI.setWindowOpacity(opacity).catch(console.error);
  }, [settings.advanced.windowOpacity]);

  // Load settings on mount
  useEffect(() => {
    window.terminalAPI
      .getSettings()
      .then((loadedSettings) => {
        setSettings(loadedSettings);
        setIsLoaded(true);
      })
      .catch((err) => {
        console.error('Failed to load settings:', err);
        setIsLoaded(true); // Still mark as loaded, using defaults
      });
  }, []);

  // Update settings
  const updateSettings = useCallback((updates: SettingsUpdate) => {
    window.terminalAPI
      .updateSettings(updates)
      .then((updatedSettings) => {
        setSettings(updatedSettings);
      })
      .catch((err) => {
        console.error('Failed to update settings:', err);
      });
  }, []);

  // Reset settings
  const resetSettings = useCallback(() => {
    window.terminalAPI
      .resetSettings()
      .then((defaultSettings) => {
        setSettings(defaultSettings);
      })
      .catch((err) => {
        console.error('Failed to reset settings:', err);
      });
  }, []);

  const contextValue = useMemo<SettingsContextType>(
    () => ({
      settings,
      theme,
      updateSettings,
      resetSettings,
      isLoaded,
    }),
    [settings, theme, updateSettings, resetSettings, isLoaded]
  );

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}
