import { z } from "zod";
import { SessionManager, SessionMetadata } from "../terminal/index.js";

export const createSessionSchema = z.object({
  shell: z.string().optional().describe("Shell to use (default: system shell)"),
  cols: z.number().optional().describe("Terminal width in columns (default: 120)"),
  rows: z.number().optional().describe("Terminal height in rows (default: 40)"),
});

export type CreateSessionArgs = z.infer<typeof createSessionSchema>;

export const createSessionTool = {
  name: "createSession",
  description:
    "Create a new terminal session. Returns a session ID that can be used with other terminal tools. " +
    "Use this to run multiple independent terminal sessions in parallel.",
  inputSchema: {
    type: "object" as const,
    properties: {
      shell: {
        type: "string",
        description: "Shell to use (default: system shell)",
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
  manager: SessionManager,
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const parsed = createSessionSchema.parse(args);
  const metadata = await manager.createSession(parsed);

  const response = {
    sessionId: metadata.sessionId,
    shell: metadata.shell,
    cols: metadata.cols,
    rows: metadata.rows,
    cwd: metadata.cwd,
    createdAt: metadata.createdAt,
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}
