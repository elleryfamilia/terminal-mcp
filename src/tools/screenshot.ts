import { z } from "zod";
import { TerminalManager, SessionManager } from "../terminal/index.js";

export const screenshotSchema = z.object({});

export const screenshotSchemaWithSession = z.object({
  sessionId: z.string().optional().describe("Session ID (optional, uses default session if not provided)"),
});

export type ScreenshotArgs = z.infer<typeof screenshotSchema>;
export type ScreenshotArgsWithSession = z.infer<typeof screenshotSchemaWithSession>;

export const screenshotTool = {
  name: "takeScreenshot",
  description: "Capture terminal state as structured JSON with: content (visible text), cursor {x, y} position, and dimensions {cols, rows}. Use when you need cursor position (e.g., for interactive apps, vim) or terminal dimensions. For simple command output, prefer getContent().",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export const screenshotToolWithSession = {
  name: "takeScreenshot",
  description: "Capture terminal state as structured JSON with: content (visible text), cursor {x, y} position, and dimensions {cols, rows}. Use when you need cursor position (e.g., for interactive apps, vim) or terminal dimensions. For simple command output, prefer getContent().",
  inputSchema: {
    type: "object" as const,
    properties: {
      sessionId: {
        type: "string",
        description: "Session ID (optional, uses default session if not provided)",
      },
    },
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

export async function handleScreenshotWithSession(
  manager: SessionManager,
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const parsed = screenshotSchemaWithSession.parse(args);
  const session = await manager.getSession(parsed.sessionId);
  const screenshot = session.takeScreenshot();

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
