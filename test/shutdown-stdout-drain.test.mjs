import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { sleep, waitFor } from "./helpers.mjs";

const FIVE_MB = 5 * 1024 * 1024;

test("stdin EOF shutdown drains buffered stdout before exiting", async () => {
  const child = spawn(process.execPath, ["test/fixtures/shutdown-big-output.mjs"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (d) => (stderr += d.toString()));
  let exit = null;
  child.on("exit", (code, signal) => (exit = { code, signal }));

  // Wait until the fixture has issued its 5MB write, WITHOUT reading stdout —
  // the OS pipe buffer (~64KB) fills and the rest stays queued in the child.
  await waitFor(() => stderr.includes("READY"));
  await sleep(200);

  // Client-style shutdown: close stdin, then read stdout until EOF.
  child.stdin.end();
  let received = 0;
  child.stdout.on("data", (d) => (received += d.length));
  await new Promise((resolve) => child.stdout.on("end", resolve));
  await waitFor(() => exit !== null);

  assert.equal(exit.code, 0, `expected clean exit, got ${JSON.stringify(exit)}`);
  assert.equal(
    received,
    FIVE_MB,
    `stdout truncated: received ${received} of ${FIVE_MB} buffered bytes`
  );
});
