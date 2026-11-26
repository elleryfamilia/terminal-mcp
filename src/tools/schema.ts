import { z } from "zod";

/**
 * The JSON Schema shape MCP clients receive for a tool's arguments.
 */
export interface ToolInputSchema {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
}

/**
 * Derive the wire schema from the zod schema that actually validates the
 * arguments.
 *
 * These used to be written twice per tool — a zod schema for parsing and a
 * hand-kept JSON Schema for `tools/list` — and they drifted (a description
 * updated in one place, a missing `Escape`, `cols` declared as `number` while
 * parsing rejected non-integers). Deriving one from the other means the schema
 * a client sees is the schema that runs.
 *
 * `io: "input"` because this describes arguments coming in, where fields with
 * a default are optional, not the parsed output where they are always present.
 */
export function inputSchemaOf(schema: z.ZodType): ToolInputSchema {
  const { $schema: _dialect, ...generated } = z.toJSONSchema(schema, {
    io: "input",
  }) as ToolInputSchema & { $schema?: string };

  return {
    ...generated,
    type: "object",
    properties: generated.properties ?? {},
    required: generated.required ?? [],
  };
}
