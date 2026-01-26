import * as fs from "fs";
import { Server as NetServer, Socket } from "net";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { TerminalManager } from "../terminal/index.js";
import { getStats } from "../utils/stats.js";

// Tool handlers
import { handleType } from "../tools/type.js";
import { handleSendKey } from "../tools/sendKey.js";
import { handleGetContent } from "../tools/getContent.js";
import { handleScreenshot } from "../tools/screenshot.js";
import { handleStartRecording } from "../tools/startRecording.js";
import { handleStopRecording } from "../tools/stopRecording.js";

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
 * Transport that communicates over a Unix socket connection
 * (Used for full MCP protocol when needed)
 */
export class SocketTransport implements Transport {
  private socket: Socket;
  private buffer = "";

  onmessage?: (message: JSONRPCMessage) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;

  constructor(socket: Socket) {
    this.socket = socket;

    this.socket.on("data", (data) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.socket.on("error", (error) => {
      this.onerror?.(error);
    });

    this.socket.on("close", () => {
      this.onclose?.();
    });
  }

  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as JSONRPCMessage;
          this.onmessage?.(message);
        } catch (error) {
          this.onerror?.(new Error(`Failed to parse message: ${line}`));
        }
      }
    }
  }

  async start(): Promise<void> {
    // Socket is already connected
  }

  async close(): Promise<void> {
    this.socket.end();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(message) + "\n";
      this.socket.write(data, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

/**
 * Create a Unix socket server that accepts MCP connections
 */
export function createSocketServer(
  socketPath: string,
  onConnection: (transport: SocketTransport) => void
): NetServer {
  // Remove existing socket file if it exists
  try {
    fs.unlinkSync(socketPath);
  } catch {
    // Ignore if doesn't exist
  }

  const server = new NetServer((socket) => {
    const transport = new SocketTransport(socket);
    onConnection(transport);
  });

  server.listen(socketPath);

  return server;
}

/**
 * Create a simple request/response socket server for tool proxying
 * This is the protocol used between interactive mode and MCP client mode
 */
export function createToolProxyServer(
  socketPath: string,
  manager: TerminalManager
): NetServer {
  // Remove existing socket file if it exists
  try {
    fs.unlinkSync(socketPath);
  } catch {
    // Ignore if doesn't exist
  }

  const server = new NetServer((socket) => {
    let buffer = "";

    socket.on("data", async (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim()) {
          try {
            const request = JSON.parse(line) as SocketRequest;
            const response = await handleToolRequest(manager, request);
            socket.write(JSON.stringify(response) + "\n");
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            socket.write(
              JSON.stringify({
                id: 0,
                error: { message: `Parse error: ${errorMessage}` },
              }) + "\n"
            );
          }
        }
      }
    });

    socket.on("error", () => {
      // Client disconnected, ignore
    });
  });

  server.listen(socketPath);

  return server;
}

/**
 * Handle a tool request from the MCP client
 */
async function handleToolRequest(
  manager: TerminalManager,
  request: SocketRequest
): Promise<SocketResponse> {
  const { id, method, params } = request;
  const stats = getStats();

  try {
    let result: unknown;

    switch (method) {
      case "type":
        stats.recordToolCall("type");
        result = handleType(manager, params);
        break;

      case "sendKey":
        stats.recordToolCall("sendKey");
        result = handleSendKey(manager, params);
        break;

      case "getContent":
        stats.recordToolCall("getContent");
        result = handleGetContent(manager, params);
        break;

      case "takeScreenshot":
        stats.recordToolCall("takeScreenshot");
        result = handleScreenshot(manager, params);
        break;

      case "startRecording":
        stats.recordToolCall("startRecording");
        result = handleStartRecording(manager, params);
        break;

      case "stopRecording":
        stats.recordToolCall("stopRecording");
        result = await handleStopRecording(manager, params);
        break;

      default:
        return {
          id,
          error: { message: `Unknown method: ${method}` },
        };
    }

    return { id, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id,
      error: { message },
    };
  }
}
