/**
 * Default Settings
 *
 * Default values for all application settings.
 */

import type { AppSettings } from './types';

/**
 * Default application settings
 */
export const defaultSettings: AppSettings = {
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
    setLocaleEnv: false,
  },
  advanced: {
    gpuAcceleration: true,
    windowOpacity: 100,
    debugMode: false,
  },
};

/**
 * Font size options
 */
export const fontSizes = [10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24] as const;

/**
 * Scrollback constraints
 */
export const SCROLLBACK_MIN = 1000;
export const SCROLLBACK_MAX = 50000;

/**
 * Opacity constraints
 */
export const OPACITY_MIN = 50;
export const OPACITY_MAX = 100;

/**
 * Available font families (monospace fonts suitable for terminals)
 * Note: Web/Electron cannot enumerate system fonts for security reasons.
 * This is a curated list - the app will fall back gracefully if a font isn't installed.
 */
export const fontFamilies = [
  // Nerd Fonts (with icons)
  'JetBrainsMono Nerd Font',
  'JetBrainsMono Nerd Font Mono',
  'Hack Nerd Font',
  'Hack Nerd Font Mono',
  'FiraCode Nerd Font',
  'FiraCode Nerd Font Mono',
  'CaskaydiaCove Nerd Font',
  'CaskaydiaCove Nerd Font Mono',
  'MesloLGS Nerd Font',
  'MesloLGS Nerd Font Mono',
  'Iosevka Nerd Font',
  'Iosevka Nerd Font Mono',
  'SauceCodePro Nerd Font',
  'SauceCodePro Nerd Font Mono',
  '0xProto Nerd Font Mono',
  'Symbols Nerd Font Mono',
  // System fonts
  'Menlo',
  'Monaco',
  'SF Mono',
  'Andale Mono',
  'Courier New',
  // Cross-platform
  'Consolas',
  'Cascadia Code',
  'Fira Code',
  'Source Code Pro',
  'Ubuntu Mono',
  'DejaVu Sans Mono',
] as const;
