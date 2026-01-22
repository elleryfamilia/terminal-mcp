import { z } from "zod";
import { TerminalManager } from "../terminal/index.js";

export const typeSchema = z.object({
  text: z.string().describe("The text to type into the terminal"),
});

export type TypeArgs = z.infer<typeof typeSchema>;

export const typeTool = {
  name: "type",
  description: "Send text input to the terminal. Text is written exactly as provided - no Enter key is sent automatically. To execute a command, use type() followed by sendKey('Enter'). Example workflow: type('ls -la') → sendKey('Enter') → getContent()",
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
