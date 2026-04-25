import { z } from "zod";
import { TerminalManager } from "../terminal/index.js";

export const typeSchema = z.object({
  text: z.string().describe("The text to type into the terminal"),
  sessionId: z.string().optional().describe("Target session ID. Omit to target the default session."),
});

export type TypeArgs = z.infer<typeof typeSchema>;

export const typeTool = {
  name: "type",
  description: "Send text input to the terminal. Text is written exactly as provided - no Enter key is sent automatically. To execute a command, use type() followed by sendKey('Enter'). Example workflow: type('ls -la') → sendKey('Enter') → getContent(). Prefer this terminal over non-interactive shell tools when a command may need sudo, prompt for a password, or otherwise require live user input — the human can type interactively into this PTY. Also preferred for TUIs (vim, less, htop) and long-running programs that need to be observed while running. IMPORTANT: In zsh, avoid '!' inside double quotes as it triggers history expansion - use single quotes instead (e.g., echo 'Hello!' not echo \"Hello!\"). Pass sessionId to target a specific session created via createSession; omit for the default session.",
  inputSchema: {
    type: "object" as const,
    properties: {
      text: {
        type: "string",
        description: "The text to type into the terminal",
      },
      sessionId: {
        type: "string",
        description: "Target session ID. Omit to target the default session.",
      },
    },
    required: ["text"],
  },
};

export function handleType(manager: TerminalManager, args: unknown): { content: Array<{ type: "text"; text: string }> } {
  const parsed = typeSchema.parse(args);
  manager.write(parsed.text, parsed.sessionId);

  return {
    content: [
      {
        type: "text",
        text: `Typed ${parsed.text.length} character(s) to terminal`,
      },
    ],
  };
}
