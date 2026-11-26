import {
  SandboxManager,
  VENDORED_SRT_WIN_EXE,
  windowsInstallInstructions,
  type SandboxInitializeOptions,
  type SandboxRuntimeConfig,
} from "@anthropic-ai/sandbox-runtime";
import { SandboxPermissions, expandPath } from "./config.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export type SandboxPlatform = "darwin" | "linux" | "win32" | "unsupported";

export interface SandboxStatus {
  enabled: boolean;
  platform: SandboxPlatform;
  reason?: string;
}

export interface SandboxDependencyCheck {
  supported: boolean;
  message?: string;
}

/**
 * A shell invocation ready to be spawned as-is (no shell in between).
 */
export interface WrappedCommand {
  cmd: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}

/**
 * Quote one argument so it survives being re-parsed as a command line.
 * POSIX gets single quotes; Windows gets the double-quote rules that cmd.exe
 * and CommandLineToArgvW agree on.
 */
export function quoteShellArg(arg: string): string {
  if (process.platform === "win32") {
    return /^[A-Za-z0-9_.:\/\\-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, '""')}"`;
  }
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

/**
 * Windows `cmd.exe /c` expands `%NAME%` even inside double quotes, so a shell
 * path containing a percent-delimited segment cannot be launched from a
 * command string without changing its meaning. Refusing is better than
 * silently starting a different executable.
 */
export function assertLaunchableThroughCmd(argv: string[]): void {
  const suspect = argv.find((arg) => /%[^%\s]+%/.test(arg));
  if (suspect !== undefined) {
    throw new Error(
      `Sandbox cannot launch ${JSON.stringify(suspect)}: cmd.exe would expand the ` +
        `percent-delimited segment. Point --shell at a path without '%' characters.`
    );
  }
}

/**
 * Windows read grants may not reach what the one-time install's profile grant
 * excludes, so granting the profile root itself is refused at initialize().
 * The runtime already grants the profile minus those exclusions; only narrower
 * read-only paths need a grant of their own.
 */
function grantsBeyondProfileRoot(paths: string[]): string[] {
  const home = path.resolve(os.homedir()).toLowerCase();
  return paths.filter((entry) => {
    const resolved = path.resolve(entry).toLowerCase();
    return resolved !== home && !home.startsWith(resolved + path.sep);
  });
}

/**
 * Turn our permission model into sandbox-runtime configuration.
 *
 * Exported (and platform-parameterised) so the platform-specific parts can be
 * asserted from a single test run: the Windows branches are otherwise only
 * reachable on a Windows host with a provisioned sandbox.
 */
export function sandboxConfigFor(
  permissions: SandboxPermissions,
  platform: SandboxPlatform
): SandboxRuntimeConfig {
  const expandPaths = (paths: string[]): string[] => paths.map((p) => expandPath(p));

  // Configure network based on mode
  let allowedDomains: string[];
  const deniedDomains: string[] = [];

  switch (permissions.network.mode) {
    case "none":
      // Block all network by using empty allowed list
      allowedDomains = [];
      break;
    case "allowlist":
      allowedDomains = permissions.network.allowedDomains ?? [];
      break;
    case "all":
    default:
      // Allow all network access with wildcard
      allowedDomains = ["*"];
      break;
  }

  const config: SandboxRuntimeConfig = {
    filesystem: {
      // Read/write paths go to allowWrite
      allowWrite: expandPaths(permissions.filesystem.readWrite),
      // Blocked paths go to denyRead (blocks both read and write)
      denyRead: expandPaths(permissions.filesystem.blocked),
      // Read-only paths: allow read, deny write. On macOS/Linux that is the
      // default for anything not in allowWrite, so no allowRead entry is
      // needed; Windows is different (see below).
      denyWrite: [],
    },
    network: {
      allowedDomains,
      deniedDomains,
    },
    // Enable PTY support since we're spawning a shell
    allowPty: true,
  };

  if (platform === "win32") {
    // srt-win is not discovered on its own: the runtime only reads
    // windows.srtWin.path, and without it the dependency check fails with
    // "no srt-win path configured". Name the binary shipped in the package.
    config.windows = { srtWin: { path: VENDORED_SRT_WIN_EXE } };

    // The Windows sandbox runs commands as a separate `srt-sandbox` user with
    // write-restricted token, so it does not inherit the caller's read access
    // the way a POSIX child does. Read-only paths have to be granted
    // explicitly — except the profile root, which the install already grants
    // and which a session grant would be refused for.
    config.filesystem!.allowRead = grantsBeyondProfileRoot(
      expandPaths(permissions.filesystem.readOnly)
    );
  }

  return config;
}

