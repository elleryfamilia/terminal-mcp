/**
 * MCP Server Manager
 *
 * Creates a Unix socket server for MCP clients (AI assistants) to connect to.
 * Tracks connection state, captures client info, and exposes terminal tools.
 * Emits activity events for GUI observability panel.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Server as NetServer, Socket } from "net";
import { ipcMain, type BrowserWindow } from "electron";
import type { TerminalManager } from "@ellery/terminal-mcp";
import {
  type TrackedClient,
  type ExtendedClientInfo,
  ExtendedClientInfoSchema,
  generateClientId,
} from "@ellery/terminal-mcp";
import { SessionLogger } from "@ellery/terminal-mcp";

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

// MCP activity events for IPC
export interface McpToolCallStarted {
  id: number;
  tool: string;
  args?: Record<string, unknown>;
  clientId: string;
  timestamp: number;
}

export interface McpToolCallCompleted {
  id: number;
  tool: string;
  success: boolean;
  duration: number;
  timestamp: number;
  clientId: string;
  error?: string;
}

export interface McpClientConnected {
  clientId: string;
  clientInfo?: {
    name: string;
    version: string;
  };
  runtime?: {
    hostApp?: string;
    platform?: string;
  };
  timestamp: number;
}

export interface McpClientDisconnected {
  clientId: string;
  timestamp: number;
}

// Get default socket path - use /tmp for predictable path on macOS/Linux
function getDefaultSocketPath(): string {
  if (process.platform === "win32") {
    return "\\\\.\\pipe\\terminal-mcp-gui";
  }
  // Use /tmp directly instead of os.tmpdir() which returns user-specific paths on macOS
  return "/tmp/terminal-mcp-gui.sock";
}

export class McpServer {
  private server: NetServer | null = null;
  private connectedClients: Set<Socket> = new Set();
  private clientInfoMap: Map<Socket, TrackedClient> = new Map();
  private window: BrowserWindow;
  private manager: TerminalManager | null = null;
  private socketPath: string;
  private attachedSessionId: string | null = null;
  private sessionLogger: SessionLogger | null = null;

  constructor(window: BrowserWindow) {
    this.window = window;
    this.socketPath = getDefaultSocketPath();
    this.setupIpcHandlers();

    // Clean up stale session log files from previous crashes
    SessionLogger.cleanupStale().then((count) => {
      if (count > 0) {
        console.log(`[mcp-server] Cleaned up ${count} stale session log files`);
      }
    });
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
   * Handle session close - if attached session closes, detach MCP
   */
  handleSessionClose(closedSessionId: string): void {
    if (this.attachedSessionId !== closedSessionId) {
      return;
    }

    console.log(`[mcp-server] Attached session ${closedSessionId} closed, detaching MCP`);
    this.detach();
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

    // Create session logger
    this.sessionLogger = new SessionLogger();
    console.log(`[mcp-server] Session log: ${this.sessionLogger.getFilePath()}`);

    // Remove existing socket file
    try {
      fs.unlinkSync(this.socketPath);
    } catch {
      // Ignore if doesn't exist
    }

    this.server = new NetServer((socket) => {
      console.log("[mcp-server] Client connected");
      this.connectedClients.add(socket);

      // Create a placeholder tracked client
      const placeholderClientId = generateClientId();
      const trackedClient: TrackedClient = {
        clientId: placeholderClientId,
        connectedAt: Date.now(),
      };
      this.clientInfoMap.set(socket, trackedClient);

      // Emit client connected event immediately
      this.emitClientConnected(trackedClient);

      // Log connection
      this.sessionLogger?.log({
        type: "connect",
        timestamp: Date.now(),
        clientId: trackedClient.clientId,
      });

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
              const response = await this.handleRequest(request, socket);
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
        const client = this.clientInfoMap.get(socket);
        if (client) {
          // Log disconnect
          this.sessionLogger?.log({
            type: "disconnect",
            timestamp: Date.now(),
            clientId: client.clientId,
          });

          // Notify renderer
          this.emitClientDisconnected(client.clientId);
        }
        this.clientInfoMap.delete(socket);
        this.connectedClients.delete(socket);
        this.notifyConnectionChange();
      });

      socket.on("error", () => {
        const client = this.clientInfoMap.get(socket);
        if (client) {
          this.emitClientDisconnected(client.clientId);
        }
        this.clientInfoMap.delete(socket);
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
      this.clientInfoMap.clear();

      this.server.close();
      this.server = null;

      // Close session logger
      if (this.sessionLogger) {
        this.sessionLogger.close();
        this.sessionLogger = null;
      }

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

    // Client info handler
    ipcMain.handle("mcp:getClients", () => {
      return this.getConnectedClients();
    });

    // Disconnect a specific client
    ipcMain.handle("mcp:disconnectClient", (_event, clientId: string) => {
      return this.disconnectClient(clientId);
    });
  }

  /**
   * Disconnect a specific client by clientId
   */
  disconnectClient(clientId: string): boolean {
    for (const [socket, client] of this.clientInfoMap) {
      if (client.clientId === clientId) {
        console.log(`[mcp-server] Disconnecting client: ${clientId}`);
        socket.destroy();
        return true;
      }
    }
    console.log(`[mcp-server] Client not found: ${clientId}`);
    return false;
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
  private async handleRequest(request: SocketRequest, socket: Socket): Promise<SocketResponse> {
    const { id, method, params } = request;
    const startTime = Date.now();

    // Get or create tracked client for this socket
    let trackedClient = this.clientInfoMap.get(socket);
    if (!trackedClient) {
      trackedClient = {
        clientId: generateClientId(),
        connectedAt: Date.now(),
      };
      this.clientInfoMap.set(socket, trackedClient);
    }

    // Handle initialize method - captures extended client info
    if (method === "initialize") {
      return this.handleInitialize(request, socket, trackedClient);
    }

    if (!this.manager) {
      return { id, error: { message: "Terminal manager not initialized" } };
    }

    // Check if we have an attached session for tool methods
    if (!this.attachedSessionId) {
      return { id, error: { message: "No terminal attached. Enable MCP on a terminal tab first." } };
    }

    const session = this.manager.getSessionById(this.attachedSessionId);
    if (!session) {
      return { id, error: { message: `Attached session ${this.attachedSessionId} not found` } };
    }

    // Emit tool call started event
    this.emitToolCallStarted(id, method, params, trackedClient.clientId);

    try {
      let result: unknown;

      switch (method) {
        case "type": {
          const text = params?.text as string;
          if (!text) {
            const error = "Missing 'text' parameter";
            this.emitToolCallCompleted(id, method, false, Date.now() - startTime, error, trackedClient.clientId);
            return { id, error: { message: error } };
          }
          session.write(text);
          result = { content: [{ type: "text", text: `Typed: ${text}` }] };
          break;
        }

        case "sendKey": {
          const key = params?.key as string;
          if (!key) {
            const error = "Missing 'key' parameter";
            this.emitToolCallCompleted(id, method, false, Date.now() - startTime, error, trackedClient.clientId);
            return { id, error: { message: error } };
          }
          const sequence = getKeySequence(key);
          if (!sequence) {
            const error = `Unknown key: ${key}`;
            this.emitToolCallCompleted(id, method, false, Date.now() - startTime, error, trackedClient.clientId);
            return { id, error: { message: error } };
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

        default: {
          const error = `Unknown method: ${method}`;
          this.emitToolCallCompleted(id, method, false, Date.now() - startTime, error, trackedClient.clientId);
          return { id, error: { message: error } };
        }
      }

      // Emit tool call completed event
      this.emitToolCallCompleted(id, method, true, Date.now() - startTime, undefined, trackedClient.clientId);

      return { id, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emitToolCallCompleted(id, method, false, Date.now() - startTime, message, trackedClient.clientId);
      return { id, error: { message } };
    }
  }

  /**
   * Handle MCP initialize request - captures extended client info
   */
  private handleInitialize(
    request: SocketRequest,
    socket: Socket,
    trackedClient: TrackedClient
  ): SocketResponse {
    const { id, params } = request;
    console.log("[mcp-server] handleInitialize called with params:", JSON.stringify(params));

    try {
      // Parse extended client info from params
      const parsed = ExtendedClientInfoSchema.safeParse(params);
      const extendedInfo: ExtendedClientInfo = parsed.success ? parsed.data : {};

      // Update tracked client with parsed info
      if (extendedInfo.clientInfo) {
        trackedClient.clientId = generateClientId(extendedInfo.clientInfo);
        trackedClient.clientInfo = extendedInfo.clientInfo;
      }
      trackedClient.runtime = extendedInfo.runtime;
      trackedClient.capabilities = extendedInfo.capabilities;
      trackedClient.session = extendedInfo.session;
      trackedClient.observability = extendedInfo.observability;

      // Update the map
      this.clientInfoMap.set(socket, trackedClient);

      // Log the extended info (connection was already logged on socket connect)
      this.sessionLogger?.log({
        type: "connect",
        timestamp: Date.now(),
        clientId: trackedClient.clientId,
        clientName: trackedClient.clientInfo?.name,
        version: trackedClient.clientInfo?.version,
        runtime: trackedClient.runtime,
      });

      // Emit updated client info (client was already connected, this updates the info)
      // Re-emit so the renderer gets the updated client details
      this.emitClientConnected(trackedClient);

      console.log(
        `[mcp-server] Client initialized: ${trackedClient.clientInfo?.name || "unknown"} v${trackedClient.clientInfo?.version || "?"}`
      );

      // Return standard MCP initialize response
      return {
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "terminal-mcp-gui",
            version: "1.0.0",
          },
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { id, error: { message: `Initialize failed: ${message}` } };
    }
  }

  /**
   * Emit tool call started event via IPC
   */
  private emitToolCallStarted(
    id: number,
    tool: string,
    args: Record<string, unknown> | undefined,
    clientId: string
  ): void {
    if (this.window.isDestroyed()) return;

    const event: McpToolCallStarted = {
      id,
      tool,
      args,
      clientId,
      timestamp: Date.now(),
    };

    this.window.webContents.send("mcp:toolCallStarted", event);
  }

  /**
   * Emit tool call completed event via IPC
   */
  private emitToolCallCompleted(
    id: number,
    tool: string,
    success: boolean,
    duration: number,
    error: string | undefined,
    clientId: string
  ): void {
    if (this.window.isDestroyed()) return;

    const event: McpToolCallCompleted = {
      id,
      tool,
      success,
      duration,
      timestamp: Date.now(),
      clientId,
      error,
    };

    this.window.webContents.send("mcp:toolCallCompleted", event);

    // Also log to session file
    this.sessionLogger?.log({
      type: "tool_call",
      timestamp: Date.now(),
      clientId,
      method: tool,
      durationMs: duration,
      result: success ? "success" : "error",
      error,
    });
  }

  /**
   * Emit client connected event via IPC
   */
  private emitClientConnected(client: TrackedClient): void {
    console.log("[mcp-server] emitClientConnected called for:", client.clientId);
    if (this.window.isDestroyed()) {
      console.log("[mcp-server] Window is destroyed, skipping emit");
      return;
    }

    const event: McpClientConnected = {
      clientId: client.clientId,
      clientInfo: client.clientInfo,
      runtime: client.runtime,
      timestamp: Date.now(),
    };

    console.log("[mcp-server] Sending mcp:clientConnected event:", event);
    this.window.webContents.send("mcp:clientConnected", event);
  }

  /**
   * Emit client disconnected event via IPC
   */
  private emitClientDisconnected(clientId: string): void {
    if (this.window.isDestroyed()) return;

    const event: McpClientDisconnected = {
      clientId,
      timestamp: Date.now(),
    };

    this.window.webContents.send("mcp:clientDisconnected", event);
  }

  /**
   * Get currently connected clients info
   */
  getConnectedClients(): TrackedClient[] {
    const clients = Array.from(this.clientInfoMap.values());
    console.log("[mcp-server] getConnectedClients called, returning:", clients.length, "clients");
    return clients;
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
    ipcMain.removeHandler("mcp:getClients");
    ipcMain.removeHandler("mcp:disconnectClient");
  }
}
