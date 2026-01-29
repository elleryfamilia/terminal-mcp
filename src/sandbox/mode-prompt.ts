/**
 * Mode selection prompt using raw ANSI codes
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

/**
 * Prompt user to select terminal mode
 */
export async function promptForMode(): Promise<Mode> {
  // Check if we can use raw mode
  if (typeof process.stdin.setRawMode !== 'function') {
    return 'direct';
  }

  let selected: Mode = 'direct';
  const boxWidth = 36;
  const boxHeight = 8;

  return new Promise((resolve, reject) => {
    try {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");
    } catch (err) {
      // Can't set raw mode, return default
      resolve('direct');
      return;
    }

    // Get terminal size
    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;

    // Calculate center position
    const startCol = Math.max(1, Math.floor((cols - boxWidth) / 2));
    const startRow = Math.max(1, Math.floor((rows - boxHeight) / 2));

    const render = () => {
      const output: string[] = [];

      // Clear screen and hide cursor
      output.push(CLEAR_SCREEN + CURSOR_HOME + CURSOR_HIDE);

      // Build the box content
      const lines: string[] = [];

      // Title bar
      const title = " Terminal Mode ";
      const titlePadLeft = Math.floor((boxWidth - 2 - title.length) / 2);
      const titlePadRight = boxWidth - 2 - titlePadLeft - title.length;
      lines.push(
        `${YELLOW}${BOX.topLeft}${BOX.horizontal.repeat(titlePadLeft)}${WHITE}${BOLD}${title}${RESET}${YELLOW}${BOX.horizontal.repeat(titlePadRight)}${BOX.topRight}${RESET}`
      );

      // Empty line
      lines.push(`${YELLOW}${BOX.vertical}${RESET}${" ".repeat(boxWidth - 2)}${YELLOW}${BOX.vertical}${RESET}`);

      // Standard option
      const stdSelected = selected === 'direct';
      const stdBullet = stdSelected ? `${GREEN}●${RESET}` : `${GRAY}○${RESET}`;
      const stdLabel = stdSelected ? `${WHITE}${BOLD}Standard${RESET}` : `${GRAY}Standard${RESET}`;
      lines.push(`${YELLOW}${BOX.vertical}${RESET}  ${stdBullet} ${stdLabel}${" ".repeat(boxWidth - 14)}${YELLOW}${BOX.vertical}${RESET}`);

      // Standard description
      lines.push(`${YELLOW}${BOX.vertical}${RESET}      ${DIM}full access to resources${RESET}${" ".repeat(boxWidth - 30)}${YELLOW}${BOX.vertical}${RESET}`);

      // Empty line
      lines.push(`${YELLOW}${BOX.vertical}${RESET}${" ".repeat(boxWidth - 2)}${YELLOW}${BOX.vertical}${RESET}`);

      // Sandboxed option
      const sbxSelected = selected === 'sandbox';
      const sbxBullet = sbxSelected ? `${GREEN}●${RESET}` : `${GRAY}○${RESET}`;
      const sbxLabel = sbxSelected ? `${WHITE}${BOLD}Sandboxed${RESET}` : `${GRAY}Sandboxed${RESET}`;
      lines.push(`${YELLOW}${BOX.vertical}${RESET}  ${sbxBullet} ${sbxLabel}${" ".repeat(boxWidth - 15)}${YELLOW}${BOX.vertical}${RESET}`);

      // Sandboxed description
      lines.push(`${YELLOW}${BOX.vertical}${RESET}      ${DIM}restricted access with controls${RESET}${" ".repeat(boxWidth - 37)}${YELLOW}${BOX.vertical}${RESET}`);

      // Bottom border
      lines.push(`${YELLOW}${BOX.bottomLeft}${BOX.horizontal.repeat(boxWidth - 2)}${BOX.bottomRight}${RESET}`);

      // Draw each line at the correct position
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
        // Ignore cleanup errors
      }
    };

    const handleKey = (key: string) => {
      if (key === "\r" || key === "\n") {
        // Enter - confirm
        cleanup();
        resolve(selected);
      } else if (key === "\x1b[A" || key === "k" || key === "1") {
        // Up arrow or k or 1
        selected = 'direct';
        render();
      } else if (key === "\x1b[B" || key === "j" || key === "2") {
        // Down arrow or j or 2
        selected = 'sandbox';
        render();
      } else if (key === "\x03" || key === "q") {
        // Ctrl+C or q - cancel
        cleanup();
        reject(new Error("Cancelled by user"));
      }
    };

    render();
    process.stdin.on("data", handleKey);
  });
}