/**
 * Controller that wraps sandbox-runtime for terminal-mcp
 * Manages sandbox lifecycle and command wrapping
 */
export class SandboxController {
  private initialized = false;
  private permissions: SandboxPermissions | null = null;
  private platform: SandboxPlatform;

  constructor() {
    // Get platform from Node
    const nodePlatform = process.platform;
    if (nodePlatform === "darwin" || nodePlatform === "linux" || nodePlatform === "win32") {
      this.platform = nodePlatform;
    } else {
      this.platform = "unsupported";
    }
  }

  /**
   * Get the current platform
   */
  getPlatform(): SandboxPlatform {
    return this.platform;
  }

  /**
   * Check if sandboxing is supported on this platform
   */
  isSupported(): boolean {
    return SandboxManager.isSupportedPlatform();
  }

  /**
   * Check the dependencies the sandbox needs on this platform.
   *
   * Upstream owns the list per platform (bubblewrap + socat + ripgrep on Linux,
   * the srt-win backend and its network filters on Windows, nothing extra on
   * macOS). The async form also resolves helpers off the event loop, and on
   * Windows it is the only form that can probe the backend at all.
   */
  async checkDependencies(): Promise<SandboxDependencyCheck> {
    if (this.platform === "win32") {
      // The runtime reads windows.srtWin.path out of configuration it has
      // already been given, so a pre-flight check cannot see the binary wired
      // up in toSandboxConfig() and would always answer "no srt-win path
      // configured". Check the packaged binary directly instead, and leave the
      // host-level prerequisites (sandbox user, WFP filters) to initialize(),
      // which runs with the config in place and reports them properly.
      if (!fs.existsSync(VENDORED_SRT_WIN_EXE)) {
        return {
          supported: false,
          message: `packaged srt-win binary is missing at ${VENDORED_SRT_WIN_EXE}`,
        };
      }
      return { supported: true };
    }

    const depCheck = await SandboxManager.checkDependenciesAsync();
    const supported = depCheck.errors.length === 0;
    return {
      supported,
      message: supported ? undefined : depCheck.errors.join("; "),
    };
  }

  /**
   * How to satisfy a failed {@link checkDependencies} on this platform, one
   * entry per line of output. Kept beside the check so the two cannot
   * disagree about what is actually missing.
   */
  setupInstructions(): string[] {
    switch (this.platform) {
      case "linux":
        return [
          "To install on Arch Linux:",
          "  sudo pacman -S bubblewrap socat ripgrep",
          "",
          "To install on Debian/Ubuntu:",
          "  sudo apt install bubblewrap socat ripgrep",
        ];
      case "win32":
        // sandbox-runtime refuses to initialize until this one-time install
        // has run, so print the command it wants rather than a bare error.
        return windowsInstallInstructions({}).split("\n");
      default:
        return [];
    }
  }

  /**
   * Clean up sandbox artifacts left by previous runs.
   *
   * sandbox-runtime keeps /dev/null stubs on the host for deny paths that do
   * not exist, and removes them itself from reset() (which cleanup() calls, so
   * a normal shutdown is covered). A session killed with SIGKILL never gets
   * there, and on the next run a stub sitting where a directory is expected
   * fails bubblewrap with "Can't mkdir parents for ...: Not a directory".
   *
   * So this stays as a safety net: it removes such a stub, and only when it is
   * a 0-byte file (a real .claude directory is never touched).
   */
  cleanupSandboxArtifacts(): void {
    // The stub is a bubblewrap artifact; macOS and Windows never produce it,
    // and deleting a deliberately empty .claude file there would be wrong.
    if (this.platform !== "linux") {
      return;
    }

    const claudePath = path.join(process.cwd(), ".claude");
    try {
      const stat = fs.statSync(claudePath);
      // If .claude is a file (not directory) and 0 bytes, it's a sandbox artifact
      if (stat.isFile() && stat.size === 0) {
        fs.unlinkSync(claudePath);
        if (process.env.DEBUG_SANDBOX) {
          console.error("[sandbox-debug] Cleaned up .claude artifact (0-byte file from previous sandbox run)");
        }
      }
    } catch {
      // File doesn't exist or can't be accessed - that's fine
    }
  }

