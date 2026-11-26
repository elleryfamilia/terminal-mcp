# Sandbox Mode

Terminal MCP includes an opt-in sandbox mode that restricts filesystem and network access for enhanced security. This is useful when you want to limit what the AI assistant can access through the terminal.

## Overview

Sandbox mode uses [Anthropic's sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime) library to enforce restrictions at the OS level:

- **macOS**: Uses `sandbox-exec` (Seatbelt)
- **Linux**: Uses `bubblewrap` and `socat` (both require installation)
- **Windows**: Uses sandbox-runtime's `srt-win` backend (requires its one-time
  setup; `--sandbox` reports anything missing instead of running unconfined)

## Quick Start

```bash
# Interactive mode with sandbox
terminal-mcp --sandbox

# With a config file
terminal-mcp --sandbox --sandbox-config ~/.terminal-mcp-sandbox.json
```

## Interactive Permission Dialog

When you run `terminal-mcp --sandbox` without a config file, an interactive TUI dialog lets you configure permissions:

```
╭─────────────── Sandbox Permissions ───────────────╮
│                                                   │
│ ↑↓ move  ←→ cycle  ENTER confirm  q quit          │
│                                                   │
│ Core Paths:                                       │
│ ▸ Current directory          [Read/Write]        │
│   /tmp                        [Read/Write]        │
│                                                   │
│ Shell & Caches:                                   │
│   ~/.cache, ~/.local          [Read/Write]        │
│   Shell history files         [Read/Write]        │
│                                                   │
│ Credentials (sensitive):                          │
│   ~/.ssh                      [Blocked   ]        │
│   ~/.aws                      [Blocked   ]        │
│                                                   │
│ Network:                                          │
│   Network access              [Allowed   ]        │
│                                                   │
│   + Add custom path...                            │
│                                                   │
╰───────────────────────────────────────────────────╯
```

### Controls

| Key | Action |
|-----|--------|
| `↑` / `↓` or `j` / `k` | Move selection |
| `←` / `→` or `Space` | Cycle access level |
| `Enter` | Confirm and start |
| `q` or `Esc` | Cancel (use defaults) |
| `d` or `Delete` | Remove custom path |

### Access Levels

Each path can have one of three access levels:

| Level | Color | Description |
|-------|-------|-------------|
| **Read/Write** | Green | Full access to read and write |
| **Read-Only** | Cyan | Can read but not modify |
| **Blocked** | Red | No access allowed |

### Adding Custom Paths

1. Navigate to `+ Add custom path...` and press `Enter`
2. Type the path (e.g., `~/secrets`, `/var/data`)
3. Use `←` / `→` to set the access level
4. Press `Enter` to add, or `Esc` to cancel

Custom paths appear with a `*` indicator and can be removed with `d`.

## Configuration File

For repeatable configurations, use a JSON config file:

```bash
terminal-mcp --sandbox --sandbox-config ~/.terminal-mcp-sandbox.json
```

### Config File Format

```json
{
  "filesystem": {
    "readWrite": [
      ".",
      "/tmp",
      "~/.cache",
      "~/.local",
      "~/.npm"
    ],
    "readOnly": [
      "~"
    ],
    "blocked": [
      "~/.ssh",
      "~/.aws",
      "~/.gnupg",
      "~/.config/gh"
    ]
  },
  "network": {
    "mode": "all"
  }
}
```

### Filesystem Options

| Field | Type | Description |
|-------|------|-------------|
| `readWrite` | `string[]` | Paths with full read/write access |
| `readOnly` | `string[]` | Paths with read-only access |
| `blocked` | `string[]` | Paths completely blocked |

Paths can use:
- Absolute paths: `/tmp`, `/var/data`
- Home directory: `~`, `~/.ssh`
- Current directory: `.`

### Network Options

| Field | Type | Description |
|-------|------|-------------|
| `mode` | `string` | `"all"`, `"none"`, or `"allowlist"` |
| `allowedDomains` | `string[]` | Domains to allow (when mode is `"allowlist"`) |

#### Network Modes

```json
// Allow all network access
{ "network": { "mode": "all" } }

// Block all network access
{ "network": { "mode": "none" } }

// Allow specific domains only
{
  "network": {
    "mode": "allowlist",
    "allowedDomains": ["github.com", "*.npmjs.org", "api.anthropic.com"]
  }
}
```

## Default Permissions

When using `--sandbox` without customization, these defaults are applied:

