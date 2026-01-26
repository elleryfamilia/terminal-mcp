import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  RecordingMode,
  RecordingFormat,
  AsciicastHeader,
  AsciicastEvent,
  RecordingMetadata,
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

  constructor(
    id: string,
    mode: RecordingMode,
    outputDir: string,
    format: RecordingFormat = 'v2'
  ) {
    this.id = id;
    this.mode = mode;
    this.format = format;
    this.outputDir = outputDir;

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
  }

  /**
   * Record output data
   */
  recordOutput(data: string): void {
    if (!this.writeStream || this.finalized) {
      return;
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
  async finalize(exitCode: number | null): Promise<RecordingMetadata> {
    if (this.finalized) {
      throw new Error("Recording already finalized");
    }

    this.finalized = true;
    const endTime = Date.now();
    const durationMs = endTime - this.startTime;

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
      // Move temp file to final location
      try {
        fs.renameSync(this.tempPath, this.finalPath);
        finalPath = this.finalPath;
        saved = true;
      } catch (err) {
        // If rename fails (cross-device), copy and delete
        fs.copyFileSync(this.tempPath, this.finalPath);
        fs.unlinkSync(this.tempPath);
        finalPath = this.finalPath;
        saved = true;
      }

      // Write metadata sidecar file
      const metaPath = this.finalPath.replace(/\.cast$/, '.meta.json');
      const meta = {
        exitCode,
        durationMs,
        startTime: this.startTime,
        endTime,
        bytesWritten: this.bytesWritten,
      };
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
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
    return (Date.now() - this.startTime) / 1000;
  }

  private writeLine(line: string): void {
    if (this.writeStream) {
      const data = line + '\n';
      this.writeStream.write(data);
      this.bytesWritten += Buffer.byteLength(data, 'utf8');
    }
  }
}
