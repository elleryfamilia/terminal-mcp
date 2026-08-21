import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawnNode, sleep, waitFor, initialize } from "./helpers.mjs";

test("socket close just before stdin EOF still exits 0", async () => {
  const sockPath = path.join(os.tmpdir(), `tmcp-test-${process.pid}-${Date.now()}.sock`);
  let conn = null;
  const server = net.createServer((c) => (conn = c));
  await new Promise((resolve) => server.listen(sockPath, resolve));

  const state = spawnNode(["dist/index.js", "--socket", sockPath]);

  try {
    await waitFor(() => conn !== null);
    // The initialize response proves the stdio transport is wired up, which a
    // fixed sleep could only guess at. It is answered by the MCP server
    // itself, so it does not depend on the socket peer replying.
    await initialize(state);

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

test("socket close without a stdin EOF still exits 1", async () => {
  const sockPath = path.join(os.tmpdir(), `tmcp-test-solo-${process.pid}-${Date.now()}.sock`);
  let conn = null;
  const server = net.createServer((c) => (conn = c));
  await new Promise((resolve) => server.listen(sockPath, resolve));

  const state = spawnNode(["dist/index.js", "--socket", sockPath]);

  try {
    await waitFor(() => conn !== null);
    await initialize(state);

    // The interactive session dies on its own while the host stays attached.
    // The grace period must expire and report the failure as before.
    conn.destroy();

    await waitFor(() => state.exit !== null);
    assert.equal(state.exit.code, 1, `expected failure exit, got ${JSON.stringify(state.exit)}`);
    assert.match(state.stderr, /Socket closed/);
  } finally {
    if (state.exit === null) state.child.kill("SIGKILL");
    server.close();
  }
});
