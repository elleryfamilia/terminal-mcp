import { z } from "zod";
import { TerminalManager } from "../terminal/index.js";

export const screenshotSchema = z.object({});

export type ScreenshotArgs = z.infer<typeof screenshotSchema>;

export const screenshotTool = {
  name: "takeScreenshot",
  description: "Capture the current terminal state including visible content, cursor position, and terminal dimensions.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export function handleScreenshot(manager: TerminalManager, _args: unknown): { content: Array<{ type: "text"; text: string }> } {
  const screenshot = manager.takeScreenshot();

  const result = {
    content: screenshot.content,
    cursor: screenshot.cursor,
    dimensions: screenshot.dimensions,
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
