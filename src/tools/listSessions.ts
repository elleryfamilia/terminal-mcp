import { z } from "zod";
import { SessionManager } from "../terminal/index.js";

export const listSessionsSchema = z.object({});

export type ListSessionsArgs = z.infer<typeof listSessionsSchema>;

export const listSessionsTool = {
  name: "listSessions",
  description:
    "List all active terminal sessions. Returns session metadata including IDs, " +
    "shell type, dimensions, and last activity time. Also shows the maximum allowed " +
    "sessions and idle timeout configuration.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export function handleListSessions(
  manager: SessionManager,
  _args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const result = manager.listSessions();

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
