/**
 * Extended ClientInfo Types for MCP Observability
 *
 * Defines the schema for extended client metadata passed during MCP initialization.
 * Includes runtime info, capabilities, session metadata, and observability options.
 */

import { z } from "zod";

// Base client info (standard MCP)
export const ClientInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  instanceId: z.string().optional(), // UUID per launch
});

// Runtime environment info
export const RuntimeInfoSchema = z.object({
  hostApp: z.string().optional(), // "VSCode", "Cursor", "Terminal"
  platform: z.string().optional(), // "macOS", "Linux", "Windows"
  arch: z.string().optional(), // "arm64", "x64"
});

// Client capabilities
export const CapabilitiesSchema = z.object({
  streaming: z.boolean().optional(),
  notifications: z.boolean().optional(),
  maxConcurrency: z.number().optional(),
});

// Session metadata
export const SessionMetadataSchema = z.object({
  label: z.string().optional(), // "dev", "ci", "demo"
  workspaceId: z.string().optional(),
});

// Observability options
export const ObservabilitySchema = z.object({
  traceId: z.string().optional(),
  logLevel: z.enum(["info", "debug"]).optional(),
});

// Extended client info schema
export const ExtendedClientInfoSchema = z.object({
  clientInfo: ClientInfoSchema.optional(),
  runtime: RuntimeInfoSchema.optional(),
  capabilities: CapabilitiesSchema.optional(),
  session: SessionMetadataSchema.optional(),
  observability: ObservabilitySchema.optional(),
});

// TypeScript types derived from schemas
export type ClientInfo = z.infer<typeof ClientInfoSchema>;
export type RuntimeInfo = z.infer<typeof RuntimeInfoSchema>;
export type Capabilities = z.infer<typeof CapabilitiesSchema>;
export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;
export type Observability = z.infer<typeof ObservabilitySchema>;
export type ExtendedClientInfo = z.infer<typeof ExtendedClientInfoSchema>;

/**
 * Tracked client state stored per-connection
 */
export interface TrackedClient {
  clientId: string;
  clientInfo?: ClientInfo;
  runtime?: RuntimeInfo;
  capabilities?: Capabilities;
  session?: SessionMetadata;
  observability?: Observability;
  connectedAt: number;
}

/**
 * Session log entry types for JSONL logging
 */
export type SessionLogEntry =
  | SessionConnectEntry
  | SessionDisconnectEntry
  | SessionToolCallEntry;

export interface SessionConnectEntry {
  type: "connect";
  timestamp: number;
  clientId: string;
  clientName?: string;
  version?: string;
  runtime?: RuntimeInfo;
}

export interface SessionDisconnectEntry {
  type: "disconnect";
  timestamp: number;
  clientId: string;
}

export interface SessionToolCallEntry {
  type: "tool_call";
  timestamp: number;
  clientId: string;
  method: string;
  params?: Record<string, unknown>;
  durationMs: number;
  result: "success" | "error";
  error?: string;
}

/**
 * Generate a client ID from client info
 * Uses instanceId if provided, otherwise generates from name+version+timestamp+random
 */
export function generateClientId(clientInfo?: Partial<ClientInfo>): string {
  // Use instanceId if provided
  if (clientInfo?.instanceId) {
    return clientInfo.instanceId;
  }

  // Generate fallback: name-version-timestamp-random
  const parts = [
    clientInfo?.name || "unknown",
    clientInfo?.version || "0.0.0",
    Date.now().toString(36),
    Math.random().toString(36).substring(2, 8),
  ];
  return parts.join("-");
}
