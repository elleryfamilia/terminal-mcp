/**
 * Client Card Component
 *
 * Displays client info, metrics, and actions in a card layout.
 */

import { useCallback } from 'react';
import type { EnhancedClient, HealthStatus } from './types';
import { HealthIndicator } from './HealthIndicator';
import { MiniSparkline } from './MiniSparkline';

interface ClientCardProps {
  client: EnhancedClient;
  healthStatus: HealthStatus;
  sparklineData: number[];
  onDetails: (clientId: string) => void;
  onDisconnect: (clientId: string) => void;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

function truncateArgs(args: Record<string, unknown> | null): string {
  if (!args) return '';
  const entries = Object.entries(args);
  if (entries.length === 0) return '';

  const [, value] = entries[0];
  const strValue = typeof value === 'string' ? value : JSON.stringify(value);
  if (strValue.length > 20) {
    return `"${strValue.slice(0, 17)}..."`;
  }
  return `"${strValue}"`;
}

export function ClientCard({
  client,
  healthStatus,
  sparklineData,
  onDetails,
  onDisconnect,
}: ClientCardProps) {
  const connectedDuration = Date.now() - client.connectedAt;
  const displayName = client.clientInfo?.name || client.friendlyName;
  const version = client.clientInfo?.version;

  const handleDetails = useCallback(() => {
    onDetails(client.clientId);
  }, [client.clientId, onDetails]);

  const handleDisconnect = useCallback(() => {
    onDisconnect(client.clientId);
  }, [client.clientId, onDisconnect]);

  const successRate = client.stats.totalCalls > 0
    ? Math.round(((client.stats.totalCalls - client.stats.errorCount) / client.stats.totalCalls) * 100)
    : 100;

  const getSuccessRateClass = () => {
    if (successRate >= 95) return 'rate-good';
    if (successRate >= 80) return 'rate-warning';
    return 'rate-error';
  };

  return (
    <div className="client-card">
      <div className="client-card-header">
        <div className="client-card-title">
          <span className="client-card-name">{client.friendlyName}</span>
          <HealthIndicator status={healthStatus} />
        </div>
      </div>

      <div className="client-card-info">
        <span className="client-card-detail">
          {displayName}
          {version && ` v${version}`}
        </span>
        <span className="client-card-duration">
          Connected: {formatDuration(connectedDuration)}
        </span>
      </div>

      <div className="client-card-metrics">
        <div className="client-card-stats">
          <span className="client-card-stat">
            <strong>{client.stats.totalCalls}</strong> calls
          </span>
          <span className={`client-card-stat ${client.stats.errorCount > 0 ? 'has-errors' : ''}`}>
            <strong>{client.stats.errorCount}</strong> err
          </span>
          {client.stats.avgLatencyMs > 0 && (
            <span className="client-card-stat stat-latency">
              {client.stats.avgLatencyMs}ms
            </span>
          )}
        </div>
        <MiniSparkline data={sparklineData} />
      </div>

      {client.stats.lastMethod && (
        <div className="client-card-last">
          <span className="client-card-last-label">Last:</span>
          <span className="client-card-last-method">{client.stats.lastMethod}</span>
          {client.stats.lastMethodArgs && (
            <span className="client-card-last-args">
              {truncateArgs(client.stats.lastMethodArgs)}
            </span>
          )}
          <span className="client-card-last-time">
            ({formatTimeAgo(client.stats.lastActivityAt)})
          </span>
        </div>
      )}

      <div className="client-card-actions">
        <button
          className="client-card-btn client-card-btn-details"
          onClick={handleDetails}
        >
          Details
        </button>
        <button
          className="client-card-btn client-card-btn-disconnect"
          onClick={handleDisconnect}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
