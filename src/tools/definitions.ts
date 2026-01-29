/**
 * Shared tool definitions used by both MCP client and UI
 */

import { getAvailableKeys } from "../utils/keys.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Get all available keys for the enum
const availableKeys = getAvailableKeys();

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "type",
    description: "Type text into the terminal",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to type",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "sendKey",
    description:
      "Send a special key or key combination to the terminal. Keys are case-insensitive.",
    inputSchema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          enum: availableKeys,
          description:
            "The key to send. Common keys: Enter, Tab, Escape, Backspace, Delete, Space, Up/Down/Left/Right (arrows), Home, End, PageUp, PageDown, F1-F12. Modifiers: Ctrl+A-Z, Alt+0-9, Alt+A-Z, Shift/Ctrl/Alt+Arrow keys.",
        },
      },
      required: ["key"],
    },
  },
  {
    name: "getContent",
    description: "Get the current content of the terminal buffer",
    inputSchema: {
      type: "object",
      properties: {
        visibleOnly: {
          type: "boolean",
          description: "If true, only return visible content (default: false)",
        },
      },
    },
  },
  {
    name: "takeScreenshot",
    description:
      "Take a screenshot of the terminal showing current screen and cursor position",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "startRecording",
    description:
      "Start recording terminal output to an asciicast v2 file. Returns the recording ID and path where the file will be saved. Only one recording can be active at a time.",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["v2"],
          description: "Recording format (default: v2, asciicast v2 format)",
        },
        mode: {
          type: "string",
          enum: ["always", "on-failure"],
          description:
            "Recording mode: always saves the recording, on-failure only saves if session exits with non-zero code (default: always)",
        },
        outputDir: {
          type: "string",
          description:
            "Directory to save the recording (default: ~/.local/state/terminal-mcp/recordings, or TERMINAL_MCP_RECORD_DIR env var)",
        },
        idleTimeLimit: {
          type: "number",
          description:
            "Max seconds between events in the recording (default: 2). Caps idle time to prevent long pauses during playback.",
        },
        maxDuration: {
          type: "number",
          description:
            "Max recording duration in seconds (default: 3600 = 60 minutes). Recording will auto-stop when this limit is reached.",
        },
        inactivityTimeout: {
          type: "number",
          description:
            "Stop recording after N seconds of no terminal output (default: 600 = 10 minutes). Resets on each output event.",
        },
      },
    },
  },
  {
    name: "stopRecording",
    description:
      "Stop a recording and finalize the asciicast file. Returns metadata about the saved recording including the file path and duration.",
    inputSchema: {
      type: "object",
      properties: {
        recordingId: {
          type: "string",
          description: "The recording ID returned by startRecording",
        },
      },
      required: ["recordingId"],
    },
  },
];

/**
 * Get just the tool names as an array
 */
export function getToolNames(): string[] {
  return toolDefinitions.map((t) => t.name);
}
