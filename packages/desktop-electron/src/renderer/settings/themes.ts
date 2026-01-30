/**
 * Theme Definitions
 *
 * Complete color definitions for all supported themes.
 */

import type { Theme, ThemeId } from './types';

/**
 * Default Dark Theme
 * A clean, dark theme inspired by VS Code
 */
const defaultDark: Theme = {
  id: 'default-dark',
  name: 'Default Dark',
  isDark: true,
  colors: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    accent: '#007acc',
    accentHover: '#1a8ad4',
    border: '#3c3c3c',
    success: '#2ecc71',
    warning: '#daa520',
    error: '#cd3131',
    surface0: '#1e1e1e',
    surface1: '#252526',
    surface2: '#2d2d30',
    ansi: {
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#ffffff',
    },
  },
};

/**
 * Catppuccin Mocha
 * A warm, cozy dark theme
 */
const catppuccinMocha: Theme = {
  id: 'catppuccin-mocha',
  name: 'Catppuccin Mocha',
  isDark: true,
  colors: {
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    accent: '#cba6f7',
    accentHover: '#d4b8f9',
    border: '#45475a',
    success: '#a6e3a1',
    warning: '#f9e2af',
    error: '#f38ba8',
    surface0: '#1e1e2e',
    surface1: '#313244',
    surface2: '#45475a',
    ansi: {
      black: '#45475a',
      red: '#f38ba8',
      green: '#a6e3a1',
      yellow: '#f9e2af',
      blue: '#89b4fa',
      magenta: '#f5c2e7',
      cyan: '#94e2d5',
      white: '#bac2de',
      brightBlack: '#585b70',
      brightRed: '#f38ba8',
      brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af',
      brightBlue: '#89b4fa',
      brightMagenta: '#f5c2e7',
      brightCyan: '#94e2d5',
      brightWhite: '#a6adc8',
    },
  },
};

/**
 * Catppuccin Latte
 * A soft, light theme
 */
const catppuccinLatte: Theme = {
  id: 'catppuccin-latte',
  name: 'Catppuccin Latte',
  isDark: false,
  colors: {
    background: '#eff1f5',
    foreground: '#4c4f69',
    accent: '#8839ef',
    accentHover: '#9a4ff1',
    border: '#bcc0cc',
    success: '#40a02b',
    warning: '#df8e1d',
    error: '#d20f39',
    surface0: '#eff1f5',
    surface1: '#e6e9ef',
    surface2: '#dce0e8',
    ansi: {
      black: '#5c5f77',
      red: '#d20f39',
      green: '#40a02b',
      yellow: '#df8e1d',
      blue: '#1e66f5',
      magenta: '#ea76cb',
      cyan: '#179299',
      white: '#acb0be',
      brightBlack: '#6c6f85',
      brightRed: '#d20f39',
      brightGreen: '#40a02b',
      brightYellow: '#df8e1d',
      brightBlue: '#1e66f5',
      brightMagenta: '#ea76cb',
      brightCyan: '#179299',
      brightWhite: '#bcc0cc',
    },
  },
};

/**
 * Dracula
 * A dark theme with vibrant colors
 */
const dracula: Theme = {
  id: 'dracula',
  name: 'Dracula',
  isDark: true,
  colors: {
    background: '#282a36',
    foreground: '#f8f8f2',
    accent: '#bd93f9',
    accentHover: '#c9a5fa',
    border: '#44475a',
    success: '#50fa7b',
    warning: '#ffb86c',
    error: '#ff5555',
    surface0: '#282a36',
    surface1: '#44475a',
    surface2: '#6272a4',
    ansi: {
      black: '#21222c',
      red: '#ff5555',
      green: '#50fa7b',
      yellow: '#f1fa8c',
      blue: '#bd93f9',
      magenta: '#ff79c6',
      cyan: '#8be9fd',
      white: '#f8f8f2',
      brightBlack: '#6272a4',
      brightRed: '#ff6e6e',
      brightGreen: '#69ff94',
      brightYellow: '#ffffa5',
      brightBlue: '#d6acff',
      brightMagenta: '#ff92df',
      brightCyan: '#a4ffff',
      brightWhite: '#ffffff',
    },
  },
};

/**
 * Nord
 * A cool, Arctic-inspired theme
 */
const nord: Theme = {
  id: 'nord',
  name: 'Nord',
  isDark: true,
  colors: {
    background: '#2e3440',
    foreground: '#d8dee9',
    accent: '#88c0d0',
    accentHover: '#8fbcbb',
    border: '#3b4252',
    success: '#a3be8c',
    warning: '#ebcb8b',
    error: '#bf616a',
    surface0: '#2e3440',
    surface1: '#3b4252',
    surface2: '#434c5e',
    ansi: {
      black: '#3b4252',
      red: '#bf616a',
      green: '#a3be8c',
      yellow: '#ebcb8b',
      blue: '#81a1c1',
      magenta: '#b48ead',
      cyan: '#88c0d0',
      white: '#e5e9f0',
      brightBlack: '#4c566a',
      brightRed: '#bf616a',
      brightGreen: '#a3be8c',
      brightYellow: '#ebcb8b',
      brightBlue: '#81a1c1',
      brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb',
      brightWhite: '#eceff4',
    },
  },
};

