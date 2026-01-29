#!/usr/bin/env node

import * as fs from "fs";
import { createRequire } from "module";
import { startServer } from "./server.js";
import { startMcpClientMode } from "./client.js";
import { TerminalManager } from "./terminal/index.js";
import { createToolProxyServer, GUIOutputStream, isGuiMessageToBackend } from "./transport/index.js";
import type { GuiMessageToBackend, GuiMessageToFrontend } from "./transport/index.js";
import { getBanner } from "./ui/index.js";
import { getDefaultSocketPath, getDefaultShell, getDefaultRecordDir } from "./utils/platform.js";
import {
  SandboxController,
  loadConfigFromFile,
  promptForPermissions,
  DEFAULT_PERMISSIONS,
  type SandboxPermissions,
} from "./sandbox/index.js";
import { promptForMode } from "./sandbox/mode-prompt.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

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
  sandbox?: boolean;
  sandboxConfig?: string;
  record?: RecordingMode;
  recordDir?: string;
  recordFormat?: 'v2';
  idleTimeLimit?: number;
  maxDuration?: number;
  inactivityTimeout?: number;
  guiMode?: boolean;
  promptModeOnly?: boolean;
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
    case "--gui-mode":
      options.guiMode = true;
      break;
    case "--prompt-mode-only":
      options.promptModeOnly = true;
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
  --sandbox              Enable sandbox mode (restricts filesystem/network access)
  --sandbox-config <path> Load sandbox config from JSON file
  --gui-mode             Enable GUI mode (streams JSON protocol over stdio)
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

MCP Client Mode (add to your MCP client config):
  {
    "mcpServers": {
      "terminal": {
        "command": "terminal-mcp"
      }
    }
  }

GUI Mode (for Electron/desktop wrappers):
  terminal-mcp --gui-mode

  Streams JSON protocol over stdin/stdout for GUI applications.
  Messages are newline-delimited JSON. See gui-protocol.ts for types.
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

  // Prompt-only mode: Just show mode selector and output result
  // Used by GUI wrappers to get user's mode choice before creating terminal
  if (options.promptModeOnly) {
    try {
      const mode = await promptForMode();
      // Output result as JSON for parent process to read
      console.log(JSON.stringify({ mode }));
      process.exit(0);
    } catch (error) {
      if (error instanceof Error && error.message === 'Cancelled by user') {
        console.log(JSON.stringify({ mode: null, cancelled: true }));
        process.exit(0);
      }
      throw error;
    }
  }

  // GUI mode takes priority - used by Electron/desktop wrappers
  if (options.guiMode) {
    await startGuiMode();
  } else if (isInteractive) {
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

  // 1. Show mode selection prompt (unless --sandbox flag overrides)
  let mode: 'direct' | 'sandbox';
  if (options.sandbox) {
    mode = 'sandbox';
  } else {
    try {
      mode = await promptForMode();
    } catch (error) {
      if (error instanceof Error && error.message === 'Cancelled by user') {
        console.log("[terminal-mcp] Cancelled.");
        process.exit(0);
      }
      throw error;
    }
  }

  // Initialize sandbox if enabled
  let sandboxController: SandboxController | undefined;
  let sandboxEnabled = false;

  if (mode === 'sandbox') {
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

/**
 * GUI Mode: Streams JSON protocol over stdin/stdout for GUI applications.
 * Used by Electron/Tauri wrappers that embed terminal-mcp.
 *
 * Protocol:
 * - Input (stdin): Newline-delimited JSON messages (GuiMessageToBackend)
 * - Output (stdout): Newline-delimited JSON messages (GuiMessageToFrontend)
 * - Stderr: Error/debug logging
 */
async function startGuiMode(): Promise<void> {
  const cols = options.cols ?? 120;
  const rows = options.rows ?? 40;
  const shell = options.shell || getDefaultShell();

  // 1. Show mode selection prompt FIRST (outputs ANSI codes to stdout)
  let mode: 'direct' | 'sandbox';
  if (options.sandbox) {
    mode = 'sandbox';
  } else {
    try {
      mode = await promptForMode();
    } catch (error) {
      if (error instanceof Error && error.message === 'Cancelled by user') {
        console.log("[terminal-mcp] Cancelled.");
        process.exit(0);
      }
      throw error;
    }
  }

  // 2. If sandbox mode, get permissions and initialize
  let sandboxController: SandboxController | undefined;
  if (mode === 'sandbox') {
    sandboxController = new SandboxController();

    // Check platform support
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
      // Interactive permission prompt (will also render in xterm.js)
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
    if (status.enabled) {
      console.log(`[terminal-mcp] Sandbox enabled (${status.platform})`);
    } else {
      console.error(`[terminal-mcp] Error: Failed to initialize sandbox: ${status.reason}`);
      console.error("[terminal-mcp] Please run without the --sandbox flag or fix the issue above.");
      process.exit(1);
    }
  }

  // 3. NOW start GUI protocol
  // Create terminal manager
  const manager = new TerminalManager({
    cols,
    rows,
    shell: options.shell,
    sandboxController,
    record: options.record,
    recordDir: options.recordDir,
    recordFormat: options.recordFormat,
    idleTimeLimit: options.idleTimeLimit,
    maxDuration: options.maxDuration,
    inactivityTimeout: options.inactivityTimeout,
  });

  // Create GUI output stream
  const guiStream = new GUIOutputStream();
  guiStream.attachManager(manager);

  // Add a client for stdout communication
  const clientId = guiStream.addClient((message: GuiMessageToFrontend) => {
    // Write JSON message to stdout (newline-delimited)
    process.stdout.write(JSON.stringify(message) + "\n");
  });

  // Handle error events
  guiStream.on("error", (error) => {
    console.error("[gui-mode] Stream error:", error.message);
  });

  // Parse incoming JSON messages from stdin
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", async (chunk: string) => {
    buffer += chunk;

    // Process complete lines
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (line.length === 0) continue;

      try {
        const message = JSON.parse(line);
        if (isGuiMessageToBackend(message)) {
          await guiStream.handleMessage(clientId, message);
        } else {
          console.error("[gui-mode] Invalid message format:", line);
        }
      } catch (error) {
        console.error("[gui-mode] Failed to parse message:", line);
      }
    }
  });

  process.stdin.on("end", () => {
    console.error("[gui-mode] stdin closed, shutting down");
    cleanup();
    process.exit(0);
  });

  // Cleanup function
  function cleanup() {
    guiStream.dispose();
    manager.dispose();
  }

  // Handle signals
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });

  process.on("exit", () => {
    cleanup();
  });

  // Send ready message
  const readyMessage: GuiMessageToFrontend = {
    type: "session-list",
    sessions: [],
  };
  process.stdout.write(JSON.stringify(readyMessage) + "\n");

  console.error(`[gui-mode] Ready. Shell: ${shell}, Size: ${cols}x${rows}`);
}

main().catch((error) => {
  console.error("Failed to start:", error);
  process.exit(1);
});
