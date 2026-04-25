# Tools Reference

Terminal MCP exposes seven MCP tools for interacting with the terminal. This document provides complete API documentation for each tool.

## Overview

| Tool | Description |
|------|-------------|
| [`type`](#type) | Send text input to the terminal |
| [`sendKey`](#sendkey) | Send special keys and key combinations |
| [`getContent`](#getcontent) | Retrieve terminal buffer content |
| [`takeScreenshot`](#takescreenshot) | Capture terminal state with metadata |
| [`clear`](#clear) | Clear the terminal screen |
| [`startRecording`](#startrecording) | Start recording terminal output |
| [`stopRecording`](#stoprecording) | Stop recording and save file |

---

## type

Send text input to the terminal, simulating keyboard typing.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | The text to type into the terminal |

### Returns

```json
{
  "content": [
    {
      "type": "text",
      "text": "Typed N character(s) to terminal"
    }
  ]
}
```

### Example

**Request:**
```json
{
  "name": "type",
  "arguments": {
    "text": "ls -la"
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Typed 6 character(s) to terminal"
    }
  ]
}
```

### Notes

- Text is written directly to the PTY without any interpretation
- Does not automatically press Enter; use `sendKey` with "Enter" to execute commands
- Can include newlines (`\n`) and tabs (`\t`) in the text
- For special keys like Ctrl+C, use `sendKey` instead

---

## sendKey

Send special keys or key combinations to the terminal.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | The key name to send |

### Available Keys

#### Control Keys
| Key | Description |
|-----|-------------|
| `Enter` | Enter/Return key |
| `Tab` | Tab key |
| `Escape` | Escape key |
| `Backspace` | Backspace key |
| `Delete` | Delete key |

#### Arrow Keys
| Key | Description |
|-----|-------------|
| `ArrowUp` | Up arrow |
| `ArrowDown` | Down arrow |
| `ArrowLeft` | Left arrow |
| `ArrowRight` | Right arrow |

#### Navigation Keys
| Key | Description |
|-----|-------------|
| `Home` | Home key |
| `End` | End key |
| `PageUp` | Page Up |
| `PageDown` | Page Down |
| `Insert` | Insert key |

#### Function Keys
| Key | Description |
|-----|-------------|
| `F1` - `F12` | Function keys 1-12 |

#### Ctrl Combinations
| Key | Description |
|-----|-------------|
| `Ctrl+A` - `Ctrl+Z` | Control key combinations |
| `Ctrl+C` | Interrupt signal (SIGINT) |
| `Ctrl+D` | End of file / logout |
| `Ctrl+L` | Clear screen |
| `Ctrl+Z` | Suspend process (SIGTSTP) |
| `Ctrl+[` | Escape (alternative) |
| `Ctrl+\\` | Quit signal (SIGQUIT) |
| `Ctrl+Space` | Null character |

### Returns

```json
{
  "content": [
    {
      "type": "text",
      "text": "Sent key: KeyName"
    }
  ]
}
```

### Example

**Request:**
```json
{
  "name": "sendKey",
  "arguments": {
    "key": "Ctrl+C"
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Sent key: Ctrl+C"
    }
  ]
}
```

### Error Handling

If an unknown key is provided:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: Unknown key: \"InvalidKey\". Available keys include: Enter, Tab, Escape, ..."
    }
  ],
  "isError": true
}
```

---

## getContent

Retrieve the terminal buffer content as plain text.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `visibleOnly` | boolean | No | `false` | If true, return only the visible viewport |

### Returns

```json
{
  "content": [
    {
      "type": "text",
      "text": "Terminal content here..."
    }
  ]
}
```

### Example

**Request (full buffer):**
```json
{
  "name": "getContent",
  "arguments": {}
}
```

**Request (visible viewport only):**
```json
{
  "name": "getContent",
  "arguments": {
    "visibleOnly": true
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "user@host:~$ ls -la\ntotal 48\ndrwxr-xr-x  12 user user 4096 Jan 22 10:00 .\n..."
    }
  ]
}
```

### Notes

- Returns `"(empty terminal)"` if the terminal is empty
- Full buffer includes scrollback history (up to 1000 lines by default)
- Visible viewport returns only what would be displayed on screen
- Trailing empty lines are trimmed from the output

---

## takeScreenshot

Capture the current terminal state. Supports three output formats for different use cases.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `format` | string | No | `text` | Output format: `text`, `ansi`, or `png` |

### Formats

#### `text` (default)

Returns plain text content with cursor position and dimensions. Color information is stripped.

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"content\": \"user@host:~$ █\",\n  \"cursor\": { \"x\": 14, \"y\": 0 },\n  \"dimensions\": { \"cols\": 120, \"rows\": 40 }\n}"
    }
  ]
}
```

#### `ansi`

Returns content with ANSI color escape codes preserved. Reconstructs SGR sequences from the terminal's cell buffer, supporting 16-color, 256-color, 24-bit truecolor, bold, dim, italic, and underline attributes.

**Request:**
```json
{
  "name": "takeScreenshot",
  "arguments": { "format": "ansi" }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"content\": \"\\u001b[31mERROR\\u001b[0m: file not found\",\n  \"cursor\": { \"x\": 0, \"y\": 1 },\n  \"dimensions\": { \"cols\": 120, \"rows\": 40 }\n}"
    }
  ]
}
```

#### `png`

Returns a color screenshot as a PNG image with full ANSI color rendering, One Dark theme, and macOS-style window chrome. Requires `@resvg/resvg-js` to be installed.

**Request:**
```json
{
  "name": "takeScreenshot",
  "arguments": { "format": "png" }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "image",
      "data": "<base64-encoded PNG>",
      "mimeType": "image/png"
    }
  ]
}
```

### Response Fields (text and ansi formats)

| Field | Type | Description |
|-------|------|-------------|
| `content` | string | Visible terminal content (plain or ANSI-colored) |
| `cursor.x` | number | Cursor column position (0-indexed) |
| `cursor.y` | number | Cursor row position (0-indexed) |
| `dimensions.cols` | number | Terminal width in columns |
| `dimensions.rows` | number | Terminal height in rows |

### Use Cases

- **`text`**: Read command output, check cursor position, verify dimensions
- **`ansi`**: Capture colored output for logs, diagnostics, or re-rendering in a terminal
- **`png`**: Generate visual screenshots for documentation, sharing, or visual verification

---

## clear

Clear the terminal screen and scrollback buffer.

### Parameters

None.

### Returns

```json
{
  "content": [
    {
      "type": "text",
      "text": "Terminal cleared"
    }
  ]
}
```

### Example

**Request:**
```json
{
  "name": "clear",
  "arguments": {}
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Terminal cleared"
    }
  ]
}
```

### Notes

- Clears both the visible screen and scrollback buffer
- Equivalent to the `clear` command but operates on the terminal emulator directly
- The shell prompt will reappear after any subsequent output

---

## startRecording

Start recording terminal output to an asciicast v2 file. Only one recording can be active at a time.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `format` | string | No | `v2` | Recording format (asciicast v2) |
| `mode` | string | No | `always` | `always` or `on-failure` |
| `outputDir` | string | No | XDG default | Directory to save recording |
| `idleTimeLimit` | number | No | `2` | Max seconds between events |

### Returns

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"recordingId\": \"63f64b587bd8817a\",\n  \"path\": \"/Users/you/.local/state/terminal-mcp/recordings/terminal-1769449938208-63f64b587bd8817a.cast\",\n  \"format\": \"v2\",\n  \"mode\": \"always\"\n}"
    }
  ]
}
```

### Example

**Request:**
```json
{
  "name": "startRecording",
  "arguments": {}
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"recordingId\": \"63f64b587bd8817a\",\n  \"path\": \"/Users/you/.local/state/terminal-mcp/recordings/terminal-1769449938208-63f64b587bd8817a.cast\",\n  \"format\": \"v2\",\n  \"mode\": \"always\"\n}"
    }
  ]
}
```

### Error Handling

If a recording is already active:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"error\": \"A recording is already in progress\",\n  \"activeRecordingId\": \"abc123\",\n  \"activePath\": \"/path/to/recording.cast\"\n}"
    }
  ],
  "isError": true
}
```

