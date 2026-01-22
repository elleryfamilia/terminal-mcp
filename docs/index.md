# Terminal MCP

A headless terminal emulator exposed via the Model Context Protocol (MCP), enabling AI assistants like Claude Code to interact with terminal applications programmatically.

## What is Terminal MCP?

Terminal MCP bridges the gap between AI assistants and interactive terminal applications. It provides a full PTY (pseudo-terminal) with VT100 emulation, allowing AI agents to:

- Run interactive CLI programs (vim, htop, less, etc.)
- Navigate TUI (Text User Interface) applications
- Handle programs that require real-time input
- Work with applications that use ANSI escape codes for formatting

## Key Features

- **Full Terminal Emulation**: Uses xterm.js headless for accurate VT100/ANSI terminal emulation
- **Cross-Platform PTY**: Leverages node-pty for native pseudo-terminal support on macOS, Linux, and Windows
- **MCP Protocol**: Implements the Model Context Protocol for seamless AI assistant integration
- **Simple API**: Five intuitive tools for complete terminal control
- **Configurable**: Customizable terminal dimensions and shell selection

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Run
node dist/index.js
```

Configure in Claude Code's MCP settings:

```json
{
  "mcpServers": {
    "terminal": {
      "command": "node",
      "args": ["/path/to/terminal-mcp/dist/index.js"]
    }
  }
}
```

## Documentation

- [Installation](./installation.md) - Setup and installation instructions
- [Tools Reference](./tools.md) - Complete API documentation for all MCP tools
- [Configuration](./configuration.md) - Configuration options and customization
- [Examples](./examples.md) - Usage examples and common patterns
- [Architecture](./architecture.md) - Technical architecture and development guide

## How It Works

```
AI Assistant (Claude Code)
    │
    │ STDIO (JSON-RPC / MCP Protocol)
    ▼
Terminal MCP Server (Node.js)
    ├── MCP SDK - Protocol handling
    ├── xterm.js Headless - Terminal emulation
    └── node-pty - PTY management
            │
            ▼
        Shell Process (bash, zsh, powershell)
            │
            ▼
        Interactive Applications
```

1. The AI assistant connects to Terminal MCP via stdio using the MCP protocol
2. Commands are sent through MCP tools (`type`, `sendKey`, etc.)
3. Terminal MCP writes to a pseudo-terminal connected to a real shell
4. Output is captured by the xterm.js headless terminal emulator
5. The AI can read the terminal state via `getContent` or `takeScreenshot`

## Use Cases

- **Interactive Debugging**: Run debuggers like `gdb` or `pdb` with full control
- **TUI Applications**: Navigate tools like `htop`, `lazygit`, or `mc`
- **Text Editors**: Operate `vim`, `nano`, or `emacs` programmatically
- **REPL Sessions**: Interactive sessions with `python`, `node`, `irb`, etc.
- **System Administration**: Run `top`, `tail -f`, and other monitoring tools

## Requirements

- Node.js 18.0.0 or later
- npm or yarn
- Build tools for native module compilation (node-pty)
  - macOS: Xcode Command Line Tools
  - Linux: build-essential, python3
  - Windows: windows-build-tools

## License

MIT
