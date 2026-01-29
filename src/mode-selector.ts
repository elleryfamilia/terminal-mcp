#!/usr/bin/env node
/**
 * Standalone mode selector - minimal script for GUI wrapper
 * Outputs JSON: {"mode": "direct"|"sandbox"} or {"mode": null, "cancelled": true}
 */

// ANSI escape codes
const ESC = "\x1b";
const CURSOR_HIDE = `${ESC}[?25l`;
const CURSOR_SHOW = `${ESC}[?25h`;
const CLEAR_SCREEN = `${ESC}[2J`;
const CURSOR_HOME = `${ESC}[H`;
const CURSOR_TO = (row: number, col: number) => `${ESC}[${row};${col}H`;

// Colors
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;
const RESET = `${ESC}[0m`;
const GREEN = `${ESC}[32m`;
const YELLOW = `${ESC}[33m`;
const GRAY = `${ESC}[90m`;
const WHITE = `${ESC}[97m`;

// Box drawing
const BOX = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
};

type Mode = 'direct' | 'sandbox';

// Helper to pad string, handling negative values
const pad = (n: number) => " ".repeat(Math.max(0, n));
const repeat = (s: string, n: number) => s.repeat(Math.max(0, n));

async function main() {
  // Check if we can use raw mode
  if (typeof process.stdin.setRawMode !== 'function') {
    console.log(JSON.stringify({ mode: 'direct' }));
    process.exit(0);
  }

  let selected: Mode = 'direct';
  const boxWidth = 38;

  try {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
  } catch {
    console.log(JSON.stringify({ mode: 'direct' }));
    process.exit(0);
  }

  // Get terminal size
  const cols = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;

  // Calculate center position
  const startCol = Math.max(1, Math.floor((cols - boxWidth) / 2));
  const startRow = Math.max(1, Math.floor((rows - 10) / 2));

  const render = () => {
    const output: string[] = [];
    output.push(CLEAR_SCREEN + CURSOR_HOME + CURSOR_HIDE);

    const innerWidth = boxWidth - 2;
    const lines: string[] = [];

    // Title bar
    const title = " Terminal Mode ";
    const titlePadLeft = Math.floor((innerWidth - title.length) / 2);
    const titlePadRight = innerWidth - titlePadLeft - title.length;
    lines.push(
      `${YELLOW}${BOX.topLeft}${repeat(BOX.horizontal, titlePadLeft)}${WHITE}${BOLD}${title}${RESET}${YELLOW}${repeat(BOX.horizontal, titlePadRight)}${BOX.topRight}${RESET}`
    );

    // Empty line
    lines.push(`${YELLOW}${BOX.vertical}${RESET}${pad(innerWidth)}${YELLOW}${BOX.vertical}${RESET}`);

    // Standard option
    const stdSelected = selected === 'direct';
    const stdBullet = stdSelected ? `${GREEN}●${RESET}` : `${GRAY}○${RESET}`;
    const stdLabel = stdSelected ? `${WHITE}${BOLD}Standard${RESET}` : `${GRAY}Standard${RESET}`;
    const stdContent = `  ${stdBullet} ${stdLabel}`;
    // Account for ANSI codes in length calculation
    const stdVisibleLen = 2 + 1 + 1 + 8; // "  " + bullet + " " + "Standard"
    lines.push(`${YELLOW}${BOX.vertical}${RESET}${stdContent}${pad(innerWidth - stdVisibleLen)}${YELLOW}${BOX.vertical}${RESET}`);

    // Standard description
    const stdDesc = "full access to resources";
    lines.push(`${YELLOW}${BOX.vertical}${RESET}      ${DIM}${stdDesc}${RESET}${pad(innerWidth - 6 - stdDesc.length)}${YELLOW}${BOX.vertical}${RESET}`);

    // Empty line
    lines.push(`${YELLOW}${BOX.vertical}${RESET}${pad(innerWidth)}${YELLOW}${BOX.vertical}${RESET}`);

    // Sandboxed option
    const sbxSelected = selected === 'sandbox';
    const sbxBullet = sbxSelected ? `${GREEN}●${RESET}` : `${GRAY}○${RESET}`;
    const sbxLabel = sbxSelected ? `${WHITE}${BOLD}Sandboxed${RESET}` : `${GRAY}Sandboxed${RESET}`;
    const sbxContent = `  ${sbxBullet} ${sbxLabel}`;
    const sbxVisibleLen = 2 + 1 + 1 + 9; // "  " + bullet + " " + "Sandboxed"
    lines.push(`${YELLOW}${BOX.vertical}${RESET}${sbxContent}${pad(innerWidth - sbxVisibleLen)}${YELLOW}${BOX.vertical}${RESET}`);

    // Sandboxed description
    const sbxDesc = "restricted access with controls";
    lines.push(`${YELLOW}${BOX.vertical}${RESET}      ${DIM}${sbxDesc}${RESET}${pad(innerWidth - 6 - sbxDesc.length)}${YELLOW}${BOX.vertical}${RESET}`);

    // Empty line
    lines.push(`${YELLOW}${BOX.vertical}${RESET}${pad(innerWidth)}${YELLOW}${BOX.vertical}${RESET}`);

    // Bottom border
    lines.push(`${YELLOW}${BOX.bottomLeft}${repeat(BOX.horizontal, innerWidth)}${BOX.bottomRight}${RESET}`);

    for (let i = 0; i < lines.length; i++) {
      output.push(CURSOR_TO(startRow + i, startCol) + lines[i]);
    }

    process.stdout.write(output.join(''));
  };

  const cleanup = () => {
    try {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeAllListeners("data");
      process.stdout.write(CLEAR_SCREEN + CURSOR_HOME + CURSOR_SHOW);
    } catch {
      // Ignore
    }
  };

  render();

  process.stdin.on("data", (key: string) => {
    if (key === "\r" || key === "\n") {
      cleanup();
      console.log(JSON.stringify({ mode: selected }));
      process.exit(0);
    } else if (key === "\x1b[A" || key === "k" || key === "1") {
      selected = 'direct';
      render();
    } else if (key === "\x1b[B" || key === "j" || key === "2") {
      selected = 'sandbox';
      render();
    } else if (key === "\x03" || key === "q") {
      cleanup();
      console.log(JSON.stringify({ mode: null, cancelled: true }));
      process.exit(0);
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
