import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { sleep, waitFor } from "./helpers.mjs";

test("socket close just before stdin EOF still exits 0", async () => {
  const sockPath = path.join(os.tmpdir(), `tmcp-test-${process.pid}-${Date.now()}.sock`);
  let conn = null;
  const server = net.createServer((c) => (conn = c));
  await new Promise((resolve) => server.listen(sockPath, resolve));

  const child = spawn(process.execPath, ["dist/index.js", "--socket", sockPath], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  let exit = null;
  child.on("exit", (code, signal) => (exit = { code, signal }));

  try {
    await waitFor(() => conn !== null);
    await sleep(300); // let the MCP server finish wiring up

    // Interactive session dies and the MCP host detaches almost at once:
    // the socket closes first, stdin EOF lands a moment later. This is a
    // clean mutual teardown and must not be reported as a failure.
    conn.destroy();
    await sleep(30);
    child.stdin.end();

    await waitFor(() => exit !== null);
    assert.equal(exit.code, 0, `expected clean exit, got ${JSON.stringify(exit)}`);
  } finally {
    if (exit === null) child.kill("SIGKILL");
    server.close();
  }
});
