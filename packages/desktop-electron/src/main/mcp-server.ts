/**
 * MCP Server Manager
 *
 * Creates a Unix socket server for MCP clients (AI assistants) to connect to.
 * Tracks connection state and exposes terminal tools.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Server as NetServer, Socket } from "net";
import { ipcMain, type BrowserWindow } from "electron";
import type { TerminalManager } from "@ellery/terminal-mcp";

// Tool handlers from terminal-mcp
import {
  getKeySequence,
} from "@ellery/terminal-mcp";

interface SocketRequest {
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface SocketResponse {
  id: number;
  result?: unknown;
  error?: { message: string };
}

// Get default socket path
function getDefaultSocketPath(): string {
  if (process.platform === "win32") {
    return "\\\\.\\pipe\\terminal-mcp-gui";
  }
  return path.join(os.tmpdir(), "terminal-mcp-gui.sock");
}

export class McpServer {
  private server: NetServer | null = null;
  private connectedClients: Set<Socket> = new Set();
  private window: BrowserWindow;
  private manager: TerminalManager | null = null;
  private socketPath: string;
  private attachedSessionId: string | null = null;

  constructor(window: BrowserWindow) {
    this.window = window;
    this.socketPath = getDefaultSocketPath();
    this.setupIpcHandlers();
  }

  /**
   * Attach MCP to a specific session
   */
  attach(sessionId: string): boolean {
    if (!this.manager) {
      console.log("[mcp-server] Cannot attach: no manager");
      return false;
    }

    const session = this.manager.getSessionById(sessionId);
    if (!session) {
      console.log(`[mcp-server] Cannot attach: session ${sessionId} not found`);
      return false;
    }

    const previousSessionId = this.attachedSessionId;
    this.attachedSessionId = sessionId;
    console.log(`[mcp-server] Attached to session: ${sessionId}`);

    // Notify renderer of attachment change
    this.notifyAttachmentChange(sessionId, previousSessionId);
    return true;
  }

  /**
   * Detach MCP from current session
   */
  detach(): void {
    const previousSessionId = this.attachedSessionId;
    this.attachedSessionId = null;
    console.log("[mcp-server] Detached from session");

    // Notify renderer of attachment change
    this.notifyAttachmentChange(null, previousSessionId);
  }

  /**
   * Get the currently attached session ID
   */
  getAttachedSessionId(): string | null {
    return this.attachedSessionId;
  }

  /**
   * Handle session close - if attached session closes, auto-attach to another
   */
  handleSessionClose(closedSessionId: string): void {
    if (this.attachedSessionId !== closedSessionId) {
      return;
    }

    console.log(`[mcp-server] Attached session ${closedSessionId} closed`);

    // Try to attach to another session
    if (this.manager) {
      const sessionIds = this.manager.getSessionIds();
      const remainingSessions = sessionIds.filter((id) => id !== closedSessionId);

      if (remainingSessions.length > 0) {
        this.attach(remainingSessions[0]);
      } else {
        this.detach();
      }
    } else {
      this.detach();
    }
  }

  /**
   * Set the terminal manager (called after manager is created)
   */
  setManager(manager: TerminalManager): void {
    this.manager = manager;
  }

  /**
   * Start the MCP socket server
   */
  start(): void {
    if (this.server) return;

    // Remove existing socket file
    try {
      fs.unlinkSync(this.socketPath);
    } catch {
      // Ignore if doesn't exist
    }

    this.server = new NetServer((socket) => {
      console.log("[mcp-server] Client connected");
      this.connectedClients.add(socket);
      this.notifyConnectionChange();

      let buffer = "";

      socket.on("data", async (data) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            try {
              const request = JSON.parse(line) as SocketRequest;
              const response = await this.handleRequest(request);
              socket.write(JSON.stringify(response) + "\n");
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              socket.write(
                JSON.stringify({
                  id: 0,
                  error: { message: `Parse error: ${errorMessage}` },
                }) + "\n"
              );
            }
          }
        }
      });

      socket.on("close", () => {
        console.log("[mcp-server] Client disconnected");
        this.connectedClients.delete(socket);
        this.notifyConnectionChange();
      });

      socket.on("error", () => {
        this.connectedClients.delete(socket);
        this.notifyConnectionChange();
      });
    });

    this.server.listen(this.socketPath, () => {
      console.log(`[mcp-server] Listening on ${this.socketPath}`);
    });

    this.server.on("error", (error) => {
      console.error("[mcp-server] Server error:", error);
    });
  }

  /**
   * Stop the MCP socket server
   */
  stop(): void {
    if (this.server) {
      // Close all client connections
      for (const client of this.connectedClients) {
        client.destroy();
      }
      this.connectedClients.clear();

      this.server.close();
      this.server = null;

      // Remove socket file
      try {
        fs.unlinkSync(this.socketPath);
      } catch {
        // Ignore
      }

      this.notifyConnectionChange();
    }
  }

  /**
   * Get connection status
   */
  getStatus(): { isRunning: boolean; clientCount: number; socketPath: string } {
    return {
      isRunning: this.server !== null,
      clientCount: this.connectedClients.size,
      socketPath: this.socketPath,
    };
  }

  /**
   * Set up IPC handlers for renderer
   */
  private setupIpcHandlers(): void {
    ipcMain.handle("mcp:getStatus", () => this.getStatus());
    ipcMain.handle("mcp:start", () => {
      this.start();
      return this.getStatus();
    });
    ipcMain.handle("mcp:stop", () => {
      this.stop();
      return this.getStatus();
    });

    // Attachment handlers
    ipcMain.handle("mcp:attach", (_event, sessionId: string) => {
      return this.attach(sessionId);
    });
    ipcMain.handle("mcp:detach", () => {
      this.detach();
      return true;
    });
    ipcMain.handle("mcp:getAttached", () => {
      return this.attachedSessionId;
    });
  }

  /**
   * Notify renderer of connection changes
   */
  private notifyConnectionChange(): void {
    if (!this.window.isDestroyed()) {
      this.window.webContents.send("mcp:statusChanged", this.getStatus());
    }
  }

  /**
   * Notify renderer of attachment changes
   */
  private notifyAttachmentChange(
    newSessionId: string | null,
    previousSessionId: string | null
  ): void {
    if (!this.window.isDestroyed()) {
      this.window.webContents.send("mcp:attachmentChanged", {
        attachedSessionId: newSessionId,
        previousSessionId,
      });
    }
  }

  /**
   * Handle a tool request from an MCP client
   */
  private async handleRequest(request: SocketRequest): Promise<SocketResponse> {
    const { id, method, params } = request;

    if (!this.manager) {
      return { id, error: { message: "Terminal manager not initialized" } };
    }

    try {
      let result: unknown;

      // Check if we have an attached session
      if (!this.attachedSessionId) {
        return { id, error: { message: "No terminal attached. Enable MCP on a terminal tab first." } };
      }

      const session = this.manager.getSessionById(this.attachedSessionId);
      if (!session) {
        return { id, error: { message: `Attached session ${this.attachedSessionId} not found` } };
      }

      switch (method) {
        case "type": {
          const text = params?.text as string;
          if (!text) {
            return { id, error: { message: "Missing 'text' parameter" } };
          }
          session.write(text);
          result = { content: [{ type: "text", text: `Typed: ${text}` }] };
          break;
        }

        case "sendKey": {
          const key = params?.key as string;
          if (!key) {
            return { id, error: { message: "Missing 'key' parameter" } };
          }
          const sequence = getKeySequence(key);
          if (!sequence) {
            return { id, error: { message: `Unknown key: ${key}` } };
          }
          session.write(sequence);
          result = { content: [{ type: "text", text: `Sent key: ${key}` }] };
          break;
        }

        case "getContent": {
          const content = session.getContent();
          result = { content: [{ type: "text", text: content }] };
          break;
        }

        case "takeScreenshot": {
          const screenshot = session.takeScreenshot();
          result = {
            content: [
              {
                type: "text",
                text: JSON.stringify(screenshot, null, 2),
              },
            ],
          };
          break;
        }

        default:
          return { id, error: { message: `Unknown method: ${method}` } };
      }

      return { id, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { id, error: { message } };
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stop();
    ipcMain.removeHandler("mcp:getStatus");
    ipcMain.removeHandler("mcp:start");
    ipcMain.removeHandler("mcp:stop");
    ipcMain.removeHandler("mcp:attach");
    ipcMain.removeHandler("mcp:detach");
    ipcMain.removeHandler("mcp:getAttached");
  }
}
