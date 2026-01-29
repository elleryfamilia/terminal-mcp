/**
 * MCP Dashboard Types
 *
 * Types and constants for the MCP Activity Dashboard.
 */

// Adjectives and nouns for friendly name generation
export const FRIENDLY_ADJECTIVES = [
  'Swift', 'Clever', 'Bright', 'Quick', 'Nimble',
  'Bold', 'Keen', 'Sharp', 'Wise', 'Deft',
  'Agile', 'Calm', 'Epic', 'Grand', 'Noble',
  'Prime', 'Vivid', 'Zesty', 'Lucky', 'Rapid'
];

export const FRIENDLY_NOUNS = [
  'Falcon', 'Otter', 'Raven', 'Eagle', 'Tiger',
  'Phoenix', 'Dragon', 'Panda', 'Wolf', 'Hawk',
  'Lion', 'Bear', 'Fox', 'Owl', 'Lynx',
  'Cobra', 'Shark', 'Whale', 'Crane', 'Heron'
];

// Health status thresholds
export const HEALTH_THRESHOLDS = {
  IDLE_TIMEOUT_MS: 2 * 60 * 1000,        // 2 minutes
  ERROR_RATE_WARNING: 0.2,                // 20% errors
  ERROR_RATE_CRITICAL: 0.5,               // 50% errors
};

// Sparkline configuration
export const SPARKLINE_CONFIG = {
  BARS: 10,
  BUCKET_DURATION_MS: 30 * 1000,          // 30 seconds per bucket
  TOTAL_DURATION_MS: 5 * 60 * 1000,       // 5 minutes total
};

// Health status
export type HealthStatus = 'healthy' | 'idle' | 'warning';

// Tool call record for history
export interface ToolCallRecord {
  id: number;
  tool: string;
  args?: Record<string, unknown>;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  success?: boolean;
  error?: string;
}

// Client stats
export interface ClientStats {
  totalCalls: number;
  errorCount: number;
  avgLatencyMs: number;
  callsPerMinute: number;
  lastActivityAt: number;
  lastMethod: string | null;
  lastMethodArgs: Record<string, unknown> | null;
  // Sparkline data: timestamps of calls in the last 5 minutes
  callTimestamps: number[];
}

// Enhanced client with computed metrics
export interface EnhancedClient {
  clientId: string;
  friendlyName: string;
  clientInfo?: {
    name: string;
    version: string;
  };
  runtime?: {
    hostApp?: string;
    platform?: string;
    arch?: string;
  };
  connectedAt: number;
  stats: ClientStats;
  history: ToolCallRecord[];
}

// Dashboard view state
export type DashboardView = 'cards' | 'drilldown';

// Props for main dashboard
export interface McpDashboardProps {
  isExpanded: boolean;
  onToggle: () => void;
  onClear: () => void;
}

// Aggregate metrics for header
export interface AggregateMetrics {
  totalClients: number;
  totalCalls: number;
  successRate: number;
  avgLatencyMs: number;
}
