import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TerminalManager } from "./terminal/index.js";
import { registerTools } from "./tools/index.js";

export interface ServerOptions {
  cols?: number;
  rows?: number;
  shell?: string;
}

/**
 * Create and configure the MCP server
 */
export function createServer(options: ServerOptions = {}): {
  server: Server;
  manager: TerminalManager;
} {
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

  const manager = new TerminalManager({
    cols: options.cols,
    rows: options.rows,
    shell: options.shell,
  });

  registerTools(server, manager);

  return { server, manager };
}

/**
 * Start the MCP server with stdio transport
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
