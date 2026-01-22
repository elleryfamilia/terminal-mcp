import { z } from "zod";
import { TerminalManager } from "../terminal/index.js";

export const clearSchema = z.object({});

export type ClearArgs = z.infer<typeof clearSchema>;

export const clearTool = {
  name: "clear",
  description: "Clear the terminal screen and scrollback buffer.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export function handleClear(manager: TerminalManager, _args: unknown): { content: Array<{ type: "text"; text: string }> } {
  manager.clear();

  return {
    content: [
      {
        type: "text",
        text: "Terminal cleared",
      },
    ],
  };
}
