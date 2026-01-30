import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type {
  RecordingMode,
  RecordingFormat,
  AsciicastHeader,
  AsciicastEvent,
  RecordingMetadata,
  StopReason,
} from "./types.js";

/**
 * Recorder handles writing asciicast v2 format recordings
 *
 * Asciicast v2 format:
 * - First line: JSON header with version, dimensions, timestamp
 * - Subsequent lines: JSON arrays [time, type, data]
 *   - time: seconds since start (float)
 *   - type: "o" for output, "r" for resize
 *   - data: string content
 */
export class Recorder {
  readonly id: string;
  private mode: RecordingMode;
  private format: RecordingFormat;
  private outputDir: string;
  private tempPath: string;
  private finalPath: string;
  private writeStream: fs.WriteStream | null = null;
  private startTime: number = 0;
  private bytesWritten: number = 0;
  private finalized: boolean = false;
  private idleTimeLimit: number;
  private lastEventTime: number = 0;
  private adjustedElapsed: number = 0;

  // Timeout settings
  private maxDuration: number;
  private inactivityTimeout: number;
  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private stopReason: StopReason = 'explicit';

  // Callback for auto-finalize events
  private onAutoFinalize?: (metadata: RecordingMetadata) => void;

  constructor(
    id: string,
    mode: RecordingMode,
    outputDir: string,
    format: RecordingFormat = 'v2',
    idleTimeLimit: number = 2,
    maxDuration: number = 3600,        // 60 minutes default
    inactivityTimeout: number = 600    // 10 minutes default
  ) {
    this.id = id;
    this.mode = mode;
    this.format = format;
    this.outputDir = outputDir;
    this.idleTimeLimit = idleTimeLimit;
    this.maxDuration = maxDuration;
    this.inactivityTimeout = inactivityTimeout;

    // Generate temp and final paths
    const timestamp = Date.now();
    const filename = `terminal-${timestamp}-${id}.cast`;
    this.tempPath = path.join(os.tmpdir(), `terminal-mcp-recording-${id}.cast`);
    this.finalPath = path.join(outputDir, filename);
  }

  /**
   * Start the recording
   * Writes the asciicast header to the temp file
   */
  start(width: number, height: number, env?: { SHELL?: string; TERM?: string }): void {
    if (this.writeStream) {
      throw new Error("Recording already started");
    }

    this.startTime = Date.now();

    // Ensure output directory exists
    fs.mkdirSync(this.outputDir, { recursive: true });

    // Create write stream to temp file
    this.writeStream = fs.createWriteStream(this.tempPath, { flags: 'w' });

    // Write header
    const header: AsciicastHeader = {
      version: 2,
      width,
      height,
      timestamp: Math.floor(this.startTime / 1000),
    };

    if (env) {
      header.env = env;
    }

    this.writeLine(JSON.stringify(header));

    // Set up max duration timer
    if (this.maxDuration > 0) {
      this.maxDurationTimer = setTimeout(() => {
        this._autoFinalize('max_duration');
      }, this.maxDuration * 1000);
    }

    // Set up initial inactivity timer
    if (this.inactivityTimeout > 0) {
      this.inactivityTimer = setTimeout(() => {
        this._autoFinalize('inactivity');
      }, this.inactivityTimeout * 1000);
    }
  }

  /**
   * Record output data
   */
  recordOutput(data: string): void {
    if (!this.writeStream || this.finalized) {
      return;
    }

    // Reset inactivity timer on each output event
    if (this.inactivityTimeout > 0 && this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = setTimeout(() => {
        this._autoFinalize('inactivity');
      }, this.inactivityTimeout * 1000);
    }

    const elapsed = this.getElapsedSeconds();
    const event: AsciicastEvent = [elapsed, 'o', data];
    this.writeLine(JSON.stringify(event));
  }

  /**
   * Record terminal resize event
   */
  recordResize(cols: number, rows: number): void {
    if (!this.writeStream || this.finalized) {
      return;
    }

    const elapsed = this.getElapsedSeconds();
    const event: AsciicastEvent = [elapsed, 'r', `${cols}x${rows}`];
    this.writeLine(JSON.stringify(event));
  }

