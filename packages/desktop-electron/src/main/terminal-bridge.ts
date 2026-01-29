/**
 * Terminal Bridge
 *
 * Bridges the terminal-mcp core library with Electron's IPC system.
 * Runs terminal-mcp in-process (no subprocess needed since node-pty
 * works natively in Electron's main process).
 */

import { ipcMain, type BrowserWindow } from "electron";
import {
  TerminalManager,
  GUIOutputStream,
  SandboxController,
  type GuiMessageToFrontend,
  type ManagedSession,
  type SandboxPermissions,
} from "@ellery/terminal-mcp";

// Log for debugging
const debug = (msg: string, ...args: unknown[]) => {
  console.log(`[terminal-bridge] ${msg}`, ...args);
};

/**
 * Parse OSC (Operating System Command) escape sequences from terminal output.
 * These are used by shells to set window/tab titles.
 *
 * Format: ESC ] <code> ; <text> BEL  or  ESC ] <code> ; <text> ESC \
 * - OSC 0: Set icon name and window title
 * - OSC 1: Set icon name
 * - OSC 2: Set window title
 */
function parseOscTitle(data: string): string | null {
  // Match OSC 0, 1, or 2 sequences
  // ESC ] (0|1|2) ; <title> (BEL | ESC \)
  // \x1b = ESC, \x07 = BEL, \x1b\\ = ST (String Terminator)
  const oscRegex = /\x1b\]([012]);([^\x07\x1b]*?)(?:\x07|\x1b\\)/g;

  let lastTitle: string | null = null;
  let match;

  while ((match = oscRegex.exec(data)) !== null) {
    const code = match[1];
    const title = match[2];

    // OSC 0 and OSC 2 set the window title (OSC 1 is just icon name)
    if (code === '0' || code === '2') {
      lastTitle = title;
    }
  }

  return lastTitle;
}

/**
 * Extract the process/command name from an OSC title.
 * Shells typically set titles like "user@host: ~/path" or "vim file.txt" or "node index.js"
 * We want to extract the command/process part.
 */
function extractProcessFromTitle(title: string): string | null {
  if (!title || title.trim() === '') return null;

  // Common title formats:
  // 1. "command args" (e.g., "vim file.txt", "node index.js")
  // 2. "user@host: path" (e.g., "user@mac: ~/projects")
  // 3. "path — command" or "command — path" (some themes)
  // 4. Just the command name

  const trimmed = title.trim();

  // If it looks like "user@host: path" (shell prompt style), extract shell from context
  // This usually means we're at a prompt, not running a command
  if (/^[\w-]+@[\w.-]+:/.test(trimmed)) {
    return null; // Let it fall back to pty.process for the shell name
  }

  // If it contains " — " (em dash), common in some themes
  if (trimmed.includes(' — ')) {
    const parts = trimmed.split(' — ');
    // Usually the command is one of the parts
    for (const part of parts) {
      const word = part.trim().split(/\s+/)[0];
      if (word && !word.includes('@') && !word.includes('/')) {
        return word;
      }
    }
  }

  // Extract first word as the command
  const firstWord = trimmed.split(/\s+/)[0];

  // Skip if it looks like a path
  if (firstWord.startsWith('/') || firstWord.startsWith('~')) {
    return null;
  }

  // Skip if it looks like user@host
  if (firstWord.includes('@')) {
    return null;
  }

  return firstWord || null;
}

// Import type only to avoid circular dependency
import type { McpServer } from "./mcp-server.js";

// Sandbox configuration types
interface SandboxConfig {
  filesystem: {
    readWrite: string[];
    readOnly: string[];
    blocked: string[];
  };
  network: {
    mode: 'all' | 'none' | 'allowlist';
    allowedDomains?: string[];
  };
}

export class TerminalBridge {
  private manager: TerminalManager | null = null;
  private guiStream: GUIOutputStream;
  private window: BrowserWindow;
  private clientId: string | null = null;
  private disposed = false;

  // Track sessions for event forwarding
  private sessionEventHandlers: Map<string, { cleanup: () => void }> = new Map();

