import { TerminalSession, TerminalSessionOptions, ScreenshotResult } from "./session.js";

/**
 * Manages the terminal session lifecycle
 * Currently supports a single session for simplicity
 */
export class TerminalManager {
  private session: TerminalSession | null = null;
  private options: TerminalSessionOptions;

  constructor(options: TerminalSessionOptions = {}) {
    this.options = options;
  }

  /**
   * Get or create the terminal session
   */
  getSession(): TerminalSession {
    if (!this.session || !this.session.isActive()) {
      this.session = new TerminalSession(this.options);
    }
    return this.session;
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
   * Dispose of the current session
   */
  dispose(): void {
    if (this.session) {
      this.session.dispose();
      this.session = null;
    }
  }
}
