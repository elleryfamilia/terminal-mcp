import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { waitFor } from "./helpers.mjs";

test("cleanup failures during shutdown are reported on stderr", async () => {
  const child = spawn(process.execPath, ["test/fixtures/shutdown-failing-cleanup.mjs"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (d) => (stderr += d.toString()));
  let exit = null;
  child.on("exit", (code, signal) => (exit = { code, signal }));

  await waitFor(() => stderr.includes("READY"));
  child.stdin.end();
  await waitFor(() => exit !== null);

  // Detach should still be treated as clean (the PTY kill is best-effort),
  // but the failure must not vanish silently.
  assert.equal(exit.code, 0, `expected exit 0, got ${JSON.stringify(exit)}`);
  assert.match(stderr, /cleanup/i, "stderr should mention the cleanup failure");
  assert.match(stderr, /boom: cleanup exploded/, "stderr should include the error itself");
});
