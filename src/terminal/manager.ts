import { randomBytes } from "crypto";
import { TerminalSession, TerminalSessionOptions, ScreenshotResult } from "./session.js";
import type { SandboxController } from "../sandbox/index.js";
import { RecordingManager } from "../recording/index.js";
import type { RecordingMode, RecordingFormat, RecordingMetadata } from "../recording/index.js";
import { getDefaultRecordDir } from "../utils/platform.js";

export interface TerminalManagerOptions extends TerminalSessionOptions {
  sandboxController?: SandboxController;
  record?: RecordingMode;
  recordDir?: string;
  recordFormat?: RecordingFormat;
  idleTimeLimit?: number;
  maxDuration?: number;
  inactivityTimeout?: number;
  // Multi-session options
  maxSessions?: number;
  sessionIdleTimeout?: number; // seconds; non-default sessions are evicted after this
}

export interface CreateSessionOptions {
  shell?: string;
  cols?: number;
  rows?: number;
}

export interface SessionMetadata {
  sessionId: string;
  shell: string;
  cols: number;
  rows: number;
  createdAt: string;
  lastActivityAt: string;
  isDefault: boolean;
}

interface SessionEntry {
  session: TerminalSession;
  metadata: SessionMetadata;
  lastActivity: number;
  isDefault: boolean;
}

const DEFAULT_MAX_SESSIONS = 5;
const DEFAULT_SESSION_IDLE_TIMEOUT = 600; // 10 minutes

/**
 * Manages one or more terminal sessions in a single process.
 *
 * The "default" session is created lazily on first access and is never
 * idle-evicted; it's what the existing single-session API operates on
 * when no sessionId is passed. Additional sessions can be created via
 * createSession() and addressed by ID.
 */
export class TerminalManager {
  private sessions: Map<string, SessionEntry> = new Map();
  private defaultSessionId: string | null = null;
  private defaultSessionPromise: Promise<TerminalSession> | null = null;
  private idleCheckInterval: NodeJS.Timeout | null = null;

  private options: TerminalManagerOptions;
  private sandboxController?: SandboxController;
  private recordingManager: RecordingManager;
  private autoRecordingId: string | null = null;
  private maxSessions: number;
  private sessionIdleTimeoutMs: number;

  constructor(options: TerminalManagerOptions = {}) {
    this.options = options;
    this.sandboxController = options.sandboxController;
    this.recordingManager = new RecordingManager({
      mode: options.record ?? 'off',
      outputDir: options.recordDir ?? getDefaultRecordDir(),
      format: options.recordFormat ?? 'v2',
      idleTimeLimit: options.idleTimeLimit ?? 2,
      maxDuration: options.maxDuration ?? 3600,
      inactivityTimeout: options.inactivityTimeout ?? 600,
    });
    this.maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
    this.sessionIdleTimeoutMs = (options.sessionIdleTimeout ?? DEFAULT_SESSION_IDLE_TIMEOUT) * 1000;

    // Periodic idle cleanup for non-default sessions
    this.idleCheckInterval = setInterval(() => this.cleanupIdleSessions(), 60 * 1000);
    this.idleCheckInterval.unref();
  }

  // ---------------------------------------------------------------------------
  // Session lookup helpers
  // ---------------------------------------------------------------------------

  private generateSessionId(): string {
    while (true) {
      const id = randomBytes(3).toString("hex").slice(0, 5);
      if (!this.sessions.has(id)) return id;
    }
  }

