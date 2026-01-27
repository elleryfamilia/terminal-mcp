import { SandboxPermissions } from "./config.js";

// ANSI escape codes
const ESC = "\x1b";
const CURSOR_HIDE = `${ESC}[?25l`;
const CURSOR_SHOW = `${ESC}[?25h`;
const CLEAR_TO_END = `${ESC}[J`;
const SAVE_CURSOR = `${ESC}7`;
const RESTORE_CURSOR = `${ESC}8`;

// Colors
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;
const RESET = `${ESC}[0m`;
const CYAN = `${ESC}[36m`;
const GREEN = `${ESC}[32m`;
const RED = `${ESC}[31m`;
const YELLOW = `${ESC}[38;2;255;255;0m`;
const BG_BLUE = `${ESC}[44m`;
const WHITE = `${ESC}[97m`;
const MAGENTA = `${ESC}[35m`;

// Box drawing characters
const BOX = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
};

type AccessLevel = "read-write" | "read-only" | "blocked";
type NetworkLevel = "allowed" | "blocked";

interface PathItem {
  type: "path";
  label: string;
  paths: string[];
  access: AccessLevel;
  custom?: boolean;
}

interface NetworkItem {
  type: "network";
  label: string;
  access: NetworkLevel;
}

interface HeaderItem {
  type: "header";
  label: string;
}

interface AddItem {
  type: "add";
  label: string;
}

type Item = PathItem | NetworkItem | HeaderItem | AddItem;

function isSelectable(item: Item): item is PathItem | NetworkItem | AddItem {
  return item.type === "path" || item.type === "network" || item.type === "add";
}

/**
 * Interactive permission selection prompt
 */
