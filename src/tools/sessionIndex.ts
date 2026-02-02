import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { SessionManager } from "../terminal/index.js";

import { typeToolWithSession, handleTypeWithSession } from "./type.js";
import { sendKeyToolWithSession, handleSendKeyWithSession } from "./sendKey.js";
import { getContentToolWithSession, handleGetContentWithSession } from "./getContent.js";
import { screenshotToolWithSession, handleScreenshotWithSession } from "./screenshot.js";
import { createSessionTool, handleCreateSession } from "./createSession.js";
import { destroySessionTool, handleDestroySession } from "./destroySession.js";
import { listSessionsTool, handleListSessions } from "./listSessions.js";

const sessionTools = [
  createSessionTool,
  destroySessionTool,
  listSessionsTool,
  typeToolWithSession,
  sendKeyToolWithSession,
  getContentToolWithSession,
  screenshotToolWithSession,
];

/**
 * Register session-aware tools with the MCP server
 */
export function registerSessionTools(server: Server, manager: SessionManager): void {
  // Register list tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: sessionTools,
  }));

  // Register call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "createSession":
          return await handleCreateSession(manager, args);

        case "destroySession":
          return handleDestroySession(manager, args);

        case "listSessions":
          return handleListSessions(manager, args);

        case "type":
          return await handleTypeWithSession(manager, args);

        case "sendKey":
          return await handleSendKeyWithSession(manager, args);

        case "getContent":
          return await handleGetContentWithSession(manager, args);

        case "takeScreenshot":
          return await handleScreenshotWithSession(manager, args);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
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
}
