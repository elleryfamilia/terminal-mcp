# Configuration

Terminal MCP can be configured via command-line arguments when starting the server.

## Command-Line Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--cols` | number | 120 | Terminal width in columns |
| `--rows` | number | 40 | Terminal height in rows |
| `--shell` | string | `$SHELL` or `bash` | Shell executable to use |
| `--help`, `-h` | flag | - | Show help message |

## Usage

### Basic Usage

```bash
# Use defaults (120x40, system shell)
node dist/index.js

# Custom dimensions
node dist/index.js --cols 80 --rows 24

# Specific shell
node dist/index.js --shell /bin/zsh

# Combined options
node dist/index.js --cols 100 --rows 30 --shell /usr/local/bin/fish
```

### Help

```bash
node dist/index.js --help
```

Output:
```
terminal-mcp - A headless terminal emulator exposed via MCP

Usage: terminal-mcp [options]

Options:
  --cols <number>   Terminal width in columns (default: 120)
  --rows <number>   Terminal height in rows (default: 40)
  --shell <path>    Shell to use (default: $SHELL or bash)
  --help, -h        Show this help message

Example:
  terminal-mcp --cols 80 --rows 24 --shell /bin/zsh
```

## Claude Code Configuration

### Basic Configuration

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

### With Custom Options

```json
{
  "mcpServers": {
    "terminal": {
      "command": "node",
      "args": [
        "/path/to/terminal-mcp/dist/index.js",
        "--cols", "100",
        "--rows", "30",
        "--shell", "/bin/zsh"
      ]
    }
  }
}
```

### Using npx (After Publishing)

```json
{
  "mcpServers": {
    "terminal": {
      "command": "npx",
      "args": ["terminal-mcp", "--cols", "80", "--rows", "24"]
    }
  }
}
```

## Terminal Dimensions

### Choosing Dimensions

The default 120x40 works well for most use cases. Consider adjusting based on:

| Use Case | Recommended Size | Reason |
|----------|------------------|--------|
| General CLI | 120x40 (default) | Comfortable for most commands |
| TUI Apps (htop, etc.) | 100x30 or larger | Need space for interface elements |
| Narrow displays | 80x24 | Classic terminal size |
| Log monitoring | 200x50 | More visible content |
| Vim/editors | 120x40+ | Comfortable editing space |

### Dynamic Resizing

Terminal dimensions are fixed at startup. If you need to resize during a session, you'll need to restart the server with new dimensions.

Future versions may support dynamic resizing via an MCP tool.

## Shell Selection

### Default Shell Detection

Terminal MCP uses this priority for shell selection:

1. `--shell` command-line argument (if provided)
2. `$SHELL` environment variable
3. `bash` as fallback

### Common Shell Paths

| Shell | Common Path |
|-------|-------------|
| Bash | `/bin/bash` |
| Zsh | `/bin/zsh` |
| Fish | `/usr/local/bin/fish` or `/opt/homebrew/bin/fish` |
| PowerShell | `pwsh` (cross-platform) or `powershell.exe` (Windows) |

### Shell-Specific Notes

#### Bash
```bash
node dist/index.js --shell /bin/bash
```
Most compatible option. Works on all Unix systems.

#### Zsh
```bash
node dist/index.js --shell /bin/zsh
```
Default on macOS. Supports advanced features like better tab completion.

#### Fish
```bash
node dist/index.js --shell /usr/local/bin/fish
```
Note: Fish uses non-POSIX syntax. Some scripts may not work.

#### PowerShell (Cross-Platform)
```bash
node dist/index.js --shell pwsh
```
For Windows-style commands on any platform.

## Environment Variables

The terminal session inherits the environment from the parent process. Key variables that affect behavior:

| Variable | Effect |
|----------|--------|
| `SHELL` | Default shell if `--shell` not specified |
| `TERM` | Set to `xterm-256color` by Terminal MCP |
| `PATH` | Determines available commands |
| `HOME` | Home directory for shell |
| `USER` | Current username |

### Customizing Environment

Currently, environment variables are inherited from the process running Terminal MCP. To customize:

1. Set variables before starting:
   ```bash
   MY_VAR=value node dist/index.js
   ```

2. Or export in your shell configuration

Future versions may support environment configuration via command-line options.

## Working Directory

The terminal session starts in the current working directory of the Terminal MCP process.

```bash
# Start in a specific directory
cd /path/to/project && node /path/to/terminal-mcp/dist/index.js
```

## Scrollback Buffer

The terminal maintains a scrollback buffer of 1000 lines by default. This allows `getContent` to retrieve historical output.

The scrollback size is currently fixed but may become configurable in future versions.

## Terminal Type

Terminal MCP identifies itself as `xterm-256color`, which:

- Supports 256-color output
- Enables most terminal applications to render correctly
- Provides good compatibility with TUI applications

## Resource Limits

### Memory

Each terminal session maintains:
- PTY process resources
- xterm.js buffer (depends on scrollback size)
- Active shell and its children

For most use cases, memory usage is minimal (< 50MB).

### Process Lifetime

The terminal session lives for the duration of the MCP connection. When the AI assistant disconnects:

1. SIGTERM is sent to gracefully shutdown
2. The PTY process is killed
3. All resources are cleaned up

### Concurrent Sessions

Currently, Terminal MCP supports a single terminal session. The session is created on first tool use and persists until shutdown.

Future versions may support multiple named sessions.