export async function promptForPermissions(): Promise<SandboxPermissions> {
  // If not a TTY, return defaults
  if (!process.stdin.isTTY) {
    console.log("[terminal-mcp] Non-interactive mode, using default sandbox permissions");
    return getDefaultFromItems(createDefaultItems());
  }

  const items: Item[] = createDefaultItems();

  let selectedPos = 0;
  let scrollOffset = 0;
  const maxVisible = 18;
  const boxWidth = 58;

  // Input mode state
  let inputMode = false;
  let inputBuffer = "";
  let inputAccessLevel: AccessLevel = "blocked";

  const getSelectableIndices = () =>
    items.map((item, i) => (isSelectable(item) ? i : -1)).filter((i) => i >= 0);

  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdout.write(SAVE_CURSOR + CURSOR_HIDE);

    const getSelectedIndex = () => {
      const indices = getSelectableIndices();
      return indices[Math.min(selectedPos, indices.length - 1)];
    };

    const cycleAccess = (item: PathItem | NetworkItem, direction: 1 | -1) => {
      if (item.type === "path") {
        const levels: AccessLevel[] = ["read-write", "read-only", "blocked"];
        const current = levels.indexOf(item.access);
        const next = (current + direction + levels.length) % levels.length;
        item.access = levels[next];
      } else {
        item.access = item.access === "allowed" ? "blocked" : "allowed";
      }
    };

    const formatAccess = (item: PathItem | NetworkItem): string => {
      if (item.type === "path") {
        switch (item.access) {
          case "read-write":
            return `${GREEN}Read/Write${RESET}`;
          case "read-only":
            return `${CYAN}Read-Only ${RESET}`;
          case "blocked":
            return `${RED}Blocked   ${RESET}`;
        }
      } else {
        return item.access === "allowed"
          ? `${GREEN}Allowed${RESET}`
          : `${RED}Blocked${RESET}`;
      }
    };

    const formatInputAccess = (access: AccessLevel): string => {
      switch (access) {
        case "read-write":
          return `${GREEN}Read/Write${RESET}`;
        case "read-only":
          return `${CYAN}Read-Only${RESET}`;
        case "blocked":
          return `${RED}Blocked${RESET}`;
      }
    };

    const render = () => {
      process.stdout.write(RESTORE_CURSOR + SAVE_CURSOR + CLEAR_TO_END);

      const lines: string[] = [];
      lines.push("");

      if (inputMode) {
        // Input mode UI
        lines.push(`${BOLD}Add Custom Path${RESET}`);
        lines.push("");
        lines.push(`${DIM}Enter path (e.g., ~/myproject, /var/data):${RESET}`);
        lines.push("");
        lines.push(`  ${WHITE}▸ ${inputBuffer}${BOLD}_${RESET}`);
        lines.push("");
        lines.push(`  Access: [${formatInputAccess(inputAccessLevel)}] ${DIM}(←→ to change)${RESET}`);
        lines.push("");
        lines.push(`${DIM}ENTER to add  |  ESC to cancel${RESET}`);
        lines.push("");
      } else {
        // Normal mode UI
        lines.push(`${DIM} ↑↓ move  ←→ cycle  ENTER confirm  q quit${RESET}`);
        lines.push("");

        const selectedIndex = getSelectedIndex();

        // Adjust scroll
        let selectedLinePos = 0;
        for (let i = 0; i < selectedIndex; i++) {
          selectedLinePos++;
        }

        if (selectedLinePos < scrollOffset) {
          scrollOffset = Math.max(0, selectedLinePos - 1);
        } else if (selectedLinePos >= scrollOffset + maxVisible) {
          scrollOffset = selectedLinePos - maxVisible + 2;
        }

        if (scrollOffset > 0) {
          lines.push(`${DIM}    ↑ scroll up for more${RESET}`);
        }

        let lineCount = 0;
        for (let i = 0; i < items.length; i++) {
          if (lineCount < scrollOffset) {
            lineCount++;
            continue;
          }
          if (lineCount >= scrollOffset + maxVisible) {
            break;
          }
          lineCount++;

          const item = items[i];
          const isSelected = i === selectedIndex;

          if (item.type === "header") {
            lines.push(`${CYAN} ${item.label}${RESET}`);
          } else if (item.type === "add") {
            if (isSelected) {
              lines.push(` ${BG_BLUE}${WHITE}▸${RESET} ${MAGENTA}${BOLD}+ ${item.label}${RESET}`);
            } else {
              lines.push(`   ${MAGENTA}+ ${item.label}${RESET}`);
            }
          } else {
            const accessStr = formatAccess(item);
            const isCustom = item.type === "path" && item.custom;
            const labelBase = isCustom ? `${item.label} ${DIM}*${RESET}` : item.label;
            const label = item.label.padEnd(28);

            if (isSelected) {
              lines.push(` ${BG_BLUE}${WHITE}▸${RESET} ${BOLD}${label}${RESET} [${accessStr}]${isCustom ? ` ${DIM}*${RESET}` : ""}`);
            } else {
              lines.push(`   ${label} [${accessStr}]${isCustom ? ` ${DIM}*${RESET}` : ""}`);
            }
          }
        }

        if (scrollOffset + maxVisible < items.length) {
          lines.push(`${DIM}    ↓ scroll down for more${RESET}`);
        }

        lines.push("");
      }

      const output = drawBox(lines, inputMode ? "Add Custom Path" : "Sandbox Permissions", boxWidth);
      process.stdout.write("\n" + output + "\n");
    };

    const drawBox = (lines: string[], title: string, width: number): string => {
      const output: string[] = [];

      const titleText = ` ${title} `;
      const leftPad = Math.floor((width - 2 - titleText.length) / 2);
      const rightPad = width - 2 - leftPad - titleText.length;
      output.push(
        `${YELLOW}${BOX.topLeft}${BOX.horizontal.repeat(leftPad)}${WHITE}${BOLD}${titleText}${RESET}${YELLOW}${BOX.horizontal.repeat(rightPad)}${BOX.topRight}${RESET}`
      );

      for (const line of lines) {
        const plainText = line.replace(/\x1b\[[0-9;]*m/g, "");
        const padding = width - 2 - plainText.length;
        output.push(
          `${YELLOW}${BOX.vertical}${RESET}${line}${" ".repeat(Math.max(0, padding))}${YELLOW}${BOX.vertical}${RESET}`
        );
      }

      output.push(
        `${YELLOW}${BOX.bottomLeft}${BOX.horizontal.repeat(width - 2)}${BOX.bottomRight}${RESET}`
      );

      return output.join("\n");
    };

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeAllListeners("data");
      process.stdout.write(RESTORE_CURSOR + CLEAR_TO_END + CURSOR_SHOW);
    };

    const addCustomPath = () => {
      if (inputBuffer.trim()) {
        const path = inputBuffer.trim();
        // Find the "Add custom path" item and insert before it
        const addIndex = items.findIndex((i) => i.type === "add");

        // Check if custom header exists, if not add it
        const customHeaderIndex = items.findIndex(
          (i) => i.type === "header" && i.label === "Custom Paths:"
        );

        if (customHeaderIndex === -1) {
          // Insert custom header and path before "Add custom path"
          items.splice(addIndex, 0, { type: "header", label: "Custom Paths:" });
          items.splice(addIndex + 1, 0, {
            type: "path",
            label: path,
            paths: [path],
            access: inputAccessLevel,
            custom: true,
          });
        } else {
          // Insert before "Add custom path"
          items.splice(addIndex, 0, {
            type: "path",
            label: path,
            paths: [path],
            access: inputAccessLevel,
            custom: true,
          });
        }
      }

      inputMode = false;
      inputBuffer = "";
      inputAccessLevel = "blocked";
    };

    const handleKey = (key: string) => {
      if (inputMode) {
        // Input mode key handling
        if (key === "\x1b" || key === "\x03") {
          // ESC or Ctrl+C - cancel input
          inputMode = false;
          inputBuffer = "";
          inputAccessLevel = "blocked";
        } else if (key === "\r" || key === "\n") {
          // Enter - add the path
          addCustomPath();
        } else if (key === "\x7f" || key === "\b") {
          // Backspace
          inputBuffer = inputBuffer.slice(0, -1);
        } else if (key === "\x1b[C") {
          // Right arrow - cycle access forward
          const levels: AccessLevel[] = ["read-write", "read-only", "blocked"];
          const current = levels.indexOf(inputAccessLevel);
          inputAccessLevel = levels[(current + 1) % levels.length];
        } else if (key === "\x1b[D") {
          // Left arrow - cycle access backward
          const levels: AccessLevel[] = ["read-write", "read-only", "blocked"];
          const current = levels.indexOf(inputAccessLevel);
          inputAccessLevel = levels[(current - 1 + levels.length) % levels.length];
        } else if (key.length === 1 && key >= " " && key <= "~") {
          // Printable character
          inputBuffer += key;
        } else {
          return;
        }
        render();
        return;
      }

      // Normal mode key handling
      const selectableIndices = getSelectableIndices();
      const selectedIndex = getSelectedIndex();
      const item = items[selectedIndex];

      if (key === "\x1b[A" || key === "k") {
        // Up
        selectedPos = Math.max(0, selectedPos - 1);
      } else if (key === "\x1b[B" || key === "j") {
        // Down
        selectedPos = Math.min(selectableIndices.length - 1, selectedPos + 1);
      } else if (key === " " || key === "\x1b[C" || key === "l") {
        // Space or Right - cycle forward or activate add
        if (item.type === "add") {
          inputMode = true;
          inputBuffer = "";
          inputAccessLevel = "blocked";
        } else if (item.type === "path" || item.type === "network") {
          cycleAccess(item, 1);
        }
      } else if (key === "\x1b[D" || key === "h") {
        // Left - cycle backward
        if (item.type === "path" || item.type === "network") {
          cycleAccess(item, -1);
        }
      } else if (key === "\r" || key === "\n") {
        // Enter - confirm or activate add
        if (item.type === "add") {
          inputMode = true;
          inputBuffer = "";
          inputAccessLevel = "blocked";
        } else {
          cleanup();
          const permissions = getDefaultFromItems(items);
          console.log(`${GREEN}Sandbox configured.${RESET}\n`);
          resolve(permissions);
          return;
        }
      } else if (key === "q" || key === "\x03") {
        // q or Ctrl+C - quit
        cleanup();
        console.log(`${YELLOW}Cancelled. Using defaults.${RESET}\n`);
        resolve(getDefaultFromItems(createDefaultItems()));
        return;
      } else if (key === "d" || key === "\x1b[3~") {
        // d or Delete - remove custom item
        if (item.type === "path" && item.custom) {
          const idx = items.indexOf(item);
          items.splice(idx, 1);

          // Remove "Custom Paths:" header if no more custom items
          const hasCustomItems = items.some((i) => i.type === "path" && i.custom);
          if (!hasCustomItems) {
            const headerIdx = items.findIndex(
              (i) => i.type === "header" && i.label === "Custom Paths:"
            );
            if (headerIdx !== -1) {
              items.splice(headerIdx, 1);
            }
          }

          // Adjust selected position
          const newSelectableIndices = getSelectableIndices();
          selectedPos = Math.min(selectedPos, newSelectableIndices.length - 1);
        }
      } else {
        return;
      }

      render();
    };

    render();
    process.stdin.on("data", handleKey);
  });
}

