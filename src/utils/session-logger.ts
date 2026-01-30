/**
 * Session Logger
 *
 * Logs MCP session activity to temp files in JSONL format.
 * Files are named with PID to enable stale file cleanup on startup.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { SessionLogEntry } from "../types/mcp-client-info.js";

const SESSION_DIR = path.join(os.tmpdir(), "terminal-mcp-sessions");

export class SessionLogger {
  private filePath: string;
  private writeStream: fs.WriteStream | null = null;
  private isDisposed = false;

  constructor() {
    // Ensure directory exists
    fs.mkdirSync(SESSION_DIR, { recursive: true });

    // Create file with PID in name for stale detection
    const timestamp = Date.now();
    this.filePath = path.join(SESSION_DIR, `session-${process.pid}-${timestamp}.jsonl`);

    // Open write stream in append mode
    this.writeStream = fs.createWriteStream(this.filePath, { flags: "a" });

    // Handle stream errors gracefully
    this.writeStream.on("error", (err) => {
      console.error("[session-logger] Write stream error:", err);
    });
  }

  /**
   * Log an entry to the session file
   */
  log(entry: SessionLogEntry): void {
    if (this.isDisposed || !this.writeStream) {
      return;
    }

    try {
      this.writeStream.write(JSON.stringify(entry) + "\n");
    } catch (err) {
      console.error("[session-logger] Failed to write log entry:", err);
    }
  }

  /**
   * Get the path to the log file
   */
  getFilePath(): string {
    return this.filePath;
  }

  /**
   * Close the logger and clean up the temp file
   */
  close(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;

    // End the write stream
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
    }

    // Remove the temp file
    try {
      fs.unlinkSync(this.filePath);
    } catch {
      // Ignore errors if file doesn't exist
    }
  }

  /**
   * Clean up stale session files from crashed processes
   * Should be called on application startup
   */
  static cleanupStale(): Promise<number> {
    return new Promise((resolve) => {
      let cleaned = 0;

      try {
        // Ensure directory exists
        if (!fs.existsSync(SESSION_DIR)) {
          resolve(0);
          return;
        }

        const files = fs.readdirSync(SESSION_DIR);

        for (const file of files) {
          // Parse PID from filename: session-<pid>-<timestamp>.jsonl
          const match = file.match(/^session-(\d+)-\d+\.jsonl$/);
          if (!match) {
            continue;
          }

          const filePid = parseInt(match[1], 10);

          // Check if process is still running
          if (!isProcessRunning(filePid)) {
            // Process is dead, clean up the file
            const filePath = path.join(SESSION_DIR, file);
            try {
              fs.unlinkSync(filePath);
              cleaned++;
              console.log(`[session-logger] Cleaned stale file: ${file}`);
            } catch (err) {
              console.error(`[session-logger] Failed to clean ${file}:`, err);
            }
          }
        }
      } catch (err) {
        console.error("[session-logger] Error during stale cleanup:", err);
      }

      resolve(cleaned);
    });
  }
}

/**
 * Check if a process with given PID is still running
 */
function isProcessRunning(pid: number): boolean {
  try {
    // Signal 0 doesn't send anything but checks if process exists
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
