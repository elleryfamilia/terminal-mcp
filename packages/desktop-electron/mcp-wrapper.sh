#!/bin/bash

# MCP Debug Wrapper - logs all I/O to /tmp/mcp-debug.log

LOG="/tmp/mcp-debug.log"
echo "=== MCP Started at $(date) ===" >> "$LOG"
echo "Args: $@" >> "$LOG"
echo "PWD: $(pwd)" >> "$LOG"
echo "PATH: $PATH" >> "$LOG"

# Run the actual command, tee-ing stdin/stdout/stderr to the log
exec /opt/homebrew/bin/node /Users/ellery/_git/terminal-mcp-gui/dist/index.js "$@" 2>> "$LOG"
