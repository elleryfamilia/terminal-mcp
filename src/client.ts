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

/**
 * MCP Client Mode - connects to existing terminal socket and serves MCP over stdio
 */
export async function startMcpClientMode(socketPath: string): Promise<void> {
  // How long a socket close waits for a stdin EOF that would mark this as a
  // clean mutual shutdown rather than the interactive session dying alone.
  const SOCKET_CLOSE_GRACE_MS = 100;

  // Connect to the interactive terminal's socket
  const socket = await connectToSocket(socketPath);

  // Nothing to release — the OS reclaims the socket fd on exit. We install this
  // only for the stdin-EOF -> exit wiring (the socket keeps the loop alive).
  const shutdownState = installStdioShutdownHandlers({ cleanup: () => {} });

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

  // Pending requests waiting for responses
  const pendingRequests = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();

  // Buffer for incoming data
  let buffer = "";

  // Handle responses from the interactive terminal
  socket.on("data", (data) => {
    buffer += data.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
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

  socket.on("error", (error) => {
    console.error("Socket error:", error.message);
    process.exit(1);
  });

  socket.on("close", () => {
    if (shutdownState.isShuttingDown()) return;
    // The interactive session and the MCP host often go away together (user
    // quits the terminal, host detaches). If the socket close is dequeued
    // first, exiting 1 immediately would mislabel a clean mutual teardown —
    // give an imminent stdin EOF a moment to start the clean shutdown instead.
    const graceTimer = setTimeout(() => {
      if (shutdownState.isShuttingDown()) return;
      console.error("Socket closed");
      process.exit(1);
    }, SOCKET_CLOSE_GRACE_MS);
    // stdin keeps the loop alive here, so this timer never needs to; unref'ing
    // it keeps that an implementation detail rather than a load-bearing one.
    graceTimer.unref();
  });

  // Helper to send request to interactive terminal
  async function sendRequest(
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    const id = ++requestId;
    const request: SocketRequest = { id, method, params };

    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      socket.write(JSON.stringify(request) + "\n", (error) => {
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

  // Connect MCP server to stdio
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
              `Start an interactive session first by running: tmcp`
          )
        );
      } else if (error.code === "ECONNREFUSED") {
        reject(
          new Error(
            `Connection refused to ${socketPath}.\n` +
              `The tmcp session may have crashed. Try restarting it.`
          )
        );
      } else {
        reject(error);
      }
    });
  });
}
