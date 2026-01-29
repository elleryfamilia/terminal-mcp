/**
 * Client Drilldown Component
 *
 * Full detail view for a single client with execution history.
 */

import type { EnhancedClient, ToolCallRecord } from './types';
import { MiniSparkline } from './MiniSparkline';

interface ClientDrilldownProps {
  client: EnhancedClient;
  sparklineData: number[];
  onBack: () => void;
  onDisconnect: (clientId: string) => void;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function truncateArgs(args?: Record<string, unknown>): string {
  if (!args) return '-';
  const entries = Object.entries(args);
  if (entries.length === 0) return '-';

  const [, value] = entries[0];
  const strValue = typeof value === 'string' ? value : JSON.stringify(value);
  if (strValue.length > 30) {
    return `"${strValue.slice(0, 27)}..."`;
  }
  return `"${strValue}"`;
}

function HistoryItem({ record }: { record: ToolCallRecord }) {
  const isCompleted = record.completedAt !== undefined;
  const isSuccess = record.success === true;
  const isError = record.success === false;

  return (
    <>
      <div className={`drilldown-history-item ${isError ? 'history-error' : ''}`}>
        <span className="history-time">{formatTime(record.startedAt)}</span>
        <span className="history-tool">{record.tool}</span>
        <span className="history-args">{truncateArgs(record.args)}</span>
        <span className="history-duration">
          {isCompleted && record.duration !== undefined
            ? `${record.duration}ms`
            : '...'}
        </span>
        <span className="history-status">
          {!isCompleted && <span className="status-pending">...</span>}
          {isSuccess && <span className="status-success">✓</span>}
          {isError && <span className="status-error">✗</span>}
        </span>
      </div>
      {isError && record.error && (
        <div className="drilldown-history-error">
          Error: {record.error}
        </div>
      )}
    </>
  );
}

export function ClientDrilldown({
  client,
  sparklineData,
  onBack,
  onDisconnect,
}: ClientDrilldownProps) {
  const displayName = client.clientInfo?.name || client.friendlyName;
  const version = client.clientInfo?.version;

  return (
    <div className="client-drilldown">
      <div className="drilldown-header">
        <button className="drilldown-back" onClick={onBack}>
          ← Back
        </button>
        <span className="drilldown-title">{client.friendlyName}</span>
        <button
          className="drilldown-disconnect"
          onClick={() => onDisconnect(client.clientId)}
        >
          Disconnect
        </button>
      </div>

      <div className="drilldown-info">
        <div className="drilldown-info-left">
          <div className="drilldown-info-row">
            <span className="drilldown-label">Name:</span>
            <span className="drilldown-value">
              {displayName}
              {version && ` v${version}`}
            </span>
          </div>
          {client.runtime?.hostApp && (
            <div className="drilldown-info-row">
              <span className="drilldown-label">Host:</span>
              <span className="drilldown-value">{client.runtime.hostApp}</span>
            </div>
          )}
          {client.runtime?.platform && (
            <div className="drilldown-info-row">
              <span className="drilldown-label">Platform:</span>
              <span className="drilldown-value">
                {client.runtime.platform}
                {client.runtime.arch && ` ${client.runtime.arch}`}
              </span>
            </div>
          )}
          <div className="drilldown-info-row">
            <span className="drilldown-label">Connected:</span>
            <span className="drilldown-value">{formatDate(client.connectedAt)}</span>
          </div>
        </div>

        <div className="drilldown-info-right">
          <div className="drilldown-stats">
            <span className="drilldown-stat">
              <strong>{client.stats.totalCalls}</strong> calls
            </span>
            <span className="drilldown-stat">
              <strong>{client.stats.errorCount}</strong> errors
            </span>
            <span className="drilldown-stat">
              <strong>{client.stats.avgLatencyMs || '-'}</strong>ms avg
            </span>
          </div>
          <div className="drilldown-sparkline">
            <MiniSparkline data={sparklineData} width={100} height={24} />
            <span className="drilldown-sparkline-label">
              {client.stats.callsPerMinute.toFixed(1)} calls/min
            </span>
          </div>
        </div>
      </div>

      <div className="drilldown-history">
        <div className="drilldown-history-header">
          Execution History
        </div>
        <div className="drilldown-history-list">
          {client.history.length === 0 ? (
            <div className="drilldown-history-empty">No activity yet</div>
          ) : (
            client.history.map((record) => (
              <HistoryItem key={`${record.id}-${record.startedAt}`} record={record} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
