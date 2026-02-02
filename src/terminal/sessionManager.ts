import { TerminalSession, TerminalSessionOptions, ScreenshotResult } from "./session.js";
import { randomBytes } from "crypto";

/**
 * Metadata for a terminal session
 */
export interface SessionMetadata {
  sessionId: string;
  shell: string;
  cols: number;
  rows: number;
  cwd: string;
  createdAt: string;
  lastActivityAt: string;
}

/**
 * Options for creating a new session
 */
export interface CreateSessionOptions {
  shell?: string;
  cols?: number;
  rows?: number;
}

/**
 * Options for the SessionManager
 */
export interface SessionManagerOptions {
  maxSessions?: number;
  idleTimeout?: number; // in seconds
  defaultShell?: string;
  defaultCols?: number;
  defaultRows?: number;
}

/**
 * Internal session tracking data
 */
interface SessionEntry {
  session: TerminalSession;
  metadata: SessionMetadata;
  lastActivity: number; // timestamp
}

const DEFAULT_MAX_SESSIONS = 5;
const DEFAULT_IDLE_TIMEOUT = 600; // 10 minutes in seconds
const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 40;

/**
 * Manages multiple terminal sessions with lifecycle management
 */
export class SessionManager {
  private sessions: Map<string, SessionEntry> = new Map();
  private defaultSessionId: string | null = null;
  private idleCheckInterval: NodeJS.Timeout | null = null;

  private maxSessions: number;
  private idleTimeout: number;
  private defaultShell?: string;
  private defaultCols: number;
  private defaultRows: number;

  constructor(options: SessionManagerOptions = {}) {
    this.maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
    this.idleTimeout = options.idleTimeout ?? DEFAULT_IDLE_TIMEOUT;
    this.defaultShell = options.defaultShell;
    this.defaultCols = options.defaultCols ?? DEFAULT_COLS;
    this.defaultRows = options.defaultRows ?? DEFAULT_ROWS;

    // Start idle session checker
    this.startIdleChecker();
  }

  /**
   * Generate a short random session ID
   */
  private generateSessionId(): string {
    // Generate 3 random bytes -> 6 hex chars, then take first 5
    const id = randomBytes(3).toString("hex").slice(0, 5);
    // Ensure uniqueness
    if (this.sessions.has(id)) {
      return this.generateSessionId();
    }
    return id;
  }

  /**
   * Start the idle session checker
   */
  private startIdleChecker(): void {
    // Check every minute
    this.idleCheckInterval = setInterval(() => {
      this.cleanupIdleSessions();
    }, 60 * 1000);

    // Don't prevent process exit
    this.idleCheckInterval.unref();
  }

  /**
   * Clean up sessions that have been idle too long
   */
  private cleanupIdleSessions(): void {
    const now = Date.now();
    const timeoutMs = this.idleTimeout * 1000;

    for (const [sessionId, entry] of this.sessions) {
      if (now - entry.lastActivity > timeoutMs) {
        this.destroySession(sessionId);
      }
    }
  }

  /**
   * Update last activity timestamp for a session
   */
  private touchSession(sessionId: string): void {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.lastActivity = Date.now();
      entry.metadata.lastActivityAt = new Date().toISOString();
    }
  }

  /**
   * Create a new terminal session
   */
  async createSession(options: CreateSessionOptions = {}): Promise<SessionMetadata> {
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(
        `Maximum session limit reached (${this.maxSessions}). ` +
        `Destroy an existing session or increase --max-sessions.`
      );
    }

    const sessionId = this.generateSessionId();
    const shell = options.shell ?? this.defaultShell;
    const cols = options.cols ?? this.defaultCols;
    const rows = options.rows ?? this.defaultRows;

    const session = await TerminalSession.create({
      shell,
      cols,
      rows,
    });

    const now = new Date().toISOString();
    const metadata: SessionMetadata = {
      sessionId,
      shell: shell ?? process.env.SHELL ?? "/bin/bash",
      cols,
      rows,
      cwd: process.cwd(),
      createdAt: now,
      lastActivityAt: now,
    };

    const entry: SessionEntry = {
      session,
      metadata,
      lastActivity: Date.now(),
    };

    this.sessions.set(sessionId, entry);

    return metadata;
  }

  /**
   * Destroy a specific session
   */
  destroySession(sessionId: string): { success: boolean; message: string } {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      return {
        success: false,
        message: `Session '${sessionId}' not found`,
      };
    }

    entry.session.dispose();
    this.sessions.delete(sessionId);

    // Clear default session reference if this was it
    if (this.defaultSessionId === sessionId) {
      this.defaultSessionId = null;
    }

    return {
      success: true,
      message: `Session '${sessionId}' destroyed`,
    };
  }

  /**
   * Get or create the default session
   */
  async getDefaultSession(): Promise<TerminalSession> {
    if (this.defaultSessionId) {
      const entry = this.sessions.get(this.defaultSessionId);
      if (entry && entry.session.isActive()) {
        this.touchSession(this.defaultSessionId);
        return entry.session;
      }
      // Default session was destroyed or inactive, clear reference
      this.defaultSessionId = null;
    }

    // Create a new default session
    const metadata = await this.createSession();
    this.defaultSessionId = metadata.sessionId;
    return this.sessions.get(metadata.sessionId)!.session;
  }

  /**
   * Get a session by ID, or the default session if no ID provided
   */
  async getSession(sessionId?: string): Promise<TerminalSession> {
    if (!sessionId) {
      return this.getDefaultSession();
    }

    const entry = this.sessions.get(sessionId);
    if (!entry) {
      throw new Error(`Session '${sessionId}' not found`);
    }

    if (!entry.session.isActive()) {
      this.sessions.delete(sessionId);
      throw new Error(`Session '${sessionId}' is no longer active`);
    }

    this.touchSession(sessionId);
    return entry.session;
  }

  /**
   * List all active sessions
   */
  listSessions(): {
    sessions: SessionMetadata[];
    maxSessions: number;
    idleTimeout: number;
  } {
    const sessions: SessionMetadata[] = [];

    for (const [sessionId, entry] of this.sessions) {
      if (entry.session.isActive()) {
        sessions.push({ ...entry.metadata });
      } else {
        // Clean up inactive session
        this.sessions.delete(sessionId);
      }
    }

    return {
      sessions,
      maxSessions: this.maxSessions,
      idleTimeout: this.idleTimeout,
    };
  }

  /**
   * Check if a session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Get the number of active sessions
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Dispose all sessions and cleanup
   */
  dispose(): void {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }

    for (const [sessionId, entry] of this.sessions) {
      entry.session.dispose();
    }

    this.sessions.clear();
    this.defaultSessionId = null;
  }
}
