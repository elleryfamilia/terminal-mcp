import { z } from "zod";
import { TerminalManager } from "../terminal/index.js";
import { inputSchemaOf } from "./schema.js";

export const destroySessionSchema = z.object({
  sessionId: z.string().describe("ID of the session to destroy"),
});

export const destroySessionTool = {
  name: "destroySession",
  description: "Destroy a terminal session by ID. The default session cannot be destroyed.",
  inputSchema: inputSchemaOf(destroySessionSchema),
};

export function handleDestroySession(
  manager: TerminalManager,
  args: unknown
): { content: Array<{ type: "text"; text: string }>; isError?: boolean } {
  const parsed = destroySessionSchema.parse(args);
  const result = manager.destroySession(parsed.sessionId);
  return {
    content: [
      {
        type: "text",
        text: result.message,
      },
    ],
    isError: !result.success,
  };
}
