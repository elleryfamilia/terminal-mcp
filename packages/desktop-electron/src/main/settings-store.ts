/**
 * Settings Store
 *
 * Main process settings persistence using electron-store.
 * Exposes IPC handlers for the renderer to read/write settings.
 */

import { ipcMain, BrowserWindow } from 'electron';
import Store from 'electron-store';

/**
 * Theme identifier
 */
type ThemeId =
  | 'default-dark'
  | 'catppuccin-mocha'
  | 'catppuccin-latte'
  | 'dracula'
  | 'nord'
  | 'one-dark'
  | 'solarized-dark'
  | 'solarized-light'
  | 'aranaverse';

/**
 * Cursor style options
 */
type CursorStyle = 'block' | 'bar' | 'underline';

/**
 * Font family options (monospace fonts suitable for terminals)
 */
type FontFamily =
  | 'JetBrainsMono Nerd Font'
  | 'Menlo'
  | 'Monaco'
  | 'SF Mono'
  | 'Consolas'
  | 'Cascadia Code'
  | 'Fira Code'
  | 'Source Code Pro'
  | 'Ubuntu Mono'
  | 'DejaVu Sans Mono';

/**
 * Application settings schema
 */
interface AppSettings {
  appearance: {
    theme: ThemeId;
    fontFamily: FontFamily;
    fontSize: number;
    fontLigatures: boolean;
  };
  terminal: {
    cursorStyle: CursorStyle;
    cursorBlink: boolean;
    scrollbackLines: number;
    bellSound: boolean;
  };
  advanced: {
    gpuAcceleration: boolean;
    windowOpacity: number;
    debugMode: boolean;
  };
}

/**
 * Store schema
 */
interface SettingsStoreSchema {
  settings: AppSettings;
}

/**
 * Default settings values
 */
const defaultSettings: AppSettings = {
  appearance: {
    theme: 'default-dark',
    fontFamily: 'JetBrainsMono Nerd Font',
    fontSize: 14,
    fontLigatures: true,
  },
  terminal: {
    cursorStyle: 'block',
    cursorBlink: true,
    scrollbackLines: 5000,
    bellSound: false,
  },
  advanced: {
    gpuAcceleration: true,
    windowOpacity: 100,
    debugMode: false,
  },
};

/**
 * Settings store instance
 */
const store = new Store<SettingsStoreSchema>({
  name: 'settings',
  defaults: {
    settings: defaultSettings,
  },
});

/**
 * Get current settings
 */
export function getSettings(): AppSettings {
  return store.get('settings', defaultSettings);
}

/**
 * Update settings (deep merge)
 */
export function updateSettings(updates: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const updated: AppSettings = {
    appearance: {
      ...current.appearance,
      ...(updates.appearance || {}),
    },
    terminal: {
      ...current.terminal,
      ...(updates.terminal || {}),
    },
    advanced: {
      ...current.advanced,
      ...(updates.advanced || {}),
    },
  };
  store.set('settings', updated);
  return updated;
}

/**
 * Reset settings to defaults
 */
export function resetSettings(): AppSettings {
  store.set('settings', defaultSettings);
  return defaultSettings;
}

/**
 * Initialize IPC handlers for settings
 */
export function initSettingsHandlers(): void {
  // Get settings
  ipcMain.handle('settings:get', () => {
    return getSettings();
  });

  // Update settings
  ipcMain.handle('settings:update', (_event, updates: Partial<AppSettings>) => {
    return updateSettings(updates);
  });

  // Reset settings
  ipcMain.handle('settings:reset', () => {
    return resetSettings();
  });

  // Set window opacity (0.0 to 1.0)
  ipcMain.handle('settings:setWindowOpacity', (event, opacity: number) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      // Clamp opacity between 0.5 and 1.0 (matching our settings range of 50-100%)
      const clampedOpacity = Math.max(0.5, Math.min(1.0, opacity));
      win.setOpacity(clampedOpacity);
      return true;
    }
    return false;
  });
}
