/**
 * GUI Output Stream
 *
 * Manages connections from GUI clients and broadcasts terminal events to them.
 * Supports multiple concurrent GUI clients (e.g., multiple Electron windows).
 *
 * This module provides the bridge between terminal-mcp's core PTY handling
 * and GUI frontends like Electron.
 */

import { EventEmitter } from "events";
import type {
  GuiMessageToFrontend,
  GuiMessageToBackend,
  GuiCreateSessionMessage,
  GuiResizeMessage,
} from "./gui-protocol.js";
import {
  encodeData,
  decodeData,
} from "./gui-protocol.js";
import type { TerminalManager } from "../terminal/index.js";
import type { TerminalSession } from "../terminal/session.js";

/** Callback type for sending messages to a GUI client */
export type GuiClientCallback = (message: GuiMessageToFrontend) => void;

/** Events emitted by GUIOutputStream */
export interface GUIOutputStreamEvents {
  "client-connected": (clientId: string) => void;
  "client-disconnected": (clientId: string) => void;
  error: (error: Error) => void;
}

// Default session ID for single-session mode (current TerminalManager)
const DEFAULT_SESSION_ID = "default";

/**
 * Manages GUI client connections and routes messages between
 * terminal sessions and GUI frontends.
 *
 * Currently works with TerminalManager's single-session model.
 * Multi-session support will be added when TerminalManager is extended.
 */
export class GUIOutputStream extends EventEmitter {
  private clients: Map<string, GuiClientCallback> = new Map();
  private sessionSubscriptions: Map<string, Set<string>> = new Map(); // sessionId -> Set<clientId>
  private manager: TerminalManager | null = null;
  private clientCounter = 0;
  private sessionEventsBound = false;

  constructor() {
    super();
  }

  /**
   * Attach a TerminalManager to handle session operations
   */
  attachManager(manager: TerminalManager): void {
    this.manager = manager;
  }

  /**
   * Add a GUI client connection
   * @returns clientId for this connection
   */
  addClient(callback: GuiClientCallback): string {
    const clientId = `gui-${++this.clientCounter}`;
    this.clients.set(clientId, callback);
    this.emit("client-connected", clientId);
    return clientId;
  }

  /**
   * Remove a GUI client connection
   */
  removeClient(clientId: string): void {
    this.clients.delete(clientId);

    // Remove from all session subscriptions
    for (const subscribers of this.sessionSubscriptions.values()) {
      subscribers.delete(clientId);
    }

    this.emit("client-disconnected", clientId);
  }

