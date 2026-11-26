import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawnNode, sleep, waitFor, initialize, callTool, findResponse, respondOk } from "./helpers.mjs";

test("client mode starts, lists tools, with no socket present", async () => {
  const sockPath = path.join(os.tmpdir(), `tmcp-test-none-${process.pid}-${Date.now()}.sock`);
  const state = spawnNode(["dist/index.js", "--socket", sockPath]);

  try {
    await initialize(state);
    state.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n");
    const res = await waitFor(() => findResponse(state, 2));
    assert.ok(res.result.tools.some((t) => t.name === "getContent"), "tools/list must return the known tool set without opening any socket");
    assert.equal(state.exit, null, "process must not exit just because no session is running");
  } finally {
    state.child.kill("SIGKILL");
  }
});

test("tool call with no socket present returns a friendly isError result naming terminal-mcp", async () => {
  const sockPath = path.join(os.tmpdir(), `tmcp-test-friendly-${process.pid}-${Date.now()}.sock`);
  const state = spawnNode(["dist/index.js", "--socket", sockPath]);

  try {
    await initialize(state);
    callTool(state, 2, "getContent", {});
    const res = await waitFor(() => findResponse(state, 2));
    assert.equal(res.result.isError, true);
    assert.match(res.result.content[0].text, /terminal-mcp/);
    assert.equal(state.exit, null);
  } finally {
    state.child.kill("SIGKILL");
  }
});

