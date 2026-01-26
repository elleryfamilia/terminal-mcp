import { z } from "zod";
import { TerminalManager } from "../terminal/index.js";

export const startRecordingSchema = z.object({
  format: z.enum(['v2']).optional().default('v2'),
  mode: z.enum(['always', 'on-failure']).optional().default('always'),
  outputDir: z.string().optional(),
});

export const startRecordingTool = {
  name: "startRecording",
  description: "Start recording terminal output to an asciicast v2 file. Returns the recording ID and path where the file will be saved.",
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
        description: "Directory to save the recording (default: current directory)",
      },
    },
    required: [],
  },
};

export function handleStartRecording(
  manager: TerminalManager,
  args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const parsed = startRecordingSchema.parse(args ?? {});

  const recordingManager = manager.getRecordingManager();
  const recorder = recordingManager.createRecording({
    format: parsed.format,
    mode: parsed.mode,
    outputDir: parsed.outputDir ?? recordingManager.getDefaultOutputDir(),
  });

  // Get current dimensions and start recording
  const dimensions = manager.getDimensions();
  recorder.start(dimensions.cols, dimensions.rows, {
    TERM: 'xterm-256color',
  });

  const result = {
    recordingId: recorder.id,
    path: recorder.getFinalPath(),
    format: parsed.format,
    mode: parsed.mode,
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
