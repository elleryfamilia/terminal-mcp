import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/**
 * Sandbox filesystem permission configuration
 */
export interface FilesystemPermissions {
  /** Paths with full read/write access */
  readWrite: string[];
  /** Paths with read-only access */
  readOnly: string[];
  /** Paths completely blocked from access */
  blocked: string[];
}

/**
 * Sandbox network permission configuration
 */
export interface NetworkPermissions {
  /** Network access mode */
  mode: "all" | "none" | "allowlist";
  /** Allowed domains when mode is 'allowlist' */
  allowedDomains?: string[];
}

/**
 * Full sandbox permissions configuration
 */
export interface SandboxPermissions {
  filesystem: FilesystemPermissions;
  network: NetworkPermissions;
}

/**
 * Default permissions for sandbox mode
 * Provides reasonable defaults while blocking sensitive directories
 * Allows shell-related files to be writable for normal shell operation
 */
export const DEFAULT_PERMISSIONS: SandboxPermissions = {
  filesystem: {
    readWrite: [
      // Core paths
      ".",              // Current working directory
      "/tmp",           // Temp files

      // Shell operation
      "~/.cache",       // Cache files (oh-my-zsh, etc.)
      "~/.local",       // Local user data
      "~/.zsh_history", // Zsh history
      "~/.bash_history", // Bash history
      "~/.node_repl_history", // Node REPL history
      "~/.python_history", // Python history

      // Package managers
      "~/.npm",
      "~/.yarn",
      "~/.pnpm",
      "~/.bun",
    ],
    readOnly: [
      "~",              // Home directory (general read access)
    ],
    blocked: [
      // SSH/GPG
      "~/.ssh",
      "~/.gnupg",

      // Cloud credentials
      "~/.aws",
      "~/.config/gcloud",
      "~/.azure",
      "~/.kube",

      // CLI credentials
      "~/.config/gh",

      // Auth tokens
      "~/.npmrc",
      "~/.netrc",
      "~/.docker/config.json",
    ],
  },
  network: {
    mode: "all",
  },
};

/**
 * Expand ~ to home directory in a path
 */
export function expandPath(p: string): string {
  if (p.startsWith("~/")) {
    return path.join(os.homedir(), p.slice(2));
  }
  if (p === "~") {
    return os.homedir();
  }
  if (p === ".") {
    return process.cwd();
  }
  return path.resolve(p);
}

/**
 * Load sandbox configuration from a JSON file
 */
export function loadConfigFromFile(filePath: string): SandboxPermissions {
  const expandedPath = expandPath(filePath);

  if (!fs.existsSync(expandedPath)) {
    throw new Error(`Sandbox config file not found: ${expandedPath}`);
  }

  const content = fs.readFileSync(expandedPath, "utf-8");
  let config: unknown;

  try {
    config = JSON.parse(content);
  } catch {
    throw new Error(`Invalid JSON in sandbox config file: ${expandedPath}`);
  }

  return validateConfig(config);
}

/**
 * Validate and normalize a config object
 */
function validateConfig(config: unknown): SandboxPermissions {
  if (typeof config !== "object" || config === null) {
    throw new Error("Sandbox config must be an object");
  }

  const obj = config as Record<string, unknown>;
  const result: SandboxPermissions = {
    filesystem: {
      readWrite: [],
      readOnly: [],
      blocked: [],
    },
    network: {
      mode: "all",
    },
  };

  // Validate filesystem config
  if (obj.filesystem && typeof obj.filesystem === "object") {
    const fs = obj.filesystem as Record<string, unknown>;

    if (Array.isArray(fs.readWrite)) {
      result.filesystem.readWrite = fs.readWrite.filter(
        (p): p is string => typeof p === "string"
      );
    }

    if (Array.isArray(fs.readOnly)) {
      result.filesystem.readOnly = fs.readOnly.filter(
        (p): p is string => typeof p === "string"
      );
    }

    if (Array.isArray(fs.blocked)) {
      result.filesystem.blocked = fs.blocked.filter(
        (p): p is string => typeof p === "string"
      );
    }
  }

  // Validate network config
  if (obj.network && typeof obj.network === "object") {
    const net = obj.network as Record<string, unknown>;

    if (net.mode === "all" || net.mode === "none" || net.mode === "allowlist") {
      result.network.mode = net.mode;
    }

    if (Array.isArray(net.allowedDomains)) {
      result.network.allowedDomains = net.allowedDomains.filter(
        (d): d is string => typeof d === "string"
      );
    }
  }

  return result;
}

/**
 * Merge user selections with defaults
 */
export function mergePermissions(
  base: SandboxPermissions,
  overrides: Partial<SandboxPermissions>
): SandboxPermissions {
  return {
    filesystem: {
      readWrite: overrides.filesystem?.readWrite ?? base.filesystem.readWrite,
      readOnly: overrides.filesystem?.readOnly ?? base.filesystem.readOnly,
      blocked: overrides.filesystem?.blocked ?? base.filesystem.blocked,
    },
    network: {
      mode: overrides.network?.mode ?? base.network.mode,
      allowedDomains: overrides.network?.allowedDomains ?? base.network.allowedDomains,
    },
  };
}