  /**
   * Get the number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Send a message to a specific client
   */
  sendToClient(clientId: string, message: GuiMessageToFrontend): void {
    const callback = this.clients.get(clientId);
    if (callback) {
      try {
        callback(message);
      } catch (error) {
        this.emit("error", error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: GuiMessageToFrontend): void {
    for (const [, callback] of this.clients) {
      try {
        callback(message);
      } catch (error) {
        this.emit("error", error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  /**
   * Broadcast a message to clients subscribed to a specific session
   */
  broadcastToSession(sessionId: string, message: GuiMessageToFrontend): void {
    const subscribers = this.sessionSubscriptions.get(sessionId);
    if (!subscribers) {
      // Fall back to broadcast if no specific subscribers
      this.broadcast(message);
      return;
    }

    for (const clientId of subscribers) {
      this.sendToClient(clientId, message);
    }
  }

  /**
   * Subscribe a client to a session's events
   */
  subscribeToSession(clientId: string, sessionId: string): void {
    let subscribers = this.sessionSubscriptions.get(sessionId);
    if (!subscribers) {
      subscribers = new Set();
      this.sessionSubscriptions.set(sessionId, subscribers);
    }
    subscribers.add(clientId);
  }

  /**
   * Unsubscribe a client from a session's events
   */
  unsubscribeFromSession(clientId: string, sessionId: string): void {
    const subscribers = this.sessionSubscriptions.get(sessionId);
    if (subscribers) {
      subscribers.delete(clientId);
    }
  }

  /**
   * Emit terminal output to subscribed GUI clients
   */
  emitOutput(sessionId: string, data: string): void {
    this.broadcastToSession(sessionId, {
      type: "output",
      sessionId,
      data: encodeData(data),
    });
  }

  /**
   * Emit session created event
   */
  emitSessionCreated(
    sessionId: string,
    shell: string,
    cols: number,
    rows: number,
    cwd: string
  ): void {
    this.broadcast({
      type: "session-created",
      sessionId,
      shell,
      cols,
      rows,
      cwd,
    });
  }

  /**
   * Emit session closed event
   */
  emitSessionClosed(sessionId: string, exitCode: number): void {
    this.broadcastToSession(sessionId, {
      type: "session-closed",
      sessionId,
      exitCode,
    });

    // Clean up subscriptions for this session
    this.sessionSubscriptions.delete(sessionId);
  }

  /**
   * Emit resize event
   */
  emitResize(sessionId: string, cols: number, rows: number): void {
    this.broadcastToSession(sessionId, {
      type: "resize",
      sessionId,
      cols,
      rows,
    });
  }

  /**
   * Emit recording started event
   */
  emitRecordingStarted(sessionId: string, filename: string): void {
    this.broadcastToSession(sessionId, {
      type: "recording-started",
      sessionId,
      filename,
    });
  }

  /**
   * Emit recording stopped event
   */
  emitRecordingStopped(sessionId: string, filename: string, saved: boolean): void {
    this.broadcastToSession(sessionId, {
      type: "recording-stopped",
      sessionId,
      filename,
      saved,
    });
  }

  /**
   * Handle an incoming message from a GUI client
   */
  async handleMessage(clientId: string, message: GuiMessageToBackend): Promise<void> {
    if (!this.manager) {
      this.sendToClient(clientId, {
        type: "error",
        requestType: message.type,
        message: "No terminal manager attached",
        code: "NO_MANAGER",
      });
      return;
    }

    try {
      switch (message.type) {
        case "create-session":
          await this.handleCreateSession(clientId, message);
          break;

        case "close-session":
          this.handleCloseSession(clientId, message.sessionId);
          break;

        case "input":
          this.handleInput(message.sessionId, decodeData(message.data));
          break;

        case "resize":
          this.handleResize(message);
          break;

        case "get-content":
          this.handleGetContent(clientId, message.sessionId);
          break;

        case "list-sessions":
          this.handleListSessions(clientId);
          break;

        case "start-recording":
          // Recording is handled via CLI flags currently
          this.sendToClient(clientId, {
            type: "error",
            requestType: "start-recording",
            sessionId: message.sessionId,
            message: "Recording control via GUI not yet implemented",
            code: "NOT_IMPLEMENTED",
          });
          break;

        case "stop-recording":
          // Recording is handled via CLI flags currently
          this.sendToClient(clientId, {
            type: "error",
            requestType: "stop-recording",
            sessionId: message.sessionId,
            message: "Recording control via GUI not yet implemented",
            code: "NOT_IMPLEMENTED",
          });
          break;

        default:
          this.sendToClient(clientId, {
            type: "error",
            requestType: (message as { type: string }).type,
            message: `Unknown message type: ${(message as { type: string }).type}`,
            code: "UNKNOWN_MESSAGE",
          });
      }
    } catch (error) {
      this.sendToClient(clientId, {
        type: "error",
        requestType: message.type,
        message: error instanceof Error ? error.message : String(error),
        code: "HANDLER_ERROR",
      });
    }
  }

  /**
   * Handle create-session request
   * Currently uses TerminalManager's single-session model
   */
  private async handleCreateSession(
    clientId: string,
    message: GuiCreateSessionMessage
  ): Promise<void> {
    if (!this.manager) return;

    // Check if session already exists
    if (this.manager.hasActiveSession()) {
      // Return existing session info
      const session = this.manager.getCurrentSession()!;
      const dims = session.getDimensions();

      // Subscribe client to the session
      this.subscribeToSession(clientId, DEFAULT_SESSION_ID);

      this.sendToClient(clientId, {
        type: "session-created",
        sessionId: DEFAULT_SESSION_ID,
        shell: process.env.SHELL || "/bin/sh",
        cols: dims.cols,
        rows: dims.rows,
        cwd: process.cwd(),
      });
      return;
    }

    // Initialize new session via manager
    const session = await this.manager.initSession();

    // Subscribe client to the session
    this.subscribeToSession(clientId, DEFAULT_SESSION_ID);

    // Set up event forwarding (only once)
    if (!this.sessionEventsBound) {
      this.setupSessionEventForwarding(session);
      this.sessionEventsBound = true;
    }

    // Resize if different from defaults
    if (message.cols || message.rows) {
      const cols = message.cols || 120;
      const rows = message.rows || 40;
      session.resize(cols, rows);
    }

    const dims = session.getDimensions();

    // Notify client
    this.sendToClient(clientId, {
      type: "session-created",
      sessionId: DEFAULT_SESSION_ID,
      shell: message.shell || process.env.SHELL || "/bin/sh",
      cols: dims.cols,
      rows: dims.rows,
      cwd: message.cwd || process.cwd(),
    });
  }

  /**
   * Handle close-session request
   */
  private handleCloseSession(clientId: string, sessionId: string): void {
    if (!this.manager) return;

    if (!this.manager.hasActiveSession()) {
      this.sendToClient(clientId, {
        type: "error",
        requestType: "close-session",
        sessionId,
        message: "No active session",
        code: "SESSION_NOT_FOUND",
      });
      return;
    }

    this.manager.dispose();
    this.sessionEventsBound = false;
  }

  /**
   * Handle input message
   */
  private handleInput(sessionId: string, data: string): void {
    if (!this.manager) return;

    const session = this.manager.getCurrentSession();
    if (session && session.isActive()) {
      session.write(data);
    }
  }

  /**
   * Handle resize message
   */
  private handleResize(message: GuiResizeMessage): void {
    if (!this.manager) return;

    const session = this.manager.getCurrentSession();
    if (session && session.isActive()) {
      session.resize(message.cols, message.rows);
    }
  }

  /**
   * Handle get-content request
   */
  private handleGetContent(clientId: string, sessionId: string): void {
    if (!this.manager) return;

    const session = this.manager.getCurrentSession();
    if (!session) {
      this.sendToClient(clientId, {
        type: "error",
        requestType: "get-content",
        sessionId,
        message: "No active session",
        code: "SESSION_NOT_FOUND",
      });
      return;
    }

    const screenshot = session.takeScreenshot();
    this.sendToClient(clientId, {
      type: "content",
      sessionId,
      content: screenshot.content,
      cursor: screenshot.cursor,
      dimensions: screenshot.dimensions,
    });
  }

  /**
   * Handle list-sessions request
   */
  private handleListSessions(clientId: string): void {
    if (!this.manager) return;

    const session = this.manager.getCurrentSession();
    const sessions = session
      ? [
          {
            sessionId: DEFAULT_SESSION_ID,
            shell: process.env.SHELL || "/bin/sh",
            cols: session.getDimensions().cols,
            rows: session.getDimensions().rows,
            cwd: process.cwd(),
            isRecording: false, // TODO: Check recording status
          },
        ]
      : [];

    this.sendToClient(clientId, {
      type: "session-list",
      sessions,
    });
  }

  /**
   * Set up event forwarding from a session to GUI clients
   */
  setupSessionEventForwarding(session: TerminalSession): void {
    const sessionId = DEFAULT_SESSION_ID;

    // Forward PTY output
    session.onData((data) => {
      this.emitOutput(sessionId, data);
    });

    // Forward exit
    session.onExit((code) => {
      this.emitSessionClosed(sessionId, code);
    });

    // Forward resize
    session.onResize((cols, rows) => {
      this.emitResize(sessionId, cols, rows);
    });
  }

  /**
   * Dispose of all connections
   */
  dispose(): void {
    this.clients.clear();
    this.sessionSubscriptions.clear();
    this.manager = null;
    this.sessionEventsBound = false;
    this.removeAllListeners();
  }
}

/**
 * Create a GUIOutputStream instance attached to a manager
 */
export function createGUIOutputStream(manager: TerminalManager): GUIOutputStream {
  const stream = new GUIOutputStream();
  stream.attachManager(manager);
  return stream;
}
