import * as net from "net";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { VERSION } from "./utils/version.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { toolDefinitions } from "./tools/definitions.js";
import { installStdioShutdownHandlers } from "./utils/shutdown.js";
import { LineDecoder } from "./utils/line-decoder.js";

interface SocketRequest {
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface SocketResponse {
  id: number;
  result?: unknown;
  error?: { message: string };
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  socket: net.Socket;
}

/**
 * MCP Client Mode - connects lazily to the interactive terminal's socket and
 * serves MCP over stdio immediately, without waiting for that socket.
 *
 * No interactive session running at startup, or one dropping mid-session,
 * no longer exits the process: each tool call connects on demand (reusing an
 * in-flight connect attempt) and a missing/dropped session surfaces as a
 * normal MCP tool error instead.
 */
export async function startMcpClientMode(socketPath: string): Promise<void> {
  // Nothing to release — the OS reclaims the socket fd on exit. We install this
  // only for the stdin-EOF -> exit wiring (the client itself keeps the loop alive).
  installStdioShutdownHandlers({ cleanup: () => {} });

  // Create MCP server
  const server = new Server(
    {
      name: "terminal-mcp",
      version: VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Request ID counter
  let requestId = 0;

  // Pending requests waiting for responses, tagged with the socket they were
  // sent on so a stale connection's close only rejects the requests it
  // actually owns, never a newer live connection's.
  const pendingRequests = new Map<number, PendingRequest>();

  // Current live socket, if any, and an in-flight connect attempt shared by
  // every caller so concurrent tool calls don't each open their own socket.
  let socket: net.Socket | null = null;
  let connecting: Promise<net.Socket> | null = null;

  function isLive(s: net.Socket | null): s is net.Socket {
    return s !== null && !s.destroyed && s.writable;
  }

  function attachSocket(s: net.Socket): void {
    // Owned by this connection alone: a stale partial line from a dead
    // connection must never prefix a new connection's first response.
    const decoder = new LineDecoder();

    s.on("data", (data) => {
      for (const line of decoder.push(data)) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line) as SocketResponse;
            const pending = pendingRequests.get(response.id);
            if (pending) {
              pendingRequests.delete(response.id);
              if (response.error) {
                pending.reject(new Error(response.error.message));
              } else {
                pending.resolve(response.result);
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    });

    s.on("error", () => {
      // 'close' always follows and owns cleanup.
    });

    s.on("close", () => {
      if (socket === s) socket = null;
      for (const [id, pending] of pendingRequests) {
        if (pending.socket !== s) continue;
        pendingRequests.delete(id);
        pending.reject(
          new Error(
            "The interactive terminal-mcp session ended before the call completed."
          )
        );
      }
    });
  }

  function ensureSocket(): Promise<net.Socket> {
    if (isLive(socket)) return Promise.resolve(socket);
    if (connecting) return connecting;
    connecting = connectToSocket(socketPath).then(
      (s) => {
        attachSocket(s);
        socket = s;
        connecting = null;
        return s;
      },
      (err) => {
        connecting = null;
        throw err;
      }
    );
    return connecting;
  }

  // Helper to send request to interactive terminal
  async function sendRequest(
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    const s = await ensureSocket();
    const id = ++requestId;
    const request: SocketRequest = { id, method, params };

    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject, socket: s });
      s.write(JSON.stringify(request) + "\n", (error) => {
        if (error) {
          pendingRequests.delete(id);
          reject(error);
        }
      });
    });
  }

  // Register list tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  // Register call tool handler - proxy to socket
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await sendRequest(name, args as Record<string, unknown>);
      return result as {
        content: Array<{ type: "text"; text: string }>;
        isError?: boolean;
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Connect MCP server to stdio immediately — this no longer waits on the
  // socket, so a missing interactive session never blocks or exits startup.
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

/**
 * Connect to the interactive terminal's socket
 */
function connectToSocket(socketPath: string): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath, () => {
      resolve(socket);
    });

    socket.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(
          new Error(
            `No tmcp session found at ${socketPath}.\n` +
              `Start one: run \`terminal-mcp\``
          )
        );
      } else if (error.code === "ECONNREFUSED") {
        reject(
          new Error(
            `Connection refused to ${socketPath}.\n` +
              `The interactive terminal-mcp session may have crashed. Start one: run \`terminal-mcp\``
          )
        );
      } else {
        reject(error);
      }
    });
  });
}
