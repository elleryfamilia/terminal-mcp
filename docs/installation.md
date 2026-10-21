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

### Quick Install

The easiest way to install is using the install script:

```bash
curl -fsSL https://raw.githubusercontent.com/elleryfamilia/terminal-mcp/main/install.sh | bash
```

This will clone the repo, build it, and create a `terminal-mcp` symlink in your PATH.

## MCP Client Integration

Terminal MCP works with any MCP-compatible client. Add it to your MCP server configuration.

### Configuration

After running the install script, add Terminal MCP to your MCP client configuration:

```json
{
  "mcpServers": {
    "terminal": {
      "command": "terminal-mcp"
    }
  }
}
```

This configuration (no `--headless`) runs **client mode**: it connects your MCP host to a separate **interactive session** you run yourself in a terminal window, so you can watch and drive the same shell the AI uses. Open a terminal and run:

```sh
terminal-mcp
```

and leave it open whenever you want the AI to use it. Starting the interactive session before or after your MCP host doesn't matter:

- No interactive session yet: the MCP host's `terminal-mcp` connects and lists tools normally; a tool call returns a friendly error telling you to run `terminal-mcp`, then try again.
- Start the interactive session at any point after: the next tool call connects automatically - no restart of your MCP client or host required.
- If the interactive session closes or crashes, the next tool call reconnects the same way once a new one is running; a call already in flight when it drops gets a clear error rather than hanging.
- Using a custom `--socket` path? Pass the same `--socket <path>` to both the interactive session and this configuration's `args`.
- Need a custom size or shell? `--cols`/`--rows`/`--shell` configure the **interactive session**, not this client config - the client itself has no terminal to size or shell to pick. Pass them to the interactive launch instead: `terminal-mcp --cols 100 --rows 30 --shell /bin/zsh`.

If you'd rather skip running a second process altogether, add `--headless` to this configuration's `args` instead - it's self-contained and needs no interactive session:

```json
{
  "mcpServers": {
    "terminal": {
      "command": "terminal-mcp",
      "args": ["--headless", "--cols", "100", "--rows", "30"]
    }
  }
}
```

### Verify Integration

Verifying tool availability (listing tools, discovering the server) works with or without an interactive session already running, and needs no restart either way. After configuring:

1. The terminal tools should appear in the available tools list.
2. If you're using client mode, start an interactive `terminal-mcp` session (see above) before trying a command, or you'll get a friendly error telling you to.
3. Try a simple command: "Use the terminal to echo hello world".

Changed the MCP client configuration itself (not just started/stopped the interactive session)? That does still need a restart of your MCP client/host to pick up.

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
3. Look at your MCP client's logs for error messages
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

Re-run the install script to update:

```bash
curl -fsSL https://raw.githubusercontent.com/elleryfamilia/terminal-mcp/main/install.sh | bash
```

Or manually:

```bash
cd ~/.terminal-mcp
git pull
npm install
npm run build
```