/**
 * One Dark
 * Atom's iconic One Dark theme
 */
const oneDark: Theme = {
  id: 'one-dark',
  name: 'One Dark',
  isDark: true,
  colors: {
    background: '#282c34',
    foreground: '#abb2bf',
    accent: '#61afef',
    accentHover: '#74b9f0',
    border: '#3e4451',
    success: '#98c379',
    warning: '#e5c07b',
    error: '#e06c75',
    surface0: '#282c34',
    surface1: '#21252b',
    surface2: '#2c313a',
    ansi: {
      black: '#3f4451',
      red: '#e06c75',
      green: '#98c379',
      yellow: '#e5c07b',
      blue: '#61afef',
      magenta: '#c678dd',
      cyan: '#56b6c2',
      white: '#dcdfe4',
      brightBlack: '#4f5666',
      brightRed: '#f44747',
      brightGreen: '#98c379',
      brightYellow: '#e5c07b',
      brightBlue: '#61afef',
      brightMagenta: '#c678dd',
      brightCyan: '#56b6c2',
      brightWhite: '#abb2bf',
    },
  },
};

/**
 * Solarized Dark
 * The classic Solarized dark theme
 */
const solarizedDark: Theme = {
  id: 'solarized-dark',
  name: 'Solarized Dark',
  isDark: true,
  colors: {
    background: '#002b36',
    foreground: '#839496',
    accent: '#268bd2',
    accentHover: '#2aa198',
    border: '#073642',
    success: '#859900',
    warning: '#b58900',
    error: '#dc322f',
    surface0: '#002b36',
    surface1: '#073642',
    surface2: '#094552',
    ansi: {
      black: '#073642',
      red: '#dc322f',
      green: '#859900',
      yellow: '#b58900',
      blue: '#268bd2',
      magenta: '#d33682',
      cyan: '#2aa198',
      white: '#eee8d5',
      brightBlack: '#002b36',
      brightRed: '#cb4b16',
      brightGreen: '#586e75',
      brightYellow: '#657b83',
      brightBlue: '#839496',
      brightMagenta: '#6c71c4',
      brightCyan: '#93a1a1',
      brightWhite: '#fdf6e3',
    },
  },
};

/**
 * Solarized Light
 * The classic Solarized light theme
 */
const solarizedLight: Theme = {
  id: 'solarized-light',
  name: 'Solarized Light',
  isDark: false,
  colors: {
    background: '#fdf6e3',
    foreground: '#657b83',
    accent: '#268bd2',
    accentHover: '#2aa198',
    border: '#eee8d5',
    success: '#859900',
    warning: '#b58900',
    error: '#dc322f',
    surface0: '#fdf6e3',
    surface1: '#eee8d5',
    surface2: '#e4ddc8',
    ansi: {
      black: '#073642',
      red: '#dc322f',
      green: '#859900',
      yellow: '#b58900',
      blue: '#268bd2',
      magenta: '#d33682',
      cyan: '#2aa198',
      white: '#eee8d5',
      brightBlack: '#002b36',
      brightRed: '#cb4b16',
      brightGreen: '#586e75',
      brightYellow: '#657b83',
      brightBlue: '#839496',
      brightMagenta: '#6c71c4',
      brightCyan: '#93a1a1',
      brightWhite: '#fdf6e3',
    },
  },
};

/**
 * Arañaverse
 * A vibrant Spider-Verse inspired theme with vivid colors
 */
const aranaverse: Theme = {
  id: 'aranaverse',
  name: 'Arañaverse',
  isDark: true,
  colors: {
    background: '#0d0d1a',
    foreground: '#f0f0f5',
    accent: '#e612b9',
    accentHover: '#ff2ed0',
    border: '#2a2a4a',
    success: '#00c5c7',
    warning: '#ffce27',
    error: '#ff3366',
    surface0: '#0d0d1a',
    surface1: '#1a1a2e',
    surface2: '#2a2a4a',
    ansi: {
      black: '#1a1a2e',
      red: '#ff3366',
      green: '#00c5c7',
      yellow: '#ffce27',
      blue: '#00c1ff',
      magenta: '#e612b9',
      cyan: '#00c1ff',
      white: '#f0f0f5',
      brightBlack: '#4a4a6a',
      brightRed: '#ff5c8a',
      brightGreen: '#33ffd0',
      brightYellow: '#ffe566',
      brightBlue: '#66d9ff',
      brightMagenta: '#ff66d9',
      brightCyan: '#66d9ff',
      brightWhite: '#ffffff',
    },
  },
};

/**
 * All available themes indexed by ID
 */
export const themes: Record<ThemeId, Theme> = {
  'default-dark': defaultDark,
  'catppuccin-mocha': catppuccinMocha,
  'catppuccin-latte': catppuccinLatte,
  'dracula': dracula,
  'nord': nord,
  'one-dark': oneDark,
  'solarized-dark': solarizedDark,
  'solarized-light': solarizedLight,
  'aranaverse': aranaverse,
};

/**
 * Get a theme by ID
 */
export function getTheme(id: ThemeId): Theme {
  return themes[id] || themes['default-dark'];
}

/**
 * Get all themes as an array (useful for selectors)
 */
export function getAllThemes(): Theme[] {
  return Object.values(themes);
}
