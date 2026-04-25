import * as pty from "node-pty";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import xtermHeadless from "@xterm/headless";
const { Terminal } = xtermHeadless;
import { getDefaultShell } from "../utils/platform.js";
import type { SandboxController } from "../sandbox/index.js";

// Custom prompt indicator for terminal-mcp.
// Includes "mcp" so it's unmistakable — many shell themes (oh-my-zsh,
// starship, etc.) already use ⚡ on its own and a bare lightning bolt
// would blend in. Used both as the rendered text and as the idempotency
// sentinel by the precmd hook.
const PROMPT_INDICATOR = "⚡ mcp";

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
  private resizeListeners: Array<(cols: number, rows: number) => void> = [];

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
      // Create temp rcfile that sources user's .bashrc then prepends our marker
      // to PS1 every prompt (so themes that rebuild PS1 in PROMPT_COMMAND can't
      // clobber it) and sets the terminal title.
      const homeDir = os.homedir();
      const bannerCmd = startupBanner ? `printf '%s\\n' '${escapeBannerForShell(startupBanner)}'` : "";
      const bashrcContent = `
# Source user's bashrc if it exists
[ -f "${homeDir}/.bashrc" ] && source "${homeDir}/.bashrc"
# Set initial terminal title
printf '\\033]0;[terminal-mcp]\\a'
# Prepend a marker to PS1 every prompt and refresh the title.
# Re-runs each PROMPT_COMMAND so themes that rebuild PS1 keep the marker.
_terminal_mcp_prompt_marker() {
  printf '\\033]0;[terminal-mcp] %s\\a' "\${PWD/#$HOME/~}"
  case "$PS1" in
    *"${PROMPT_INDICATOR}"*) ;;
    *) PS1="\\[\\033[30;43m\\] ${PROMPT_INDICATOR} \\[\\033[0m\\] $PS1" ;;
  esac
}
case "\${PROMPT_COMMAND:-}" in
  *_terminal_mcp_prompt_marker*) ;;
  *) PROMPT_COMMAND="_terminal_mcp_prompt_marker\${PROMPT_COMMAND:+; $PROMPT_COMMAND}" ;;
esac
# Print startup banner
${bannerCmd}
`;
      this.rcFile = path.join(os.tmpdir(), `terminal-mcp-bashrc-${process.pid}`);
      fs.writeFileSync(this.rcFile, bashrcContent);
      return { args: ["--rcfile", this.rcFile], env };
    }

    if (shellName === "zsh") {
      // Create temp ZDOTDIR with .zshrc that sources user's config then registers
      // a precmd hook (running LAST) that prepends our marker. This survives
      // theme regenerators like powerlevel10k / starship that rebuild PROMPT
      // every precmd.
      const homeDir = os.homedir();
      this.zdotdir = path.join(os.tmpdir(), `terminal-mcp-zsh-${process.pid}`);
      fs.mkdirSync(this.zdotdir, { recursive: true });

      const bannerCmd = startupBanner ? `printf '%s\\n' '${escapeBannerForShell(startupBanner)}'` : "";
      const zshrcContent = `
# Reset ZDOTDIR so nested zsh uses normal config
export ZDOTDIR="${homeDir}"
# Source user's zshrc if it exists
[ -f "${homeDir}/.zshrc" ] && source "${homeDir}/.zshrc"
# Set initial terminal title
print -Pn '\\e]0;[terminal-mcp]\\a'
# Prepend a marker to PROMPT every precmd and refresh the title.
# Registers AFTER user's zshrc so this hook fires after p10k/starship
# regenerate PROMPT.
autoload -Uz add-zsh-hook
_terminal_mcp_prompt_marker() {
  print -Pn '\\e]0;[terminal-mcp] %~\\a'
  if [[ "$PROMPT" != *"${PROMPT_INDICATOR}"* ]]; then
    PROMPT="%K{yellow}%F{black} ${PROMPT_INDICATOR} %f%k $PROMPT"
  fi
}
add-zsh-hook precmd _terminal_mcp_prompt_marker
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

      if (process.env.DEBUG_SANDBOX) {
        console.error("[sandbox-debug] Spawn command:", spawnCmd);
        console.error("[sandbox-debug] Spawn args:", spawnArgs.join(" "));
        console.error("[sandbox-debug] CWD:", options.cwd ?? process.cwd());
      }
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
   * Subscribe to terminal resize events
   */
  onResize(listener: (cols: number, rows: number) => void): void {
    this.resizeListeners.push(listener);
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
   * Get terminal content with ANSI color escape sequences preserved.
   * Reads the xterm.js cell buffer and reconstructs SGR sequences.
   */
  getAnsiContent(visibleOnly = false): string {
    if (this.disposed) {
      throw new Error("Terminal session has been disposed");
    }

    const buffer = this.terminal.buffer.active;
    const lines: string[] = [];

    const startLine = visibleOnly ? buffer.baseY : 0;
    const endLine = visibleOnly ? buffer.baseY + this.terminal.rows : buffer.length;

    for (let y = startLine; y < endLine; y++) {
      const line = buffer.getLine(y);
      if (!line) {
        lines.push("");
        continue;
      }

      let lineStr = "";
      let lastFg = -999;
      let lastFgMode = -999;
      let lastBg = -999;
      let lastBgMode = -999;
      let lastBold = false;
      let lastDim = false;
      let lastItalic = false;
      let lastUnderline = false;

      for (let x = 0; x < line.length; x++) {
        const cell = line.getCell(x);
        if (!cell) continue;
        const char = cell.getChars();

        const fg = cell.getFgColor();
        const fgMode = cell.getFgColorMode();
        const bg = cell.getBgColor();
        const bgMode = cell.getBgColorMode();
        const bold = cell.isBold() === 1;
        const dim = cell.isDim() === 1;
        const italic = cell.isItalic() === 1;
        const underline = cell.isUnderline() === 1;

        const attrChanged =
          fg !== lastFg || fgMode !== lastFgMode ||
          bg !== lastBg || bgMode !== lastBgMode ||
          bold !== lastBold || dim !== lastDim ||
          italic !== lastItalic || underline !== lastUnderline;

        if (attrChanged) {
          const sgr: string[] = [];

          // Reset if we had any prior styling
          if (lastFgMode !== -999) sgr.push("0");

          if (bold) sgr.push("1");
          if (dim) sgr.push("2");
          if (italic) sgr.push("3");
          if (underline) sgr.push("4");

          // Foreground
          if (fgMode === 0x1000000) {
            // P16
            sgr.push(fg < 8 ? `${30 + fg}` : `${90 + fg - 8}`);
          } else if (fgMode === 0x2000000) {
            // P256
            sgr.push(`38;5;${fg}`);
          } else if (fgMode === 0x3000000) {
            // RGB
            sgr.push(`38;2;${(fg >> 16) & 0xFF};${(fg >> 8) & 0xFF};${fg & 0xFF}`);
          }

          // Background
          if (bgMode === 0x1000000) {
            sgr.push(bg < 8 ? `${40 + bg}` : `${100 + bg - 8}`);
          } else if (bgMode === 0x2000000) {
            sgr.push(`48;5;${bg}`);
          } else if (bgMode === 0x3000000) {
            sgr.push(`48;2;${(bg >> 16) & 0xFF};${(bg >> 8) & 0xFF};${bg & 0xFF}`);
          }

          if (sgr.length > 0) {
            lineStr += `\x1b[${sgr.join(";")}m`;
          }

          lastFg = fg;
          lastFgMode = fgMode;
          lastBg = bg;
          lastBgMode = bgMode;
          lastBold = bold;
          lastDim = dim;
          lastItalic = italic;
          lastUnderline = underline;
        }

        lineStr += char || " ";
      }

      // Reset at end of line if we emitted any SGR
      if (lastFgMode !== -999) {
        lineStr += "\x1b[0m";
      }

      lines.push(lineStr);
    }

    // Trim trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1].replace(/\x1b\[[0-9;]*m/g, "").trim() === "") {
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

    // Notify all resize listeners
    for (const listener of this.resizeListeners) {
      listener(cols, rows);
    }
  }

  /**
   * Check if the session is still active
   */
  isActive(): boolean {
    return !this.disposed;
  }

  /**
   * Get the underlying xterm.js Terminal instance for direct buffer access.
   * Used by the color screenshot renderer.
   */
  getTerminal(): InstanceType<typeof Terminal> {
    if (this.disposed) {
      throw new Error("Terminal session has been disposed");
    }
    return this.terminal;
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
