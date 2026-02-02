# Configuration

Terminal MCP can be configured via command-line arguments when starting the server.

## Command-Line Options

### General Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--cols` | number | 120 | Terminal width in columns |
| `--rows` | number | 40 | Terminal height in rows |
| `--shell` | string | `$SHELL` or `bash` | Shell executable to use |
| `--sandbox` | flag | - | Enable sandbox mode (restricts filesystem/network) |
| `--sandbox-config` | string | - | Path to sandbox configuration JSON file |
| `--version`, `-v` | flag | - | Show version number |
| `--help`, `-h` | flag | - | Show help message |

See [Sandbox Mode](./sandbox.md) for detailed sandbox configuration.

### Recording Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--record [mode]` | string | `off` | Recording mode: `always`, `on-failure`, `off` |
| `--record-dir` | string | XDG default | Output directory for recordings |
| `--record-format` | string | `v2` | Recording format (asciicast v2) |
| `--idle-time-limit` | number | `2` | Max seconds between events in recording |

See [Recording Documentation](recording.md) for full details on recording features.

### Multi-Session Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--max-sessions` | number | 5 | Maximum concurrent terminal sessions |
| `--session-idle-timeout` | number | 600 | Auto-destroy idle sessions after N seconds |

## Usage

### Basic Usage

```bash
# Use defaults (120x40, system shell)
terminal-mcp

# Custom dimensions
terminal-mcp --cols 80 --rows 24

# Specific shell
terminal-mcp --shell /bin/zsh

# Combined options
terminal-mcp --cols 100 --rows 30 --shell /usr/local/bin/fish

# Check version
terminal-mcp --version
```

### Recording Usage

```bash
# Record with defaults (saves to ~/.local/state/terminal-mcp/recordings/)
terminal-mcp --record

# Record to specific directory
terminal-mcp --record --record-dir=./my-recordings

# Record only on failure
terminal-mcp --record=on-failure

# Custom idle time limit (5 seconds max between events)
terminal-mcp --record --idle-time-limit=5
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
| `TERMINAL_MCP_RECORD_DIR` | Default recording output directory |
| `XDG_STATE_HOME` | XDG base directory for state files (fallback for recordings) |

### Recording Directory Resolution

The default recording directory is resolved in this order:

1. `--record-dir` command-line argument (if provided)
2. `TERMINAL_MCP_RECORD_DIR` environment variable (if set)
3. `$XDG_STATE_HOME/terminal-mcp/recordings` (if XDG_STATE_HOME is set)
4. `~/.local/state/terminal-mcp/recordings` (fallback)

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

Terminal MCP supports multiple concurrent sessions (default: 5 max). Use `createSession` to create new sessions and `destroySession` to clean them up. Sessions are automatically destroyed after idle timeout (default: 10 minutes).

```bash
# Allow up to 10 concurrent sessions
terminal-mcp --max-sessions 10

# Set idle timeout to 30 minutes
terminal-mcp --session-idle-timeout 1800
```
