import { test } from "node:test";
import assert from "node:assert/strict";
import { LineDecoder } from "../dist/utils/line-decoder.js";

test("returns no lines for a chunk with no newline yet", () => {
  const d = new LineDecoder();
  assert.deepEqual(d.push(Buffer.from("partial")), []);
});

test("returns one line once its newline arrives, holding the next partial line", () => {
  const d = new LineDecoder();
  assert.deepEqual(d.push(Buffer.from("line one\nline two")), ["line one"]);
  assert.deepEqual(d.push(Buffer.from(" continues\n")), ["line two continues"]);
});

test("returns multiple complete lines delivered in a single chunk", () => {
  const d = new LineDecoder();
  assert.deepEqual(d.push(Buffer.from("a\nb\nc\n")), ["a", "b", "c"]);
});

test("reassembles a multi-byte UTF-8 character split across two chunks, deterministically", () => {
  // U+1F680 ROCKET is 4 bytes in UTF-8 (F0 9F 9A 80). Split the raw bytes
  // in the middle of that sequence - not at a line or character boundary -
  // so a naive per-chunk decode would see two invalid partial sequences
  // instead of reassembling the original character. Calling push() twice
  // directly, with no socket or timing involved, makes this deterministic:
  // unlike an integration test over a real socket, there is no way for the
  // two chunks to be coalesced into one `data` event before the assertion.
  const payload = Buffer.from("\u{1F680}\n", "utf8");
  const splitAt = payload.indexOf(0xf0) + 2; // inside the rocket's 4-byte sequence
  const d = new LineDecoder();
  assert.deepEqual(d.push(payload.subarray(0, splitAt)), []);
  assert.deepEqual(d.push(payload.subarray(splitAt)), ["\u{1F680}"]);
});

test("a fresh instance starts with no leftover state from another instance", () => {
  const first = new LineDecoder();
  first.push(Buffer.from("leftover, no trailing newline"));
  const second = new LineDecoder();
  assert.deepEqual(second.push(Buffer.from("fresh\n")), ["fresh"]);
});
