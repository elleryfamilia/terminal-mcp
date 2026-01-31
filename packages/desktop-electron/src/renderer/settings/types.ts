/**
 * Settings and Theme Type Definitions
 *
 * TypeScript interfaces for the application settings and theme system.
 */

/**
 * Theme identifier - used to reference themes
 */
export type ThemeId =
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
 * ANSI terminal colors (16 colors)
 */
export interface AnsiColors {
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

/**
 * Complete theme color definition
 */
export interface ThemeColors {
  // Base colors
  background: string;
  foreground: string;

  // UI colors
  accent: string;
  accentHover: string;
  border: string;

  // Status colors
  success: string;
  warning: string;
  error: string;

  // Surface levels (for layered UI)
  surface0: string;  // Lowest (e.g., background)
  surface1: string;  // Cards, panels
  surface2: string;  // Hover states

  // Terminal ANSI colors
  ansi: AnsiColors;
}

/**
 * Theme definition including metadata
 */
export interface Theme {
  id: ThemeId;
  name: string;
  isDark: boolean;
  colors: ThemeColors;
}

/**
 * Cursor style options for the terminal
 */
export type CursorStyle = 'block' | 'bar' | 'underline';

/**
 * Font family - any string to allow custom/system fonts
 */
export type FontFamily = string;

/**
 * Application settings schema
 */
export interface AppSettings {
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
    /**
     * Also set LC_CTYPE in addition to LANG.
     * When false (default), only LANG is set, matching iTerm2 behavior.
     * When true, also sets LC_CTYPE which may cause SSH locale errors.
     */
    setLocaleEnv: boolean;
  };
  advanced: {
    gpuAcceleration: boolean;
    windowOpacity: number;
    debugMode: boolean;
  };
}

/**
 * Settings update payload (partial updates allowed)
 */
export type SettingsUpdate = {
  [K in keyof AppSettings]?: Partial<AppSettings[K]>;
};

/**
 * Settings context type for React
 */
export interface SettingsContextType {
  settings: AppSettings;
  theme: Theme;
  updateSettings: (updates: SettingsUpdate) => void;
  resetSettings: () => void;
  isLoaded: boolean;
}
