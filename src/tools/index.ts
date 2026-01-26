import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TerminalManager } from "../terminal/index.js";

import { typeTool, handleType } from "./type.js";
import { sendKeyTool, handleSendKey } from "./sendKey.js";
import { getContentTool, handleGetContent } from "./getContent.js";
import { screenshotTool, handleScreenshot } from "./screenshot.js";
import { startRecordingTool, handleStartRecording } from "./startRecording.js";
import { stopRecordingTool, handleStopRecording } from "./stopRecording.js";

const tools = [typeTool, sendKeyTool, getContentTool, screenshotTool, startRecordingTool, stopRecordingTool];

export function registerTools(server: Server, manager: TerminalManager): void {
  // Register list tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  // Register call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "type":
          return handleType(manager, args);

        case "sendKey":
          return handleSendKey(manager, args);

        case "getContent":
          return handleGetContent(manager, args);

        case "takeScreenshot":
          return handleScreenshot(manager, args);

        case "startRecording":
          return handleStartRecording(manager, args);

        case "stopRecording":
          return await handleStopRecording(manager, args);

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
