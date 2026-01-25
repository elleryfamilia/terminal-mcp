import * as path from "path";
import * as os from "os";

/**
 * Get the default IPC path for cross-platform communication.
 * Uses named pipes on Windows, Unix sockets elsewhere.
 */
export function getDefaultSocketPath(): string {
  if (process.platform === "win32") {
    return "\\\\.\\pipe\\terminal-mcp";
  }
  return path.join(os.tmpdir(), "terminal-mcp.sock");
}

/**
 * Get the default shell for the current platform.
 */
export function getDefaultShell(): string {
  if (process.platform === "win32") {
    return process.env.COMSPEC || "cmd.exe";
  }
  return process.env.SHELL || "/bin/bash";
}
