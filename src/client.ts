import * as net from "net";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

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
  // Connect to the interactive terminal's socket
  const socket = await connectToSocket(socketPath);

  // Create MCP server
  const server = new Server(
    {
      name: "terminal-mcp",
      version: "0.1.0",
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

  // Define tools that proxy to the interactive terminal
  const tools = [
    {
      name: "type",
      description: "Type text into the terminal",
      inputSchema: {
        type: "object" as const,
        properties: {
          text: {
            type: "string",
            description: "The text to type",
          },
        },
        required: ["text"],
      },
    },
    {
      name: "sendKey",
      description:
        "Send a special key to the terminal (e.g., enter, tab, ctrl+c)",
      inputSchema: {
        type: "object" as const,
        properties: {
          key: {
            type: "string",
            description:
              "The key to send (e.g., enter, tab, escape, up, down, left, right, ctrl+c, ctrl+d)",
          },
        },
        required: ["key"],
      },
    },
    {
      name: "getContent",
      description: "Get the current content of the terminal buffer",
      inputSchema: {
        type: "object" as const,
        properties: {
          visibleOnly: {
            type: "boolean",
            description: "If true, only return visible content (default: false)",
          },
        },
      },
    },
    {
      name: "takeScreenshot",
      description:
        "Take a screenshot of the terminal showing current screen and cursor position",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "clear",
      description: "Clear the terminal screen",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
  ];

  // Register list tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
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
