import { Stats } from "../utils/stats.js";

const VERSION = "0.1.0";

// Custom color #31cae1 as 24-bit ANSI escape (RGB: 49, 202, 225)
const BRAND_COLOR = "\x1b[38;2;49;202;225m";
// Pink accent color for MCP (RGB: 255, 105, 180 - hot pink)
const PINK_COLOR = "\x1b[38;2;255;105;180m";
// Bright yellow for borders (RGB: 255, 255, 0)
const YELLOW_COLOR = "\x1b[38;2;255;255;0m";
// White for text content
const WHITE_COLOR = "\x1b[38;2;255;255;255m";
const RESET = "\x1b[0m";

// ANSI Shadow style figlet logo for "TERMINAL" + "MCP" stacked
const LOGO = `
████████╗███████╗██████╗ ███╗   ███╗██╗███╗   ██╗ █████╗ ██╗
╚══██╔══╝██╔════╝██╔══██╗████╗ ████║██║████╗  ██║██╔══██╗██║
   ██║   █████╗  ██████╔╝██╔████╔██║██║██╔██╗ ██║███████║██║
   ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║██║╚██╗██║██╔══██║██║
   ██║   ███████╗██║  ██║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║███████╗
   ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝
                    ███╗   ███╗ ██████╗██████╗
                    ████╗ ████║██╔════╝██╔══██╗
                    ██╔████╔██║██║     ██████╔╝
                    ██║╚██╔╝██║██║     ██╔═══╝
                    ██║ ╚═╝ ██║╚██████╗██║
                    ╚═╝     ╚═╝ ╚═════╝╚═╝
`.trim();

export interface BannerOptions {
  socketPath: string;
  cols: number;
  rows: number;
  shell: string;
  execPath: string; // Path to the executable
}

/**
 * Print the startup banner to stderr (so it doesn't interfere with shell output)
 */
export function printBanner(options: BannerOptions): void {
  // Build the logo with box around it
  const logoLines = LOGO.split("\n");

  // Find the widest logo line to determine box width
  const maxLogoWidth = Math.max(...logoLines.map((l) => l.length));
  const boxWidth = maxLogoWidth + 4; // 2 chars padding on each side

  const horizontalLine = "─".repeat(boxWidth);
  const emptyLine = YELLOW_COLOR + "│" + " ".repeat(boxWidth) + "│";

  // Center the logo as a block (same left padding for all lines)
  // First 6 lines are TERMINAL (blue), last 6 lines are MCP (pink)
  const centeredLogo = logoLines.map((line, index) => {
    const rightPad = boxWidth - 2 - line.length;
    const color = index < 6 ? BRAND_COLOR : PINK_COLOR;
    return YELLOW_COLOR + "│ " + color + line + " ".repeat(rightPad) + " " + YELLOW_COLOR + "│";
  });

  const banner = `
${YELLOW_COLOR}╭${horizontalLine}╮
${centeredLogo.join("\n")}
${YELLOW_COLOR}├${horizontalLine}┤
${YELLOW_COLOR}│${WHITE_COLOR}  Socket: ${padRight(options.socketPath, boxWidth - 11)}${YELLOW_COLOR}│
${YELLOW_COLOR}│${WHITE_COLOR}  Terminal: ${padRight(`${options.cols}x${options.rows}`, 12)}Shell: ${padRight(options.shell, boxWidth - 30)}${YELLOW_COLOR}│
${emptyLine}
${YELLOW_COLOR}│${WHITE_COLOR}  AI can now observe this terminal via MCP.${" ".repeat(boxWidth - 44)}${YELLOW_COLOR}│
${YELLOW_COLOR}│${WHITE_COLOR}  Type /info for configuration help.${" ".repeat(boxWidth - 37)}${YELLOW_COLOR}│
${YELLOW_COLOR}│${WHITE_COLOR}${" ".repeat(boxWidth - 7)}v${VERSION} ${YELLOW_COLOR}│
${YELLOW_COLOR}╰${horizontalLine}╯${RESET}
`;
  process.stderr.write(banner);
}

/**
 * Generate the /info output
 */
export function getInfoOutput(
  socketPath: string,
  cols: number,
  rows: number,
  shell: string,
  stats: Stats,
  execPath: string
): string {
  const summary = stats.getSummary();
  const toolCallsStr =
    Object.keys(summary.toolCalls).length > 0
      ? Object.entries(summary.toolCalls)
          .map(([tool, count]) => `    ${tool}: ${count}`)
          .join("\n")
      : "    (none yet)";

  return `
${YELLOW_COLOR}╭─────────────────────────────────────────────────────────────╮
│${WHITE_COLOR}  📡 TERMINAL-MCP INFO                                       ${YELLOW_COLOR}│
├─────────────────────────────────────────────────────────────┤${RESET}

${WHITE_COLOR}\x1b[1mSession Info:\x1b[0m${WHITE_COLOR}
  Socket: ${socketPath}
  Terminal: ${cols}x${rows}
  Shell: ${shell}
  Uptime: ${summary.uptime}
  Tool calls: ${summary.totalCalls}
${toolCallsStr}

\x1b[1mMCP Configuration:\x1b[0m${WHITE_COLOR}
  Add this to ~/.claude/mcp.json (or your project's .mcp.json):

  ${YELLOW_COLOR}{
    "mcpServers": {
      "terminal": {
        "command": "node",
        "args": ["${execPath}"]
      }
    }
  }${WHITE_COLOR}

  Then restart Claude Code to load the MCP server.

\x1b[1mAvailable Tools:\x1b[0m${WHITE_COLOR}
  • getContent     - Read terminal buffer (visibleOnly=true for current screen)
  • takeScreenshot - Get visible screen + cursor position
  • type           - Send text input
  • sendKey        - Send special keys (enter, ctrl+c, etc.)

${YELLOW_COLOR}╰─────────────────────────────────────────────────────────────╯${RESET}
`;
}

/**
 * Print the /info output
 */
export function printInfo(
  socketPath: string,
  cols: number,
  rows: number,
  shell: string,
  stats: Stats,
  execPath: string
): void {
  process.stdout.write(getInfoOutput(socketPath, cols, rows, shell, stats, execPath));
}

/**
 * Pad a string to the right with spaces
 */
function padRight(str: string, length: number): string {
  if (str.length >= length) {
    return str.substring(0, length - 1) + " ";
  }
  return str + " ".repeat(length - str.length);
}

/**
 * Check if input is the /info command
 */
export function isInfoCommand(input: string): boolean {
  return input.trim() === "/info";
}
