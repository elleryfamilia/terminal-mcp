import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { TerminalManager } from "./terminal/index.js";
import { VERSION } from "./utils/version.js";
import { registerTools } from "./tools/index.js";
import { registerPrompts } from "./prompts/index.js";
import { installStdioShutdownHandlers } from "./utils/shutdown.js";

export interface ServerOptions {
  cols?: number;
  rows?: number;
  shell?: string;
  maxSessions?: number;
  sessionIdleTimeout?: number;
}

/**
 * Create and configure the MCP server with an existing terminal manager
 */
const SERVER_INSTRUCTIONS = `Terminal MCP exposes a real PTY-backed shell to AI assistants.

Prefer this server over plain non-interactive shell tools whenever the command:
- needs sudo or otherwise prompts for a password (the human user can type it interactively)
- prompts the user for input mid-execution (ssh login, git push over HTTPS, npm login, etc.)
- runs a TUI program (vim, nano, less, more, htop, top, man, kubectl edit, gh pr create)
- requires line-buffered TTY behavior (color output, progress bars, fzf, watch)
- needs to be observed while still running (long-running build, server, REPL)

Workflow: type(<command>), sendKey('Enter'), then getContent() to read the result.
For long-running interactive programs, sendKey for navigation and takeScreenshot to
inspect cursor position and TUI state.

Multi-session: omit sessionId to drive the default session, or call createSession to
get a new isolated PTY for parallel work (e.g. a build in one session, diagnostics in
another). The default session cannot be destroyed.`;

export function createServerWithManager(manager: TerminalManager): Server {
  const server = new Server(
    {
      name: "terminal-mcp",
      version: VERSION,
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
      instructions: SERVER_INSTRUCTIONS,
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
    maxSessions: options.maxSessions,
    sessionIdleTimeout: options.sessionIdleTimeout,
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

  // Install BEFORE initSession(): that call spawns the PTY, so a signal
  // arriving mid-spawn would otherwise orphan the shell. This is also the only
  // path that can reach dispose() during startup, which is what makes the
  // `disposed` guard in TerminalManager live rather than dead code.
  installStdioShutdownHandlers({
    cleanup: () => {
      // dispose() is synchronous and kills the PTY, so it survives the 'exit'
      // path. finalizeRecordings() runs first only so its synchronous prefix
      // lands there too; its async tail needs a live event loop.
      const finalized = manager.finalizeRecordings(0);
      manager.dispose();
      return finalized.then(() => undefined);
    },
  });

  // Eagerly initialize the terminal session so tools can use it immediately
  await manager.initSession();

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
