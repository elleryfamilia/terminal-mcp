/**
 * Enhanced Clients Hook
 *
 * Manages client state with computed metrics, sparkline data,
 * and tool call history.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  McpToolCallStarted,
  McpToolCallCompleted,
  McpClientConnected,
  McpClientDisconnected,
} from '../../types/electron';
import type {
  EnhancedClient,
  ToolCallRecord,
  ClientStats,
  AggregateMetrics,
  HealthStatus,
} from './types';
import { HEALTH_THRESHOLDS, SPARKLINE_CONFIG } from './types';
import { getFriendlyName } from './useFriendlyName';

const MAX_HISTORY_SIZE = 50;

function createEmptyStats(): ClientStats {
  return {
    totalCalls: 0,
    errorCount: 0,
    avgLatencyMs: 0,
    callsPerMinute: 0,
    lastActivityAt: Date.now(),
    lastMethod: null,
    lastMethodArgs: null,
    callTimestamps: [],
  };
}

function createEnhancedClient(
  clientId: string,
  clientInfo?: { name: string; version: string },
  runtime?: { hostApp?: string; platform?: string; arch?: string },
  connectedAt?: number
): EnhancedClient {
  return {
    clientId,
    friendlyName: getFriendlyName(clientId),
    clientInfo,
    runtime,
    connectedAt: connectedAt ?? Date.now(),
    stats: createEmptyStats(),
    history: [],
  };
}

export interface UseEnhancedClientsReturn {
  clients: Map<string, EnhancedClient>;
  aggregateMetrics: AggregateMetrics;
  getHealthStatus: (client: EnhancedClient) => HealthStatus;
  getSparklineData: (client: EnhancedClient) => number[];
  disconnectClient: (clientId: string) => Promise<void>;
  clearHistory: () => void;
}

export function useEnhancedClients(): UseEnhancedClientsReturn {
  const [clients, setClients] = useState<Map<string, EnhancedClient>>(new Map());

  // Track pending tool calls to match started/completed
  const pendingCalls = useRef<Map<number, { clientId: string; startedAt: number }>>(new Map());

  // Cleanup old sparkline timestamps periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const cutoff = now - SPARKLINE_CONFIG.TOTAL_DURATION_MS;

      setClients((prev) => {
        let changed = false;
        const next = new Map(prev);

        for (const [id, client] of next) {
          const filteredTimestamps = client.stats.callTimestamps.filter((t) => t > cutoff);
          if (filteredTimestamps.length !== client.stats.callTimestamps.length) {
            changed = true;
            next.set(id, {
              ...client,
              stats: {
                ...client.stats,
                callTimestamps: filteredTimestamps,
                // Recalculate calls per minute
                callsPerMinute: filteredTimestamps.filter((t) => t > now - 60000).length,
              },
            });
          }
        }

        return changed ? next : prev;
      });
    }, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Subscribe to MCP events
  useEffect(() => {
    // Fetch initial clients
    window.terminalAPI.mcpGetClients().then((initialClients) => {
      console.log('[MCP Dashboard] Initial clients:', initialClients);
      const clientMap = new Map<string, EnhancedClient>();
      for (const client of initialClients) {
        clientMap.set(
          client.clientId,
          createEnhancedClient(
            client.clientId,
            client.clientInfo,
            client.runtime,
            client.connectedAt
          )
        );
      }
      setClients(clientMap);
    });

    // Client connected
    const cleanupConnected = window.terminalAPI.onMcpClientConnected(
      (event: McpClientConnected) => {
        console.log('[MCP Dashboard] Client connected:', event);
        setClients((prev) => {
          const next = new Map(prev);
          next.set(
            event.clientId,
            createEnhancedClient(
              event.clientId,
              event.clientInfo,
              event.runtime,
              event.timestamp
            )
          );
          return next;
        });
      }
    );

    // Client disconnected
    const cleanupDisconnected = window.terminalAPI.onMcpClientDisconnected(
      (event: McpClientDisconnected) => {
        setClients((prev) => {
          const next = new Map(prev);
          next.delete(event.clientId);
          return next;
        });
      }
    );

    // Tool call started
    const cleanupStarted = window.terminalAPI.onMcpToolCallStarted(
      (event: McpToolCallStarted) => {
        console.log('[MCP Dashboard] Tool call started:', event);
        // Track pending call
        pendingCalls.current.set(event.id, {
          clientId: event.clientId,
          startedAt: event.timestamp,
        });

        setClients((prev) => {
          const client = prev.get(event.clientId);
          if (!client) return prev;

          const record: ToolCallRecord = {
            id: event.id,
            tool: event.tool,
            args: event.args,
            startedAt: event.timestamp,
          };

          const newHistory = [record, ...client.history].slice(0, MAX_HISTORY_SIZE);

          const next = new Map(prev);
          next.set(event.clientId, {
            ...client,
            stats: {
              ...client.stats,
              lastActivityAt: event.timestamp,
              lastMethod: event.tool,
              lastMethodArgs: event.args ?? null,
            },
            history: newHistory,
          });

          return next;
        });
      }
    );

    // Tool call completed
    const cleanupCompleted = window.terminalAPI.onMcpToolCallCompleted(
      (event: McpToolCallCompleted) => {
        console.log('[MCP Dashboard] Tool call completed:', event);
        const pending = pendingCalls.current.get(event.id);
        pendingCalls.current.delete(event.id);

        // Find the client - either from pending or search all clients
        let targetClientId: string | null = pending?.clientId ?? null;

        if (!targetClientId) {
          // Search for the call in client histories
          setClients((prev) => {
            for (const [id, client] of prev) {
              const found = client.history.find((h) => h.id === event.id && !h.completedAt);
              if (found) {
                targetClientId = id;
                break;
              }
            }
            return prev;
          });
        }

        if (!targetClientId) return;

        setClients((prev) => {
          const client = prev.get(targetClientId!);
          if (!client) return prev;

          // Update the history record
          const newHistory = client.history.map((record) => {
            if (record.id === event.id) {
              return {
                ...record,
                completedAt: event.timestamp,
                duration: event.duration,
                success: event.success,
                error: event.error,
              };
            }
            return record;
          });

          // Update stats
          const newTotalCalls = client.stats.totalCalls + 1;
          const newErrorCount = client.stats.errorCount + (event.success ? 0 : 1);

          // Calculate new average latency
          const prevTotal = client.stats.avgLatencyMs * client.stats.totalCalls;
          const newAvgLatency =
            newTotalCalls > 0 ? (prevTotal + event.duration) / newTotalCalls : 0;

          // Add to sparkline timestamps
          const newTimestamps = [...client.stats.callTimestamps, event.timestamp];
          const now = Date.now();
          const oneMinuteAgo = now - 60000;
          const callsPerMinute = newTimestamps.filter((t) => t > oneMinuteAgo).length;

          const next = new Map(prev);
          next.set(targetClientId!, {
            ...client,
            stats: {
              ...client.stats,
              totalCalls: newTotalCalls,
              errorCount: newErrorCount,
              avgLatencyMs: Math.round(newAvgLatency),
              callsPerMinute,
              lastActivityAt: event.timestamp,
              callTimestamps: newTimestamps,
            },
            history: newHistory,
          });

          return next;
        });
      }
    );

    return () => {
      cleanupConnected();
      cleanupDisconnected();
      cleanupStarted();
      cleanupCompleted();
    };
  }, []);

  // Calculate aggregate metrics
  const aggregateMetrics: AggregateMetrics = {
    totalClients: clients.size,
    totalCalls: 0,
    successRate: 100,
    avgLatencyMs: 0,
  };

  let totalCalls = 0;
  let totalErrors = 0;
  let totalLatency = 0;
  let latencyCount = 0;

  for (const client of clients.values()) {
    totalCalls += client.stats.totalCalls;
    totalErrors += client.stats.errorCount;
    if (client.stats.avgLatencyMs > 0 && client.stats.totalCalls > 0) {
      totalLatency += client.stats.avgLatencyMs * client.stats.totalCalls;
      latencyCount += client.stats.totalCalls;
    }
  }

  aggregateMetrics.totalCalls = totalCalls;
  aggregateMetrics.successRate = totalCalls > 0 ? Math.round(((totalCalls - totalErrors) / totalCalls) * 100) : 100;
  aggregateMetrics.avgLatencyMs = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0;

  // Get health status for a client
  const getHealthStatus = useCallback((client: EnhancedClient): HealthStatus => {
    const now = Date.now();
    const timeSinceActivity = now - client.stats.lastActivityAt;

    // Check error rate first
    if (client.stats.totalCalls > 0) {
      const errorRate = client.stats.errorCount / client.stats.totalCalls;
      if (errorRate >= HEALTH_THRESHOLDS.ERROR_RATE_WARNING) {
        return 'warning';
      }
    }

    // Check idle status
    if (timeSinceActivity > HEALTH_THRESHOLDS.IDLE_TIMEOUT_MS) {
      return 'idle';
    }

    return 'healthy';
  }, []);

  // Get sparkline data (10 bars, each representing 30s of the last 5 min)
  const getSparklineData = useCallback((client: EnhancedClient): number[] => {
    const now = Date.now();
    const buckets: number[] = new Array(SPARKLINE_CONFIG.BARS).fill(0);

    for (const timestamp of client.stats.callTimestamps) {
      const age = now - timestamp;
      if (age < SPARKLINE_CONFIG.TOTAL_DURATION_MS) {
        const bucketIndex = Math.floor(age / SPARKLINE_CONFIG.BUCKET_DURATION_MS);
        if (bucketIndex >= 0 && bucketIndex < SPARKLINE_CONFIG.BARS) {
          buckets[SPARKLINE_CONFIG.BARS - 1 - bucketIndex]++;
        }
      }
    }

    return buckets;
  }, []);

  // Disconnect a client (will be implemented via IPC)
  const disconnectClient = useCallback(async (clientId: string): Promise<void> => {
    try {
      await window.terminalAPI.mcpDisconnectClient(clientId);
    } catch (error) {
      console.error('Failed to disconnect client:', error);
    }
  }, []);

  // Clear all history
  const clearHistory = useCallback(() => {
    setClients((prev) => {
      const next = new Map(prev);
      for (const [id, client] of next) {
        next.set(id, {
          ...client,
          stats: {
            ...client.stats,
            totalCalls: 0,
            errorCount: 0,
            avgLatencyMs: 0,
            callTimestamps: [],
          },
          history: [],
        });
      }
      return next;
    });
  }, []);

  return {
    clients,
    aggregateMetrics,
    getHealthStatus,
    getSparklineData,
    disconnectClient,
    clearHistory,
  };
}
