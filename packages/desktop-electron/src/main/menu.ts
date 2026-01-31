/**
 * Application Menu
 *
 * Defines the native menu bar for the application.
 */

import { app, BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from "electron";
import type { WindowManager } from "./window-manager.js";

const isMac = process.platform === "darwin";

/**
 * Get the currently focused window, or the first window if none focused
 */
function getActiveWindow(windowManager: WindowManager): BrowserWindow | null {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused) return focused;

  // Fall back to first window
  const windows = windowManager.getAllWindows();
  return windows.length > 0 ? windows[0].window : null;
}

export function createMenu(windowManager: WindowManager): void {
  // Helper to send to active window
  const sendToActive = (channel: string) => {
    const window = getActiveWindow(windowManager);
    if (window && !window.isDestroyed()) {
      window.webContents.send(channel);
    }
  };
  const template: MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              {
                label: "Preferences...",
                accelerator: "CmdOrCtrl+,",
                click: () => sendToActive("menu:preferences"),
              },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),

    // File menu
    {
      label: "File",
      submenu: [
        {
          label: "New Tab",
          accelerator: "CmdOrCtrl+T",
          click: () => sendToActive("menu:newTerminal"),
        },
        {
          label: "New Window",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            windowManager.createWindow();
          },
        },
        { type: "separator" },
        {
          label: "Close Tab",
          accelerator: "CmdOrCtrl+W",
          click: () => sendToActive("menu:closeTerminal"),
        },
        ...(isMac ? [] : [{ type: "separator" as const }, { role: "quit" as const }]),
      ],
    },

    // Edit menu
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
        { type: "separator" },
        {
          label: "Clear Terminal",
          accelerator: "CmdOrCtrl+K",
          click: () => sendToActive("menu:clearTerminal"),
        },
      ],
    },

    // View menu
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },

    // Terminal menu
    {
      label: "Terminal",
      submenu: [
        {
          label: "Run Command...",
          accelerator: "CmdOrCtrl+Shift+P",
          click: () => sendToActive("menu:commandPalette"),
        },
        { type: "separator" },
        {
          label: "Start Recording",
          click: () => sendToActive("menu:startRecording"),
        },
        {
          label: "Stop Recording",
          click: () => sendToActive("menu:stopRecording"),
        },
        { type: "separator" },
        {
          label: "Scroll to Top",
          accelerator: "CmdOrCtrl+Home",
          click: () => sendToActive("menu:scrollToTop"),
        },
        {
          label: "Scroll to Bottom",
          accelerator: "CmdOrCtrl+End",
          click: () => sendToActive("menu:scrollToBottom"),
        },
      ],
    },

    // Window menu
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [{ type: "separator" as const }, { role: "front" as const }]
          : [{ role: "close" as const }]),
      ],
    },

    // Help menu
    {
      label: "Help",
      submenu: [
        {
          label: "Documentation",
          click: async () => {
            await shell.openExternal("https://github.com/elleryfamilia/terminal-mcp#readme");
          },
        },
        {
          label: "Report Issue",
          click: async () => {
            await shell.openExternal("https://github.com/elleryfamilia/terminal-mcp/issues");
          },
        },
        { type: "separator" },
        {
          label: "About Clutch Little Interface",
          click: () => sendToActive("menu:about"),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
