# Tools Reference

Terminal MCP exposes five MCP tools for interacting with the terminal. This document provides complete API documentation for each tool.

## Overview

| Tool | Description |
|------|-------------|
| [`type`](#type) | Send text input to the terminal |
| [`sendKey`](#sendkey) | Send special keys and key combinations |
| [`getContent`](#getcontent) | Retrieve terminal buffer content |
| [`takeScreenshot`](#takescreenshot) | Capture terminal state with metadata |
| [`clear`](#clear) | Clear the terminal screen |

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

Capture the current terminal state including content, cursor position, and dimensions.

### Parameters

None.

### Returns

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"content\":\"...\",\"cursor\":{\"x\":0,\"y\":5},\"dimensions\":{\"cols\":120,\"rows\":40}}"
    }
  ]
}
```

The text content is a JSON string with the following structure:

| Field | Type | Description |
|-------|------|-------------|
| `content` | string | Visible terminal content |
| `cursor.x` | number | Cursor column position (0-indexed) |
| `cursor.y` | number | Cursor row position (0-indexed) |
| `dimensions.cols` | number | Terminal width in columns |
| `dimensions.rows` | number | Terminal height in rows |

### Example

**Request:**
```json
{
  "name": "takeScreenshot",
  "arguments": {}
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"content\": \"user@host:~$ █\",\n  \"cursor\": {\n    \"x\": 14,\n    \"y\": 0\n  },\n  \"dimensions\": {\n    \"cols\": 120,\n    \"rows\": 40\n  }\n}"
    }
  ]
}
```

### Use Cases

- Determine cursor position for navigation
- Verify terminal dimensions for TUI applications
- Get a structured snapshot of terminal state

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
