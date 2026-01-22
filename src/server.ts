import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { TerminalManager } from "./terminal/index.js";
import { registerTools } from "./tools/index.js";
import { registerPrompts } from "./prompts/index.js";

export interface ServerOptions {
  cols?: number;
  rows?: number;
  shell?: string;
}

/**
 * Create and configure the MCP server with an existing terminal manager
 */
export function createServerWithManager(manager: TerminalManager): Server {
  const server = new Server(
    {
      name: "terminal-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
    }
  );

  registerTools(server, manager);
  registerPrompts(server);

  return server;
}

/**
 * Create and configure the MCP server with a new terminal manager
 */
export function createServer(options: ServerOptions = {}): {
  server: Server;
  manager: TerminalManager;
} {
  const manager = new TerminalManager({
    cols: options.cols,
    rows: options.rows,
    shell: options.shell,
  });

  const server = createServerWithManager(manager);

  return { server, manager };
}

/**
 * Connect an MCP server to a transport
 */
export async function connectServer(server: Server, transport: Transport): Promise<void> {
  await server.connect(transport);
}

/**
 * Start the MCP server with stdio transport (legacy mode)
 */
export async function startServer(options: ServerOptions = {}): Promise<void> {
  const { server, manager } = createServer(options);
  const transport = new StdioServerTransport();

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    manager.dispose();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    manager.dispose();
    process.exit(0);
  });

  await server.connect(transport);
}
