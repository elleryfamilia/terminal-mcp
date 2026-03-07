import { TerminalSession, TerminalSessionOptions, ScreenshotResult } from "./session.js";
import type { SandboxController } from "../sandbox/index.js";
import { RecordingManager } from "../recording/index.js";
import type { RecordingMode, RecordingFormat, RecordingMetadata } from "../recording/index.js";
import { getDefaultRecordDir } from "../utils/platform.js";

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
}

/**
 * Manages the terminal session lifecycle
 * Currently supports a single session for simplicity
 */
export class TerminalManager {
  private session: TerminalSession | null = null;
  private sessionPromise: Promise<TerminalSession> | null = null;
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
   * Get terminal content with ANSI color codes
   */
  getAnsiContent(visibleOnly = false): string {
    return this.getSession().getAnsiContent(visibleOnly);
  }

  /**
   * Take a screenshot
   */
  takeScreenshot(): ScreenshotResult {
    return this.getSession().takeScreenshot();
  }

  /**
   * Get the underlying xterm.js Terminal instance for direct buffer access.
   * Used by the color screenshot renderer.
   */
  getTerminal() {
    return this.getSession().getTerminal();
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
    if (this.session) {
      this.session.dispose();
      this.session = null;
    }
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
