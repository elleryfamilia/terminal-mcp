/**
 * Preload Script
 *
 * Exposes a secure API to the renderer process via contextBridge.
 * This script runs in a sandboxed context with access to Node.js APIs
 * but exposes only specific, safe functionality to the renderer.
 */

import { contextBridge, ipcRenderer, webUtils } from "electron";

// Type definitions for the exposed API
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

  // Event listeners
  onMessage: (callback: (message: unknown) => void) => () => void;
  onWindowResize: (callback: () => void) => () => void;

  // Shell utilities
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;

  // File utilities
  getPathForFile: (file: File) => string;
}

// Expose the API to the renderer
contextBridge.exposeInMainWorld("terminalAPI", {
  // Session management
  createSession: (options) => ipcRenderer.invoke("terminal:create", options),
  closeSession: (sessionId) => ipcRenderer.invoke("terminal:close", sessionId),
  isActive: (sessionId) => ipcRenderer.invoke("terminal:isActive", sessionId),

  // Terminal I/O
  input: (sessionId, data) => ipcRenderer.invoke("terminal:input", sessionId, data),
  resize: (sessionId, cols, rows) => ipcRenderer.invoke("terminal:resize", sessionId, cols, rows),
  getContent: (sessionId) => ipcRenderer.invoke("terminal:getContent", sessionId),

  // Event listeners
  onMessage: (callback: (message: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, message: unknown) => callback(message);
    ipcRenderer.on("terminal:message", handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener("terminal:message", handler);
    };
  },

  onWindowResize: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("window:resize", handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener("window:resize", handler);
    };
  },

  // Shell utilities
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),

  // File utilities
  getPathForFile: (file) => webUtils.getPathForFile(file),
} satisfies TerminalAPI);

// Type augmentation for the window object
declare global {
  interface Window {
    terminalAPI: TerminalAPI;
  }
}
