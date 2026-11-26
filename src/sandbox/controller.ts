import {
  SandboxManager,
  type SandboxInitializeOptions,
  type SandboxRuntimeConfig,
} from "@anthropic-ai/sandbox-runtime";
import { SandboxPermissions, expandPath } from "./config.js";
import * as fs from "fs";
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
    const depCheck = await SandboxManager.checkDependenciesAsync();
    const supported = depCheck.errors.length === 0;
    return {
      supported,
      message: supported ? undefined : depCheck.errors.join("; "),
    };
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
    // Expand all paths
    const expandPaths = (paths: string[]): string[] =>
      paths.map((p) => expandPath(p));

    // Configure network based on mode
    let allowedDomains: string[];
    let deniedDomains: string[] = [];

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
        // Read-only paths: we want to allow read but deny write
        // Paths not in allowWrite are read-only by default
        denyWrite: [],
      },
      network: {
        allowedDomains,
        deniedDomains,
      },
      // Enable PTY support since we're spawning a shell
      allowPty: true,
    };

    return config;
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
      const { argv, env } = await SandboxManager.wrapWithSandboxArgv(
        command,
        shell,
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
