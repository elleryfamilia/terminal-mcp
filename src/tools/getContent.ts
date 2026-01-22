import { z } from "zod";
import { TerminalManager } from "../terminal/index.js";

export const getContentSchema = z.object({
  visibleOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, only return the visible viewport content. If false, include scrollback buffer."),
});

export type GetContentArgs = z.infer<typeof getContentSchema>;

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
