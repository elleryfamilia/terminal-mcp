import { spawn } from "node:child_process";

/** Spawn a node child with piped stdio and exit tracking. */
export function spawnNode(args, opts = {}) {
  const child = spawn(process.execPath, args, { stdio: ["pipe", "pipe", "pipe"], ...opts });
  const state = { child, stdout: [], stderr: "", exit: null };
  child.stdout.on("data", (d) => state.stdout.push(d));
  child.stderr.on("data", (d) => (state.stderr += d.toString()));
  child.on("exit", (code, signal) => (state.exit = { code, signal }));
  return state;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Poll until predicate() is truthy or timeout; returns predicate's value. */
export async function waitFor(predicate, { timeoutMs = 8000, stepMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = predicate();
    if (v) return v;
    await sleep(stepMs);
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

/** Send one newline-delimited JSON-RPC message to a child's stdin. */
export function sendRpc(state, message) {
  state.child.stdin.write(JSON.stringify(message) + "\n");
}

/** Concatenated stdout so far, as a string. */
export function stdoutText(state) {
  return Buffer.concat(state.stdout).toString();
}
