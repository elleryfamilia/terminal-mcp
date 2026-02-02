import { z } from "zod";
import { TerminalManager, SessionManager } from "../terminal/index.js";

export const typeSchema = z.object({
  text: z.string().describe("The text to type into the terminal"),
});

export const typeSchemaWithSession = z.object({
  sessionId: z.string().optional().describe("Session ID (optional, uses default session if not provided)"),
  text: z.string().describe("The text to type into the terminal"),
});

export type TypeArgs = z.infer<typeof typeSchema>;
export type TypeArgsWithSession = z.infer<typeof typeSchemaWithSession>;

export const typeTool = {
  name: "type",
  description: "Send text input to the terminal. Text is written exactly as provided - no Enter key is sent automatically. To execute a command, use type() followed by sendKey('Enter'). Example workflow: type('ls -la') → sendKey('Enter') → getContent(). IMPORTANT: In zsh, avoid '!' inside double quotes as it triggers history expansion - use single quotes instead (e.g., echo 'Hello!' not echo \"Hello!\").",
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

export const typeToolWithSession = {
  name: "type",
  description: "Send text input to the terminal. Text is written exactly as provided - no Enter key is sent automatically. To execute a command, use type() followed by sendKey('Enter'). Example workflow: type('ls -la') → sendKey('Enter') → getContent(). IMPORTANT: In zsh, avoid '!' inside double quotes as it triggers history expansion - use single quotes instead (e.g., echo 'Hello!' not echo \"Hello!\").",
  inputSchema: {
    type: "object" as const,
    properties: {
      sessionId: {
        type: "string",
        description: "Session ID (optional, uses default session if not provided)",
      },
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

export async function handleTypeWithSession(
  manager: SessionManager,
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const parsed = typeSchemaWithSession.parse(args);
  const session = await manager.getSession(parsed.sessionId);
  session.write(parsed.text);

  return {
    content: [
      {
        type: "text",
        text: `Typed ${parsed.text.length} character(s) to terminal`,
      },
    ],
  };
}
