/**
 * Library Exports
 *
 * This file exports all public APIs for use as a library.
 * The main index.ts is the CLI entry point; this file is for programmatic usage.
 */

// Terminal management
export { TerminalSession, TerminalManager } from "./terminal/index.js";
export type {
  TerminalSessionOptions,
  ScreenshotResult,
  TerminalManagerOptions,
  CreateSessionOptions,
  ManagedSession,
} from "./terminal/index.js";

// Transport layer - GUI streaming
export {
  GUIOutputStream,
  createGUIOutputStream,
} from "./transport/index.js";
export type {
  GuiClientCallback,
  GUIOutputStreamEvents,
} from "./transport/index.js";

// GUI protocol types
export {
  encodeData,
  decodeData,
  isGuiMessageToBackend,
  isGuiMessageToFrontend,
} from "./transport/index.js";
export type {
  GuiMessageToBackend,
  GuiMessageToFrontend,
  GuiInputMessage,
  GuiCreateSessionMessage,
  GuiCloseSessionMessage,
  GuiResizeMessage,
  GuiStartRecordingMessage,
  GuiStopRecordingMessage,
  GuiGetContentMessage,
  GuiListSessionsMessage,
  BackendOutputMessage,
  BackendSessionCreatedMessage,
  BackendSessionClosedMessage,
  BackendResizeMessage,
  BackendRecordingStartedMessage,
  BackendRecordingStoppedMessage,
  BackendContentMessage,
  BackendSessionListMessage,
  BackendErrorMessage,
} from "./transport/index.js";

// Socket transport
export {
  SocketTransport,
  createSocketServer,
  createToolProxyServer,
} from "./transport/index.js";

// Recording
export { RecordingManager } from "./recording/index.js";
export type {
  RecordingMode,
  RecordingFormat,
  RecordingOptions,
  RecordingMetadata,
} from "./recording/index.js";

// Utilities
export { getDefaultShell, getDefaultSocketPath, getDefaultRecordDir } from "./utils/platform.js";
export { getKeySequence, KEY_SEQUENCES, getAvailableKeys } from "./utils/keys.js";

// Sandbox/Mode selection
export { promptForMode } from "./sandbox/mode-prompt.js";
export { promptForPermissions } from "./sandbox/prompt.js";
export { SandboxController, loadConfigFromFile, DEFAULT_PERMISSIONS } from "./sandbox/index.js";
export type { SandboxPermissions } from "./sandbox/index.js";

// MCP Client Info types
export {
  ClientInfoSchema,
  RuntimeInfoSchema,
  CapabilitiesSchema,
  SessionMetadataSchema,
  ObservabilitySchema,
  ExtendedClientInfoSchema,
  generateClientId,
} from "./types/mcp-client-info.js";
export type {
  ClientInfo,
  RuntimeInfo,
  Capabilities,
  SessionMetadata,
  Observability,
  ExtendedClientInfo,
  TrackedClient,
  SessionLogEntry,
  SessionConnectEntry,
  SessionDisconnectEntry,
  SessionToolCallEntry,
} from "./types/mcp-client-info.js";

// Session logging
export { SessionLogger } from "./utils/session-logger.js";
