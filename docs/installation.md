# Installation

This guide covers how to install and set up Terminal MCP.

## Prerequisites

### Node.js

Terminal MCP requires Node.js 22.12.0 or later (the bundled sandbox runtime
requires it, and it is loaded at startup even when `--sandbox` is off). Check
your version:

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

With custom options:

```json
{
  "mcpServers": {
    "terminal": {
      "command": "terminal-mcp",
      "args": ["--cols", "100", "--rows", "30", "--shell", "/bin/zsh"]
    }
  }
}
```

### Verify Integration

After configuring, restart your MCP client and verify the tools are available:

1. The terminal tools should appear in the available tools list
2. Try a simple command: "Use the terminal to echo hello world"

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