  /**
   * Finalize the recording
   * - For 'always' mode: move temp file to output dir
   * - For 'on-failure' mode: move if exitCode !== 0, delete otherwise
   *
   * Returns metadata about the recording
   */
  async finalize(exitCode: number | null, stopReason?: StopReason): Promise<RecordingMetadata> {
    if (this.finalized) {
      throw new Error("Recording already finalized");
    }

    this.finalized = true;
    const endTime = Date.now();
    const durationMs = endTime - this.startTime;

    // Clear any active timers
    this.clearTimers();

    // Use provided stopReason or the internally tracked one
    const finalStopReason = stopReason ?? this.stopReason;

    // Close the write stream
    if (this.writeStream) {
      await new Promise<void>((resolve, reject) => {
        this.writeStream!.end((err: Error | null | undefined) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    let saved = false;
    let finalPath = this.tempPath;

    // Determine whether to save based on mode and exit code
    const shouldSave = this.mode === 'always' ||
                       (this.mode === 'on-failure' && exitCode !== 0 && exitCode !== null);

    if (shouldSave) {
      // Check if temp file exists before attempting to save
      if (!fs.existsSync(this.tempPath)) {
        // Temp file doesn't exist - recording may not have started properly or was cleaned up
        return {
          id: this.id,
          path: '',
          tempPath: this.tempPath,
          startTime: this.startTime,
          endTime,
          durationMs,
          bytesWritten: this.bytesWritten,
          exitCode,
          mode: this.mode,
          saved: false,
          stopReason: finalStopReason,
        };
      }

      // Ensure output directory exists (defensive check for cases where dir was deleted during recording)
      fs.mkdirSync(this.outputDir, { recursive: true });

      // Move temp file to final location
      try {
        fs.renameSync(this.tempPath, this.finalPath);
        finalPath = this.finalPath;
        saved = true;
      } catch (err) {
        // If rename fails (cross-device), try copy and delete
        try {
          fs.copyFileSync(this.tempPath, this.finalPath);
          fs.unlinkSync(this.tempPath);
          finalPath = this.finalPath;
          saved = true;
        } catch (copyErr) {
          // Both rename and copy failed - temp file may have been deleted
          console.error('[recorder] Failed to save recording:', copyErr);
          // Return with saved=false
        }
      }

      // Write metadata sidecar file only if recording was saved
      if (saved) {
        const metaPath = this.finalPath.replace(/\.cast$/, '.meta.json');
        const meta = {
          exitCode,
          durationMs,
          startTime: this.startTime,
          endTime,
          bytesWritten: this.bytesWritten,
          stopReason: finalStopReason,
        };
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
      }
    } else {
      // Delete temp file
      try {
        fs.unlinkSync(this.tempPath);
      } catch {
        // Ignore if already deleted
      }
    }

    return {
      id: this.id,
      path: saved ? finalPath : '',
      tempPath: this.tempPath,
      startTime: this.startTime,
      endTime,
      durationMs,
      bytesWritten: this.bytesWritten,
      exitCode,
      mode: this.mode,
      saved,
      stopReason: finalStopReason,
    };
  }

  /**
   * Check if recording is active
   */
  isActive(): boolean {
    return this.writeStream !== null && !this.finalized;
  }

  /**
   * Get the temp file path (for debugging/testing)
   */
  getTempPath(): string {
    return this.tempPath;
  }

  /**
   * Get the final file path
   */
  getFinalPath(): string {
    return this.finalPath;
  }

  private getElapsedSeconds(): number {
    const now = Date.now();

    if (this.lastEventTime === 0) {
      // First event - just record the time
      this.lastEventTime = now;
      this.adjustedElapsed = (now - this.startTime) / 1000;
      return this.adjustedElapsed;
    }

    // Calculate actual idle time since last event
    const idleTime = (now - this.lastEventTime) / 1000;

    // Cap idle time if limit is set and exceeded
    if (this.idleTimeLimit > 0 && idleTime > this.idleTimeLimit) {
      // Only add the capped idle time to our adjusted elapsed
      this.adjustedElapsed += this.idleTimeLimit;
    } else {
      // Add actual idle time
      this.adjustedElapsed += idleTime;
    }

    this.lastEventTime = now;
    return this.adjustedElapsed;
  }

  private writeLine(line: string): void {
    if (this.writeStream) {
      const data = line + '\n';
      this.writeStream.write(data);
      this.bytesWritten += Buffer.byteLength(data, 'utf8');
    }
  }

  /**
   * Clear all active timers
   */
  private clearTimers(): void {
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  /**
   * Auto-finalize the recording due to timeout
   * Called internally when max duration or inactivity timeout is reached
   */
  private async _autoFinalize(reason: StopReason): Promise<void> {
    if (this.finalized) {
      return;
    }

    this.stopReason = reason;
    const metadata = await this.finalize(null, reason);

    // Notify callback if registered
    if (this.onAutoFinalize) {
      this.onAutoFinalize(metadata);
    }
  }

  /**
   * Set callback for auto-finalize events (timeout triggered)
   */
  setOnAutoFinalize(callback: (metadata: RecordingMetadata) => void): void {
    this.onAutoFinalize = callback;
  }

  /**
   * Get timeout configuration and remaining time
   */
  getTimeoutInfo(): {
    maxDuration: number;
    inactivityTimeout: number;
    elapsedSeconds: number;
    remainingMaxDuration: number;
  } {
    const elapsedSeconds = this.startTime > 0 ? (Date.now() - this.startTime) / 1000 : 0;
    const remainingMaxDuration = this.maxDuration > 0 ? Math.max(0, this.maxDuration - elapsedSeconds) : -1;

    return {
      maxDuration: this.maxDuration,
      inactivityTimeout: this.inactivityTimeout,
      elapsedSeconds,
      remainingMaxDuration,
    };
  }
}
