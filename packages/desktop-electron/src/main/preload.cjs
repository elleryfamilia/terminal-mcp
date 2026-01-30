/**
 * Preload Script (CommonJS)
 *
 * Exposes a secure API to the renderer process via contextBridge.
 * This script runs in a sandboxed context with access to Node.js APIs
 * but exposes only specific, safe functionality to the renderer.
 */

const { contextBridge, ipcRenderer } = require("electron");

// Expose the API to the renderer
contextBridge.exposeInMainWorld("terminalAPI", {
  // Session management
  createSession: (options) => ipcRenderer.invoke("terminal:create", options),
  closeSession: (sessionId) => ipcRenderer.invoke("terminal:close", sessionId),
  isActive: (sessionId) => ipcRenderer.invoke("terminal:isActive", sessionId),
  listSessions: () => ipcRenderer.invoke("terminal:list"),

  // Terminal I/O
  input: (sessionId, data) => ipcRenderer.invoke("terminal:input", sessionId, data),
  resize: (sessionId, cols, rows) => ipcRenderer.invoke("terminal:resize", sessionId, cols, rows),
  getContent: (sessionId) => ipcRenderer.invoke("terminal:getContent", sessionId),
  getProcess: (sessionId) => ipcRenderer.invoke("terminal:getProcess", sessionId),

  // Event listeners
  onMessage: (callback) => {
    const handler = (_event, message) => callback(message);
    ipcRenderer.on("terminal:message", handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener("terminal:message", handler);
    };
  },

  onWindowResize: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("window:resize", handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener("window:resize", handler);
    };
  },

  // MCP server status
  mcpGetStatus: () => ipcRenderer.invoke("mcp:getStatus"),
  mcpStart: () => ipcRenderer.invoke("mcp:start"),
  mcpStop: () => ipcRenderer.invoke("mcp:stop"),
  onMcpStatusChanged: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on("mcp:statusChanged", handler);
    return () => {
      ipcRenderer.removeListener("mcp:statusChanged", handler);
    };
  },

  // MCP session attachment
  mcpAttach: (sessionId) => ipcRenderer.invoke("mcp:attach", sessionId),
  mcpDetach: () => ipcRenderer.invoke("mcp:detach"),
  mcpGetAttached: () => ipcRenderer.invoke("mcp:getAttached"),
  mcpGetClients: () => ipcRenderer.invoke("mcp:getClients"),
  onMcpAttachmentChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("mcp:attachmentChanged", handler);
    return () => {
      ipcRenderer.removeListener("mcp:attachmentChanged", handler);
    };
  },
  onMcpToolCallStarted: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("mcp:toolCallStarted", handler);
    return () => {
      ipcRenderer.removeListener("mcp:toolCallStarted", handler);
    };
  },
  onMcpToolCallCompleted: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("mcp:toolCallCompleted", handler);
    return () => {
      ipcRenderer.removeListener("mcp:toolCallCompleted", handler);
    };
  },
  onMcpClientConnected: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("mcp:clientConnected", handler);
    return () => {
      ipcRenderer.removeListener("mcp:clientConnected", handler);
    };
  },
  onMcpClientDisconnected: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("mcp:clientDisconnected", handler);
    return () => {
      ipcRenderer.removeListener("mcp:clientDisconnected", handler);
    };
  },
  mcpDisconnectClient: (clientId) => ipcRenderer.invoke("mcp:disconnectClient", clientId),

  // Sandbox mode
  setSandboxMode: (config) => ipcRenderer.invoke("terminal:setSandboxMode", config),

  // Recording
  startRecording: (sessionId) => ipcRenderer.invoke("terminal:startRecording", sessionId),
  stopRecording: (sessionId) => ipcRenderer.invoke("terminal:stopRecording", sessionId),
  getRecordingStatus: (sessionId) => ipcRenderer.invoke("terminal:getRecordingStatus", sessionId),
  onRecordingChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("terminal:recordingChanged", handler);
    return () => {
      ipcRenderer.removeListener("terminal:recordingChanged", handler);
    };
  },

  // Recording management
  recordingsOpenFolder: (filePath) => ipcRenderer.invoke("recordings:openFolder", filePath),
  recordingsList: () => ipcRenderer.invoke("recordings:list"),
  recordingsDelete: (filePath) => ipcRenderer.invoke("recordings:delete", filePath),
  recordingsGetDir: () => ipcRenderer.invoke("recordings:getDir"),

  // Settings
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (updates) => ipcRenderer.invoke("settings:update", updates),
  resetSettings: () => ipcRenderer.invoke("settings:reset"),
  setWindowOpacity: (opacity) => ipcRenderer.invoke("settings:setWindowOpacity", opacity),
  onSettingsChanged: (callback) => {
    const handler = (_event, settings) => callback(settings);
    ipcRenderer.on("settings:changed", handler);
    return () => {
      ipcRenderer.removeListener("settings:changed", handler);
    };
  },

  // Menu events
  onMenuPreferences: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("menu:preferences", handler);
    return () => {
      ipcRenderer.removeListener("menu:preferences", handler);
    };
  },

  // Window management
  createWindow: () => ipcRenderer.invoke("window:create"),
});
