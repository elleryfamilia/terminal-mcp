import { TerminalSession, TerminalSessionOptions, ScreenshotResult } from "./session.js";
import type { SandboxController } from "../sandbox/index.js";

/**
 * Options for creating a TerminalManager
 */
export interface TerminalManagerOptions extends TerminalSessionOptions {
  sandboxController?: SandboxController;
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

  constructor(options: TerminalManagerOptions = {}) {
    this.options = options;
    this.sandboxController = options.sandboxController;
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
    return this.getSessionAsync();
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
