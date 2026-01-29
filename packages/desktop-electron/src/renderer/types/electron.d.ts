/**
 * Type declarations for Electron preload API
 */

export interface SandboxConfig {
  filesystem: {
    readWrite: string[];
    readOnly: string[];
    blocked: string[];
  };
  network: {
    mode: 'all' | 'none' | 'allowlist';
    allowedDomains?: string[];
  };
}

export interface TerminalAPI {
  // Session management
  createSession: (options?: {
    cols?: number;
    rows?: number;
    shell?: string;
    cwd?: string;
  }) => Promise<{
    success: boolean;
    sessionId?: string;
    cols?: number;
    rows?: number;
    error?: string;
  }>;

  closeSession: (sessionId: string) => Promise<{ success: boolean; error?: string }>;

  isActive: (sessionId: string) => Promise<boolean>;

  listSessions: () => Promise<{ sessions: string[] }>;

  // Terminal I/O
  input: (sessionId: string, data: string) => Promise<{ success: boolean; error?: string }>;

  resize: (
    sessionId: string,
    cols: number,
    rows: number
  ) => Promise<{ success: boolean; error?: string }>;

  getContent: (sessionId: string) => Promise<{
    success: boolean;
    content?: string;
    cursor?: { x: number; y: number };
    dimensions?: { cols: number; rows: number };
    error?: string;
  }>;

  getProcess: (sessionId: string) => Promise<{
    success: boolean;
    process?: string;
    error?: string;
  }>;

  // Event listeners
  onMessage: (callback: (message: unknown) => void) => () => void;
  onWindowResize: (callback: () => void) => () => void;

  // MCP server
  mcpGetStatus: () => Promise<McpStatus>;
  mcpStart: () => Promise<McpStatus>;
  mcpStop: () => Promise<McpStatus>;
  onMcpStatusChanged: (callback: (status: McpStatus) => void) => () => void;

  // MCP session attachment
  mcpAttach: (sessionId: string) => Promise<boolean>;
  mcpDetach: () => Promise<boolean>;
  mcpGetAttached: () => Promise<string | null>;
  mcpGetClients: () => Promise<TrackedClient[]>;
  onMcpAttachmentChanged: (callback: (data: McpAttachmentChange) => void) => () => void;
  onMcpToolCallStarted: (callback: (data: McpToolCallStarted) => void) => () => void;
  onMcpToolCallCompleted: (callback: (data: McpToolCallCompleted) => void) => () => void;
  onMcpClientConnected: (callback: (data: McpClientConnected) => void) => () => void;
  onMcpClientDisconnected: (callback: (data: McpClientDisconnected) => void) => () => void;
  mcpDisconnectClient: (clientId: string) => Promise<boolean>;

  // Sandbox mode
  setSandboxMode: (config: SandboxConfig) => Promise<void>;

  // Recording
  startRecording: (
    sessionId: string
  ) => Promise<{ success: boolean; recordingId?: string; error?: string }>;
  stopRecording: (
    sessionId: string
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  getRecordingStatus: (
    sessionId: string
  ) => Promise<{ isRecording: boolean; recordingId?: string }>;
  onRecordingChanged: (callback: (data: RecordingChange) => void) => () => void;
}

export interface McpAttachmentChange {
  attachedSessionId: string | null;
  previousSessionId: string | null;
}

export interface RecordingChange {
  sessionId: string;
  isRecording: boolean;
  recordingId?: string;
  filePath?: string;
}

export interface McpStatus {
  isRunning: boolean;
  clientCount: number;
  socketPath: string;
}

// MCP Activity Events
export interface McpToolCallStarted {
  id: number;
  tool: string;
  args?: Record<string, unknown>;
  clientId: string;
  timestamp: number;
}

export interface McpToolCallCompleted {
  id: number;
  tool: string;
  success: boolean;
  duration: number;
  timestamp: number;
  clientId: string;
  error?: string;
}

export interface McpClientInfo {
  name: string;
  version: string;
  instanceId?: string;
}

export interface McpRuntimeInfo {
  hostApp?: string;
  platform?: string;
  arch?: string;
}

export interface McpClientConnected {
  clientId: string;
  clientInfo?: McpClientInfo;
  runtime?: McpRuntimeInfo;
  timestamp: number;
}

export interface McpClientDisconnected {
  clientId: string;
  timestamp: number;
}

export interface TrackedClient {
  clientId: string;
  clientInfo?: McpClientInfo;
  runtime?: McpRuntimeInfo;
  connectedAt: number;
}

declare global {
  interface Window {
    terminalAPI: TerminalAPI;
  }
}

export {};
