import * as pty from "node-pty";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import xtermHeadless from "@xterm/headless";
const { Terminal } = xtermHeadless;
import { getDefaultShell } from "../utils/platform.js";
import type { SandboxController } from "../sandbox/index.js";

/**
 * Get system locale like Hyper does.
 * On macOS, reads from defaults. On Linux, checks environment.
 */
function getSystemLocale(): string {
  // Check if already set to UTF-8
  const lang = process.env.LANG || "";
  if (lang.toLowerCase().includes("utf-8") || lang.toLowerCase().includes("utf8")) {
    return lang;
  }

  try {
    if (process.platform === "darwin") {
      // macOS: read from system preferences
      const output = execSync("defaults read -g AppleLocale 2>/dev/null", {
        encoding: "utf8",
        timeout: 1000,
      }).trim();
      if (output) {
        // Convert format: en_US -> en_US.UTF-8
        return `${output.replace(/-/g, "_")}.UTF-8`;
      }
    }
  } catch {
    // Fall through to default
  }

  // Default to en_US.UTF-8
  return "en_US.UTF-8";
}

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
  /** Skip prompt customization and use user's native shell config */
  nativeShell?: boolean;
  /**
   * Also set LC_CTYPE in addition to LANG.
   * When false (default), only LANG is set, matching iTerm2 behavior.
   * When true, also sets LC_CTYPE which may cause issues when SSH'ing
   * to remote servers that don't have the same locales installed
   * (SSH forwards LC_* variables via SendEnv).
   */
  setLocaleEnv?: boolean;
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
   * Get a list of available UTF-8 locales on the system.
   * Returns the best one to use, preferring the user's existing locale if valid.
   */
  private getAvailableUtf8Locale(): string {
    const isUtf8 = (locale: string) =>
      locale.toLowerCase().includes("utf-8") || locale.toLowerCase().includes("utf8");

    // Check if user already has a UTF-8 locale set
    const userLang = process.env.LANG || "";
    const userLcAll = process.env.LC_ALL || "";

    if (isUtf8(userLcAll)) return userLcAll;
    if (isUtf8(userLang)) return userLang;

    // Try to detect available locales
    try {
      const { execSync } = require("child_process");
      const localeOutput = execSync("locale -a 2>/dev/null", {
        encoding: "utf8",
        timeout: 1000,
      });

      const locales = localeOutput.split("\n").filter((l: string) => isUtf8(l));

      // Prefer C.UTF-8 as it's most portable (available on most Linux systems)
      if (locales.includes("C.UTF-8")) return "C.UTF-8";
      if (locales.includes("C.utf8")) return "C.utf8";

      // Then try POSIX UTF-8 variants
      if (locales.includes("POSIX.UTF-8")) return "POSIX.UTF-8";

      // Then try en_US.UTF-8 variants
      const enUs = locales.find((l: string) => l.startsWith("en_US") && isUtf8(l));
      if (enUs) return enUs;

      // Use any available UTF-8 locale
      if (locales.length > 0) return locales[0];
    } catch {
      // locale command failed, use platform-specific defaults
    }

    // Platform-specific fallbacks
    if (process.platform === "darwin") {
      // macOS always has en_US.UTF-8
      return "en_US.UTF-8";
    }

    // Linux/other: C.UTF-8 is the most portable
    return "C.UTF-8";
  }

  /**
   * Ensure proper UTF-8 locale settings for the terminal.
   * Electron apps launched from Finder on macOS don't inherit shell locale settings,
   * which breaks programs like mosh that require UTF-8.
   */
  private ensureUtf8Locale(env: Record<string, string>): Record<string, string> {
    const result = { ...env };

    const isUtf8 = (locale: string) =>
      locale.toLowerCase().includes("utf-8") || locale.toLowerCase().includes("utf8");

    // Check current locale settings
    const lang = process.env.LANG || "";
    const lcCtype = process.env.LC_CTYPE || "";
    const lcAll = process.env.LC_ALL || "";

    // If already UTF-8, don't change anything
    if (isUtf8(lcAll) || (isUtf8(lang) && isUtf8(lcCtype))) {
      return result;
    }

    // Get a valid UTF-8 locale
    const targetLocale = this.getAvailableUtf8Locale();

    // Set LANG if not UTF-8
    if (!isUtf8(lang)) {
      result.LANG = targetLocale;
    }

    // Set LC_CTYPE specifically for character encoding (most important for mosh)
    if (!isUtf8(lcCtype)) {
      result.LC_CTYPE = targetLocale;
    }

    // Clear LC_ALL if it's set to a non-UTF-8 value (it overrides everything)
    if (lcAll && !isUtf8(lcAll)) {
      result.LC_ALL = "";
    }

    return result;
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

    // Determine shell type and set up custom prompt (unless nativeShell is enabled)
    const shellName = path.basename(shell);
    let args: string[] = [];
    let env: Record<string, string> = { ...options.env };

    if (options.nativeShell) {
      // Use native shell without customization - just set TERMINAL_MCP env var
      // Spawn as login shell so user's profile is sourced (sets up PATH, aliases, etc.)
      env.TERMINAL_MCP = "1";
      if (shellName === "zsh" || shellName === "bash" || shellName === "sh") {
        args = ["--login"];
      }
      // Set LANG for local UTF-8 support (like iTerm2's "Set locale environment
      // variables automatically"). By default we only set LANG, not LC_CTYPE,
      // because SSH's SendEnv forwards LC_* variables and remote servers may not
      // have the same locales installed. The system derives LC_CTYPE from LANG locally.
      const systemLocale = getSystemLocale();
      env.LANG = systemLocale;
      // Optionally set LC_CTYPE too (may cause SSH issues with remote servers)
      if (options.setLocaleEnv) {
        env.LC_CTYPE = systemLocale;
      }
    } else {
      // Set up terminal-mcp custom prompt
      const promptSetup = this.setupShellPrompt(shellName, options.env, options.startupBanner);
      args = promptSetup.args;
      env = promptSetup.env;
      // Ensure UTF-8 locale for MCP mode (headless operation)
      env = this.ensureUtf8Locale(env);
    }

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

    // Build the final environment for the PTY process
    // By default, filter out LC_* variables from inherited environment to avoid
    // SSH forwarding issues (SSH's SendEnv LC_* forwards these to remote servers
    // that may not have the same locales). We set LANG which is sufficient for
    // local UTF-8 support - the shell derives other locale settings from LANG.
    const baseEnv: Record<string, string> = {};
    const filterLcVars = options.nativeShell && !options.setLocaleEnv;
    for (const [key, value] of Object.entries(process.env)) {
      // Skip LC_* variables when filtering is enabled
      if (filterLcVars && key.startsWith("LC_")) {
        continue;
      }
      if (value !== undefined) {
        baseEnv[key] = value;
      }
    }

    // Spawn PTY process
    this.ptyProcess = pty.spawn(spawnCmd, spawnArgs, {
      name: "xterm-256color",
      cols,
      rows,
      cwd: options.cwd ?? process.cwd(),
      env: { ...baseEnv, ...env },
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
   * Get terminal dimensions
   */
  getDimensions(): { cols: number; rows: number } {
    return {
      cols: this.terminal.cols,
      rows: this.terminal.rows,
    };
  }

  /**
   * Get the current foreground process name
   * On macOS/Linux this returns the actual process running in the terminal
   */
  getProcess(): string {
    if (this.disposed) {
      return "shell";
    }
    try {
      // node-pty's process property returns the current foreground process
      return this.ptyProcess.process || "shell";
    } catch {
      return "shell";
    }
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
