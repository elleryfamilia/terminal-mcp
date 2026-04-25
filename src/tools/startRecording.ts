import { z } from "zod";
import { TerminalManager } from "../terminal/index.js";

export const startRecordingSchema = z.object({
  format: z.enum(['v2']).optional().default('v2'),
  mode: z.enum(['always', 'on-failure']).optional().default('always'),
  outputDir: z.string().optional(),
  idleTimeLimit: z.number().optional().default(2),
  maxDuration: z.number().optional().default(3600),
  inactivityTimeout: z.number().optional().default(600),
});

export const startRecordingTool = {
  name: "startRecording",
  description: "Start recording terminal output to an asciicast v2 file. Returns the recording ID and path where the file will be saved. Only one recording can be active at a time. Recording captures output from all active sessions in the process.",
  inputSchema: {
    type: "object" as const,
    properties: {
      format: {
        type: "string",
        enum: ["v2"],
        description: "Recording format (default: v2, asciicast v2 format)",
      },
      mode: {
        type: "string",
        enum: ["always", "on-failure"],
        description: "Recording mode: always saves the recording, on-failure only saves if session exits with non-zero code (default: always)",
      },
      outputDir: {
        type: "string",
        description: "Directory to save the recording (default: ~/.local/state/terminal-mcp/recordings, or TERMINAL_MCP_RECORD_DIR env var)",
      },
      idleTimeLimit: {
        type: "number",
        description: "Max seconds between events in the recording (default: 2). Caps idle time to prevent long pauses during playback.",
      },
      maxDuration: {
        type: "number",
        description: "Max recording duration in seconds (default: 3600 = 60 minutes). Recording will auto-stop when this limit is reached.",
      },
      inactivityTimeout: {
        type: "number",
        description: "Stop recording after N seconds of no terminal output (default: 600 = 10 minutes). Resets on each output event.",
      },
    },
    required: [],
  },
};

export function handleStartRecording(
  manager: TerminalManager,
  args: unknown
): { content: Array<{ type: "text"; text: string }>; isError?: boolean } {
  const parsed = startRecordingSchema.parse(args ?? {});

  const recordingManager = manager.getRecordingManager();

  // Check if there's already an active recording
  const activeRecordings = recordingManager.getActiveRecordings();
  if (activeRecordings.length > 0) {
    const existing = activeRecordings[0];
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: "A recording is already in progress",
            activeRecordingId: existing.id,
            activePath: existing.getFinalPath(),
          }, null, 2),
        },
      ],
      isError: true,
    };
  }

  const recorder = recordingManager.createRecording({
    format: parsed.format,
    mode: parsed.mode,
    outputDir: parsed.outputDir ?? recordingManager.getDefaultOutputDir(),
    idleTimeLimit: parsed.idleTimeLimit,
    maxDuration: parsed.maxDuration,
    inactivityTimeout: parsed.inactivityTimeout,
  });

  // Get current dimensions and start recording
  const dimensions = manager.getDimensions();
  recorder.start(dimensions.cols, dimensions.rows, {
    TERM: 'xterm-256color',
  });

  // Build timeout message
  const timeoutParts: string[] = [];
  if (parsed.maxDuration > 0) {
    const mins = Math.floor(parsed.maxDuration / 60);
    timeoutParts.push(`${mins} minute${mins !== 1 ? 's' : ''}`);
  }
  if (parsed.inactivityTimeout > 0) {
    const mins = Math.floor(parsed.inactivityTimeout / 60);
    timeoutParts.push(`${mins} minute${mins !== 1 ? 's' : ''} of inactivity`);
  }
  const timeoutMessage = timeoutParts.length > 0
    ? `Recording will auto-stop after ${timeoutParts.join(' or ')}`
    : undefined;

  const result = {
    recordingId: recorder.id,
    path: recorder.getFinalPath(),
    format: parsed.format,
    mode: parsed.mode,
    maxDuration: parsed.maxDuration,
    inactivityTimeout: parsed.inactivityTimeout,
    message: timeoutMessage,
  };

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
