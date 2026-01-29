/**
 * GUI Communication Protocol
 *
 * Defines the message types for communication between the terminal-mcp backend
 * and GUI frontends (Electron, web, etc.)
 *
 * Messages are JSON-encoded and sent over IPC (Electron) or Unix socket/WebSocket.
 * Binary data (terminal output/input) is base64 encoded for JSON transport.
 */

// ============================================================================
// Messages from GUI to Backend
// ============================================================================

/** Send user input (keystrokes) to a terminal session */
export interface GuiInputMessage {
  type: "input";
  sessionId: string;
  /** Base64-encoded input bytes */
  data: string;
}

/** Request creation of a new terminal session */
export interface GuiCreateSessionMessage {
  type: "create-session";
  /** Shell to use (e.g., "/bin/zsh"). If omitted, uses system default */
  shell?: string;
  /** Terminal width in columns */
  cols: number;
  /** Terminal height in rows */
  rows: number;
  /** Working directory. If omitted, uses current directory */
  cwd?: string;
  /** Additional environment variables */
  env?: Record<string, string>;
}

/** Request to close a terminal session */
export interface GuiCloseSessionMessage {
  type: "close-session";
  sessionId: string;
}

/** Request to resize a terminal session */
export interface GuiResizeMessage {
  type: "resize";
  sessionId: string;
  cols: number;
  rows: number;
}

/** Request to start recording a session */
export interface GuiStartRecordingMessage {
  type: "start-recording";
  sessionId: string;
  /** Optional filename override */
  filename?: string;
}

/** Request to stop recording a session */
export interface GuiStopRecordingMessage {
  type: "stop-recording";
  sessionId: string;
}

/** Request current terminal content (for initial sync) */
export interface GuiGetContentMessage {
  type: "get-content";
  sessionId: string;
}

/** Request list of active sessions */
export interface GuiListSessionsMessage {
  type: "list-sessions";
}

/** Union type of all messages from GUI to backend */
export type GuiMessageToBackend =
  | GuiInputMessage
  | GuiCreateSessionMessage
  | GuiCloseSessionMessage
  | GuiResizeMessage
  | GuiStartRecordingMessage
  | GuiStopRecordingMessage
  | GuiGetContentMessage
  | GuiListSessionsMessage;

// ============================================================================
// Messages from Backend to GUI
// ============================================================================

/** Raw terminal output data */
export interface BackendOutputMessage {
  type: "output";
  sessionId: string;
  /** Base64-encoded output bytes */
  data: string;
}

/** Notification that a new session was created */
export interface BackendSessionCreatedMessage {
  type: "session-created";
  sessionId: string;
  shell: string;
  cols: number;
  rows: number;
  cwd: string;
}

/** Notification that a session was closed */
export interface BackendSessionClosedMessage {
  type: "session-closed";
  sessionId: string;
  exitCode: number;
}

/** Notification that a session was resized */
export interface BackendResizeMessage {
  type: "resize";
  sessionId: string;
  cols: number;
  rows: number;
}

/** Notification that recording started */
export interface BackendRecordingStartedMessage {
  type: "recording-started";
  sessionId: string;
  filename: string;
}

/** Notification that recording stopped */
export interface BackendRecordingStoppedMessage {
  type: "recording-stopped";
  sessionId: string;
  filename: string;
  /** Whether the recording was saved (vs discarded due to mode) */
  saved: boolean;
}

/** Response to get-content request */
export interface BackendContentMessage {
  type: "content";
  sessionId: string;
  /** Full terminal buffer content */
  content: string;
  cursor: {
    x: number;
    y: number;
  };
  dimensions: {
    cols: number;
    rows: number;
  };
}

/** Response to list-sessions request */
export interface BackendSessionListMessage {
  type: "session-list";
  sessions: Array<{
    sessionId: string;
    shell: string;
    cols: number;
    rows: number;
    cwd: string;
    isRecording: boolean;
  }>;
}

/** Error response */
export interface BackendErrorMessage {
  type: "error";
  /** Original request type that caused the error */
  requestType: string;
  sessionId?: string;
  message: string;
  code?: string;
}

/** Union type of all messages from backend to GUI */
export type GuiMessageToFrontend =
  | BackendOutputMessage
  | BackendSessionCreatedMessage
  | BackendSessionClosedMessage
  | BackendResizeMessage
  | BackendRecordingStartedMessage
  | BackendRecordingStoppedMessage
  | BackendContentMessage
  | BackendSessionListMessage
  | BackendErrorMessage;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Encode a string to base64 for transport
 */
export function encodeData(data: string): string {
  return Buffer.from(data, "utf-8").toString("base64");
}

/**
 * Decode base64 data back to string
 */
export function decodeData(base64: string): string {
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Type guard for GUI messages to backend
 */
export function isGuiMessageToBackend(msg: unknown): msg is GuiMessageToBackend {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  if (typeof m.type !== "string") return false;

  const validTypes = [
    "input",
    "create-session",
    "close-session",
    "resize",
    "start-recording",
    "stop-recording",
    "get-content",
    "list-sessions",
  ];

  return validTypes.includes(m.type);
}

/**
 * Type guard for backend messages to GUI
 */
export function isGuiMessageToFrontend(msg: unknown): msg is GuiMessageToFrontend {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  if (typeof m.type !== "string") return false;

  const validTypes = [
    "output",
    "session-created",
    "session-closed",
    "resize",
    "recording-started",
    "recording-stopped",
    "content",
    "session-list",
    "error",
  ];

  return validTypes.includes(m.type);
}
