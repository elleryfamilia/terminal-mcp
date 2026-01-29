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

### Option A: Ink TUI (Recommended for Terminal-Native Experience)

[Ink](https://github.com/vadimdemedes/ink) is a React renderer for the terminal. It allows building rich TUIs using familiar React patterns while staying entirely within the terminal - no separate window or browser needed.

**Pros:**
- No runtime change needed (works with Node.js)
- Terminal-native experience (no GUI chrome)
- React component model (familiar DX)
- Active ecosystem (@inkjs/ui components)
- Small footprint (no Electron/browser overhead)
- Users stay in their terminal workflow

**Cons:**
- Can't render complex graphics
- Limited to terminal capabilities
- Fullscreen apps (vim, htop) need special handling

**Architecture with Ink:**
```
┌─────────────────────────────────────────────────────────────┐
│                    Terminal Window                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │     PTY Output Region (ANSI scroll region)           │  │
│  │     Rendered via @xterm/headless buffer              │  │
│  │     Shell, vim, htop run here                        │  │
│  │     Apps see reduced terminal size (rows - 3)        │  │
│  │                                                       │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  🔴 REC │ 🛡️ Sandbox │ Socket: /tmp/mcp.sock │ F11  │  │  ← Ink status bar
│  │  Tools: type, sendKey │ Press ? for help             │  │    (fixed position)
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                              │
         │ Raw PTY I/O                  │ MCP over Unix socket
         ▼                              ▼
┌─────────────────────┐      ┌─────────────────────┐
│   Shell Process     │      │   Claude / AI       │
│   (zsh, bash, etc.) │      │   (MCP client)      │
└─────────────────────┘      └─────────────────────┘
```

#### Key Concepts

**1. Alternate Screen Buffer**

Enter a "fullscreen" mode that restores the original terminal on exit:

```typescript
const ENTER_ALT_SCREEN = '\x1b[?1049h';
const LEAVE_ALT_SCREEN = '\x1b[?1049l';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

function FullScreen({ children }) {
  useEffect(() => {
    process.stdout.write(ENTER_ALT_SCREEN + HIDE_CURSOR);
    return () => process.stdout.write(SHOW_CURSOR + LEAVE_ALT_SCREEN);
  }, []);
  return children;
}
```

**2. Scroll Region for Persistent Status Bar**

Reserve bottom rows for the status bar using ANSI scroll regions (DECSTBM):

```typescript
const STATUS_HEIGHT = 3;
const totalRows = process.stdout.rows;
const ptyRows = totalRows - STATUS_HEIGHT;

// Set scroll region - PTY output constrained to rows 1 through ptyRows
process.stdout.write(`\x1b[1;${ptyRows}r`);

// Create PTY with reduced size - apps think terminal is smaller
const pty = spawn(shell, [], {
  rows: ptyRows,
  cols: process.stdout.columns,
});
```

**3. Hybrid Rendering (PTY + Ink)**

The PTY region uses raw output; the status bar uses Ink:

```typescript
import { render, Box, Text } from 'ink';

class TerminalMcpTUI {
  private pty: IPty;
  private xterm: Terminal;
  private ptyRows: number;
  private fullscreen = false;

  start() {
    const totalRows = process.stdout.rows;
    this.ptyRows = totalRows - STATUS_HEIGHT;

    // Enter alternate screen
    process.stdout.write(ENTER_ALT_SCREEN);

    // Set scroll region for PTY area
    process.stdout.write(`\x1b[1;${this.ptyRows}r`);

    // Create PTY with reduced size
    this.pty = spawn(shell, [], {
      rows: this.ptyRows,
      cols: process.stdout.columns,
    });

    // xterm/headless for terminal state tracking
    this.xterm = new Terminal({
      rows: this.ptyRows,
      cols: process.stdout.columns
    });

    // PTY output → xterm buffer → PTY region of screen
    this.pty.onData((data) => {
      this.xterm.write(data);
      // Output goes to scroll region automatically
      process.stdout.write(data);
    });

    // Render Ink status bar at fixed position
    this.renderStatusBar();
  }

  renderStatusBar() {
    const statusTop = this.ptyRows + 1;
    // Position cursor at status bar region
    process.stdout.write(`\x1b[${statusTop};1H`);
    // Render status bar content...
  }
}
```

**4. Fullscreen Toggle**

Allow users to hide the status bar for apps that need full terminal:

```typescript
toggleFullscreen() {
  this.fullscreen = !this.fullscreen;

  const totalRows = process.stdout.rows;
  const ptyRows = this.fullscreen ? totalRows : totalRows - STATUS_HEIGHT;

  if (this.fullscreen) {
    // Reset scroll region to full terminal
    process.stdout.write('\x1b[r');
  } else {
    // Restore scroll region, leaving room for status
    process.stdout.write(`\x1b[1;${ptyRows}r`);
    this.renderStatusBar();
  }

  // Resize PTY - app will redraw itself
  this.pty.resize(process.stdout.columns, ptyRows);
  this.xterm.resize(process.stdout.columns, ptyRows);
}

handleInput(data: string) {
  // Intercept F11 before passing to PTY
  if (data === '\x1b[23~') {  // F11
    this.toggleFullscreen();
    return;
  }
  this.pty.write(data);
}
```

#### Ink Components for Status Bar

Using [@inkjs/ui](https://github.com/vadimdemedes/ink-ui) components:

```tsx
import { Box, Text } from 'ink';
import { Spinner, Badge } from '@inkjs/ui';

function StatusBar({ recording, sandbox, socket, mcpConnected }) {
  return (
    <Box borderStyle="single" paddingX={1}>
      {recording && (
        <>
          <Text color="red">🔴 REC</Text>
          <Text> │ </Text>
        </>
      )}
      {sandbox && (
        <>
          <Badge color="green">Sandbox</Badge>
          <Text> │ </Text>
        </>
      )}
      <Text dimColor>Socket: {socket}</Text>
      <Text> │ </Text>
      {mcpConnected ? (
        <Text color="green">● MCP</Text>
      ) : (
        <Spinner label="MCP connecting..." />
      )}
      <Box flexGrow={1} />
      <Text dimColor>F11: fullscreen │ ?: help</Text>
    </Box>
  );
}
```

#### Available @inkjs/ui Components

| Component | Use Case |
|-----------|----------|
| `<Spinner />` | Loading/connecting indicators |
| `<ProgressBar />` | Recording progress, uploads |
| `<Badge />` | Status indicators (Sandbox, Recording) |
| `<Alert />` | Warnings, errors |
| `<TextInput />` | Command palette, search |
| `<Select />` | Settings menus, shell selection |
| `<ConfirmInput />` | Dangerous action confirmation |

#### Implementation Phases for Ink TUI

**Phase 1: Basic Fullscreen Shell**
- [ ] Add `--tui` CLI flag
- [ ] Implement alternate screen buffer wrapper
- [ ] Pipe PTY I/O in fullscreen mode
- [ ] Clean exit handling

**Phase 2: Status Bar**
- [ ] Implement scroll region management
- [ ] Add Ink-rendered status bar
- [ ] Show recording/sandbox/MCP status
- [ ] Handle terminal resize

**Phase 3: Fullscreen Toggle**
- [ ] F11 hotkey to toggle status bar
- [ ] Resize PTY on toggle
- [ ] Visual indicator when status bar hidden

**Phase 4: Interactive Features**
- [ ] Help overlay (? key)
- [ ] Command palette (Ctrl+P)
- [ ] Settings dialog
- [ ] Tool activity sidebar (optional)

#### When to Use Ink vs Desktop GUI

| Use Case | Recommendation |
|----------|----------------|
| SSH into remote server | Ink TUI |
| Terminal-centric workflow | Ink TUI |
| Multi-window/tab management | Electron/Tauri |
| Needs browser features | Electron/Tauri |
| Minimal resource usage | Ink TUI |
| Rich graphics/theming | Electron/Tauri |

---

### Option B: Electron (Recommended for Desktop GUI)

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

### Option C: Tauri + Subprocess

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

### Option D: Web App (Future)

Run terminal-mcp as a local server, connect via WebSocket from browser.

## Implementation Phases

### Path A: Ink TUI (Terminal-Native)

**Phase A1: Basic Fullscreen Mode**
- [ ] Add `--tui` CLI flag to `src/index.ts`
- [ ] Create `src/tui/` directory structure
- [ ] Implement alternate screen buffer wrapper
- [ ] Basic PTY passthrough in fullscreen mode
- [ ] Clean exit handling (restore terminal state)

**Phase A2: Status Bar with Scroll Regions**
- [ ] Implement ANSI scroll region management
- [ ] Add Ink + @inkjs/ui dependencies
- [ ] Create status bar component showing:
  - Recording status
  - Sandbox status
  - MCP connection status
  - Socket path
- [ ] Handle terminal resize events

**Phase A3: Fullscreen Toggle**
- [ ] F11 hotkey to toggle status bar visibility
- [ ] Resize PTY dynamically on toggle
- [ ] Visual indicator when status bar is hidden
- [ ] Persist user preference

**Phase A4: Interactive Features**
- [ ] Help overlay (? key)
- [ ] Command palette (Ctrl+P)
- [ ] Tool activity sidebar (optional, toggle with Tab)
- [ ] Settings dialog

### Path B: Desktop GUI (Electron/Tauri)

**Phase B1: Core Streaming Infrastructure** (COMPLETED)
- [x] Add `GUIOutputStream` class (`src/transport/gui-stream.ts`)
- [x] Define GUI protocol messages (`src/transport/gui-protocol.ts`)
- [x] Add `--gui-mode` CLI flag (`src/index.ts`)
- [x] Emit raw PTY output events from sessions (via GUIOutputStream)
- [ ] Add unit tests for protocol

**Phase B2: Electron Wrapper** (IN PROGRESS)
- [x] Create new `packages/desktop-electron` directory
- [x] Set up Electron + React + xterm.js
- [x] Import terminal-mcp as dependency (runs in-process)
- [x] Wire up PTY output to xterm.js
- [ ] Implement tab management (single tab works)
- [ ] Add basic settings UI

**Phase B3: Tauri Wrapper (Optional)**
- [ ] Create new `packages/desktop-tauri` directory
- [ ] Set up Tauri + SolidJS/React + xterm.js
- [ ] Spawn terminal-mcp as subprocess
- [ ] Connect via Unix socket
- [ ] Wire up PTY output to xterm.js

**Phase B4: Polish & Features**
- [ ] Themes and customization
- [ ] Split panes
- [ ] Search in terminal
- [ ] Keyboard shortcuts
- [ ] Session persistence
- [ ] Recording playback UI

## File Structure After Implementation

```
terminal-mcp/
├── src/                          # Core library (existing + new)
│   ├── terminal/
│   │   ├── session.ts            # PTY + xterm.js integration
│   │   ├── manager.ts            # Session lifecycle management
│   │   └── index.ts
│   ├── transport/
│   │   ├── index.ts              # UPDATED: exports GUI modules
│   │   ├── socket.ts             # Unix socket transport
│   │   ├── gui-stream.ts         # NEW: GUI streaming/broadcasting
│   │   └── gui-protocol.ts       # NEW: Protocol type definitions
│   ├── lib.ts                    # NEW: Library exports for embedding
│   ├── index.ts                  # CLI entry point (updated with --gui-mode)
│   └── ...
├── packages/
│   └── desktop-electron/         # NEW: Electron app
│       ├── src/
│       │   ├── main/
│       │   │   ├── index.ts      # Electron main process entry
│       │   │   ├── terminal-bridge.ts  # IPC bridge to terminal-mcp
│       │   │   ├── preload.ts    # Secure context bridge
│       │   │   └── menu.ts       # Application menu
│       │   └── renderer/
│       │       ├── index.html
│       │       ├── index.tsx     # React entry point
│       │       ├── App.tsx       # Main app component
│       │       ├── components/
│       │       │   ├── Terminal.tsx   # xterm.js wrapper
│       │       │   └── StatusBar.tsx  # Status bar
│       │       └── styles/
│       │           └── index.css
│       ├── package.json
│       ├── tsconfig.json         # Renderer TypeScript config
│       ├── tsconfig.main.json    # Main process TypeScript config
│       └── vite.config.ts        # Vite bundler config
├── package.json                  # UPDATED: exports field for library usage
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

### Why Two Paths (Ink TUI vs Desktop GUI)?

**Ink TUI is ideal when:**
- Users want to stay in their terminal workflow
- SSH/remote access is needed (no GUI forwarding)
- Minimal resource usage is important
- Quick integration is the priority (no separate app)

**Desktop GUI (Electron/Tauri) is ideal when:**
- Rich visual theming is important
- Multi-window/tab management is needed
- Users prefer standalone applications
- Browser-based features are required (rich text, images)

Both paths share the same core terminal-mcp backend.

## References

### Ink TUI
- [Ink](https://github.com/vadimdemedes/ink) - React for interactive command-line apps
- [@inkjs/ui](https://github.com/vadimdemedes/ink-ui) - UI components for Ink (Spinner, Select, etc.)
- [Ink Fullscreen Discussion](https://github.com/vadimdemedes/ink/issues/263) - Alternate screen buffer approach
- [ANSI Escape Codes](https://en.wikipedia.org/wiki/ANSI_escape_code) - Scroll regions (DECSTBM), cursor control

### Desktop GUI
- [OpenCode Architecture](https://github.com/sst/opencode) - Similar CLI-first, GUI-wrapper approach
- [OpenTUI](https://github.com/sst/opentui) - TUI library used by OpenCode
- [VS Code Terminal](https://github.com/microsoft/vscode) - Electron + node-pty reference
- [Hyper Terminal](https://github.com/vercel/hyper) - Electron terminal example
- [xterm.js Documentation](https://xtermjs.org/)
- [node-pty Documentation](https://github.com/microsoft/node-pty)
