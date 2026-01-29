/**
 * Application Menu
 *
 * Defines the native menu bar for the application.
 */

import { app, Menu, shell, type BrowserWindow, type MenuItemConstructorOptions } from "electron";

const isMac = process.platform === "darwin";

export function createMenu(window: BrowserWindow): void {
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
                click: () => {
                  window.webContents.send("menu:preferences");
                },
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
          label: "New Terminal",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            window.webContents.send("menu:newTerminal");
          },
        },
        {
          label: "New Window",
          accelerator: "CmdOrCtrl+Shift+N",
          click: () => {
            // TODO: Create new window
          },
        },
        { type: "separator" },
        {
          label: "Close Terminal",
          accelerator: "CmdOrCtrl+W",
          click: () => {
            window.webContents.send("menu:closeTerminal");
          },
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
          click: () => {
            window.webContents.send("menu:clearTerminal");
          },
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
          click: () => {
            window.webContents.send("menu:commandPalette");
          },
        },
        { type: "separator" },
        {
          label: "Start Recording",
          click: () => {
            window.webContents.send("menu:startRecording");
          },
        },
        {
          label: "Stop Recording",
          click: () => {
            window.webContents.send("menu:stopRecording");
          },
        },
        { type: "separator" },
        {
          label: "Scroll to Top",
          accelerator: "CmdOrCtrl+Home",
          click: () => {
            window.webContents.send("menu:scrollToTop");
          },
        },
        {
          label: "Scroll to Bottom",
          accelerator: "CmdOrCtrl+End",
          click: () => {
            window.webContents.send("menu:scrollToBottom");
          },
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
          label: "About Terminal MCP",
          click: () => {
            window.webContents.send("menu:about");
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
