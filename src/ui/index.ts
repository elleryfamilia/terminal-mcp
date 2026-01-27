import { VERSION } from "../utils/version.js";

// Custom color #31cae1 as 24-bit ANSI escape (RGB: 49, 202, 225)
const BRAND_COLOR = "\x1b[38;2;49;202;225m";
// Pink accent color for MCP (RGB: 255, 105, 180 - hot pink)
const PINK_COLOR = "\x1b[38;2;255;105;180m";
// Bright yellow for borders (RGB: 255, 255, 0)
const YELLOW_COLOR = "\x1b[38;2;255;255;0m";
// White for text content
const WHITE_COLOR = "\x1b[38;2;255;255;255m";
// Green for sandbox indicator (RGB: 50, 205, 50 - lime green)
const GREEN_COLOR = "\x1b[38;2;50;205;50m";
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
  sandboxEnabled?: boolean;
}

/**
 * Generate the startup banner string
 */
export function getBanner(options: BannerOptions): string {
  // Build the logo with box around it
  const logoLines = LOGO.split("\n");

  // Find the widest logo line to determine box width
  const maxLogoWidth = Math.max(...logoLines.map((l) => l.length));
  const boxWidth = maxLogoWidth + 4; // 2 chars padding on each side

  const horizontalLine = "─".repeat(boxWidth);

  // Center the logo as a block (same left padding for all lines)
  // First 6 lines are TERMINAL (blue), last 6 lines are MCP (pink)
  const centeredLogo = logoLines.map((line, index) => {
    const rightPad = boxWidth - 2 - line.length;
    const color = index < 6 ? BRAND_COLOR : PINK_COLOR;
    return YELLOW_COLOR + "│ " + color + line + " ".repeat(rightPad) + " " + YELLOW_COLOR + "│";
  });

  const mcpConfig = `{
  "mcpServers": {
    "terminal": {
      "command": "terminal-mcp"
    }
  }
}`;

  // Build sandbox status line if enabled
  const sandboxLine = options.sandboxEnabled
    ? `${YELLOW_COLOR}│${WHITE_COLOR}  Sandbox: ${GREEN_COLOR}ENABLED${WHITE_COLOR} (restricted filesystem/network)${" ".repeat(boxWidth - 47)}${YELLOW_COLOR}│\n`
    : "";

  return `
${YELLOW_COLOR}╭${horizontalLine}╮
${centeredLogo.join("\n")}
${YELLOW_COLOR}├${horizontalLine}┤
${YELLOW_COLOR}│${WHITE_COLOR}  Socket: ${padRight(options.socketPath, boxWidth - 11)}${YELLOW_COLOR}│
${YELLOW_COLOR}│${WHITE_COLOR}  Terminal: ${padRight(`${options.cols}x${options.rows}`, 12)}Shell: ${padRight(options.shell, boxWidth - 30)}${YELLOW_COLOR}│
${sandboxLine}${YELLOW_COLOR}│${WHITE_COLOR}  Tools: type, sendKey, getContent, takeScreenshot, clear${" ".repeat(boxWidth - 58)}${YELLOW_COLOR}│
${YELLOW_COLOR}│${WHITE_COLOR}${" ".repeat(boxWidth - 7)}v${VERSION} ${YELLOW_COLOR}│
${YELLOW_COLOR}╰${horizontalLine}╯${RESET}

${WHITE_COLOR}MCP Configuration (add to your MCP client):${RESET}

${mcpConfig}

${YELLOW_COLOR}╭${horizontalLine}╮
│${WHITE_COLOR}  Restart your MCP client to connect.${" ".repeat(boxWidth - 38)}${YELLOW_COLOR}│
╰${horizontalLine}╯${RESET}
`;
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

