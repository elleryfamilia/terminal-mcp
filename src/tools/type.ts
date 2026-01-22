import { z } from "zod";
import { TerminalManager } from "../terminal/index.js";

export const typeSchema = z.object({
  text: z.string().describe("The text to type into the terminal"),
});

export type TypeArgs = z.infer<typeof typeSchema>;

export const typeTool = {
  name: "type",
  description: "Send text input to the terminal. The text is written directly to the terminal as if typed by a user.",
  inputSchema: {
    type: "object" as const,
    properties: {
      text: {
        type: "string",
        description: "The text to type into the terminal",
      },
    },
    required: ["text"],
  },
};

export function handleType(manager: TerminalManager, args: unknown): { content: Array<{ type: "text"; text: string }> } {
  const parsed = typeSchema.parse(args);
  manager.write(parsed.text);

  return {
    content: [
      {
        type: "text",
        text: `Typed ${parsed.text.length} character(s) to terminal`,
      },
    ],
  };
}