function createDefaultItems(): Item[] {
  return [
    { type: "header", label: "Core Paths:" },
    { type: "path", label: "Current directory", paths: ["."], access: "read-write" },
    { type: "path", label: "/tmp", paths: ["/tmp"], access: "read-write" },

    { type: "header", label: "Shell & Caches:" },
    { type: "path", label: "~/.cache, ~/.local", paths: ["~/.cache", "~/.local"], access: "read-write" },
    { type: "path", label: "Shell history files", paths: ["~/.zsh_history", "~/.bash_history", "~/.node_repl_history", "~/.python_history"], access: "read-write" },

    { type: "header", label: "Package Managers:" },
    { type: "path", label: "~/.npm, ~/.yarn, ~/.pnpm", paths: ["~/.npm", "~/.yarn", "~/.pnpm", "~/.bun"], access: "read-write" },
    { type: "path", label: "~/.cargo, ~/.rustup", paths: ["~/.cargo", "~/.rustup"], access: "blocked" },
    { type: "path", label: "~/.nvm, ~/.pyenv, ~/.rbenv", paths: ["~/.nvm", "~/.pyenv", "~/.rbenv"], access: "blocked" },

    { type: "header", label: "Home Directory:" },
    { type: "path", label: "~ (general access)", paths: ["~"], access: "read-only" },

    { type: "header", label: "Credentials (sensitive):" },
    { type: "path", label: "~/.ssh", paths: ["~/.ssh"], access: "blocked" },
    { type: "path", label: "~/.gnupg", paths: ["~/.gnupg"], access: "blocked" },
    { type: "path", label: "~/.aws", paths: ["~/.aws"], access: "blocked" },
    { type: "path", label: "~/.config/gcloud, ~/.azure", paths: ["~/.config/gcloud", "~/.azure", "~/.kube"], access: "blocked" },
    { type: "path", label: "~/.config/gh", paths: ["~/.config/gh"], access: "blocked" },
    { type: "path", label: "~/.npmrc, ~/.netrc", paths: ["~/.npmrc", "~/.netrc", "~/.docker/config.json"], access: "blocked" },

    { type: "header", label: "Network:" },
    { type: "network", label: "Network access", access: "allowed" },

    { type: "add", label: "Add custom path..." },
  ];
}

