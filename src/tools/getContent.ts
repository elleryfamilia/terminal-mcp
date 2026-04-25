import { z } from "zod";
import { TerminalManager } from "../terminal/index.js";

export const getContentSchema = z.object({
  visibleOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, only return the visible viewport content. If false, include scrollback buffer."),
  sessionId: z.string().optional().describe("Target session ID. Omit to target the default session."),
});

export type GetContentArgs = z.infer<typeof getContentSchema>;

export const getContentTool = {
  name: "getContent",
  description: "Get terminal content as plain text. Use after sending commands to see output. Returns full scrollback buffer by default (up to 1000 lines). Set visibleOnly=true for just the current viewport. Prefer this over takeScreenshot for reading command output. Pass sessionId to read a specific session.",
  inputSchema: {
    type: "object" as const,
    properties: {
      visibleOnly: {
        type: "boolean",
        description: "If true, only return the visible viewport content. If false (default), include scrollback buffer.",
        default: false,
      },
      sessionId: {
        type: "string",
        description: "Target session ID. Omit to target the default session.",
      },
    },
    required: [],
  },
};

export function handleGetContent(manager: TerminalManager, args: unknown): { content: Array<{ type: "text"; text: string }> } {
  const parsed = getContentSchema.parse(args);

  const content = parsed.visibleOnly
    ? manager.getVisibleContent(parsed.sessionId)
    : manager.getContent(parsed.sessionId);

  return {
    content: [
      {
        type: "text",
        text: content || "(empty terminal)",
      },
    ],
  };
}
