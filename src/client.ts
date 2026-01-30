import * as net from "net";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { VERSION } from "./utils/version.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { toolDefinitions } from "./tools/definitions.js";

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
  console.error(`[mcp-client] Starting, connecting to ${socketPath}`);

  // Connect to the interactive terminal's socket
  let socket: net.Socket;
  try {
    socket = await connectToSocket(socketPath);
    console.error(`[mcp-client] Connected to socket`);
  } catch (error) {
    console.error(`[mcp-client] Failed to connect:`, error);
    throw error;
  }

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
    console.error("Socket closed");
    process.exit(1);
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
  console.error(`[mcp-client] Starting MCP server on stdio`);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[mcp-client] MCP server connected and ready`);
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
