# Recording

Terminal MCP supports recording terminal sessions to [asciicast v2](https://docs.asciinema.org/manual/asciicast/v2/) format, compatible with [asciinema](https://asciinema.org/) for playback and sharing.

## Overview

There are two ways to record terminal sessions:

1. **CLI Recording** - Record the entire session from start to finish using `--record` flag
2. **MCP Tool Recording** - Start/stop recording on-demand via MCP tools for capturing specific portions

## CLI Recording

Start terminal-mcp with recording enabled to capture the entire session.

### Basic Usage

```bash
# Record with defaults (saves to ~/.local/state/terminal-mcp/recordings/)
terminal-mcp --record

# Specify output directory
terminal-mcp --record --record-dir=./my-recordings

# Record only on failure (non-zero exit code)
terminal-mcp --record=on-failure
```

### CLI Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--record [mode]` | string | `off` | Recording mode: `always`, `on-failure`, `off` |
| `--record-dir` | string | See below | Output directory for recordings |
| `--record-format` | string | `v2` | Recording format (asciicast v2) |
| `--idle-time-limit` | number | `2` | Max seconds between events (caps idle time) |
| `--max-duration` | number | `3600` | Max recording duration in seconds (60 min) |
| `--inactivity-timeout` | number | `600` | Stop after no output for N seconds (10 min) |

### Default Recording Directory

The default recording directory follows XDG conventions:

1. `TERMINAL_MCP_RECORD_DIR` environment variable (if set)
2. `$XDG_STATE_HOME/terminal-mcp/recordings` (if XDG_STATE_HOME is set)
3. `~/.local/state/terminal-mcp/recordings` (fallback)

### Recording Modes

| Mode | Behavior |
|------|----------|
| `always` | Always save the recording when session ends |
| `on-failure` | Only save if the session exits with non-zero code |
| `off` | Disable recording (default) |

## MCP Tool Recording

Use MCP tools to start and stop recording on-demand. This allows AI assistants to capture specific portions of a session.

### startRecording

Start recording terminal output. Only one recording can be active at a time.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `format` | string | No | `v2` | Recording format (asciicast v2) |
| `mode` | string | No | `always` | `always` or `on-failure` |
| `outputDir` | string | No | XDG default | Directory to save recording |
| `idleTimeLimit` | number | No | `2` | Max seconds between events |
| `maxDuration` | number | No | `3600` | Max recording duration in seconds (60 min) |
| `inactivityTimeout` | number | No | `600` | Stop after no output for N seconds (10 min) |

**Response:**

```json
{
  "recordingId": "63f64b587bd8817a",
  "path": "/Users/you/.local/state/terminal-mcp/recordings/terminal-1769449938208-63f64b587bd8817a.cast",
  "format": "v2",
  "mode": "always",
  "maxDuration": 3600,
  "inactivityTimeout": 600,
  "message": "Recording will auto-stop after 60 minutes or 10 minutes of inactivity"
}
```

**Error (recording already active):**

```json
{
  "error": "A recording is already in progress",
  "activeRecordingId": "abc123",
  "activePath": "/path/to/active/recording.cast"
}
```

### stopRecording

Stop an active recording and finalize the asciicast file.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `recordingId` | string | Yes | The recording ID from `startRecording` |

**Response:**

```json
{
  "recordingId": "63f64b587bd8817a",
  "path": "/Users/you/.local/state/terminal-mcp/recordings/terminal-1769449938208-63f64b587bd8817a.cast",
  "durationMs": 62186,
  "bytesWritten": 11752,
  "saved": true,
  "mode": "always",
  "stopReason": "explicit"
}
```

The `stopReason` indicates why the recording stopped:
- `explicit` - User called stopRecording
- `session_exit` - Terminal session ended
- `max_duration` - Reached maximum duration limit
- `inactivity` - No terminal output for the timeout period
- `server_shutdown` - The MCP client disconnected (or the server was signalled) while the recording was still active

The recorded `exitCode` is `null` when the shell never exited, which is the
case for `server_shutdown`, `max_duration`, and `inactivity`. Because
`on-failure` mode saves only on a non-zero shell exit, a recording stopped for
any of those reasons is discarded rather than written to disk.

### Example Workflow

```
1. startRecording: {}
   → Returns recordingId: "abc123"

2. type: {"text": "echo hello"}
3. sendKey: {"key": "Enter"}
4. getContent: {}

5. stopRecording: {"recordingId": "abc123"}
   → Recording saved to ~/.local/state/terminal-mcp/recordings/
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TERMINAL_MCP_RECORD_DIR` | Override default recording output directory |
| `XDG_STATE_HOME` | XDG base directory for state files (used if TERMINAL_MCP_RECORD_DIR not set) |

### Example

```bash
# Set default recording directory in .bashrc/.zshrc
export TERMINAL_MCP_RECORD_DIR=~/my-recordings

# Or override for a single session
TERMINAL_MCP_RECORD_DIR=/tmp/debug-session terminal-mcp --record
```

## Output Files

Each recording creates two files:

| File | Description |
|------|-------------|
| `terminal-{timestamp}-{id}.cast` | Asciicast v2 recording file |
| `terminal-{timestamp}-{id}.meta.json` | Metadata (duration, exit code, etc.) |

### Asciicast v2 Format

The `.cast` file is a newline-delimited JSON format:

```json
{"version":2,"width":120,"height":40,"timestamp":1769449938,"env":{"TERM":"xterm-256color"}}
[0.5,"o","$ echo hello\r\n"]
[0.6,"o","hello\r\n"]
[1.2,"o","$ "]
```

- Line 1: Header with version, dimensions, timestamp, environment
- Subsequent lines: Events as `[timestamp, type, data]`
  - `"o"` = output (data written to terminal)
  - `"r"` = resize (terminal dimensions changed)

## Playback

### Using asciinema

```bash
# Install asciinema
brew install asciinema  # macOS
apt install asciinema   # Ubuntu/Debian

# Play recording
asciinema play ~/.local/state/terminal-mcp/recordings/terminal-*.cast

# Play at 2x speed
asciinema play -s 2 recording.cast

# Play with max idle time of 1 second
asciinema play -i 1 recording.cast
```

### Upload to asciinema.org

```bash
asciinema upload recording.cast
```

### Web Player

Recordings can also be embedded in web pages using the [asciinema player](https://docs.asciinema.org/manual/player/).

## Recording Timeouts

To prevent runaway recordings, two timeout mechanisms are available:

### Max Duration (`maxDuration`)

The maximum recording duration in seconds. Recording will automatically stop when this limit is reached.

| Setting | Effect |
|---------|--------|
| `3600` (default) | Max 60 minutes |
| `0` | No limit (not recommended) |
| `1800` | Max 30 minutes |

### Inactivity Timeout (`inactivityTimeout`)

Stop recording after no terminal output for the specified number of seconds. The timer resets on each output event.

| Setting | Effect |
|---------|--------|
| `600` (default) | Stop after 10 minutes of inactivity |
| `0` | No inactivity limit (not recommended) |
| `300` | Stop after 5 minutes of inactivity |

### Examples

```bash
# Record with shorter timeouts for debugging
terminal-mcp --record --max-duration=300 --inactivity-timeout=60

# Record with no inactivity limit (for long-running processes)
terminal-mcp --record --inactivity-timeout=0
```

Via MCP tools:
```json
{
  "maxDuration": 1800,
  "inactivityTimeout": 300
}
```

## Idle Time Limiting

The `idleTimeLimit` option caps the time between events in recordings. This prevents long pauses during playback when the terminal was idle.

| Setting | Effect |
|---------|--------|
| `2` (default) | Max 2 seconds between events |
| `0` | No limit (preserve actual timing) |
| `5` | Max 5 seconds between events |

Example: If you wait 30 seconds between commands, the recording will show only 2 seconds of pause (with default setting).

## Best Practices

1. **Use MCP tools for demos** - Start/stop recording around specific operations for cleaner recordings

2. **Set idle time limit** - Use `--idle-time-limit` to keep recordings concise

3. **Use `on-failure` for debugging** - Only keep recordings when something goes wrong

4. **Set a default directory** - Configure `TERMINAL_MCP_RECORD_DIR` in your shell profile

5. **Clean up old recordings** - Recordings can accumulate; periodically clean the output directory

## Limitations

- Only one recording can be active at a time (via MCP tools)
- CLI `--record` and MCP tool recording are independent
- Recording captures terminal output, not input (keystrokes are inferred from output)
- Large recordings may impact performance
