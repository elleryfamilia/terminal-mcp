# Installation

This guide covers how to install and set up Terminal MCP.

## Prerequisites

### Node.js

Terminal MCP requires Node.js 18.0.0 or later. Check your version:

```bash
node --version
```

If you need to install or update Node.js, visit [nodejs.org](https://nodejs.org/) or use a version manager like [nvm](https://github.com/nvm-sh/nvm).

### Build Tools

Terminal MCP uses `node-pty`, a native module that requires compilation. You'll need platform-specific build tools:

#### macOS

Install Xcode Command Line Tools:

```bash
xcode-select --install
```

#### Linux (Debian/Ubuntu)

```bash
sudo apt-get install build-essential python3
```

#### Linux (RHEL/CentOS/Fedora)

```bash
sudo dnf groupinstall "Development Tools"
sudo dnf install python3
```

#### Windows

Install windows-build-tools (requires Administrator PowerShell):

```powershell
npm install --global windows-build-tools
```

Or install Visual Studio Build Tools manually from [visualstudio.microsoft.com](https://visualstudio.microsoft.com/visual-cpp-build-tools/).

## Installation Methods

### From Source (Recommended for Development)

1. Clone the repository:

```bash
git clone https://github.com/elleryfamilia/terminal-mcp.git
cd terminal-mcp
```

2. Install dependencies:

```bash
npm install
```

This will automatically build the TypeScript source (via the `prepare` script).

3. Verify the build:

```bash
ls dist/
# Should show: index.js, server.js, terminal/, tools/, utils/
```

### Via npx (After Publishing)

Once published to npm, you can run directly:

```bash
npx terminal-mcp
```

### Global Installation (After Publishing)

```bash
npm install -g terminal-mcp
terminal-mcp
```

## Claude Code Integration

To use Terminal MCP with Claude Code, add it to your MCP server configuration.

### Configuration File Location

- **macOS/Linux**: `~/.claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Configuration

Add Terminal MCP to your configuration:

```json
{
  "mcpServers": {
    "terminal": {
      "command": "node",
      "args": ["/absolute/path/to/terminal-mcp/dist/index.js"]
    }
  }
}
```

With custom options:

```json
{
  "mcpServers": {
    "terminal": {
      "command": "node",
      "args": [
        "/absolute/path/to/terminal-mcp/dist/index.js",
        "--cols", "100",
        "--rows", "30",
        "--shell", "/bin/zsh"
      ]
    }
  }
}
```

After publishing to npm:

```json
{
  "mcpServers": {
    "terminal": {
      "command": "npx",
      "args": ["terminal-mcp"]
    }
  }
}
```

### Verify Integration

After configuring, restart Claude Code and verify the tools are available:

1. Open Claude Code
2. The terminal tools should appear in the available tools list
3. Try a simple command: "Use the terminal to echo hello world"

## Troubleshooting

### Native Module Compilation Errors

If you see errors about `node-pty` compilation:

1. Ensure build tools are installed (see Prerequisites)
2. Try clearing npm cache: `npm cache clean --force`
3. Remove node_modules and reinstall: `rm -rf node_modules && npm install`
4. On Windows, ensure you're using a compatible Node.js architecture (x64)

### Permission Errors

On Unix systems, ensure the entry point is executable:

```bash
chmod +x dist/index.js
```

### Shell Not Found

If your default shell isn't found, specify it explicitly:

```bash
node dist/index.js --shell /bin/bash
```

### MCP Connection Issues

1. Verify the path in your configuration is absolute
2. Check that Node.js is in your PATH
3. Look at Claude Code's logs for error messages
4. Test the server manually:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/index.js
```

You should see a JSON response with `serverInfo`.

## Development Setup

For development with hot reloading:

```bash
# Install tsx for TypeScript execution
npm install -D tsx

# Run in development mode
npm run dev
```

Build for production:

```bash
npm run build
```

## Updating

### From Source

```bash
git pull
npm install
npm run build
```

### Via npm (After Publishing)

```bash
npm update -g terminal-mcp
```
