import { StringDecoder } from "string_decoder";

/**
 * Reassembles newline-delimited text frames out of a stream of raw byte
 * chunks, one decoder per logical connection. A StringDecoder (rather than
 * `chunk.toString()` per call) holds a multi-byte UTF-8 sequence split
 * across two chunks until it's complete, so it decodes correctly instead of
 * becoming replacement characters. Partial state (both the undecoded tail
 * bytes and the decoded-but-not-yet-newline-terminated buffer) is private to
 * each instance, so a stale connection's half-received frame can never leak
 * into a different connection's decoder.
 */
export class LineDecoder {
  private buffer = "";
  private readonly decoder = new StringDecoder("utf8");

  /**
   * Feed one chunk of raw bytes. Returns every complete line it produced,
   * in order; a trailing partial line (no terminating "\n" yet) is held
   * internally until a future chunk completes it.
   */
  push(chunk: Buffer): string[] {
    this.buffer += this.decoder.write(chunk);
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";
    return lines;
  }
}
