/**
 * Electron Main Process
 *
 * Entry point for the Terminal MCP desktop application.
 * Manages window creation and terminal bridge lifecycle.
 */

import { app, BrowserWindow, ipcMain, shell } from "electron";
import * as path from "path";
import { fileURLToPath } from "url";
import { TerminalBridge } from "./terminal-bridge.js";
import { McpServer } from "./mcp-server.js";
import { createMenu } from "./menu.js";
import { getWindowState, trackWindowState } from "./window-state.js";
import { initSettingsHandlers, getSettings } from "./settings-store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set app name for menu bar (productName in build config only applies when packaged)
app.setName("Clutch Little Interface");

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let terminalBridge: TerminalBridge | null = null;
let mcpServer: McpServer | null = null;

// Development mode check - only use dev server if explicitly set
// When running `npm run start`, we use built files
// When running `npm run dev`, we use Vite dev server
const isDev = process.env.ELECTRON_DEV === "true";

async function createWindow() {
  // Get saved window state
  const windowState = getWindowState();

  // Get saved settings for theme-based background color
  const settings = getSettings();
  // Map theme to background color (matching themes.ts)
  const themeBackgrounds: Record<string, string> = {
    'default-dark': '#1e1e1e',
    'catppuccin-mocha': '#1e1e2e',
    'catppuccin-latte': '#eff1f5',
    'dracula': '#282a36',
    'nord': '#2e3440',
    'one-dark': '#282c34',
    'solarized-dark': '#002b36',
    'solarized-light': '#fdf6e3',
    'aranaverse': '#0d0d1a',
  };
  const backgroundColor = themeBackgrounds[settings.appearance.theme] || '#1e1e1e';

  mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 600,
    minHeight: 400,
    backgroundColor,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for node-pty in main process
    },
  });

  // Track window state changes for persistence
  trackWindowState(mainWindow);

  // Create terminal bridge
  terminalBridge = new TerminalBridge(mainWindow);

  // Create and start MCP server for AI assistant connections
  mcpServer = new McpServer(mainWindow);
  mcpServer.start();

  // Link terminal bridge to MCP server for session attachment coordination
  terminalBridge.setMcpServer(mcpServer);

  // Link MCP server to terminal bridge's manager (after first session is created)
  // This is done via the terminal bridge getter
  terminalBridge.onManagerReady((manager) => {
    mcpServer?.setManager(manager);
  });

  // Set up application menu
  createMenu(mainWindow);

  // Load the renderer
  if (isDev) {
    // In development, load from Vite dev server
    await mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built files
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (terminalBridge) {
      terminalBridge.dispose();
      terminalBridge = null;
    }
    if (mcpServer) {
      mcpServer.dispose();
      mcpServer = null;
    }
  });

  // Handle window resize
  mainWindow.on("resize", () => {
    mainWindow?.webContents.send("window:resize");
  });
}

// App lifecycle
app.whenReady().then(async () => {
  // Initialize settings IPC handlers
  initSettingsHandlers();

  // IPC handler for creating new windows
  ipcMain.handle("window:create", async () => {
    await createWindow();
    return { success: true };
  });

  await createWindow();

  app.on("activate", async () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
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
  if (terminalBridge) {
    terminalBridge.dispose();
  }
});

// Handle IPC messages from renderer
// These are set up in terminal-bridge.ts

// Export for testing
export { createWindow };
