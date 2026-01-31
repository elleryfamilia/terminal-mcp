/**
 * Electron Main Process
 *
 * Entry point for the Terminal MCP desktop application.
 * Manages window lifecycle through WindowManager.
 *
 * Architecture:
 * - WindowManager: Manages multiple windows, each with its own TerminalBridge
 * - McpServer: App-scoped singleton, shared across all windows
 * - IPC handlers: Registered once at app level, dispatch to appropriate bridge
 */

import { app, BrowserWindow, ipcMain, shell } from "electron";
import { WindowManager } from "./window-manager.js";
import { createMenu } from "./menu.js";
import { initSettingsHandlers } from "./settings-store.js";

// Set app name for menu bar (productName in build config only applies when packaged)
app.setName("Clutch Little Interface");

// Global window manager
let windowManager: WindowManager | null = null;

/**
 * Register all IPC handlers for terminal operations.
 * These are registered once at app startup and dispatch to the appropriate
 * TerminalBridge based on the event sender's window.
 */
function registerIpcHandlers(wm: WindowManager): void {
  // ==========================================
  // Terminal IPC handlers (window-scoped)
  // ==========================================

  ipcMain.handle("terminal:create", async (event, options) => {
    const bridge = wm.getBridge(event.sender);
    if (!bridge) return { success: false, error: "Window not found" };
    return bridge.createSession(options);
  });

  ipcMain.handle("terminal:input", (event, sessionId: string, data: string) => {
    const bridge = wm.getBridge(event.sender);
    if (!bridge) return { success: false, error: "Window not found" };
    return bridge.input(sessionId, data);
  });

  ipcMain.handle("terminal:resize", (event, sessionId: string, cols: number, rows: number) => {
    const bridge = wm.getBridge(event.sender);
    if (!bridge) return { success: false, error: "Window not found" };
    return bridge.resize(sessionId, cols, rows);
  });

  ipcMain.handle("terminal:getContent", (event, sessionId: string) => {
    const bridge = wm.getBridge(event.sender);
    if (!bridge) return { success: false, error: "Window not found" };
    return bridge.getContent(sessionId);
  });

  ipcMain.handle("terminal:close", (event, sessionId: string) => {
    const bridge = wm.getBridge(event.sender);
    if (!bridge) return { success: false, error: "Window not found" };
    return bridge.closeSession(sessionId);
  });

  ipcMain.handle("terminal:isActive", (event, sessionId: string) => {
    const bridge = wm.getBridge(event.sender);
    if (!bridge) return false;
    return bridge.isActive(sessionId);
  });

  ipcMain.handle("terminal:list", (event) => {
    const bridge = wm.getBridge(event.sender);
    if (!bridge) return { sessions: [] };
    return bridge.listSessions();
  });

  ipcMain.handle("terminal:getProcess", (event, sessionId: string) => {
    const bridge = wm.getBridge(event.sender);
    if (!bridge) return { success: false, error: "Window not found" };
    return bridge.getProcess(sessionId);
  });

  ipcMain.handle("terminal:setSandboxMode", async (event, config) => {
    const bridge = wm.getBridge(event.sender);
    if (!bridge) return { success: false, error: "Window not found" };
    return bridge.setSandboxMode(config);
  });

  // ==========================================
  // Recording IPC handlers (window-scoped)
  // ==========================================

  ipcMain.handle("terminal:startRecording", async (event, sessionId: string) => {
    const bridge = wm.getBridge(event.sender);
    if (!bridge) return { success: false, error: "Window not found" };
    return bridge.startRecording(sessionId);
  });

  ipcMain.handle("terminal:stopRecording", async (event, sessionId: string, stopReason) => {
    const bridge = wm.getBridge(event.sender);
    if (!bridge) return { success: false, error: "Window not found" };
    return bridge.stopRecording(sessionId, stopReason);
  });

  ipcMain.handle("terminal:getRecordingStatus", (event, sessionId: string) => {
    const bridge = wm.getBridge(event.sender);
    if (!bridge) return { isRecording: false };
    return bridge.getRecordingStatus(sessionId);
  });

  ipcMain.handle("recordings:openFolder", async (event, filePath: string) => {
    const bridge = wm.getBridge(event.sender);
    if (!bridge) return { success: false };
    return bridge.openRecordingFolder(filePath);
  });

  ipcMain.handle("recordings:list", async (event) => {
    const bridge = wm.getBridge(event.sender);
    if (!bridge) return { recordings: [], outputDir: "" };
    return bridge.listRecordings();
  });

  ipcMain.handle("recordings:delete", async (event, filePath: string) => {
    const bridge = wm.getBridge(event.sender);
    if (!bridge) return { success: false, error: "Window not found" };
    return bridge.deleteRecording(filePath);
  });

  ipcMain.handle("recordings:getDir", async (event) => {
    const bridge = wm.getBridge(event.sender);
    if (!bridge) return { outputDir: "" };
    return { outputDir: bridge.getRecordingsDir() };
  });

  // ==========================================
  // Shell utilities (window-scoped)
  // ==========================================

  ipcMain.handle("shell:openExternal", async (event, url: string) => {
    const bridge = wm.getBridge(event.sender);
    if (!bridge) return { success: false, error: "Window not found" };
    return bridge.openExternal(url);
  });

  // ==========================================
  // MCP IPC handlers (app-scoped)
  // ==========================================

  ipcMain.handle("mcp:getStatus", () => {
    const mcpServer = wm.getMcpServer();
    return mcpServer?.getStatus() ?? { isRunning: false, clientCount: 0, socketPath: "" };
  });

  ipcMain.handle("mcp:start", () => {
    const mcpServer = wm.getMcpServer();
    mcpServer?.start();
    return mcpServer?.getStatus() ?? { isRunning: false, clientCount: 0, socketPath: "" };
  });

  ipcMain.handle("mcp:stop", () => {
    const mcpServer = wm.getMcpServer();
    mcpServer?.stop();
    return mcpServer?.getStatus() ?? { isRunning: false, clientCount: 0, socketPath: "" };
  });

  ipcMain.handle("mcp:attach", (_event, sessionId: string) => {
    const mcpServer = wm.getMcpServer();
    return mcpServer?.attach(sessionId) ?? false;
  });

  ipcMain.handle("mcp:detach", () => {
    const mcpServer = wm.getMcpServer();
    mcpServer?.detach();
    return true;
  });

  ipcMain.handle("mcp:getAttached", () => {
    const mcpServer = wm.getMcpServer();
    return mcpServer?.getAttachedSessionId() ?? null;
  });

  ipcMain.handle("mcp:getClients", () => {
    const mcpServer = wm.getMcpServer();
    return mcpServer?.getConnectedClients() ?? [];
  });

  ipcMain.handle("mcp:disconnectClient", (_event, clientId: string) => {
    const mcpServer = wm.getMcpServer();
    return mcpServer?.disconnectClient(clientId) ?? false;
  });

  // ==========================================
  // Window IPC handlers
  // ==========================================

  ipcMain.handle("window:create", async () => {
    await wm.createWindow();
    return { success: true };
  });
}

