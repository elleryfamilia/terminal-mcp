import { z } from "zod";
import { TerminalManager } from "../terminal/index.js";

export const listSessionsSchema = z.object({});

export const listSessionsTool = {
  name: "listSessions",
  description: "List all active terminal sessions, including the default session. Returns session metadata and the configured limits.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export function handleListSessions(
  manager: TerminalManager,
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