  /**
   * Convert our permission model to sandbox-runtime config format
   */
  private toSandboxConfig(permissions: SandboxPermissions): SandboxRuntimeConfig {
    return sandboxConfigFor(permissions, this.platform);
  }

  /**
   * Initialize the sandbox with given permissions
   * Returns status indicating whether sandbox is active
   */
  async initialize(permissions: SandboxPermissions): Promise<SandboxStatus> {
    // Check platform support
    if (!this.isSupported()) {
      return {
        enabled: false,
        platform: this.platform,
        reason: `Platform ${this.platform} is not supported`,
      };
    }

    // Check the dependencies this platform needs
    const depCheck = await this.checkDependencies();
    if (!depCheck.supported) {
      return {
        enabled: false,
        platform: this.platform,
        reason: depCheck.message ?? "Sandbox dependencies not available",
      };
    }

    // Clean up any sandbox artifacts from previous runs
    // (see cleanupSandboxArtifacts: only a no-op unless a stub survived a kill)
    this.cleanupSandboxArtifacts();

    try {
      const config = this.toSandboxConfig(permissions);
      await SandboxManager.initialize(config, undefined, true, this.initializeOptions());

      this.initialized = true;
      this.permissions = permissions;

      return {
        enabled: true,
        platform: this.platform,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        enabled: false,
        platform: this.platform,
        reason: `Failed to initialize sandbox: ${message}`,
      };
    }
  }

  /**
   * Options sandbox-runtime only understands on Windows.
   */
  private initializeOptions(): SandboxInitializeOptions | undefined {
    if (this.platform !== "win32") {
      return undefined;
    }
    return {
      // Narrowing an older profile read grant can take minutes; without this
      // the first Windows run looks hung.
      onWindowsProfileGrantProgress: (line: string) => {
        console.error(`[terminal-mcp] ${line}`);
      },
    };
  }

  /**
   * Wrap a shell invocation with sandbox restrictions.
   *
   * Always returns argv, so callers spawn without a shell in between.
   *
   * macOS/Linux have a string wrapper that is run through `/bin/sh -c` — the
   * long-standing path here. Windows has no such thing: it wraps to an argv
   * array that must be spawned directly (that is the security boundary, since
   * a shell in between would re-expand the command), so it uses the argv form.
   */
  async wrapShellCommand(
    shell: string,
    args: string[],
    cwd?: string
  ): Promise<WrappedCommand> {
    if (!this.initialized) {
      throw new Error("Sandbox not initialized");
    }

    // The shell and its own flags are re-parsed from a command line, so quote
    // them: paths with spaces would otherwise split.
    const command = [shell, ...args].map(quoteShellArg).join(" ");

    if (this.platform === "win32") {
      assertLaunchableThroughCmd([shell, ...args]);

      // The inner shell parses this command line, so the two have to agree:
      // quoteShellArg emits cmd.exe rules, and the default inner shell is
      // `cmd.exe /d /s /c`. So cmd launches the user's shell instead of the
      // user's shell being handed the command line — passing `shell` here
      // would have pwsh/powershell/bash parse a cmd-quoted path, where a
      // quoted executable is a string expression and never a command.
      const { argv, env } = await SandboxManager.wrapWithSandboxArgv(
        command,
        undefined,
        undefined,
        undefined,
        cwd
      );

      if (process.env.DEBUG_SANDBOX) {
        console.error("[sandbox-debug] Generated argv:", argv.join(" "));
      }

      const [cmd, ...rest] = argv;
      return { cmd, args: rest, env: { ...env } };
    }

    const sandboxedCommand = await SandboxManager.wrapWithSandbox(command, shell);

    if (process.env.DEBUG_SANDBOX) {
      console.error("[sandbox-debug] Generated command:", sandboxedCommand);
    }

    return { cmd: "/bin/sh", args: ["-c", sandboxedCommand] };
  }

  /**
   * Check if sandbox is currently active
   */
  isActive(): boolean {
    return this.initialized;
  }

  /**
   * Get current permissions (if initialized)
   */
  getPermissions(): SandboxPermissions | null {
    return this.permissions;
  }

  /**
   * Cleanup sandbox resources
   */
  async cleanup(): Promise<void> {
    if (this.initialized) {
      await SandboxManager.reset();
      this.initialized = false;
      this.permissions = null;
    }
  }
}
