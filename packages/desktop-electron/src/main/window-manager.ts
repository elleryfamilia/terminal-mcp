/**
 * Window Manager
 *
 * Manages multiple window instances for the application.
 * Each window has its own TerminalBridge, but MCP is app-scoped.
 */

import { app, BrowserWindow, type WebContents } from "electron";
import * as path from "path";
import { fileURLToPath } from "url";
import { TerminalBridge } from "./terminal-bridge.js";
import { McpServer } from "./mcp-server.js";
import { getWindowState, trackWindowState } from "./window-state.js";
import { getSettings } from "./settings-store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Development mode check
const isDev = process.env.ELECTRON_DEV === "true";

// Theme to background color mapping (matching themes.ts)
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

/**
 * A managed window with its associated terminal bridge
 */
export interface ManagedWindow {
  window: BrowserWindow;
  bridge: TerminalBridge;
}

/**
 * WindowManager handles the lifecycle of multiple application windows.
 * Each window gets its own TerminalBridge, but there's a single global McpServer.
 */
export class WindowManager {
  private windows: Map<number, ManagedWindow> = new Map();
  private mcpServer: McpServer | null = null;
  private disposed = false;

  /**
   * Create a new application window with its own terminal bridge
   */
  async createWindow(): Promise<BrowserWindow> {
    // Get saved window state (for first window) or offset for subsequent windows
    const windowState = getWindowState();
    const existingCount = this.windows.size;

    // Offset subsequent windows
    const offsetX = existingCount * 30;
    const offsetY = existingCount * 30;

    // Get saved settings for theme-based background color
    const settings = getSettings();
    const backgroundColor = themeBackgrounds[settings.appearance.theme] || '#1e1e1e';

    const window = new BrowserWindow({
      x: windowState.x !== undefined ? windowState.x + offsetX : undefined,
      y: windowState.y !== undefined ? windowState.y + offsetY : undefined,
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

    // Track window state changes for persistence (only first window saves state)
    if (existingCount === 0) {
      trackWindowState(window);
    }

    // Create terminal bridge for this window
    const bridge = new TerminalBridge(window);

    // Store the managed window
    const windowId = window.id;
    this.windows.set(windowId, { window, bridge });

    // Initialize MCP server on first window
    if (!this.mcpServer) {
      this.mcpServer = new McpServer(this);
      this.mcpServer.start();
    }

    // Link terminal bridge to MCP server (for auto-attach on first session)
    bridge.setMcpServer(this.mcpServer);

    // Load the renderer with isFirstWindow flag
    const isFirstWindow = existingCount === 0;
    if (isDev) {
      await window.loadURL(`http://localhost:5173?isFirstWindow=${isFirstWindow}`);
      window.webContents.openDevTools();
    } else {
      await window.loadFile(path.join(__dirname, "../renderer/index.html"), {
        query: { isFirstWindow: String(isFirstWindow) },
      });
    }

    // Handle window close
    window.on("closed", () => {
      this.handleWindowClosed(windowId);
    });

    // Handle window resize
    window.on("resize", () => {
      window.webContents.send("window:resize");
    });

    return window;
  }

  /**
   * Handle a window being closed
   */
  private handleWindowClosed(windowId: number): void {
    const managed = this.windows.get(windowId);
    if (managed) {
      managed.bridge.dispose();
      this.windows.delete(windowId);
    }

    // If all windows are closed on non-macOS, dispose MCP server
    // (macOS keeps app running until explicit quit)
    if (this.windows.size === 0 && process.platform !== "darwin") {
      this.disposeMcpServer();
    }
  }

  /**
   * Find the terminal bridge for a specific WebContents
   */
  getBridge(webContents: WebContents): TerminalBridge | null {
    // Find the window that contains this webContents
    const window = BrowserWindow.fromWebContents(webContents);
    if (!window) return null;

    const managed = this.windows.get(window.id);
    return managed?.bridge ?? null;
  }

  /**
   * Get all managed windows
   */
  getAllWindows(): ManagedWindow[] {
    return Array.from(this.windows.values());
  }

  /**
   * Get the MCP server instance
   */
  getMcpServer(): McpServer | null {
    return this.mcpServer;
  }

  /**
   * Broadcast a message to all windows
   */
  broadcast(channel: string, ...args: unknown[]): void {
    for (const managed of this.windows.values()) {
      if (!managed.window.isDestroyed()) {
        managed.window.webContents.send(channel, ...args);
      }
    }
  }

  /**
   * Get the number of open windows
   */
  getWindowCount(): number {
    return this.windows.size;
  }

  /**
   * Dispose of the MCP server
   */
  private disposeMcpServer(): void {
    if (this.mcpServer) {
      this.mcpServer.dispose();
      this.mcpServer = null;
    }
  }

  /**
   * Clean up all resources
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Dispose all bridges
    for (const managed of this.windows.values()) {
      managed.bridge.dispose();
    }
    this.windows.clear();

    // Dispose MCP server
    this.disposeMcpServer();
  }
}