### Allowed (Read/Write)
- `.` - Current working directory
- `/tmp` - Temporary files
- `~/.cache`, `~/.local` - Cache and local data
- `~/.zsh_history`, `~/.bash_history`, etc. - Shell history
- `~/.npm`, `~/.yarn`, `~/.pnpm`, `~/.bun` - Package managers

### Allowed (Read-Only)
- `~` - Home directory (general read access)

### Blocked
- `~/.ssh` - SSH keys and config
- `~/.gnupg` - GPG keys
- `~/.aws` - AWS credentials
- `~/.config/gcloud`, `~/.azure`, `~/.kube` - Cloud credentials
- `~/.config/gh` - GitHub CLI credentials
- `~/.npmrc`, `~/.netrc`, `~/.docker/config.json` - Auth tokens

### Network
- All network access allowed by default

## Platform Support

| Platform | Support | Mechanism |
|----------|---------|-----------|
| macOS | Full | sandbox-exec (Seatbelt) |
| Linux | Full | bubblewrap (requires `bwrap` and `socat` installed) |
| Windows | Supported | srt-win backend (sandbox user + network filters) |

### Linux Setup

On Linux, install bubblewrap and socat (socat relays the sandbox's network
bridge; without it the dependency check fails and the sandbox stays off):

```bash
# Debian/Ubuntu
sudo apt install bubblewrap socat

# Fedora
sudo dnf install bubblewrap socat

# Arch
sudo pacman -S bubblewrap socat
```

`ripgrep` (`rg`) is also used to expand glob deny-patterns on Linux.

## Known Limitations

### Syscall Restrictions

The sandbox may block certain system calls. For example, oh-my-zsh shows this warning:

```
nice(5) failed: operation not permitted
```

This is harmless - the shell works normally, it just can't lower its process priority. This is expected behavior and doesn't affect functionality.

### Path Specificity

More specific paths take precedence. For example, if you:
- Allow `~` as read-only
- Block `~/.ssh`

Then `~/.ssh` will be blocked even though `~` is allowed.

## Example Configurations

### Minimal (Maximum Security)

```json
{
  "filesystem": {
    "readWrite": ["."],
    "readOnly": [],
    "blocked": ["~"]
  },
  "network": {
    "mode": "none"
  }
}
```

### Development (Balanced)

```json
{
  "filesystem": {
    "readWrite": [
      ".",
      "/tmp",
      "~/.cache",
      "~/.npm",
      "~/.cargo"
    ],
    "readOnly": ["~"],
    "blocked": [
      "~/.ssh",
      "~/.aws",
      "~/.gnupg"
    ]
  },
  "network": {
    "mode": "allowlist",
    "allowedDomains": [
      "github.com",
      "*.githubusercontent.com",
      "*.npmjs.org",
      "registry.yarnpkg.com"
    ]
  }
}
```

### CI/Build Environment

```json
{
  "filesystem": {
    "readWrite": [
      ".",
      "/tmp",
      "~/.npm",
      "~/.cache"
    ],
    "readOnly": [],
    "blocked": [
      "~/.ssh",
      "~/.aws",
      "~/.gnupg",
      "~/.config"
    ]
  },
  "network": {
    "mode": "all"
  }
}
```

## Troubleshooting

### "Sandbox dependencies not available" on Windows

The `srt-win` backend needs the runtime's one-time setup (a sandbox user and
its network filters). The error names whichever part is missing; re-running
`--sandbox` after installing it should get past the check.

To sandbox on Windows today without that setup, run inside WSL and use the
Linux path instead.

### "Linux sandbox requires bubblewrap"

Install bubblewrap (`bwrap`) using your package manager. See [Linux Setup](#linux-setup).

### "socat not installed"

Install `socat` (`sudo apt install socat`). It is needed for the network bridge
that gives the sandboxed process proxy access.

### "Operation not permitted" errors

The sandbox is working correctly. These errors indicate blocked operations. Check your permissions configuration if legitimate operations are being blocked.

### Shell initialization errors

If your shell fails to start, ensure these paths are allowed:
- `~/.cache` (for oh-my-zsh and similar)
- Shell history files
- Your shell's config directory

## Security Considerations

Sandbox mode provides defense-in-depth but is not a complete security solution:

1. **Explicit opt-in**: Users must explicitly enable `--sandbox`
2. **OS-level enforcement**: Restrictions are enforced by the operating system
3. **Network filtering**: Can restrict which domains are accessible
4. **Credential protection**: Blocks access to common credential locations by default

The sandbox is most effective when combined with other security practices like least-privilege access and regular credential rotation.