test("concurrent tool calls while disconnected dedupe to one connect attempt, then all succeed over one connection once a session appears", async () => {
  const sockPath = path.join(os.tmpdir(), `tmcp-test-concurrent-${process.pid}-${Date.now()}.sock`);
  const state = spawnNode(["dist/index.js", "--socket", sockPath]);
  let acceptedConnections = 0;
  let server = null;

  try {
    await initialize(state);
    // Two calls fired back-to-back before any socket exists must not spawn two
    // parallel connect attempts (the connecting-promise dedupe), and both must
    // settle (not hang) once the shared connect attempt fails.
    callTool(state, 2, "getContent", {});
    callTool(state, 3, "getContent", {});
    const [r2, r3] = await Promise.all([
      waitFor(() => findResponse(state, 2)),
      waitFor(() => findResponse(state, 3)),
    ]);
    assert.equal(r2.result.isError, true);
    assert.equal(r3.result.isError, true);

    server = net.createServer((c) => { acceptedConnections++; respondOk(c); });
    await new Promise((resolve) => server.listen(sockPath, resolve));

    callTool(state, 4, "getContent", {});
    callTool(state, 5, "getContent", {});
    const [r4, r5] = await Promise.all([
      waitFor(() => findResponse(state, 4)),
      waitFor(() => findResponse(state, 5)),
    ]);
    assert.equal(r4.result.content[0].text, "ok");
    assert.equal(r5.result.content[0].text, "ok");
    assert.equal(acceptedConnections, 1, "two concurrent calls against the same live socket must reuse one connection, not open two");
  } finally {
    state.child.kill("SIGKILL");
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});

test("in-flight call rejects with a session-ended error when the session drops mid-call", async () => {
  const sockPath = path.join(os.tmpdir(), `tmcp-test-midcall-${process.pid}-${Date.now()}.sock`);
  const state = spawnNode(["dist/index.js", "--socket", sockPath]);
  let server = null;

  try {
    await initialize(state);

    let conn = null;
    let gotRequest = false;
    let buf = "";
    // Deliberately never responds; only records that a complete request line
    // arrived, so the test destroys the connection after the request is truly
    // in flight rather than racing the client's own write.
    server = net.createServer((c) => {
      conn = c;
      c.on("data", (d) => {
        buf += d.toString();
        if (buf.includes("\n")) gotRequest = true;
      });
    });
    await new Promise((resolve) => server.listen(sockPath, resolve));

    callTool(state, 2, "getContent", {});
    await waitFor(() => gotRequest);
    conn.destroy();
    const res = await waitFor(() => findResponse(state, 2));
    assert.equal(res.result.isError, true);
    assert.match(res.result.content[0].text, /session ended/i);
  } finally {
    state.child.kill("SIGKILL");
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});

test("connects once a session appears after startup, surviving a fragmented first response", async () => {
  const sockPath = path.join(os.tmpdir(), `tmcp-test-later-${process.pid}-${Date.now()}.sock`);
  const state = spawnNode(["dist/index.js", "--socket", sockPath]);
  let server = null;

  try {
    await initialize(state);

    let conn = null;
    let buf = "";
    server = net.createServer((c) => {
      conn = c;
      // Buffer incoming request bytes same as the real transport does; a
      // request line is not guaranteed to arrive in a single `data` event
      // either, so this mock must not assume chunk-equals-frame any more
      // than the production code it is standing in for.
      c.on("data", (d) => {
        buf += d.toString();
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const req = JSON.parse(line);
          const payload = JSON.stringify({ id: req.id, result: { content: [{ type: "text", text: "ok" }] } }) + "\n";
          // Split the *response* across two separate socket writes as an
          // end-to-end sanity check of the real socket plumbing. The two
          // writes are not guaranteed to land in two separate `data` events
          // (test/line-decoder.test.mjs proves the reassembly itself
          // deterministically, by calling push() directly with no socket in
          // the way); this test only confirms attachSocket wires that logic
          // up correctly against a real net.Socket.
          c.write(payload.slice(0, 5));
          setTimeout(() => c.write(payload.slice(5)), 5);
        }
      });
    });
    await new Promise((resolve) => server.listen(sockPath, resolve));

    callTool(state, 3, "getContent", {});
    const res = await waitFor(() => findResponse(state, 3));
    assert.equal(res.result.isError, undefined);
    assert.equal(res.result.content[0].text, "ok");
  } finally {
    state.child.kill("SIGKILL");
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});

test("recovers after a connection drops mid-response with a partial (incomplete) frame", async () => {
  const sockPath = path.join(os.tmpdir(), `tmcp-test-partial-${process.pid}-${Date.now()}.sock`);
  const state = spawnNode(["dist/index.js", "--socket", sockPath]);
  let server = null;
  let replacement = null;

  try {
    await initialize(state);

    let conn = null;
    server = net.createServer((c) => {
      conn = c;
      c.on("data", () => {
        // Send only half a response line, then vanish - the client's
        // per-connection buffer must discard this partial frame on close,
        // not prefix it onto the next connection's first response.
        c.write('{"id":2,"result":{"con');
        setTimeout(() => c.destroy(), 5);
      });
    });
    await new Promise((resolve) => server.listen(sockPath, resolve));

    callTool(state, 2, "getContent", {});
    await waitFor(() => findResponse(state, 2));
    assert.match(findResponse(state, 2).result.content[0].text, /session ended/i);

    await new Promise((resolve) => server.close(resolve));
    replacement = net.createServer((c) => respondOk(c));
    await new Promise((resolve) => replacement.listen(sockPath, resolve));

    callTool(state, 3, "getContent", {});
    const res = await waitFor(() => findResponse(state, 3));
    assert.equal(res.result.isError, undefined);
    assert.equal(res.result.content[0].text, "ok", "a stale partial frame from the dead connection must not corrupt the replacement connection's response");
  } finally {
    state.child.kill("SIGKILL");
    if (server) await new Promise((resolve) => server.close(() => resolve()));
    if (replacement) await new Promise((resolve) => replacement.close(() => resolve()));
  }
});

test("reassembles a multi-byte UTF-8 character split across two socket writes", async () => {
  const sockPath = path.join(os.tmpdir(), `tmcp-test-utf8-${process.pid}-${Date.now()}.sock`);
  const state = spawnNode(["dist/index.js", "--socket", sockPath]);
  let server = null;

  try {
    await initialize(state);

    let conn = null;
    server = net.createServer((c) => {
      conn = c;
      let buf = "";
      c.on("data", (d) => {
        buf += d.toString();
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const req = JSON.parse(line);
          // U+1F680 ROCKET is 4 bytes in UTF-8 (F0 9F 9A 80). Split the raw
          // bytes in the middle of that sequence, not at a line or character
          // boundary, so a naive per-chunk `data.toString()` decodes each half
          // as invalid UTF-8 and replaces it with U+FFFD instead of
          // reassembling the original character. The two writes below are
          // not guaranteed to arrive as two separate `data` events (that part
          // is proven deterministically by test/line-decoder.test.mjs,
          // calling push() directly); this is an end-to-end sanity check
          // that the real socket plumbing wires LineDecoder in correctly.
          const payload = Buffer.from(
            JSON.stringify({ id: req.id, result: { content: [{ type: "text", text: "\u{1F680}" }] } }) + "\n",
            "utf8"
          );
          const splitAt = payload.indexOf(0xf0) + 2; // inside the rocket's 4-byte sequence
          c.write(payload.subarray(0, splitAt));
          setTimeout(() => c.write(payload.subarray(splitAt)), 5);
        }
      });
    });
    await new Promise((resolve) => server.listen(sockPath, resolve));

    callTool(state, 2, "getContent", {});
    const res = await waitFor(() => findResponse(state, 2));
    assert.equal(res.result.content[0].text, "\u{1F680}", "a multi-byte character split across two writes must reassemble correctly, not become replacement characters");
  } finally {
    state.child.kill("SIGKILL");
    if (server) await new Promise((resolve) => server.close(() => resolve()));
  }
});
