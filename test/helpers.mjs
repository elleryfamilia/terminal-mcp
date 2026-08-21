import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";

/**
 * Spawn a node child with piped stdio and exit tracking. stdout/stderr are
 * decoded incrementally (a StringDecoder holds partial multi-byte sequences
 * across chunk boundaries) so pollers can read them without re-decoding
 * everything received so far on every poll.
 */
export function spawnNode(args, opts = {}) {
  const child = spawn(process.execPath, args, { stdio: ["pipe", "pipe", "pipe"], ...opts });
  const state = { child, stdout: "", stderr: "", exit: null };
  const outDecoder = new StringDecoder("utf8");
  const errDecoder = new StringDecoder("utf8");
  child.stdout.on("data", (d) => (state.stdout += outDecoder.write(d)));
  child.stderr.on("data", (d) => (state.stderr += errDecoder.write(d)));
  child.on("exit", (code, signal) => (state.exit = { code, signal }));
  return state;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Poll until predicate() is truthy or timeout; returns predicate's value. */
export async function waitFor(predicate, { timeoutMs = 10000, stepMs = 50 } = {}) {
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

/** Send a tools/call request. */
export function callTool(state, id, name, args = {}) {
  sendRpc(state, { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } });
}

/** Find a JSON-RPC response with the given id in what the child has sent so far. */
export function findResponse(state, id) {
  for (const line of state.stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id === id) return msg;
    } catch {
      // Partial or non-JSON line; skip.
    }
  }
  return null;
}

/** Complete the MCP handshake and resolve once the server has answered. */
export async function initialize(state, id = 1) {
  sendRpc(state, {
    jsonrpc: "2.0", id, method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "terminal-mcp-tests", version: "0" },
    },
  });
  const response = await waitFor(() => findResponse(state, id));
  sendRpc(state, { jsonrpc: "2.0", method: "notifications/initialized" });
  return response;
}
