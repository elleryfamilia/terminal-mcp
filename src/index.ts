#!/usr/bin/env node

import { startServer } from "./server.js";

// Parse command line arguments
const args = process.argv.slice(2);
const options: { cols?: number; rows?: number; shell?: string } = {};

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
    case "--help":
    case "-h":
      console.log(`
terminal-mcp - A headless terminal emulator exposed via MCP

Usage: terminal-mcp [options]

Options:
  --cols <number>   Terminal width in columns (default: 120)
  --rows <number>   Terminal height in rows (default: 40)
  --shell <path>    Shell to use (default: $SHELL or bash)
  --help, -h        Show this help message

Example:
  terminal-mcp --cols 80 --rows 24 --shell /bin/zsh
`);
      process.exit(0);
  }
}

startServer(options).catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
