#!/usr/bin/env node

import * as fs from "fs";
import { createRequire } from "module";
import updateNotifier from "update-notifier";
import { startServer } from "./server.js";
import { startMcpClientMode } from "./client.js";
import { TerminalManager } from "./terminal/index.js";
import { createToolProxyServer } from "./transport/index.js";
import { getBanner } from "./ui/index.js";
import { getDefaultSocketPath, getDefaultShell, getDefaultRecordDir } from "./utils/platform.js";
import {
  SandboxController,
  loadConfigFromFile,
  promptForPermissions,
  DEFAULT_PERMISSIONS,
  type SandboxPermissions,
} from "./sandbox/index.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");
const { version } = pkg;

// Default socket path
const DEFAULT_SOCKET_PATH = getDefaultSocketPath();

// Recording mode type
type RecordingMode = 'always' | 'on-failure' | 'off';

// Parse command line arguments
const args = process.argv.slice(2);
const options: {
  cols?: number;
  rows?: number;
  shell?: string;
  socket?: string;
  headless?: boolean;
  sandbox?: boolean;
  sandboxConfig?: string;
  record?: RecordingMode;
  recordDir?: string;
  recordFormat?: 'v2';
  idleTimeLimit?: number;
  maxDuration?: number;
  inactivityTimeout?: number;
  maxSessions?: number;
  sessionIdleTimeout?: number;
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
    case "--headless":
      options.headless = true;
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
    case "--record":
      // Support bare --record (defaults to 'always')
      if (!next || next.startsWith('-')) {
        options.record = 'always';
      } else if (['always', 'on-failure', 'off'].includes(next)) {
        options.record = next as RecordingMode;
        i++;
      } else {
        // Unknown value, treat as bare --record
        options.record = 'always';
      }
      break;
    case "--record-dir":
      if (next) {
        options.recordDir = next;
        i++;
      }
      break;
    case "--record-format":
      if (next) {
        options.recordFormat = next as 'v2';
        i++;
      }
      break;
    case "--idle-time-limit":
      if (next) {
        options.idleTimeLimit = parseFloat(next);
        i++;
      }
      break;
    case "--max-duration":
      if (next) {
        options.maxDuration = parseFloat(next);
        i++;
      }
      break;
    case "--inactivity-timeout":
      if (next) {
        options.inactivityTimeout = parseFloat(next);
        i++;
      }
      break;
    case "--max-sessions":
      if (next) {
        options.maxSessions = parseInt(next, 10);
        i++;
      }
      break;
    case "--session-idle-timeout":
      if (next) {
        options.sessionIdleTimeout = parseFloat(next);
        i++;
      }
      break;
    case "--version":
    case "-v":
      console.log(`terminal-mcp v${version}`);
      process.exit(0);
    case "--help":
    case "-h":
      console.log(`
terminal-mcp v${version} - A headless terminal emulator exposed via MCP

Usage: terminal-mcp [options]

Options:
  --cols <number>        Terminal width in columns (default: auto or 120)
  --rows <number>        Terminal height in rows (default: auto or 40)
  --shell <path>         Shell to use (default: $SHELL or bash)
  --socket <path>        Unix socket path for MCP (default: ${DEFAULT_SOCKET_PATH})
  --headless             Run in headless mode (MCP server with embedded terminal, no TTY needed)
  --sandbox              Enable sandbox mode (restricts filesystem/network access)
  --sandbox-config <path> Load sandbox config from JSON file
  --max-sessions <n>     Max concurrent terminal sessions (default: 5)
  --session-idle-timeout <sec> Idle non-default sessions auto-destroy after this (default: 600)
  --version, -v          Show version number
  --help, -h             Show this help message

Recording Options:
  --record [mode]     Enable recording (default mode: always)
                      Modes: always, on-failure, off
                      - always: Save all recordings
                      - on-failure: Only save recordings on non-zero exit
                      - off: Disable recording
  --record-dir <dir>  Recording output directory
                      Default: ~/.local/state/terminal-mcp/recordings
                      Override: TERMINAL_MCP_RECORD_DIR env var
  --record-format <f> Recording format: v2 (default: v2, asciicast v2 format)
  --idle-time-limit <sec>  Max idle time between events (default: 2s)
                      Caps idle time in recordings to prevent long pauses
  --max-duration <sec>     Max recording duration (default: 3600 = 60 min)
                      Recording auto-stops when this limit is reached
  --inactivity-timeout <sec>  Stop after no output (default: 600 = 10 min)
                      Resets on each terminal output event

Environment Variables:
  TERMINAL_MCP_RECORD_DIR  Default recording output directory

Mode Detection:
  - If --headless: Headless mode (embedded PTY + MCP server over stdio)
  - If stdin is a TTY: Interactive mode (gives you a shell, exposes socket)
  - If stdin is not a TTY: MCP client mode (connects to socket, serves MCP)

Interactive Mode (run in your terminal):
  terminal-mcp              # Normal mode
  terminal-mcp --sandbox    # With sandbox (interactive permission prompt)

  This gives you an interactive shell. AI can observe/interact via MCP.

  With recording:
  terminal-mcp --record
  terminal-mcp --record --record-dir=./project-recordings
  terminal-mcp --record=on-failure --idle-time-limit=5

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

Headless Mode (no TTY required, for CI/containers/MCP servers):
  terminal-mcp --headless
  terminal-mcp --headless --cols 120 --rows 40

  Spawns a PTY shell internally and serves MCP directly over stdio.
  No separate interactive session or socket needed.

  MCP client config for headless:
  {
    "mcpServers": {
      "terminal": {
        "command": "terminal-mcp",
        "args": ["--headless", "--cols", "120", "--rows", "40"]
      }
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

  // Prevent recursive invocation
  if (process.env.TERMINAL_MCP === '1') {
    console.error(
      'Error: terminal-mcp cannot be run from within itself.\n' +
      'You are already inside a terminal-mcp session.\n\n' +
      'To use MCP tools, configure your MCP client to connect to this session.'
    );
    process.exit(1);
  }

  if (options.headless) {
    // Headless mode: Spawn PTY internally, serve MCP directly over stdio
    // No TTY or socket needed
    await startServer({
      cols: options.cols,
      rows: options.rows,
      shell: options.shell,
      maxSessions: options.maxSessions,
      sessionIdleTimeout: options.sessionIdleTimeout,
    });
  } else if (isInteractive) {
    // Interactive mode: Shell on stdin/stdout, tool proxy on Unix socket
    await startInteractiveMode(socketPath);
  } else {
    // MCP client mode: Connect to socket, serve MCP over stdio
    await startMcpClientMode(socketPath);
  }
}

async function startInteractiveMode(socketPath: string): Promise<void> {
  // Throttled update check (once per day). Prints to stderr in the user's
  // terminal, never in headless / MCP-client mode where it would corrupt
  // JSON-RPC over stdio.
  try {
    updateNotifier({ pkg }).notify({ defer: false });
  } catch {
    // Never let an update check break startup.
  }

  // Get terminal size from environment or use defaults
  const cols = options.cols ?? (process.stdout.columns || 120);
  const rows = options.rows ?? (process.stdout.rows || 40);
  const shell = options.shell || getDefaultShell();

  // Initialize sandbox if enabled
  let sandboxController: SandboxController | undefined;
  let sandboxEnabled = false;

  if (options.sandbox) {
    sandboxController = new SandboxController();

    // Check platform support and dependencies BEFORE showing the modal
    if (!sandboxController.isSupported()) {
      const platform = sandboxController.getPlatform();
      if (platform === "win32") {
        console.error("[terminal-mcp] Error: Sandbox mode is not supported on Windows.");
      } else {
        console.error(`[terminal-mcp] Error: Sandbox mode is not supported on platform '${platform}'.`);
      }
      console.error("[terminal-mcp] Please run without the --sandbox flag.");
      process.exit(1);
    }

    // Check Linux-specific dependencies
    const depCheck = sandboxController.checkLinuxDependencies();
    if (!depCheck.supported) {
      console.error(`[terminal-mcp] Error: Sandbox dependencies not available.`);
      console.error(`[terminal-mcp] Missing: ${depCheck.message}`);
      console.error("");
      console.error("To install on Arch Linux:");
      console.error("  sudo pacman -S bubblewrap socat");
      console.error("");
      console.error("To install on Debian/Ubuntu:");
      console.error("  sudo apt install bubblewrap socat");
      console.error("");
      console.error("Or run without the --sandbox flag.");
      process.exit(1);
    }

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
      try {
        permissions = await promptForPermissions();
      } catch (error) {
        if (error instanceof Error && error.message === "cancelled") {
          console.log("[terminal-mcp] Cancelled.");
          process.exit(0);
        }
        throw error;
      }
    }

    // Initialize sandbox
    const status = await sandboxController.initialize(permissions);
    sandboxEnabled = status.enabled;

    if (status.enabled) {
      console.log(`[terminal-mcp] Sandbox enabled (${status.platform})`);
    } else {
      // If we get here, something unexpected failed during initialization
      console.error(`[terminal-mcp] Error: Failed to initialize sandbox: ${status.reason}`);
      console.error("[terminal-mcp] Please run without the --sandbox flag or fix the issue above.");
      process.exit(1);
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
    record: options.record,
    recordDir: options.recordDir,
    recordFormat: options.recordFormat,
    idleTimeLimit: options.idleTimeLimit,
    maxDuration: options.maxDuration,
    inactivityTimeout: options.inactivityTimeout,
    maxSessions: options.maxSessions,
    sessionIdleTimeout: options.sessionIdleTimeout,
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
  session.onExit(async (code) => {
    // Finalize recordings and get results
    const recordings = await manager.finalizeRecordings(code);

    console.log(`\n[terminal-mcp] Shell exited with code ${code}`);

    // Show recording info if any were saved
    const savedRecordings = recordings.filter(r => r.saved);
    if (savedRecordings.length > 0) {
      console.log('\nRecordings saved:');
      for (const rec of savedRecordings) {
        console.log(`  ${rec.path}`);
      }
      console.log('\nPlay with: asciinema play <file>');
      console.log('Install:   pip install asciinema  or  brew install asciinema');
    }

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
