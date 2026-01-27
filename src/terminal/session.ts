import * as pty from "@homebridge/node-pty-prebuilt-multiarch";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import xtermHeadless from "@xterm/headless";
const { Terminal } = xtermHeadless;
import { getDefaultShell } from "../utils/platform.js";
import type { SandboxController } from "../sandbox/index.js";

// Custom prompt indicator for terminal-mcp
const PROMPT_INDICATOR = "⚡";

export interface TerminalSessionOptions {
  cols?: number;
  rows?: number;
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
  startupBanner?: string;
  sandboxController?: SandboxController;
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
  private ptyProcess!: pty.IPty;
  private terminal!: InstanceType<typeof Terminal>;
  private disposed = false;
  private dataListeners: Array<(data: string) => void> = [];
  private exitListeners: Array<(code: number) => void> = [];

  private rcFile: string | null = null;
  private zdotdir: string | null = null;

  /**
   * Private constructor - use TerminalSession.create() instead
   */
  private constructor() {}

  /**
   * Factory method to create a TerminalSession
   * Use this instead of the constructor to support async sandbox initialization
   */
  static async create(options: TerminalSessionOptions = {}): Promise<TerminalSession> {
    const session = new TerminalSession();
    await session.initialize(options);
    return session;
  }

  /**
   * Set up shell-specific prompt customization
   * Returns args to pass to shell and env modifications
   */
  private setupShellPrompt(
    shellName: string,
    extraEnv?: Record<string, string>,
    startupBanner?: string
  ): { args: string[]; env: Record<string, string> } {
    const env: Record<string, string> = {
      TERMINAL_MCP: "1",
      ...extraEnv,
    };

    // Escape banner for use in shell scripts
    const escapeBannerForShell = (banner: string) => {
      // Escape single quotes and backslashes for shell
      return banner.replace(/'/g, "'\\''");
    };

    if (shellName === "bash" || shellName === "sh") {
      // Create temp rcfile that sources user's .bashrc then sets our prompt
      const homeDir = os.homedir();
      const bannerCmd = startupBanner ? `printf '%s\\n' '${escapeBannerForShell(startupBanner)}'` : "";
      const bashrcContent = `
# Source user's bashrc if it exists
[ -f "${homeDir}/.bashrc" ] && source "${homeDir}/.bashrc"
# Set terminal-mcp prompt
PS1="${PROMPT_INDICATOR} \\$ "
# Print startup banner
${bannerCmd}
`;
      this.rcFile = path.join(os.tmpdir(), `terminal-mcp-bashrc-${process.pid}`);
      fs.writeFileSync(this.rcFile, bashrcContent);
      return { args: ["--rcfile", this.rcFile], env };
    }

    if (shellName === "zsh") {
      // Create temp ZDOTDIR with .zshrc that sources user's config then sets prompt
      const homeDir = os.homedir();
      this.zdotdir = path.join(os.tmpdir(), `terminal-mcp-zsh-${process.pid}`);
      fs.mkdirSync(this.zdotdir, { recursive: true });

      const bannerCmd = startupBanner ? `printf '%s\\n' '${escapeBannerForShell(startupBanner)}'` : "";
      const zshrcContent = `
# Reset ZDOTDIR so nested zsh uses normal config
export ZDOTDIR="${homeDir}"
# Source user's zshrc if it exists
[ -f "${homeDir}/.zshrc" ] && source "${homeDir}/.zshrc"
# Set terminal-mcp prompt
PROMPT="${PROMPT_INDICATOR} %# "
# Print startup banner
${bannerCmd}
`;
      fs.writeFileSync(path.join(this.zdotdir, ".zshrc"), zshrcContent);
      env.ZDOTDIR = this.zdotdir;
      return { args: [], env };
    }

    // PowerShell (pwsh is PowerShell Core, powershell is Windows PowerShell)
    if (
      shellName === "powershell" ||
      shellName === "powershell.exe" ||
      shellName === "pwsh" ||
      shellName === "pwsh.exe"
    ) {
      env.TERMINAL_MCP_PROMPT = "1";
      return { args: ["-NoLogo"], env };
    }

    // Windows cmd.exe
    if (shellName === "cmd" || shellName === "cmd.exe") {
      env.PROMPT = `${PROMPT_INDICATOR} $P$G`;
      return { args: [], env };
    }

    // For other shells, just set env vars and hope for the best
    env.PS1 = `${PROMPT_INDICATOR} $ `;
    return { args: [], env };
  }

  /**
   * Initialize the terminal session
   * This is called by the create() factory method
   */
  private async initialize(options: TerminalSessionOptions): Promise<void> {
    const cols = options.cols ?? 120;
    const rows = options.rows ?? 40;
    const shell = options.shell ?? getDefaultShell();

    // Create headless terminal emulator
    this.terminal = new Terminal({
      cols,
      rows,
      scrollback: 1000,
      allowProposedApi: true,
    });

    // Determine shell type and set up custom prompt
    const shellName = path.basename(shell);
    const { args, env } = this.setupShellPrompt(shellName, options.env, options.startupBanner);

    // Determine spawn command - may be wrapped by sandbox
    let spawnCmd = shell;
    let spawnArgs = args;

    if (options.sandboxController?.isActive()) {
      const wrapped = await options.sandboxController.wrapShellCommand(shell, args);
      spawnCmd = wrapped.cmd;
      spawnArgs = wrapped.args;
    }

    // Spawn PTY process
    this.ptyProcess = pty.spawn(spawnCmd, spawnArgs, {
      name: "xterm-256color",
      cols,
      rows,
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...env } as Record<string, string>,
    });

    // Pipe PTY output to terminal emulator and listeners
    this.ptyProcess.onData((data) => {
      if (!this.disposed) {
        this.terminal.write(data);
        // Notify all data listeners
        for (const listener of this.dataListeners) {
          listener(data);
        }
      }
    });

    this.ptyProcess.onExit(({ exitCode }) => {
      this.disposed = true;
      for (const listener of this.exitListeners) {
        listener(exitCode);
      }
    });
  }

  /**
   * Subscribe to PTY output data
   */
  onData(listener: (data: string) => void): void {
    this.dataListeners.push(listener);
  }

  /**
   * Subscribe to PTY exit
   */
  onExit(listener: (code: number) => void): void {
    this.exitListeners.push(listener);
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

      // Clean up temp rc files
      if (this.rcFile) {
        try {
          fs.unlinkSync(this.rcFile);
        } catch {
          // Ignore cleanup errors
        }
      }
      if (this.zdotdir) {
        try {
          fs.rmSync(this.zdotdir, { recursive: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }
}
