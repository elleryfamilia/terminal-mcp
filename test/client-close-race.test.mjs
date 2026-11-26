import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawnNode, sleep, waitFor, initialize, callTool, findResponse, respondOk } from "./helpers.mjs";

test("socket close just before stdin EOF still exits 0", async () => {
  const sockPath = path.join(os.tmpdir(), `tmcp-test-${process.pid}-${Date.now()}.sock`);
  let conn = null;
  const server = net.createServer((c) => { conn = c; respondOk(c); });
  await new Promise((resolve) => server.listen(sockPath, resolve));

  const state = spawnNode(["dist/index.js", "--socket", sockPath]);

  try {
    await initialize(state);
    // Lazy connect: the socket only opens once a tool call is made.
    callTool(state, 2, "getContent", {});
    await waitFor(() => conn !== null);
    await waitFor(() => findResponse(state, 2));

    // Interactive session dies and the MCP host detaches almost at once: the
    // socket closes first, stdin EOF lands a moment later. This is a clean
    // mutual teardown and must not be reported as a failure.
    conn.destroy();
    await sleep(5);
    state.child.stdin.end();

    await waitFor(() => state.exit !== null);
    assert.equal(state.exit.code, 0, `expected clean exit, got ${JSON.stringify(state.exit)}`);
  } finally {
    if (state.exit === null) state.child.kill("SIGKILL");
    server.close();
  }
});

test("socket close without a stdin EOF stays alive and reconnects", async () => {
  const sockPath = path.join(os.tmpdir(), `tmcp-test-solo-${process.pid}-${Date.now()}.sock`);
  let conn = null;
  let server = net.createServer((c) => { conn = c; respondOk(c); });
  let replacement = null;
  await new Promise((resolve) => server.listen(sockPath, resolve));

  const state = spawnNode(["dist/index.js", "--socket", sockPath]);

  try {
    await initialize(state);
    callTool(state, 2, "getContent", {});
    await waitFor(() => conn !== null);
    await waitFor(() => findResponse(state, 2));

    // The interactive session dies on its own while the host stays attached.
    // Old behavior: fatal exit after a grace period. New behavior: the client
    // survives past the old grace window and reconnects to a replacement
    // session at the same socket path.
    conn.destroy();
    await sleep(150); // past the old 100ms SOCKET_CLOSE_GRACE_MS window
    assert.equal(state.exit, null, "client process must not exit when the interactive session drops");

    await new Promise((resolve) => server.close(resolve));
    conn = null;
    replacement = net.createServer((c) => { conn = c; respondOk(c); });
    await new Promise((resolve) => replacement.listen(sockPath, resolve));
    callTool(state, 3, "getContent", {});
    const res = await waitFor(() => findResponse(state, 3));
    assert.equal(res.result.isError, undefined);
    assert.equal(res.result.content[0].text, "ok", "must reconnect and complete a call against the replacement session");
  } finally {
    // Both listeners are closed here, unconditionally, rather than only on
    // the success path, so a failed assertion above cannot leak a listening
    // socket into later tests in the same process.
    if (state.exit === null) state.child.kill("SIGKILL");
    await new Promise((resolve) => server.close(() => resolve()));
    if (replacement) await new Promise((resolve) => replacement.close(() => resolve()));
  }
});