  // Callback for when manager is ready
  private managerReadyCallbacks: Array<(manager: TerminalManager) => void> = [];

  // MCP server reference for session attachment
  private mcpServer: McpServer | null = null;

  // Track if first session has been created (for auto-attach)
  private firstSessionCreated = false;

  // Sandbox mode configuration
  private sandboxConfig: SandboxConfig | null = null;
  private sandboxController: SandboxController | null = null;
  private useSandboxMode = false;

  constructor(window: BrowserWindow) {
    this.window = window;
    this.guiStream = new GUIOutputStream();

    // Set up IPC handlers
    this.setupIpcHandlers();

    // Set up GUI stream client that sends to renderer
    this.clientId = this.guiStream.addClient((message: GuiMessageToFrontend) => {
      if (!this.disposed && this.window && !this.window.isDestroyed()) {
        this.window.webContents.send("terminal:message", message);
      }
    });

    // Handle stream errors
    this.guiStream.on("error", (error) => {
      console.error("[terminal-bridge] Stream error:", error.message);
    });
  }

  /**
   * Set up IPC handlers for communication with the renderer process
   */
  private setupIpcHandlers(): void {
    // Create a new terminal session
    ipcMain.handle("terminal:create", async (_event, options?: {
      cols?: number;
      rows?: number;
      shell?: string;
      cwd?: string;
    }) => {
      debug("Creating terminal session with options:", options);
      try {
        // Create manager if not exists
        if (!this.manager) {
          debug("Creating new TerminalManager", {
            useSandboxMode: this.useSandboxMode,
            hasSandboxController: !!this.sandboxController,
          });
          this.manager = new TerminalManager({
            cols: options?.cols ?? 120,
            rows: options?.rows ?? 40,
            shell: options?.shell,
            cwd: options?.cwd,
            // Use native shell in Electron - no custom prompt, user's normal config
            nativeShell: true,
            // Pass sandbox controller if sandbox mode is enabled
            sandboxController: this.useSandboxMode ? this.sandboxController ?? undefined : undefined,
          });
          this.guiStream.attachManager(this.manager);

          // Notify listeners that manager is ready
          for (const callback of this.managerReadyCallbacks) {
            callback(this.manager);
          }
        }

        // Create a new session using multi-session API
        debug("Creating new session");
        const session = await this.manager.createSession({
          cols: options?.cols ?? 120,
          rows: options?.rows ?? 40,
          shell: options?.shell,
          cwd: options?.cwd,
        });
        debug("Session created:", session.id);

        // Set up event forwarding for this session
        this.setupSessionEvents(session);
        debug("Event forwarding set up for", session.id);

        // Auto-attach first session to MCP
        if (!this.firstSessionCreated && this.mcpServer) {
          debug("Auto-attaching first session to MCP:", session.id);
          this.mcpServer.attach(session.id);
          this.firstSessionCreated = true;
        }

        const dims = session.getDimensions();
        debug("Session ready:", session.id, dims);

        // In sandbox mode, clear the screen after shell initializes to hide startup warnings
        if (this.useSandboxMode) {
          setTimeout(() => {
            // Send clear command to hide sandbox startup warnings
            session.write('clear\n');
          }, 300); // Give shell time to initialize
        }

        return {
          success: true,
          sessionId: session.id,
          cols: dims.cols,
          rows: dims.rows,
        };
      } catch (error) {
        console.error("[terminal-bridge] Failed to create session:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // Send input to terminal
    ipcMain.handle("terminal:input", (_event, sessionId: string, data: string) => {
      if (!this.manager) return { success: false, error: "No manager" };

      const session = this.manager.getSessionById(sessionId);
      if (!session || !session.isActive()) {
        return { success: false, error: `Session not found: ${sessionId}` };
      }

      session.write(data);
      return { success: true };
    });

    // Resize terminal
    ipcMain.handle("terminal:resize", (_event, sessionId: string, cols: number, rows: number) => {
      if (!this.manager) return { success: false, error: "No manager" };

      const session = this.manager.getSessionById(sessionId);
      if (!session || !session.isActive()) {
        return { success: false, error: `Session not found: ${sessionId}` };
      }

      session.resize(cols, rows);
      return { success: true };
    });

    // Get terminal content
    ipcMain.handle("terminal:getContent", (_event, sessionId: string) => {
      if (!this.manager) return { success: false, error: "No manager" };

      const session = this.manager.getSessionById(sessionId);
      if (!session) {
        return { success: false, error: `Session not found: ${sessionId}` };
      }

      const screenshot = session.takeScreenshot();
      return {
        success: true,
        content: screenshot.content,
        cursor: screenshot.cursor,
        dimensions: screenshot.dimensions,
      };
    });

    // Close terminal session
    ipcMain.handle("terminal:close", (_event, sessionId: string) => {
      if (!this.manager) return { success: false, error: "No manager" };

      // Clean up event handlers
      const handlers = this.sessionEventHandlers.get(sessionId);
      if (handlers) {
        handlers.cleanup();
        this.sessionEventHandlers.delete(sessionId);
      }

      // Notify MCP server of session close (may trigger auto-reattach)
      if (this.mcpServer) {
        this.mcpServer.handleSessionClose(sessionId);
      }

      const closed = this.manager.closeSession(sessionId);
      return { success: closed, error: closed ? undefined : `Session not found: ${sessionId}` };
    });

    // Check if session is active
    ipcMain.handle("terminal:isActive", (_event, sessionId: string) => {
      if (!this.manager) return false;
      const session = this.manager.getSessionById(sessionId);
      return session?.isActive() ?? false;
    });

    // List all active sessions
    ipcMain.handle("terminal:list", (_event) => {
      if (!this.manager) return { sessions: [] };
      return { sessions: this.manager.getSessionIds() };
    });

    // Get the current foreground process for a session
    ipcMain.handle("terminal:getProcess", (_event, sessionId: string) => {
      if (!this.manager) return { success: false, error: "No manager" };

      const session = this.manager.getSessionById(sessionId);
      if (!session) {
        return { success: false, error: `Session not found: ${sessionId}` };
      }

      try {
        // Use the getProcess() method we added to TerminalSession
        const processName = session.getProcess();
        return {
          success: true,
          process: processName,
        };
      } catch {
        return { success: true, process: "shell" };
      }
    });

    // Set sandbox mode configuration
    ipcMain.handle("terminal:setSandboxMode", async (_event, config: SandboxConfig) => {
      debug("Setting sandbox mode with config:", config);
      this.sandboxConfig = config;
      this.useSandboxMode = true;

      // Convert SandboxConfig to SandboxPermissions format
      const permissions: SandboxPermissions = {
        filesystem: {
          readWrite: config.filesystem.readWrite,
          readOnly: config.filesystem.readOnly,
          blocked: config.filesystem.blocked,
        },
        network: {
          mode: config.network.mode,
          allowedDomains: config.network.allowedDomains,
        },
      };

      // Create and initialize sandbox controller
      this.sandboxController = new SandboxController();
      const status = await this.sandboxController.initialize(permissions);

      debug("Sandbox initialization status:", status);

      if (!status.enabled) {
        console.warn("[terminal-bridge] Sandbox not enabled:", status.reason);
        return {
          success: false,
          error: status.reason || "Failed to initialize sandbox",
        };
      }

      return { success: true };
    });
  }

  /**
   * Set up event forwarding for a session
   */
  private setupSessionEvents(session: ManagedSession): void {
    const sessionId = session.id;
    let lastProcessName = session.getProcess();
    let lastOscTitle: string | null = null;
    let processCheckTimeout: ReturnType<typeof setTimeout> | null = null;

    // Forward output and detect process changes via OSC sequences
    session.onData((data) => {
      if (!this.disposed && this.window && !this.window.isDestroyed()) {
        this.window.webContents.send("terminal:message", {
          type: "output",
          sessionId,
          data: Buffer.from(data).toString("base64"),
        });

        // Check for OSC title sequences (shells emit these to set window title)
        const oscTitle = parseOscTitle(data);
        if (oscTitle !== null && oscTitle !== lastOscTitle) {
          lastOscTitle = oscTitle;

          // Try to extract process name from OSC title
          const processFromTitle = extractProcessFromTitle(oscTitle);

          if (processFromTitle && processFromTitle !== lastProcessName) {
            lastProcessName = processFromTitle;
            this.window.webContents.send("terminal:message", {
              type: "process-changed",
              sessionId,
              process: processFromTitle,
            });
          } else if (!processFromTitle) {
            // OSC title didn't contain a clear process name (e.g., user@host:path)
            // Fall back to pty.process check
            if (processCheckTimeout) {
              clearTimeout(processCheckTimeout);
            }
            processCheckTimeout = setTimeout(() => {
              try {
                const currentProcess = session.getProcess();
                if (currentProcess !== lastProcessName) {
                  lastProcessName = currentProcess;
                  this.window.webContents.send("terminal:message", {
                    type: "process-changed",
                    sessionId,
                    process: currentProcess,
                  });
                }
              } catch {
                // Session may have been disposed
              }
            }, 50);
          }
        } else if (oscTitle === null) {
          // No OSC sequence in this output chunk - debounced fallback check
          // This catches cases where the shell doesn't set OSC titles
          if (processCheckTimeout) {
            clearTimeout(processCheckTimeout);
          }
          processCheckTimeout = setTimeout(() => {
            try {
              const currentProcess = session.getProcess();
              if (currentProcess !== lastProcessName) {
                lastProcessName = currentProcess;
                this.window.webContents.send("terminal:message", {
                  type: "process-changed",
                  sessionId,
                  process: currentProcess,
                });
              }
            } catch {
              // Session may have been disposed
            }
          }, 100);
        }
      }
    });

    // Forward exit
    session.onExit((code) => {
      if (!this.disposed && this.window && !this.window.isDestroyed()) {
        this.window.webContents.send("terminal:message", {
          type: "session-closed",
          sessionId,
          exitCode: code,
        });
      }
      this.sessionEventHandlers.delete(sessionId);

      // Notify MCP server of session close (may trigger auto-reattach)
      if (this.mcpServer) {
        this.mcpServer.handleSessionClose(sessionId);
      }
    });

    // Forward resize
    session.onResize((cols, rows) => {
      if (!this.disposed && this.window && !this.window.isDestroyed()) {
        this.window.webContents.send("terminal:message", {
          type: "resize",
          sessionId,
          cols,
          rows,
        });
      }
    });

    // Store cleanup function (for when session is manually closed)
    this.sessionEventHandlers.set(sessionId, {
      cleanup: () => {
        // Session event handlers are automatically cleaned up when session is disposed
      },
    });
  }

  /**
   * Register callback for when manager is ready
   */
  onManagerReady(callback: (manager: TerminalManager) => void): void {
    if (this.manager) {
      // Manager already exists, call immediately
      callback(this.manager);
    } else {
      this.managerReadyCallbacks.push(callback);
    }
  }

  /**
   * Get the terminal manager (if ready)
   */
  getManager(): TerminalManager | null {
    return this.manager;
  }

  /**
   * Set the MCP server reference (for session attachment coordination)
   */
  setMcpServer(mcpServer: McpServer): void {
    this.mcpServer = mcpServer;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.disposed = true;

    // Remove IPC handlers
    ipcMain.removeHandler("terminal:create");
    ipcMain.removeHandler("terminal:input");
    ipcMain.removeHandler("terminal:resize");
    ipcMain.removeHandler("terminal:getContent");
    ipcMain.removeHandler("terminal:close");
    ipcMain.removeHandler("terminal:isActive");
    ipcMain.removeHandler("terminal:getProcess");

    // Clean up GUI stream
    if (this.clientId) {
      this.guiStream.removeClient(this.clientId);
    }
    this.guiStream.dispose();

    // Clean up manager
    if (this.manager) {
      this.manager.dispose();
      this.manager = null;
    }

    // Clean up sandbox controller
    if (this.sandboxController) {
      this.sandboxController.cleanup().catch(console.error);
      this.sandboxController = null;
    }
  }
}