### Notes

- Only one recording can be active at a time
- Default output directory: `~/.local/state/terminal-mcp/recordings/`
- Override with `TERMINAL_MCP_RECORD_DIR` environment variable
- See [Recording Documentation](recording.md) for full details

---

## stopRecording

Stop an active recording and finalize the asciicast file.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `recordingId` | string | Yes | The recording ID returned by `startRecording` |

### Returns

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"recordingId\": \"63f64b587bd8817a\",\n  \"path\": \"/path/to/recording.cast\",\n  \"durationMs\": 62186,\n  \"bytesWritten\": 11752,\n  \"saved\": true,\n  \"mode\": \"always\"\n}"
    }
  ]
}
```

### Example

**Request:**
```json
{
  "name": "stopRecording",
  "arguments": {
    "recordingId": "63f64b587bd8817a"
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"recordingId\": \"63f64b587bd8817a\",\n  \"path\": \"/Users/you/.local/state/terminal-mcp/recordings/terminal-1769449938208-63f64b587bd8817a.cast\",\n  \"durationMs\": 62186,\n  \"bytesWritten\": 11752,\n  \"saved\": true,\n  \"mode\": \"always\"\n}"
    }
  ]
}
```

### Error Handling

If recording not found:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: Recording not found: invalid-id"
    }
  ],
  "isError": true
}
```

If recording already finalized:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: Recording already finalized: 63f64b587bd8817a"
    }
  ],
  "isError": true
}
```

### Notes

- The recording file is written to disk when `stopRecording` is called
- If `mode` is `on-failure`, the file is only saved if exit code is non-zero
- A metadata file (`.meta.json`) is also created alongside the recording
- See [Recording Documentation](recording.md) for full details

---

## Error Handling

All tools return errors in a consistent format:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: Description of what went wrong"
    }
  ],
  "isError": true
}
```

### Common Errors

| Error | Cause |
|-------|-------|
| `Terminal session has been disposed` | The terminal session was closed |
| `Unknown key: "..."` | Invalid key name passed to `sendKey` |
| `Unknown tool: "..."` | Tool name not recognized |

---

## Tool Workflow Examples

### Running a Command

```
1. type: {"text": "echo hello world"}
2. sendKey: {"key": "Enter"}
3. getContent: {}  // Read the output
```

### Navigating a TUI Application

```
1. type: {"text": "htop"}
2. sendKey: {"key": "Enter"}
3. takeScreenshot: {}  // See the interface
4. sendKey: {"key": "ArrowDown"}  // Navigate
5. sendKey: {"key": "F10"}  // Quit
```

### Interrupting a Running Process

```
1. type: {"text": "sleep 100"}
2. sendKey: {"key": "Enter"}
3. sendKey: {"key": "Ctrl+C"}  // Interrupt
4. getContent: {}  // Verify interrupted
```

### Recording a Session

```
1. startRecording: {}
   → Returns recordingId: "abc123"

2. type: {"text": "echo 'Demo recording'"}
3. sendKey: {"key": "Enter"}
4. getContent: {}

5. stopRecording: {"recordingId": "abc123"}
   → Recording saved to ~/.local/state/terminal-mcp/recordings/

6. Play with: asciinema play <path-to-recording.cast>
```
