import { z } from "zod";
import { TerminalManager } from "../terminal/index.js";
import { renderTerminalToPng } from "../utils/render.js";

export const screenshotSchema = z.object({
  format: z.enum(["text", "ansi", "png"]).optional().describe(
    "Output format: 'text' (default) returns plain JSON, 'ansi' returns text with ANSI color codes, 'png' returns a color screenshot image"
  ),
});

export type ScreenshotArgs = z.infer<typeof screenshotSchema>;

export const screenshotTool = {
  name: "takeScreenshot",
  description:
    "Capture terminal state. Format 'text' (default) returns plain JSON with content, cursor, dimensions. Format 'ansi' returns JSON with ANSI color escape codes preserved in the content field. Format 'png' returns a color screenshot image.",
  inputSchema: {
    type: "object" as const,
    properties: {
      format: {
        type: "string",
        enum: ["text", "ansi", "png"],
        description:
          "Output format: 'text' (default) plain JSON, 'ansi' for colored text with ANSI codes, 'png' for color screenshot image",
      },
    },
    required: [],
  },
};

export function handleScreenshot(
  manager: TerminalManager,
  args: unknown
): { content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> } {
  const parsed = screenshotSchema.parse(args);
  const format = parsed.format || "text";

  if (format === "ansi") {
    const content = manager.getAnsiContent(true);
    const buffer = manager.getTerminal().buffer.active;
    const result = {
      content,
      cursor: { x: buffer.cursorX, y: buffer.cursorY },
      dimensions: {
        cols: manager.getDimensions().cols,
        rows: manager.getDimensions().rows,
      },
    };
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  if (format === "png") {
    const terminal = manager.getTerminal();
    const pngBuffer = renderTerminalToPng(terminal);

    return {
      content: [
        {
          type: "image",
          data: pngBuffer.toString("base64"),
          mimeType: "image/png",
        },
      ],
    };
  }

  // Default text format
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
