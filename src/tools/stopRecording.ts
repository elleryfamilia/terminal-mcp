import { z } from "zod";
import { TerminalManager } from "../terminal/index.js";

export const stopRecordingSchema = z.object({
  recordingId: z.string(),
});

export const stopRecordingTool = {
  name: "stopRecording",
  description: "Stop a recording and finalize the asciicast file. Returns metadata about the saved recording including the file path and duration.",
  inputSchema: {
    type: "object" as const,
    properties: {
      recordingId: {
        type: "string",
        description: "The recording ID returned by startRecording",
      },
    },
    required: ["recordingId"],
  },
};

export async function handleStopRecording(
  manager: TerminalManager,
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const parsed = stopRecordingSchema.parse(args);

  const recordingManager = manager.getRecordingManager();
  const recorder = recordingManager.getRecording(parsed.recordingId);

  if (!recorder) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: Recording not found: ${parsed.recordingId}`,
        },
      ],
      isError: true,
    };
  }

  if (!recorder.isActive()) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: Recording already finalized: ${parsed.recordingId}`,
        },
      ],
      isError: true,
    };
  }

  // Finalize with exit code 0 (explicit stop means success)
  const metadata = await recordingManager.finalizeRecording(parsed.recordingId, 0);

  if (!metadata) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: Failed to finalize recording: ${parsed.recordingId}`,
        },
      ],
      isError: true,
    };
  }

  const result = {
    recordingId: metadata.id,
    path: metadata.path,
    durationMs: metadata.durationMs,
    bytesWritten: metadata.bytesWritten,
    saved: metadata.saved,
    mode: metadata.mode,
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
