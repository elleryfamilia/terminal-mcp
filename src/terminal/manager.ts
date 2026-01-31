import { TerminalSession, TerminalSessionOptions, ScreenshotResult } from "./session.js";
import type { SandboxController } from "../sandbox/index.js";
import { RecordingManager } from "../recording/index.js";
import type { RecordingMode, RecordingFormat, RecordingMetadata } from "../recording/index.js";
import { getDefaultRecordDir, getDefaultShell } from "../utils/platform.js";
import { randomUUID } from "crypto";

/**
 * Options for creating a TerminalManager
 */
export interface TerminalManagerOptions extends TerminalSessionOptions {
  sandboxController?: SandboxController;
  record?: RecordingMode;
  recordDir?: string;
  recordFormat?: RecordingFormat;
  idleTimeLimit?: number;
  maxDuration?: number;
  inactivityTimeout?: number;
  /** Skip prompt customization and use user's native shell config */
  nativeShell?: boolean;
}

/**
 * Options for creating an individual session
 */
export interface CreateSessionOptions {
  cols?: number;
  rows?: number;
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
}

/**
 * Extended session with ID for multi-session support
 */
export interface ManagedSession extends TerminalSession {
  id: string;
}

/**
 * Manages the terminal session lifecycle
 * Supports both single-session (legacy) and multi-session modes
 */
export class TerminalManager {
  // Legacy single-session support
  private session: TerminalSession | null = null;
  private sessionPromise: Promise<TerminalSession> | null = null;

  // Multi-session support
  private sessions: Map<string, TerminalSession> = new Map();
  private sessionCounter = 0;

