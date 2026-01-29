export { SocketTransport, createSocketServer, createToolProxyServer } from "./socket.js";

// GUI streaming support
export { GUIOutputStream, createGUIOutputStream } from "./gui-stream.js";
export type { GuiClientCallback, GUIOutputStreamEvents } from "./gui-stream.js";

// GUI protocol types
export {
  encodeData,
  decodeData,
  isGuiMessageToBackend,
  isGuiMessageToFrontend,
} from "./gui-protocol.js";
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
} from "./gui-protocol.js";
