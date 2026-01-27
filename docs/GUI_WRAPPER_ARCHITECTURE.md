# GUI Wrapper Architecture

This document describes the architecture for adding a graphical user interface (GUI) to terminal-mcp while preserving the existing CLI/MCP functionality.

## Overview

The approach follows a **separation of concerns** pattern, similar to how OpenCode structures their desktop application:

1. **terminal-mcp** (this project) remains the core backend handling PTY, MCP, and terminal emulation
2. A thin **GUI wrapper** spawns terminal-mcp and displays the terminal output visually

This architecture enables:
- Releasing as a CLI tool (existing functionality)
- Releasing as a desktop app (Tauri or Electron)
- Releasing as a web app (future possibility)
- AI assistants connecting via MCP (existing functionality)

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GUI Wrapper Application                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Renderer Process                      │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │    │
│  │  │  xterm.js   │  │   Tab Bar   │  │  Settings UI    │  │    │
│  │  │  Terminal   │  │   Manager   │  │  & Preferences  │  │    │
│  │  └──────┬──────┘  └─────────────┘  └─────────────────┘  │    │
│  │         │                                                │    │
│  │         │ Write to display                               │    │
│  │         ▼                                                │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │           Terminal Output Handler               │    │    │
│  │  │  - Receives raw PTY output via IPC/Socket       │    │    │
│  │  │  - Writes bytes directly to xterm.js            │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              │ IPC / Unix Socket                 │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Main Process                           │    │
│  │  - Spawns terminal-mcp subprocess                        │    │
│  │  - Manages socket connection                             │    │
│  │  - Handles window management                             │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Unix Socket / Stdin-Stdout
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    terminal-mcp (This Project)                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    MCP Server                            │    │
│  │  - Exposes tools: type, sendKey, getContent, etc.        │    │
│  │  - Handles AI assistant connections                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  Terminal Manager                        │    │
│  │  - Manages multiple terminal sessions                    │    │
│  │  - Routes input/output to correct session                │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   PTY Handler                            │    │
│  │  - node-pty for pseudo-terminal                          │    │
│  │  - @xterm/headless for terminal emulation                │    │
│  │  - Streams raw output to GUI (NEW)                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 Recording Manager                        │    │
│  │  - Asciicast v2 recording                                │    │
│  │  - Session playback support                              │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ PTY (pseudo-terminal)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Shell Process                            │
│                    (zsh, bash, fish, etc.)                       │
└─────────────────────────────────────────────────────────────────┘
```

## Changes Required in terminal-mcp

### 1. Raw Output Streaming (Priority: High)

Add a new transport mechanism to stream raw PTY output to GUI clients.

**New file: `src/transport/gui-stream.ts`**

```typescript
import { EventEmitter } from 'events';

export interface GUIStreamEvents {
  'output': (sessionId: string, data: Buffer) => void;
  'session-created': (sessionId: string) => void;
  'session-closed': (sessionId: string) => void;
  'resize': (sessionId: string, cols: number, rows: number) => void;
}

export class GUIOutputStream extends EventEmitter {
  // Singleton or per-connection instance
  private clients: Set<WebSocket | NodeJS.WriteStream> = new Set();

  broadcast(event: keyof GUIStreamEvents, ...args: any[]) {
    // Send to all connected GUI clients
  }

  addClient(client: WebSocket | NodeJS.WriteStream) {
    this.clients.add(client);
  }

  removeClient(client: WebSocket | NodeJS.WriteStream) {
    this.clients.delete(client);
  }
}
```

### 2. Protocol for GUI Communication

Define a simple JSON protocol for GUI <-> terminal-mcp communication.

**Messages from terminal-mcp to GUI:**

```typescript
// Raw terminal output (binary, base64 encoded for JSON transport)
{
  "type": "output",
  "sessionId": "uuid",
  "data": "base64-encoded-bytes"
}

// Session lifecycle
{
  "type": "session-created",
  "sessionId": "uuid",
  "shell": "/bin/zsh",
  "cols": 80,
  "rows": 24
}

{
  "type": "session-closed",
  "sessionId": "uuid",
  "exitCode": 0
}

// Terminal resized
{
  "type": "resize",
  "sessionId": "uuid",
  "cols": 120,
  "rows": 40
}
```

**Messages from GUI to terminal-mcp:**

```typescript
// User input (keystrokes)
{
  "type": "input",
  "sessionId": "uuid",
  "data": "base64-encoded-bytes"
}

// Create new session
{
  "type": "create-session",
  "shell": "/bin/zsh",  // optional
  "cols": 80,
  "rows": 24,
  "cwd": "/path/to/dir"  // optional
}

// Close session
{
  "type": "close-session",
  "sessionId": "uuid"
}

