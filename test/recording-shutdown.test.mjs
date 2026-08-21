import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { sleep, waitFor, sendRpc, stdoutText } from "./helpers.mjs";

test("recording finalized at shutdown records an honest exit code and stop reason", async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmcp-rec-test-"));
  const state = { stdout: [] };
  const child = spawn(process.execPath, ["dist/index.js", "--headless"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  state.child = child;
  child.stdout.on("data", (d) => state.stdout.push(d));
  let exit = null;
  child.on("exit", (code, signal) => (exit = { code, signal }));

  try {
    sendRpc(state, {
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "0" } },
    });
    await waitFor(() => stdoutText(state).includes('"id":1'));
    sendRpc(state, { jsonrpc: "2.0", method: "notifications/initialized" });

    sendRpc(state, {
      jsonrpc: "2.0", id: 2, method: "tools/call",
      params: { name: "startRecording", arguments: { mode: "always", outputDir: outDir } },
    });
    await waitFor(() => stdoutText(state).includes('"id":2'));

    // Generate some terminal output so the recording has content.
    sendRpc(state, {
      jsonrpc: "2.0", id: 3, method: "tools/call",
      params: { name: "type", arguments: { text: "echo recorded\r" } },
    });
    await waitFor(() => stdoutText(state).includes('"id":3'));
    await sleep(800);

    // The MCP client detaches without stopping the recording.
    child.stdin.end();
    await waitFor(() => exit !== null);
    assert.equal(exit.code, 0, `expected clean exit, got ${JSON.stringify(exit)}`);

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
  } finally {
    if (exit === null) child.kill("SIGKILL");
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