  private options: TerminalManagerOptions;
  private sandboxController?: SandboxController;
  private recordingManager: RecordingManager;
  private autoRecordingId: string | null = null;

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
  }

  /**
   * Get the default shell path
   */
  getDefaultShell(): string {
    return this.options.shell || getDefaultShell();
  }

  // =========================================================================
  // Multi-Session API (for GUI/Electron)
  // =========================================================================

  /**
   * Create a new terminal session with a unique ID
   */
  async createSession(options: CreateSessionOptions = {}): Promise<ManagedSession> {
    const sessionId = `session-${++this.sessionCounter}-${randomUUID().slice(0, 8)}`;

    const session = await TerminalSession.create({
      cols: options.cols ?? this.options.cols ?? 120,
      rows: options.rows ?? this.options.rows ?? 40,
      shell: options.shell ?? this.options.shell,
      cwd: options.cwd ?? this.options.cwd,
      env: options.env ?? this.options.env,
      nativeShell: this.options.nativeShell,
      setLocaleEnv: this.options.setLocaleEnv,
      sandboxController: this.sandboxController,
    });

    // Store in map
    this.sessions.set(sessionId, session);

    // Wire up recording hooks
    session.onData((data) => this.recordingManager.recordOutputToAll(data));
    session.onResize((cols, rows) => this.recordingManager.recordResizeToAll(cols, rows));

    // Clean up when session exits
    session.onExit(() => {
      this.sessions.delete(sessionId);
    });

    // Return session with ID attached
    const managedSession = session as ManagedSession;
    managedSession.id = sessionId;

    return managedSession;
  }

  /**
   * Get a session by ID
   */
  getSessionById(sessionId: string): TerminalSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  /**
   * Close a session by ID
   */
  closeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.dispose();
      this.sessions.delete(sessionId);
      return true;
    }
    return false;
  }

  /**
   * Get all active session IDs
   */
  getSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get count of active sessions
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  // =========================================================================
  // Legacy Single-Session API (for CLI/MCP compatibility)
  // =========================================================================

  /**
   * Get or create the terminal session (async)
   */
  async getSessionAsync(): Promise<TerminalSession> {
    if (this.session && this.session.isActive()) {
      return this.session;
    }

    // If there's already a creation in progress, wait for it
    if (this.sessionPromise) {
      return this.sessionPromise;
    }

    // Create new session
    this.sessionPromise = TerminalSession.create({
      ...this.options,
      sandboxController: this.sandboxController,
    });

    try {
      this.session = await this.sessionPromise;
      return this.session;
    } finally {
      this.sessionPromise = null;
    }
  }

  /**
   * Get the current session if it exists and is active
   * Returns null if no session exists yet
   */
  getCurrentSession(): TerminalSession | null {
    if (this.session && this.session.isActive()) {
      return this.session;
    }
    return null;
  }

  /**
   * @deprecated Use getSessionAsync() instead. This method exists for backwards compatibility
   * but will throw if the session hasn't been created yet.
   */
  getSession(): TerminalSession {
    if (!this.session || !this.session.isActive()) {
      throw new Error(
        "Session not initialized. Use getSessionAsync() or call initSession() first."
      );
    }
    return this.session;
  }

  /**
   * Initialize the session eagerly
   * Call this at startup to create the session before it's needed
   */
  async initSession(): Promise<TerminalSession> {
    const session = await this.getSessionAsync();

    // Wire up recording hooks
    session.onData((data) => this.recordingManager.recordOutputToAll(data));
    session.onResize((cols, rows) => this.recordingManager.recordResizeToAll(cols, rows));

    // Start auto-recording if CLI mode !== 'off'
    if (this.options.record && this.options.record !== 'off') {
      this.startAutoRecording();
    }

    return session;
  }

  /**
   * Start auto-recording based on CLI options
   */
  private startAutoRecording(): void {
    if (this.autoRecordingId) {
      return; // Already recording
    }

    const recorder = this.recordingManager.createRecording({
      mode: this.options.record,
      outputDir: this.options.recordDir ?? getDefaultRecordDir(),
      format: this.options.recordFormat ?? 'v2',
      idleTimeLimit: this.options.idleTimeLimit ?? 2,
      maxDuration: this.options.maxDuration ?? 3600,
      inactivityTimeout: this.options.inactivityTimeout ?? 600,
    });

    const dimensions = this.session?.getDimensions() ?? { cols: 120, rows: 40 };
    recorder.start(dimensions.cols, dimensions.rows, {
      SHELL: this.options.shell ?? process.env.SHELL,
      TERM: 'xterm-256color',
    });

    this.autoRecordingId = recorder.id;
  }

  /**
   * Get the RecordingManager instance
   */
  getRecordingManager(): RecordingManager {
    return this.recordingManager;
  }

  /**
   * Finalize all recordings and return their metadata
   * Called by the caller when the session exits
   */
  async finalizeRecordings(exitCode: number): Promise<RecordingMetadata[]> {
    return this.recordingManager.finalizeAll(exitCode);
  }

  /**
   * Check if a session exists and is active
   */
  hasActiveSession(): boolean {
    return this.session !== null && this.session.isActive();
  }

  /**
   * Write data to the terminal
   */
  write(data: string): void {
    this.getSession().write(data);
  }

  /**
   * Get terminal content
   */
  getContent(): string {
    return this.getSession().getContent();
  }

  /**
   * Get visible content only
   */
  getVisibleContent(): string {
    return this.getSession().getVisibleContent();
  }

  /**
   * Take a screenshot
   */
  takeScreenshot(): ScreenshotResult {
    return this.getSession().takeScreenshot();
  }

  /**
   * Clear the terminal
   */
  clear(): void {
    this.getSession().clear();
  }

  /**
   * Resize the terminal
   */
  resize(cols: number, rows: number): void {
    this.getSession().resize(cols, rows);
  }

  /**
   * Get terminal dimensions
   */
  getDimensions(): { cols: number; rows: number } {
    return this.getSession().getDimensions();
  }

  /**
   * Dispose of the current session and cleanup sandbox
   */
  dispose(): void {
    // Dispose legacy session
    if (this.session) {
      this.session.dispose();
      this.session = null;
    }

    // Dispose all multi-session instances
    for (const session of this.sessions.values()) {
      session.dispose();
    }
    this.sessions.clear();
  }

  /**
   * Async dispose that also cleans up sandbox resources
   */
  async disposeAsync(): Promise<void> {
    this.dispose();
    if (this.sandboxController) {
      await this.sandboxController.cleanup();
    }
  }

  /**
   * Get the sandbox controller if one is configured
   */
  getSandboxController(): SandboxController | undefined {
    return this.sandboxController;
  }
}
