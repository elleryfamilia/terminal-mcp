#!/usr/bin/env node

import * as fs from "fs";
import { startServer } from "./server.js";
import { startMcpClientMode } from "./client.js";
import { TerminalManager } from "./terminal/index.js";
import { createToolProxyServer } from "./transport/index.js";
import { getBanner } from "./ui/index.js";
import { getDefaultSocketPath, getDefaultShell } from "./utils/platform.js";
import {
  SandboxController,
  loadConfigFromFile,
  promptForPermissions,
  DEFAULT_PERMISSIONS,
  type SandboxPermissions,
} from "./sandbox/index.js";

// Default socket path
const DEFAULT_SOCKET_PATH = getDefaultSocketPath();

// Parse command line arguments
const args = process.argv.slice(2);
const options: {
  cols?: number;
  rows?: number;
  shell?: string;
  socket?: string;
  sandbox?: boolean;
  sandboxConfig?: string;
} = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const next = args[i + 1];

  switch (arg) {
    case "--cols":
      if (next) {
        options.cols = parseInt(next, 10);
        i++;
      }
      break;
    case "--rows":
      if (next) {
        options.rows = parseInt(next, 10);
        i++;
      }
      break;
    case "--shell":
      if (next) {
        options.shell = next;
        i++;
      }
      break;
    case "--socket":
      if (next) {
        options.socket = next;
        i++;
      }
      break;
    case "--sandbox":
      options.sandbox = true;
      break;
    case "--sandbox-config":
      if (next) {
        options.sandboxConfig = next;
        options.sandbox = true; // Implicitly enable sandbox
        i++;
      }
      break;
    case "--help":
    case "-h":
      console.log(`
terminal-mcp - A headless terminal emulator exposed via MCP

Usage: terminal-mcp [options]

Options:
  --cols <number>        Terminal width in columns (default: auto or 120)
  --rows <number>        Terminal height in rows (default: auto or 40)
  --shell <path>         Shell to use (default: $SHELL or bash)
  --socket <path>        Unix socket path for MCP (default: ${DEFAULT_SOCKET_PATH})
  --sandbox              Enable sandbox mode (restricts filesystem/network access)
  --sandbox-config <path> Load sandbox config from JSON file
  --help, -h             Show this help message

Mode Detection:
  - If stdin is a TTY: Interactive mode (gives you a shell, exposes socket)
  - If stdin is not a TTY: MCP client mode (connects to socket, serves MCP)

Interactive Mode (run in your terminal):
  terminal-mcp              # Normal mode
  terminal-mcp --sandbox    # With sandbox (interactive permission prompt)

  This gives you an interactive shell. AI can observe/interact via MCP.

Sandbox Mode:
  When --sandbox is enabled, the terminal runs with restricted access:
  - Filesystem: Configurable read/write, read-only, and blocked paths
  - Network: Allow all, block all, or custom domain allowlist

  Without --sandbox-config, an interactive prompt lets you configure permissions.

  Example config file (~/.terminal-mcp-sandbox.json):
  {
    "filesystem": {
      "readWrite": [".", "/tmp"],
      "readOnly": ["~"],
      "blocked": ["~/.ssh", "~/.aws"]
    },
    "network": {
      "mode": "all"
    }
  }

MCP Client Mode (add to your MCP client config):
  {
    "mcpServers": {
      "terminal": {
        "command": "terminal-mcp"
      }
    }
  }
`);
      process.exit(0);
  }
}

async function main() {
  const socketPath = options.socket || DEFAULT_SOCKET_PATH;
  const isInteractive = process.stdin.isTTY;

  if (isInteractive) {
    // Interactive mode: Shell on stdin/stdout, tool proxy on Unix socket
    await startInteractiveMode(socketPath);
  } else {
    // MCP client mode: Connect to socket, serve MCP over stdio
    await startMcpClientMode(socketPath);
  }
}