function getDefaultFromItems(items: Item[]): SandboxPermissions {
  const permissions: SandboxPermissions = {
    filesystem: {
      readWrite: [],
      readOnly: [],
      blocked: [],
    },
    network: {
      mode: "all",
    },
  };

  for (const item of items) {
    if (item.type === "path") {
      switch (item.access) {
        case "read-write":
          permissions.filesystem.readWrite.push(...item.paths);
          break;
        case "read-only":
          permissions.filesystem.readOnly.push(...item.paths);
          break;
        case "blocked":
          permissions.filesystem.blocked.push(...item.paths);
          break;
      }
    } else if (item.type === "network") {
      permissions.network.mode = item.access === "allowed" ? "all" : "none";
    }
  }

  return permissions;
}

/**
 * Display a summary of the sandbox permissions
 */
export function displayPermissionsSummary(permissions: SandboxPermissions): void {
  console.log(`${CYAN}Sandbox Permissions:${RESET}`);

  if (permissions.filesystem.readWrite.length > 0) {
    console.log(`  ${GREEN}Read/Write:${RESET} ${permissions.filesystem.readWrite.join(", ")}`);
  }

  if (permissions.filesystem.readOnly.length > 0) {
    console.log(`  ${CYAN}Read-Only:${RESET} ${permissions.filesystem.readOnly.join(", ")}`);
  }

  if (permissions.filesystem.blocked.length > 0) {
    console.log(`  ${RED}Blocked:${RESET} ${permissions.filesystem.blocked.join(", ")}`);
  }

  console.log(`  ${CYAN}Network:${RESET} ${permissions.network.mode}`);
  if (permissions.network.mode === "allowlist" && permissions.network.allowedDomains) {
    console.log(`    Allowed: ${permissions.network.allowedDomains.join(", ")}`);
  }
}
