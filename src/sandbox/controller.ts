import {
  SandboxManager,
  type SandboxRuntimeConfig,
} from "@anthropic-ai/sandbox-runtime";
import { SandboxPermissions, expandPath } from "./config.js";

export type SandboxPlatform = "darwin" | "linux" | "win32" | "unsupported";

export interface SandboxStatus {
  enabled: boolean;
  platform: SandboxPlatform;
  reason?: string;
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
   * Check if Linux dependencies are available
   */
  checkLinuxDependencies(): { supported: boolean; message?: string } {
    if (this.platform !== "linux") {
      return { supported: true };
    }
    const check = SandboxManager.checkDependencies();
    // If there are errors, dependencies are not available
    const supported = check.errors.length === 0;
    const message = supported ? undefined : check.errors.join("; ");
    return { supported, message };
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
        reason:
          this.platform === "win32"
            ? "Sandbox not available on Windows"
            : `Platform ${this.platform} is not supported`,
      };
    }

    // Check Linux dependencies
    if (this.platform === "linux") {
      const depCheck = this.checkLinuxDependencies();
      if (!depCheck.supported) {
        return {
          enabled: false,
          platform: this.platform,
          reason: depCheck.message ?? "Linux sandbox dependencies not available",
        };
      }
    }

    try {
      const config = this.toSandboxConfig(permissions);
      await SandboxManager.initialize(config, undefined, true);

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
   * Wrap a shell command with sandbox restrictions
   * Returns the wrapped command string to execute
   */
  async wrapShellCommand(
    shell: string,
    args: string[]
  ): Promise<{ cmd: string; args: string[] }> {
    if (!this.initialized) {
      throw new Error("Sandbox not initialized");
    }

    // Build the full command string
    const fullCommand = [shell, ...args].join(" ");

    // Wrap with sandbox
    const sandboxedCommand = await SandboxManager.wrapWithSandbox(
      fullCommand,
      shell
    );

    // The sandboxed command should be executed via shell
    // Return it as a shell -c command
    return {
      cmd: "/bin/sh",
      args: ["-c", sandboxedCommand],
    };
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