/**
 * Remove all IPC handlers (for cleanup)
 */
function removeIpcHandlers(): void {
  // Terminal handlers
  ipcMain.removeHandler("terminal:create");
  ipcMain.removeHandler("terminal:input");
  ipcMain.removeHandler("terminal:resize");
  ipcMain.removeHandler("terminal:getContent");
  ipcMain.removeHandler("terminal:close");
  ipcMain.removeHandler("terminal:isActive");
  ipcMain.removeHandler("terminal:list");
  ipcMain.removeHandler("terminal:getProcess");
  ipcMain.removeHandler("terminal:setSandboxMode");

  // Recording handlers
  ipcMain.removeHandler("terminal:startRecording");
  ipcMain.removeHandler("terminal:stopRecording");
  ipcMain.removeHandler("terminal:getRecordingStatus");
  ipcMain.removeHandler("recordings:openFolder");
  ipcMain.removeHandler("recordings:list");
  ipcMain.removeHandler("recordings:delete");
  ipcMain.removeHandler("recordings:getDir");

  // Shell handlers
  ipcMain.removeHandler("shell:openExternal");

  // MCP handlers
  ipcMain.removeHandler("mcp:getStatus");
  ipcMain.removeHandler("mcp:start");
  ipcMain.removeHandler("mcp:stop");
  ipcMain.removeHandler("mcp:attach");
  ipcMain.removeHandler("mcp:detach");
  ipcMain.removeHandler("mcp:getAttached");
  ipcMain.removeHandler("mcp:getClients");
  ipcMain.removeHandler("mcp:disconnectClient");

  // Window handlers
  ipcMain.removeHandler("window:create");
}

// App lifecycle
app.whenReady().then(async () => {
  // Initialize settings IPC handlers
  initSettingsHandlers();

  // Create window manager
  windowManager = new WindowManager();

  // Register all IPC handlers once at app startup
  registerIpcHandlers(windowManager);

  // Set up application menu (uses WindowManager for "New Window" and routing)
  createMenu(windowManager);

  // Create the first window
  await windowManager.createWindow();

  app.on("activate", async () => {
    // On macOS, re-create window when dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0 && windowManager) {
      await windowManager.createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // On macOS, keep app running until explicitly quit
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (windowManager) {
    windowManager.dispose();
    windowManager = null;
  }
  removeIpcHandlers();
});

// Export for testing
export { windowManager };