// Resize terminal
{
  "type": "resize",
  "sessionId": "uuid",
  "cols": 120,
  "rows": 40
}
```

### 3. New CLI Flag for GUI Mode

Add a `--gui-socket` flag to enable GUI streaming:

```bash
terminal-mcp --gui-socket /tmp/terminal-mcp-gui.sock
```

Or use stdout for simpler integration:

```bash
terminal-mcp --gui-mode  # Streams GUI protocol to stdout
```

### 4. Modify Terminal Session to Emit Raw Output

**In `src/terminal/session.ts`:**

```typescript
// Add event emission for raw PTY output
this.pty.onData((data: string) => {
  // Existing: feed to headless terminal for state tracking
  this.terminal.write(data);

  // NEW: Emit raw data for GUI clients
  this.emit('raw-output', this.id, Buffer.from(data));
});
```

## GUI Wrapper Options

### Option A: Electron (Recommended for Quick Start)

**Pros:**
- node-pty works natively (no subprocess needed!)
- Can run terminal-mcp in-process
- Large ecosystem and documentation
- Battle-tested by VS Code, Hyper, etc.

**Cons:**
- Larger binary size (~150MB+)
- Higher memory usage

**Architecture with Electron:**
```
┌─────────────────────────────────────┐
│         Electron Main Process        │
│  - Can run terminal-mcp code directly│
│  - Or spawn as subprocess            │
│  - node-pty works natively           │
└──────────────┬──────────────────────┘
               │ IPC
┌──────────────▼──────────────────────┐
│       Electron Renderer Process      │
│  - React + xterm.js                  │
│  - Receives PTY output via IPC       │
└─────────────────────────────────────┘
```

### Option B: Tauri + Subprocess

**Pros:**
- Tiny binary size (~10-20MB)
- Lower memory usage
- Modern Rust-based architecture

**Cons:**
- Must spawn terminal-mcp as subprocess
- Slightly more complex IPC

**Architecture with Tauri:**
```
┌─────────────────────────────────────┐
│           Tauri Main Process         │
│  - Spawns terminal-mcp subprocess    │
│  - Bridges socket to frontend        │
└──────────────┬──────────────────────┘
               │ Tauri IPC
┌──────────────▼──────────────────────┐
│          Tauri Webview               │
│  - SolidJS/React + xterm.js          │
│  - Receives PTY output via events    │
└─────────────────────────────────────┘
               │
               │ Unix Socket / Stdio
┌──────────────▼──────────────────────┐
│     terminal-mcp (subprocess)        │
│  - node-pty handles PTY              │
│  - Streams output via socket/stdio   │
└─────────────────────────────────────┘
```

### Option C: Web App (Future)

Run terminal-mcp as a local server, connect via WebSocket from browser.

## Implementation Phases

### Phase 1: Core Streaming Infrastructure
- [ ] Add `GUIOutputStream` class
- [ ] Define GUI protocol messages
- [ ] Add `--gui-mode` CLI flag
- [ ] Emit raw PTY output events from sessions
- [ ] Add unit tests for protocol

### Phase 2: Electron Wrapper (Recommended First)
- [ ] Create new `packages/desktop-electron` directory
- [ ] Set up Electron + React + xterm.js
- [ ] Import terminal-mcp as dependency (runs in-process)
- [ ] Wire up PTY output to xterm.js
- [ ] Implement tab management
- [ ] Add basic settings UI

### Phase 3: Tauri Wrapper (Optional)
- [ ] Create new `packages/desktop-tauri` directory
- [ ] Set up Tauri + SolidJS/React + xterm.js
- [ ] Spawn terminal-mcp as subprocess
- [ ] Connect via Unix socket
- [ ] Wire up PTY output to xterm.js

### Phase 4: Polish & Features
- [ ] Themes and customization
- [ ] Split panes
- [ ] Search in terminal
- [ ] Keyboard shortcuts
- [ ] Session persistence
- [ ] Recording playback UI

## File Structure After Implementation

```
terminal-mcp/
├── src/                          # Core library (existing)
│   ├── terminal/
│   ├── transport/
│   │   ├── index.ts
│   │   ├── gui-stream.ts         # NEW: GUI streaming
│   │   └── gui-protocol.ts       # NEW: Protocol definitions
│   └── ...
├── packages/
│   ├── desktop-electron/         # NEW: Electron app
│   │   ├── src/
│   │   │   ├── main/             # Electron main process
│   │   │   └── renderer/         # React + xterm.js
│   │   ├── package.json
│   │   └── electron-builder.json
│   └── desktop-tauri/            # NEW: Tauri app (optional)
│       ├── src/
│       ├── src-tauri/
│       └── package.json
├── package.json
└── ...
```

## Key Design Decisions

### Why Stream Raw PTY Output?

The GUI needs raw ANSI escape sequences to properly render:
- Colors and formatting
- Cursor positioning
- Special characters

Using the existing `getContent` MCP tool (which returns parsed text) would lose this information.

### Why Keep terminal-mcp Separate?

1. **Reusability**: CLI, GUI, and MCP clients all use the same core
2. **Testing**: Core logic can be tested independently
3. **Flexibility**: Users can choose their preferred interface
4. **Maintenance**: Single source of truth for PTY handling

### Why Electron First?

1. **Simpler Integration**: node-pty works directly, no subprocess needed
2. **Faster Development**: More documentation and examples
3. **Proven**: VS Code terminal uses this exact approach
4. **Fallback**: If Tauri subprocess approach has issues, Electron is ready

## References

- [OpenCode Architecture](https://github.com/anomalyco/opencode) - Similar CLI-first, GUI-wrapper approach
- [VS Code Terminal](https://github.com/microsoft/vscode) - Electron + node-pty reference
- [Hyper Terminal](https://github.com/vercel/hyper) - Electron terminal example
- [xterm.js Documentation](https://xtermjs.org/)
- [node-pty Documentation](https://github.com/microsoft/node-pty)
