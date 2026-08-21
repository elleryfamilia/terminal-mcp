import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnNode, sleep, waitFor, callTool, findResponse, initialize } from "./helpers.mjs";

test("recording finalized at shutdown records an honest exit code and stop reason", async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmcp-rec-test-"));
  const state = spawnNode(["dist/index.js", "--headless"]);

  try {
    await initialize(state);

    callTool(state, 2, "startRecording", { mode: "always", outputDir: outDir });
    await waitFor(() => findResponse(state, 2));

    // Drive real terminal output so the recording has content to finalize.
    callTool(state, 3, "type", { text: "echo recorded\r" });
    await waitFor(() => findResponse(state, 3));

    // Wait for the output to actually reach the screen (and therefore the
    // recorder, which is wired to the same onData stream) rather than
    // guessing with a fixed sleep.
    let sawOutput = false;
    for (let probeId = 100; probeId < 120 && !sawOutput; probeId++) {
      callTool(state, probeId, "getContent");
      const res = await waitFor(() => findResponse(state, probeId));
      sawOutput = JSON.stringify(res).includes("recorded");
      if (!sawOutput) await sleep(100);
    }
    assert.ok(sawOutput, "terminal output should reach the screen before shutdown");

    // The MCP client detaches without ever calling stopRecording.
    state.child.stdin.end();
    await waitFor(() => state.exit !== null);
    assert.equal(state.exit.code, 0, `expected clean exit, got ${JSON.stringify(state.exit)}`);

    const metaFile = await waitFor(() =>
      fs.readdirSync(outDir).find((f) => f.endsWith(".meta.json"))
    );
    const meta = JSON.parse(fs.readFileSync(path.join(outDir, metaFile), "utf8"));

    // The shell never exited — metadata must not claim a clean exit.
    assert.equal(meta.exitCode, null, `exitCode should be null, got ${meta.exitCode}`);
    assert.equal(
      meta.stopReason,
      "server_shutdown",
      `stopReason should be server_shutdown, got ${meta.stopReason}`
    );
    assert.ok(meta.bytesWritten > 0, "recording should have captured terminal output");
  } finally {
    if (state.exit === null) state.child.kill("SIGKILL");
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