async function startInteractiveMode(socketPath: string): Promise<void> {
  // Get terminal size from environment or use defaults
  const cols = options.cols ?? (process.stdout.columns || 120);
  const rows = options.rows ?? (process.stdout.rows || 40);
  const shell = options.shell || getDefaultShell();

  // Initialize sandbox if enabled
  let sandboxController: SandboxController | undefined;
  let sandboxEnabled = false;

  if (options.sandbox) {
    sandboxController = new SandboxController();

    // Determine permissions
    let permissions: SandboxPermissions;
    if (options.sandboxConfig) {
      try {
        permissions = loadConfigFromFile(options.sandboxConfig);
        console.log(`[terminal-mcp] Loaded sandbox config from ${options.sandboxConfig}`);
      } catch (error) {
        console.error(`[terminal-mcp] Failed to load sandbox config: ${error}`);
        process.exit(1);
      }
    } else {
      // Interactive permission prompt
      permissions = await promptForPermissions();
    }

    // Initialize sandbox
    const status = await sandboxController.initialize(permissions);
    sandboxEnabled = status.enabled;

    if (status.enabled) {
      console.log(`[terminal-mcp] Sandbox enabled (${status.platform})`);
    } else {
      console.warn(`[terminal-mcp] Sandbox unavailable: ${status.reason}`);
      console.warn("[terminal-mcp] Continuing without sandbox...");
      sandboxController = undefined;
    }
  }

  // Generate startup banner
  const startupBanner = getBanner({
    socketPath,
    cols,
    rows,
    shell,
    sandboxEnabled,
  });

  // Create terminal manager (prompt customization handled in session.ts)
  const manager = new TerminalManager({
    cols,
    rows,
    shell: options.shell,
    startupBanner,
    sandboxController,
  });

  // Get the session and set up interactive I/O
  const session = await manager.initSession();

  // Track if we've shown the banner (for Windows, show after shell init)
  let bannerShown = false;
  const isWindows = process.platform === "win32";

  // Pipe PTY output to stdout
  session.onData((data) => {
    process.stdout.write(data);

    // On Windows, show banner after first prompt appears
    if (isWindows && !bannerShown && data.includes("⚡")) {
      bannerShown = true;
      process.stdout.write("\n" + startupBanner + "\n");
      // Send Enter to get a fresh prompt
      session.write("\r");
    }
  });

  // On non-Windows, banner is shown via shell rc file
  if (!isWindows) {
    bannerShown = true;
  }

  // Handle PTY exit
  session.onExit((code) => {
    console.log(`\n[terminal-mcp] Shell exited with code ${code}`);
    cleanup();
    process.exit(code);
  });

  // Set up raw mode for stdin if it's a TTY
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  // Pipe stdin directly to PTY
  process.stdin.on("data", (data) => {
    session.write(data.toString());
  });

  // Handle terminal resize
  process.stdout.on("resize", () => {
    const newCols = process.stdout.columns || cols;
    const newRows = process.stdout.rows || rows;
    session.resize(newCols, newRows);
  });

  // Start tool proxy socket server
  const socketServer = createToolProxyServer(socketPath, manager);

  // Cleanup function (sync version for exit handler)
  function cleanup() {
    manager.dispose();
    socketServer.close();
    try {
      fs.unlinkSync(socketPath);
    } catch {
      // Ignore
    }
  }

  // Async cleanup that also cleans up sandbox resources
  async function cleanupAsync() {
    await manager.disposeAsync();
    socketServer.close();
    try {
      fs.unlinkSync(socketPath);
    } catch {
      // Ignore
    }
  }

  // Handle signals
  process.on("SIGINT", () => {
    // Pass Ctrl+C to the shell instead of exiting
    session.write("\x03");
  });

  process.on("SIGTERM", () => {
    cleanupAsync().then(() => process.exit(0));
  });

  process.on("exit", () => {
    cleanup();
  });
}

main().catch((error) => {
  console.error("Failed to start:", error);
  process.exit(1);
});
