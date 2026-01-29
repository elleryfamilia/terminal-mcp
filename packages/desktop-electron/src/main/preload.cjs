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
  onMcpAttachmentChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("mcp:attachmentChanged", handler);
    return () => {
      ipcRenderer.removeListener("mcp:attachmentChanged", handler);
    };
  },

  // Sandbox mode
  setSandboxMode: (config) => ipcRenderer.invoke("terminal:setSandboxMode", config),
});
