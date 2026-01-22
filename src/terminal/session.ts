import * as pty from "node-pty";
import xtermHeadless from "@xterm/headless";
const { Terminal } = xtermHeadless;

export interface TerminalSessionOptions {
  cols?: number;
  rows?: number;
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
}

export interface ScreenshotResult {
  content: string;
  cursor: {
    x: number;
    y: number;
  };
  dimensions: {
    cols: number;
    rows: number;
  };
}

/**
 * Terminal session that combines node-pty with xterm.js headless
 * for full terminal emulation
 */
export class TerminalSession {
  private ptyProcess: pty.IPty;
  private terminal: InstanceType<typeof Terminal>;
  private disposed = false;

  constructor(options: TerminalSessionOptions = {}) {
    const cols = options.cols ?? 120;
    const rows = options.rows ?? 40;
    const shell = options.shell ?? process.env.SHELL ?? "bash";

    // Create headless terminal emulator
    this.terminal = new Terminal({
      cols,
      rows,
      scrollback: 1000,
      allowProposedApi: true,
    });

    // Spawn PTY process
    this.ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...options.env } as Record<string, string>,
    });

    // Pipe PTY output to terminal emulator
    this.ptyProcess.onData((data) => {
      if (!this.disposed) {
        this.terminal.write(data);
      }
    });

    this.ptyProcess.onExit(() => {
      this.disposed = true;
    });
  }

  /**
   * Write data to the terminal (simulates typing)
   */
  write(data: string): void {
    if (this.disposed) {
      throw new Error("Terminal session has been disposed");
    }
    this.ptyProcess.write(data);
  }

  /**
   * Get the current terminal buffer content as plain text
   */
  getContent(): string {
    if (this.disposed) {
      throw new Error("Terminal session has been disposed");
    }

    const buffer = this.terminal.buffer.active;
    const lines: string[] = [];

    // Get all lines from the buffer (including scrollback)
    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) {
        lines.push(line.translateToString(true));
      }
    }

    // Trim trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }

    return lines.join("\n");
  }

  /**
   * Get only the visible viewport content
   */
  getVisibleContent(): string {
    if (this.disposed) {
      throw new Error("Terminal session has been disposed");
    }

    const buffer = this.terminal.buffer.active;
    const lines: string[] = [];
    const baseY = buffer.baseY;

    for (let i = 0; i < this.terminal.rows; i++) {
      const line = buffer.getLine(baseY + i);
      if (line) {
        lines.push(line.translateToString(true));
      }
    }

    return lines.join("\n");
  }

  /**
   * Take a screenshot of the terminal state
   */
  takeScreenshot(): ScreenshotResult {
    if (this.disposed) {
      throw new Error("Terminal session has been disposed");
    }

    const buffer = this.terminal.buffer.active;

    return {
      content: this.getVisibleContent(),
      cursor: {
        x: buffer.cursorX,
        y: buffer.cursorY,
      },
      dimensions: {
        cols: this.terminal.cols,
        rows: this.terminal.rows,
      },
    };
  }

  /**
   * Clear the terminal screen
   */
  clear(): void {
    if (this.disposed) {
      throw new Error("Terminal session has been disposed");
    }
    this.terminal.clear();
  }

  /**
   * Resize the terminal
   */
  resize(cols: number, rows: number): void {
    if (this.disposed) {
      throw new Error("Terminal session has been disposed");
    }
    this.terminal.resize(cols, rows);
    this.ptyProcess.resize(cols, rows);
  }

  /**
   * Check if the session is still active
   */
  isActive(): boolean {
    return !this.disposed;
  }

  /**
   * Get terminal dimensions
   */
  getDimensions(): { cols: number; rows: number } {
    return {
      cols: this.terminal.cols,
      rows: this.terminal.rows,
    };
  }

  /**
   * Dispose of the terminal session
   */
  dispose(): void {
    if (!this.disposed) {
      this.disposed = true;
      this.ptyProcess.kill();
      this.terminal.dispose();
    }
  }
}