  private touchSession(sessionId: string): void {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.lastActivity = Date.now();
      entry.metadata.lastActivityAt = new Date().toISOString();
    }
  }

  private cleanupIdleSessions(): void {
    const now = Date.now();
    // Snapshot to avoid mutation-during-iteration
    for (const [sessionId, entry] of Array.from(this.sessions.entries())) {
      if (entry.isDefault) continue;
      if (now - entry.lastActivity > this.sessionIdleTimeoutMs) {
        entry.session.dispose();
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Wire recording hooks onto a session so its output is captured by any
   * active recordings.
   */
  private wireRecording(session: TerminalSession): void {
    session.onData((data) => this.recordingManager.recordOutputToAll(data));
    session.onResize((cols, rows) => this.recordingManager.recordResizeToAll(cols, rows));
  }

  // ---------------------------------------------------------------------------
  // Default session (single-session API surface)
  // ---------------------------------------------------------------------------

  /**
   * Get or create the default session. Idempotent and concurrency-safe.
   */
  async getSessionAsync(): Promise<TerminalSession> {
    if (this.defaultSessionId) {
      const entry = this.sessions.get(this.defaultSessionId);
      if (entry && entry.session.isActive()) {
        this.touchSession(this.defaultSessionId);
        return entry.session;
      }
      this.defaultSessionId = null;
    }

    if (this.defaultSessionPromise) {
      return this.defaultSessionPromise;
    }

    this.defaultSessionPromise = (async () => {
      const session = await TerminalSession.create({
        ...this.options,
        sandboxController: this.sandboxController,
      });
      const id = this.generateSessionId();
      const dims = session.getDimensions();
      const now = new Date().toISOString();
      const entry: SessionEntry = {
        session,
        metadata: {
          sessionId: id,
          shell: this.options.shell ?? process.env.SHELL ?? "/bin/bash",
          cols: dims.cols,
          rows: dims.rows,
          createdAt: now,
          lastActivityAt: now,
          isDefault: true,
        },
        lastActivity: Date.now(),
        isDefault: true,
      };
      this.sessions.set(id, entry);
      this.defaultSessionId = id;
      this.wireRecording(session);
      return session;
    })();

    try {
      return await this.defaultSessionPromise;
    } finally {
      this.defaultSessionPromise = null;
    }
  }

  getCurrentSession(): TerminalSession | null {
    if (!this.defaultSessionId) return null;
    const entry = this.sessions.get(this.defaultSessionId);
    return entry && entry.session.isActive() ? entry.session : null;
  }

  /**
   * @deprecated Use getSessionAsync(). Throws if the default session
   * hasn't been created yet.
   */
  getSession(): TerminalSession {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error(
        "Session not initialized. Use getSessionAsync() or call initSession() first."
      );
    }
    return session;
  }

  async initSession(): Promise<TerminalSession> {
    const session = await this.getSessionAsync();
    if (this.options.record && this.options.record !== 'off') {
      this.startAutoRecording();
    }
    return session;
  }

  private startAutoRecording(): void {
    if (this.autoRecordingId) return;
    const recorder = this.recordingManager.createRecording({
      mode: this.options.record,
      outputDir: this.options.recordDir ?? getDefaultRecordDir(),
      format: this.options.recordFormat ?? 'v2',
      idleTimeLimit: this.options.idleTimeLimit ?? 2,
      maxDuration: this.options.maxDuration ?? 3600,
      inactivityTimeout: this.options.inactivityTimeout ?? 600,
    });
    const session = this.getCurrentSession();
    const dimensions = session?.getDimensions() ?? { cols: 120, rows: 40 };
    recorder.start(dimensions.cols, dimensions.rows, {
      SHELL: this.options.shell ?? process.env.SHELL,
      TERM: 'xterm-256color',
    });
    this.autoRecordingId = recorder.id;
  }

  // ---------------------------------------------------------------------------
  // Multi-session API
  // ---------------------------------------------------------------------------

  /**
   * Create a new non-default session.
   */
  async createSession(opts: CreateSessionOptions = {}): Promise<SessionMetadata> {
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(
        `Maximum session limit reached (${this.maxSessions}). ` +
        `Destroy an existing session or raise --max-sessions.`
      );
    }
    const id = this.generateSessionId();
    const session = await TerminalSession.create({
      ...this.options,
      shell: opts.shell ?? this.options.shell,
      cols: opts.cols ?? this.options.cols,
      rows: opts.rows ?? this.options.rows,
      // Created sessions don't share the interactive startup banner
      startupBanner: undefined,
      sandboxController: this.sandboxController,
    });
    const dims = session.getDimensions();
    const now = new Date().toISOString();
    const metadata: SessionMetadata = {
      sessionId: id,
      shell: opts.shell ?? this.options.shell ?? process.env.SHELL ?? "/bin/bash",
      cols: dims.cols,
      rows: dims.rows,
      createdAt: now,
      lastActivityAt: now,
      isDefault: false,
    };
    this.sessions.set(id, {
      session,
      metadata,
      lastActivity: Date.now(),
      isDefault: false,
    });
    this.wireRecording(session);
    return metadata;
  }

  destroySession(sessionId: string): { success: boolean; message: string } {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      return { success: false, message: `Session '${sessionId}' not found` };
    }
    if (entry.isDefault) {
      return {
        success: false,
        message: `Session '${sessionId}' is the default session and cannot be destroyed`,
      };
    }
    entry.session.dispose();
    this.sessions.delete(sessionId);
    return { success: true, message: `Session '${sessionId}' destroyed` };
  }

  listSessions(): {
    sessions: SessionMetadata[];
    maxSessions: number;
    sessionIdleTimeout: number;
  } {
    const sessions: SessionMetadata[] = [];
    for (const [sessionId, entry] of Array.from(this.sessions.entries())) {
      if (entry.session.isActive()) {
        sessions.push({ ...entry.metadata });
      } else {
        this.sessions.delete(sessionId);
      }
    }
    return {
      sessions,
      maxSessions: this.maxSessions,
      sessionIdleTimeout: this.sessionIdleTimeoutMs / 1000,
    };
  }

  /**
   * Resolve a session by ID. If sessionId is omitted/undefined, returns the
   * default session (creating it if needed).
   */
  async resolveSession(sessionId?: string): Promise<TerminalSession> {
    if (!sessionId) {
      return this.getSessionAsync();
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
   * Synchronous variant of resolveSession() — requires the session to
   * already exist. Throws if not created yet (used by sync tool handlers).
   */
  resolveSessionSync(sessionId?: string): TerminalSession {
    if (!sessionId) {
      return this.getSession();
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

  // ---------------------------------------------------------------------------
  // Single-session shortcuts (now sessionId-aware)
  // ---------------------------------------------------------------------------

  hasActiveSession(): boolean {
    return this.getCurrentSession() !== null;
  }

  write(data: string, sessionId?: string): void {
    this.resolveSessionSync(sessionId).write(data);
  }

  getContent(sessionId?: string): string {
    return this.resolveSessionSync(sessionId).getContent();
  }

  getVisibleContent(sessionId?: string): string {
    return this.resolveSessionSync(sessionId).getVisibleContent();
  }

  getAnsiContent(visibleOnly = false, sessionId?: string): string {
    return this.resolveSessionSync(sessionId).getAnsiContent(visibleOnly);
  }

  getTerminal(sessionId?: string) {
    return this.resolveSessionSync(sessionId).getTerminal();
  }

  takeScreenshot(sessionId?: string): ScreenshotResult {
    return this.resolveSessionSync(sessionId).takeScreenshot();
  }

  clear(sessionId?: string): void {
    this.resolveSessionSync(sessionId).clear();
  }

  resize(cols: number, rows: number, sessionId?: string): void {
    this.resolveSessionSync(sessionId).resize(cols, rows);
  }

  getDimensions(sessionId?: string): { cols: number; rows: number } {
    return this.resolveSessionSync(sessionId).getDimensions();
  }

  // ---------------------------------------------------------------------------
  // Recording / lifecycle
  // ---------------------------------------------------------------------------

  getRecordingManager(): RecordingManager {
    return this.recordingManager;
  }

  async finalizeRecordings(exitCode: number): Promise<RecordingMetadata[]> {
    return this.recordingManager.finalizeAll(exitCode);
  }

  dispose(): void {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
    for (const [, entry] of this.sessions) {
      entry.session.dispose();
    }
    this.sessions.clear();
    this.defaultSessionId = null;
  }

  async disposeAsync(): Promise<void> {
    this.dispose();
    if (this.sandboxController) {
      await this.sandboxController.cleanup();
    }
  }

  getSandboxController(): SandboxController | undefined {
    return this.sandboxController;
  }
}
