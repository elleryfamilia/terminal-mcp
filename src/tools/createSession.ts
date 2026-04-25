import { z } from "zod";
import { TerminalManager } from "../terminal/index.js";

export const createSessionSchema = z.object({
  shell: z.string().optional().describe("Shell to use for this session (default: $SHELL or /bin/bash)"),
  cols: z.number().int().positive().optional().describe("Terminal width in columns (default: 120)"),
  rows: z.number().int().positive().optional().describe("Terminal height in rows (default: 40)"),
});

export const createSessionTool = {
  name: "createSession",
  description: "Create a new terminal session and return its metadata. Use the returned sessionId in subsequent type/sendKey/getContent/takeScreenshot calls to address this session. The default session created on first use is separate from sessions created here.",
  inputSchema: {
    type: "object" as const,
    properties: {
      shell: {
        type: "string",
        description: "Shell to use for this session (default: $SHELL or /bin/bash)",
      },
      cols: {
        type: "number",
        description: "Terminal width in columns (default: 120)",
      },
      rows: {
        type: "number",
        description: "Terminal height in rows (default: 40)",
      },
    },
    required: [],
  },
};

export async function handleCreateSession(
  manager: TerminalManager,
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const parsed = createSessionSchema.parse(args ?? {});
  const metadata = await manager.createSession(parsed);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(metadata, null, 2),
      },
    ],
  };
}
