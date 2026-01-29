/**
 * Key code mappings for terminal special keys
 * Maps human-readable key names to their ANSI escape sequences
 */

export const KEY_SEQUENCES: Record<string, string> = {
  // Control keys
  "Enter": "\r",
  "Tab": "\t",
  "Escape": "\x1b",
  "Backspace": "\x7f",
  "Delete": "\x1b[3~",
  "Space": " ",

  // Arrow keys (with aliases)
  "ArrowUp": "\x1b[A",
  "ArrowDown": "\x1b[B",
  "ArrowRight": "\x1b[C",
  "ArrowLeft": "\x1b[D",
  "Up": "\x1b[A",
  "Down": "\x1b[B",
  "Right": "\x1b[C",
  "Left": "\x1b[D",

  // Navigation keys
  "Home": "\x1b[H",
  "End": "\x1b[F",
  "PageUp": "\x1b[5~",
  "PageDown": "\x1b[6~",
  "Insert": "\x1b[2~",

  // Function keys
  "F1": "\x1bOP",
  "F2": "\x1bOQ",
  "F3": "\x1bOR",
  "F4": "\x1bOS",
  "F5": "\x1b[15~",
  "F6": "\x1b[17~",
  "F7": "\x1b[18~",
  "F8": "\x1b[19~",
  "F9": "\x1b[20~",
  "F10": "\x1b[21~",
  "F11": "\x1b[23~",
  "F12": "\x1b[24~",

  // Ctrl combinations
  "Ctrl+A": "\x01",
  "Ctrl+B": "\x02",
  "Ctrl+C": "\x03",
  "Ctrl+D": "\x04",
  "Ctrl+E": "\x05",
  "Ctrl+F": "\x06",
  "Ctrl+G": "\x07",
  "Ctrl+H": "\x08",
  "Ctrl+I": "\x09",
  "Ctrl+J": "\x0a",
  "Ctrl+K": "\x0b",
  "Ctrl+L": "\x0c",
  "Ctrl+M": "\x0d",
  "Ctrl+N": "\x0e",
  "Ctrl+O": "\x0f",
  "Ctrl+P": "\x10",
  "Ctrl+Q": "\x11",
  "Ctrl+R": "\x12",
  "Ctrl+S": "\x13",
  "Ctrl+T": "\x14",
  "Ctrl+U": "\x15",
  "Ctrl+V": "\x16",
  "Ctrl+W": "\x17",
  "Ctrl+X": "\x18",
  "Ctrl+Y": "\x19",
  "Ctrl+Z": "\x1a",
  "Ctrl+[": "\x1b",
  "Ctrl+\\": "\x1c",
  "Ctrl+]": "\x1d",
  "Ctrl+^": "\x1e",
  "Ctrl+_": "\x1f",

  // Common shortcuts
  "Ctrl+Space": "\x00",

  // Alt combinations (ESC + char)
  "Alt+0": "\x1b0",
  "Alt+1": "\x1b1",
  "Alt+2": "\x1b2",
  "Alt+3": "\x1b3",
  "Alt+4": "\x1b4",
  "Alt+5": "\x1b5",
  "Alt+6": "\x1b6",
  "Alt+7": "\x1b7",
  "Alt+8": "\x1b8",
  "Alt+9": "\x1b9",
  "Alt+A": "\x1ba",
  "Alt+B": "\x1bb",
  "Alt+C": "\x1bc",
  "Alt+D": "\x1bd",
  "Alt+E": "\x1be",
  "Alt+F": "\x1bf",
  "Alt+G": "\x1bg",
  "Alt+H": "\x1bh",
  "Alt+I": "\x1bi",
  "Alt+J": "\x1bj",
  "Alt+K": "\x1bk",
  "Alt+L": "\x1bl",
  "Alt+M": "\x1bm",
  "Alt+N": "\x1bn",
  "Alt+O": "\x1bo",
  "Alt+P": "\x1bp",
  "Alt+Q": "\x1bq",
  "Alt+R": "\x1br",
  "Alt+S": "\x1bs",
  "Alt+T": "\x1bt",
  "Alt+U": "\x1bu",
  "Alt+V": "\x1bv",
  "Alt+W": "\x1bw",
  "Alt+X": "\x1bx",
  "Alt+Y": "\x1by",
  "Alt+Z": "\x1bz",

  // Alt+Arrow combinations
  "Alt+Up": "\x1b[1;3A",
  "Alt+Down": "\x1b[1;3B",
  "Alt+Right": "\x1b[1;3C",
  "Alt+Left": "\x1b[1;3D",

  // Shift+Arrow combinations
  "Shift+Up": "\x1b[1;2A",
  "Shift+Down": "\x1b[1;2B",
  "Shift+Right": "\x1b[1;2C",
  "Shift+Left": "\x1b[1;2D",

  // Ctrl+Arrow combinations
  "Ctrl+Up": "\x1b[1;5A",
  "Ctrl+Down": "\x1b[1;5B",
  "Ctrl+Right": "\x1b[1;5C",
  "Ctrl+Left": "\x1b[1;5D",
};

/**
 * Get the escape sequence for a key name
 * @param key - The key name (e.g., "Enter", "Ctrl+C", "ArrowUp")
 * @returns The escape sequence or null if not found
 */
export function getKeySequence(key: string): string | null {
  // Normalize key name
  const normalized = key.trim();

  // Check direct match
  if (KEY_SEQUENCES[normalized]) {
    return KEY_SEQUENCES[normalized];
  }

  // Check case-insensitive match
  const lowerKey = normalized.toLowerCase();
  for (const [name, seq] of Object.entries(KEY_SEQUENCES)) {
    if (name.toLowerCase() === lowerKey) {
      return seq;
    }
  }

  return null;
}

/**
 * Get all available key names
 */
export function getAvailableKeys(): string[] {
  return Object.keys(KEY_SEQUENCES);
}
