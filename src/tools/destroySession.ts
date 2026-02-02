import { z } from "zod";
import { SessionManager } from "../terminal/index.js";

export const destroySessionSchema = z.object({
  sessionId: z.string().describe("The session ID to destroy"),
});

export type DestroySessionArgs = z.infer<typeof destroySessionSchema>;

export const destroySessionTool = {
  name: "destroySession",
  description:
    "Destroy a terminal session and clean up its resources. " +
    "Use this when you're done with a session to free up resources.",
  inputSchema: {
    type: "object" as const,
    properties: {
      sessionId: {
        type: "string",
        description: "The session ID to destroy",
      },
    },
    required: ["sessionId"],
  },
};

export function handleDestroySession(
  manager: SessionManager,
  args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const parsed = destroySessionSchema.parse(args);
  const result = manager.destroySession(parsed.sessionId);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
