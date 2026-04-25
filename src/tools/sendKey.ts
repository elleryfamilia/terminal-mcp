import { z } from "zod";
import { TerminalManager } from "../terminal/index.js";
import { getKeySequence, getAvailableKeys } from "../utils/keys.js";

export const sendKeySchema = z.object({
  key: z.string().describe("The key to send (e.g., 'Enter', 'Tab', 'Ctrl+C', 'ArrowUp')"),
  sessionId: z.string().optional().describe("Target session ID. Omit to target the default session."),
});

export type SendKeyArgs = z.infer<typeof sendKeySchema>;

const availableKeys = getAvailableKeys();

export const sendKeyTool = {
  name: "sendKey",
  description: "Send a special key or key combination to the terminal. Common keys: Enter, Tab, Escape, Backspace, Delete, ArrowUp/Down/Left/Right, Home, End, PageUp, PageDown. Control sequences: Ctrl+C (interrupt), Ctrl+D (EOF), Ctrl+Z (suspend), Ctrl+L (clear screen), Ctrl+A (line start), Ctrl+E (line end), Ctrl+U (clear line). Function keys: F1-F12. Pass sessionId to target a specific session.",
  inputSchema: {
    type: "object" as const,
    properties: {
      key: {
        type: "string",
        description: "The key to send (e.g., 'Enter', 'Tab', 'Ctrl+C', 'ArrowUp', 'Escape')",
      },
      sessionId: {
        type: "string",
        description: "Target session ID. Omit to target the default session.",
      },
    },
    required: ["key"],
  },
};

export function handleSendKey(manager: TerminalManager, args: unknown): { content: Array<{ type: "text"; text: string }> } {
  const parsed = sendKeySchema.parse(args);
  const sequence = getKeySequence(parsed.key);

  if (sequence === null) {
    const available = getAvailableKeys();
    throw new Error(
      `Unknown key: "${parsed.key}". Available keys include: ${available.slice(0, 15).join(", ")}...`
    );
  }

  manager.write(sequence, parsed.sessionId);

  return {
    content: [
      {
        type: "text",
        text: `Sent key: ${parsed.key}`,
      },
    ],
  };
}
