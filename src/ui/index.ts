import { VERSION } from "../utils/version.js";
import { getToolNames } from "../tools/definitions.js";

// Use named ANSI palette codes rather than 24-bit RGB so the terminal's
// own theme adjusts each color for the user's background. Pure RGB colors
// like #ffffff (white) are invisible on light terminals; named ANSI white
// is rendered as black-or-similar by light themes.
const BRAND_COLOR = "\x1b[36m";   // cyan
const PINK_COLOR = "\x1b[35m";    // magenta
const YELLOW_COLOR = "\x1b[33m";  // yellow (rendered as orange-ish on light themes)
const WHITE_COLOR = "\x1b[39m";   // default foreground (theme-appropriate)
const GREEN_COLOR = "\x1b[32m";   // green
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

  // Generate tool lines - first line has "Tools:" label, rest are indented
  const toolNames = getToolNames();
  const toolLines = toolNames.map((tool, index) => {
    const prefix = index === 0 ? "  Tools: " : "         ";
    const bullet = "• ";
    return `${YELLOW_COLOR}│${WHITE_COLOR}${prefix}${bullet}${padRight(tool, boxWidth - prefix.length - 3)}${YELLOW_COLOR}│`;
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
${sandboxLine}${YELLOW_COLOR}├${horizontalLine}┤
${toolLines.join("\n")}
${YELLOW_COLOR}├${horizontalLine}┤
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

