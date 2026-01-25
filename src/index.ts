#!/usr/bin/env node

import * as fs from "fs";
import { startServer } from "./server.js";
import { startMcpClientMode } from "./client.js";
import { TerminalManager } from "./terminal/index.js";
import { createToolProxyServer } from "./transport/index.js";
import { printBanner, printInfo, isInfoCommand } from "./ui/index.js";
import { getStats, resetStats } from "./utils/stats.js";
import { getDefaultSocketPath, getDefaultShell } from "./utils/platform.js";

// Default socket path
const DEFAULT_SOCKET_PATH = getDefaultSocketPath();

// Parse command line arguments
const args = process.argv.slice(2);
const options: {
  cols?: number;
  rows?: number;
  shell?: string;
  socket?: string;
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
    case "--help":
    case "-h":
      console.log(`
terminal-mcp - A headless terminal emulator exposed via MCP

Usage: terminal-mcp [options]

Options:
  --cols <number>     Terminal width in columns (default: auto or 120)
  --rows <number>     Terminal height in rows (default: auto or 40)
  --shell <path>      Shell to use (default: $SHELL or bash)
  --socket <path>     Unix socket path for MCP (default: ${DEFAULT_SOCKET_PATH})
  --help, -h          Show this help message

Mode Detection:
  - If stdin is a TTY: Interactive mode (gives you a shell, exposes socket)
  - If stdin is not a TTY: MCP client mode (connects to socket, serves MCP)

Interactive Mode (run in your terminal):
  terminal-mcp

  This gives you an interactive shell. AI can observe/interact via MCP.
  Type /info for the MCP configuration to add to your MCP client.

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
  // Initialize stats
  resetStats();

  // Get terminal size from environment or use defaults
  const cols = options.cols ?? (process.stdout.columns || 120);
  const rows = options.rows ?? (process.stdout.rows || 40);
  const shell = options.shell || getDefaultShell();

  // Print startup banner
  printBanner({ socketPath, cols, rows, shell });

  // Create terminal manager (prompt customization handled in session.ts)
  const manager = new TerminalManager({
    cols,
    rows,
    shell: options.shell,
  });

  // Get the session and set up interactive I/O
  const session = manager.getSession();

  // Pipe PTY output to stdout
  session.onData((data) => {
    process.stdout.write(data);
  });

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

  // Buffer for detecting /info command
  let inputBuffer = "";

  // Pipe stdin to PTY, with /info command detection
  process.stdin.on("data", (data) => {
    const str = data.toString();

    // Check for /info command (detect when user types /info and presses enter)
    // In raw mode, we need to buffer input to detect the command
    for (const char of str) {
      if (char === "\r" || char === "\n") {
        // Check if buffer is /info command
        if (isInfoCommand(inputBuffer)) {
          // Print info and clear the line
          process.stdout.write("\r\n");
          printInfo(socketPath, cols, rows, shell, getStats());
          inputBuffer = "";
          // Write newline to shell to maintain prompt
          session.write("\n");
          continue;
        }
        inputBuffer = "";
        session.write(char);
      } else if (char === "\x7f" || char === "\b") {
        // Backspace
        inputBuffer = inputBuffer.slice(0, -1);
        session.write(char);
      } else {
        inputBuffer += char;
        session.write(char);
      }
    }
  });

  // Handle terminal resize
  process.stdout.on("resize", () => {
    const newCols = process.stdout.columns || cols;
    const newRows = process.stdout.rows || rows;
    session.resize(newCols, newRows);
  });

  // Start tool proxy socket server
  const socketServer = createToolProxyServer(socketPath, manager);

  // Cleanup function
  function cleanup() {
    manager.dispose();
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
    cleanup();
    process.exit(0);
  });

  process.on("exit", () => {
    cleanup();
  });
}

main().catch((error) => {
  console.error("Failed to start:", error);
  process.exit(1);
});
