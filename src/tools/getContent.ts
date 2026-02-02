import { z } from "zod";
import { TerminalManager, SessionManager } from "../terminal/index.js";

export const getContentSchema = z.object({
  visibleOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, only return the visible viewport content. If false, include scrollback buffer."),
});

export const getContentSchemaWithSession = z.object({
  sessionId: z.string().optional().describe("Session ID (optional, uses default session if not provided)"),
  visibleOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, only return the visible viewport content. If false, include scrollback buffer."),
});

export type GetContentArgs = z.infer<typeof getContentSchema>;
export type GetContentArgsWithSession = z.infer<typeof getContentSchemaWithSession>;

export const getContentTool = {
  name: "getContent",
  description: "Get terminal content as plain text. Use after sending commands to see output. Returns full scrollback buffer by default (up to 1000 lines). Set visibleOnly=true for just the current viewport. Prefer this over takeScreenshot for reading command output.",
  inputSchema: {
    type: "object" as const,
    properties: {
      visibleOnly: {
        type: "boolean",
        description: "If true, only return the visible viewport content. If false (default), include scrollback buffer.",
        default: false,
      },
    },
    required: [],
  },
};

export const getContentToolWithSession = {
  name: "getContent",
  description: "Get terminal content as plain text. Use after sending commands to see output. Returns full scrollback buffer by default (up to 1000 lines). Set visibleOnly=true for just the current viewport. Prefer this over takeScreenshot for reading command output.",
  inputSchema: {
    type: "object" as const,
    properties: {
      sessionId: {
        type: "string",
        description: "Session ID (optional, uses default session if not provided)",
      },
      visibleOnly: {
        type: "boolean",
        description: "If true, only return the visible viewport content. If false (default), include scrollback buffer.",
        default: false,
      },
    },
    required: [],
  },
};

export function handleGetContent(manager: TerminalManager, args: unknown): { content: Array<{ type: "text"; text: string }> } {
  const parsed = getContentSchema.parse(args);

  const content = parsed.visibleOnly
    ? manager.getVisibleContent()
    : manager.getContent();

  return {
    content: [
      {
        type: "text",
        text: content || "(empty terminal)",
      },
    ],
  };
}

export async function handleGetContentWithSession(
  manager: SessionManager,
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const parsed = getContentSchemaWithSession.parse(args);
  const session = await manager.getSession(parsed.sessionId);

  const content = parsed.visibleOnly
    ? session.getVisibleContent()
    : session.getContent();

  return {
    content: [
      {
        type: "text",
        text: content || "(empty terminal)",
      },
    ],
  };
}
