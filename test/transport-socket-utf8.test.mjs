import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { createSocketServer, createToolProxyServer } from "../dist/transport/index.js";
import { TerminalManager } from "../dist/terminal/index.js";
import { LineDecoder } from "../dist/utils/line-decoder.js";

const WAIT_TIMEOUT_MS = 5000;

/** Poll until predicate() is truthy or timeout; returns predicate's value. */
async function waitFor(predicate, { timeoutMs = WAIT_TIMEOUT_MS, stepMs = 20 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = predicate();
    if (v) return v;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

/** Resolves once `socket` has received at least `byteCount` bytes total,
 * proving the exact split point was delivered to the server (and thus the
 * decoder) before the remaining bytes are sent - not just "some data
 * event happened", which a stream could still coalesce with later bytes. */
function waitForBytes(socket, byteCount, timeoutMs = WAIT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let received = 0;
    if (received >= byteCount) return resolve();
    const timer = setTimeout(() => {
      socket.off("data", onData);
      reject(new Error(`waitForBytes timed out after ${timeoutMs}ms (received ${received}/${byteCount} bytes)`));
    }, timeoutMs);
    function onData(chunk) {
      received += chunk.length;
      if (received >= byteCount) {
        clearTimeout(timer);
        socket.off("data", onData);
        resolve();
      }
    }
    socket.on("data", onData);
  });
}

test("SocketTransport reassembles a multi-byte UTF-8 character split across two socket writes", async () => {
  const sockPath = path.join(os.tmpdir(), `tmcp-test-socket-transport-${process.pid}-${Date.now()}.sock`);
  let received = null;
  let client = null;
  const server = createSocketServer(sockPath, (transport) => {
    transport.onmessage = (message) => {
      received = message;
    };
  });

  try {
    const accepted = once(server, "connection", { signal: AbortSignal.timeout(WAIT_TIMEOUT_MS) });

    client = net.createConnection(sockPath);
    await new Promise((resolve, reject) => {
      client.once("connect", resolve);
      client.once("error", reject);
    });

    // U+1F680 ROCKET is 4 bytes in UTF-8 (F0 9F 9A 80). Split the raw bytes
    // in the middle of that sequence - not at a line or character boundary -
    // so a naive per-chunk `data.toString()` decodes each half as invalid
    // UTF-8 and replaces it with U+FFFD instead of reassembling the
    // original character.
    const payload = Buffer.from(
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "test", params: { text: "\u{1F680}" } }) + "\n",
      "utf8"
    );
    const splitAt = payload.indexOf(0xf0) + 2; // inside the rocket's 4-byte sequence

    const [serverSocket] = await accepted;
    // Wait for exactly `splitAt` bytes to arrive - not just "a data event"
    // - before sending the rest, so the split point is actually honored by
    // the transport rather than possibly coalescing with the second write.
    const firstHalfDelivered = waitForBytes(serverSocket, splitAt);
    client.write(payload.subarray(0, splitAt));
    await firstHalfDelivered;
    client.write(payload.subarray(splitAt));
    await waitFor(() => received !== null);

    assert.equal(received.params.text, "\u{1F680}", "the split character must reassemble correctly, not become replacement characters");
  } finally {
    // The client is destroyed here, unconditionally, before closing the
    // server - an assertion failure above must not leave the connection
    // open and hang server.close()'s callback forever.
    if (client) client.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("createToolProxyServer reassembles a multi-byte UTF-8 character split across two socket writes in a request", async () => {
  const sockPath = path.join(os.tmpdir(), `tmcp-test-tool-proxy-${process.pid}-${Date.now()}.sock`);
  const manager = new TerminalManager({});
  let server = null;
  let client = null;

  try {
    await manager.initSession();
    server = createToolProxyServer(sockPath, manager);

    // Observe the server's accepted connection directly, so the test can
    // wait for exactly the split point to arrive before sending the rest -
    // a fixed delay, or just "a data event happened", cannot guarantee
    // that, and could let both writes land as one chunk (or split
    // somewhere other than intended), passing the test without actually
    // exercising split-character reassembly at the intended byte.
    const accepted = once(server, "connection", { signal: AbortSignal.timeout(WAIT_TIMEOUT_MS) });

    client = net.createConnection(sockPath);
    await new Promise((resolve, reject) => {
      client.once("connect", resolve);
      client.once("error", reject);
    });

    // Reassemble the *response* with LineDecoder too - a naive
    // per-chunk toString() reader here would reintroduce the exact bug
    // being fixed and could fail this test even when the server's own
    // request decoding is correct.
    const decoder = new LineDecoder();
    const responses = new Map();
    client.on("data", (chunk) => {
      for (const line of decoder.push(chunk)) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        responses.set(msg.id, msg);
      }
    });

    // Type a multi-byte UTF-8 character split across two writes, mid-sequence.
    const payload = Buffer.from(
      JSON.stringify({ id: 1, method: "type", params: { text: "\u{1F680}" } }) + "\n",
      "utf8"
    );
    const splitAt = payload.indexOf(0xf0) + 2;

    const [serverSocket] = await accepted;
    const firstHalfDelivered = waitForBytes(serverSocket, splitAt);
    client.write(payload.subarray(0, splitAt));
    await firstHalfDelivered;
    client.write(payload.subarray(splitAt));

    const typeResponse = await waitFor(() => responses.get(1));
    assert.equal(typeResponse.error, undefined, `type request should not error: ${JSON.stringify(typeResponse)}`);

    // Confirm the terminal's actual rendered state has the correct
    // character before reading it back over the socket - handleType()
    // returns once the PTY write is issued, but the PTY output and xterm
    // rendering happen asynchronously, so the type response alone doesn't
    // guarantee the character has landed in the buffer getContent reads.
    await waitFor(() => manager.getVisibleContent().includes("\u{1F680}"));

    // Confirm the terminal actually received the correct character, not a
    // corrupted one, over the socket path itself - proves the request body
    // decoded correctly end-to-end, not just that *some* response came back.
    client.write(JSON.stringify({ id: 2, method: "getContent", params: { visibleOnly: true } }) + "\n");
    const getContentResponse = await waitFor(() => responses.get(2));
    const text = getContentResponse.result.content[0].text;
    assert.ok(text.includes("\u{1F680}"), `terminal content should contain the rocket emoji, got: ${JSON.stringify(text)}`);
  } finally {
    try {
      if (client) client.destroy();
      if (server) await new Promise((resolve) => server.close(resolve));
    } finally {
      await manager.disposeAsync();
    }
  }
});
