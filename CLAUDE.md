# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm install        # Install dependencies (includes native node-pty compilation)
npm run build      # Compile TypeScript to dist/
npm run dev        # Run directly with tsx (no build needed)
```

## Architecture Overview

Terminal MCP is a headless terminal emulator exposed via Model Context Protocol (MCP). It has two operating modes:

### Dual-Mode Architecture

1. **Interactive Mode** (stdin is TTY): User runs `terminal-mcp` in their terminal
   - Spawns a PTY shell process, pipes I/O to user's terminal
   - Exposes a Unix socket at `/tmp/terminal-mcp.sock` for AI tool access
   - `src/index.ts` → `startInteractiveMode()` → creates `TerminalManager` + `createToolProxyServer()`

2. **MCP Client Mode** (stdin is not TTY): Claude Code spawns `terminal-mcp` as MCP server
   - Connects to the Unix socket from interactive mode
   - Serves MCP protocol over stdio to Claude Code
   - `src/client.ts` → `startMcpClientMode()` → proxies tool calls to socket

### Key Components

**Terminal Layer** (`src/terminal/`):
- `session.ts`: Core integration of `node-pty` (PTY process) + `@xterm/headless` (terminal emulation). Handles shell-specific prompt customization via temp rc files.
- `manager.ts`: Singleton wrapper managing session lifecycle

**Tool Layer** (`src/tools/`):
- Each tool has: Zod schema, tool definition object, handler function
- Pattern: `export const fooTool = {...}` + `export function handleFoo(manager, args)`
- Tools: `type`, `sendKey`, `getContent`, `takeScreenshot`

**Transport Layer** (`src/transport/`):
- `socket.ts`: Unix socket server for tool proxying between modes. Also has `SocketTransport` class implementing MCP's Transport interface.

### Data Flow

```
Interactive Mode:                    MCP Client Mode:
User Terminal                        Claude Code
    ↕ (raw PTY I/O)                     ↕ (MCP JSON-RPC over stdio)
TerminalSession                      MCP Server (client.ts)
    ↕                                   ↕ (custom JSON-RPC over socket)
Tool Proxy Server ←───────────────→ Socket Client
```

## Code Conventions

- ES Modules with `.js` extensions in imports (NodeNext module resolution)
- Zod for runtime validation of tool arguments
- Tools return `{ content: [{ type: "text", text: string }], isError?: boolean }`
- Key sequences are in `src/utils/keys.ts` (ANSI escape codes)
