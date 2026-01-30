/**
 * MCP Activity Panel Component
 *
 * Collapsible panel showing real-time MCP activity including
 * connected clients and tool call history.
 */

import type {
  TrackedClient,
  McpToolCallStarted,
  McpToolCallCompleted,
} from "../types/electron";

// Activity entry for the feed
export interface McpActivityEntry {
  id: string;
  type: "started" | "completed" | "error" | "client_connected" | "client_disconnected";
  tool?: string;
  clientId: string;
  clientName?: string;
  timestamp: number;
  duration?: number;
  args?: Record<string, unknown>;
  error?: string;
}

interface McpActivityPanelProps {
  isExpanded: boolean;
  onToggle: () => void;
  clients: Map<string, TrackedClient>;
  activity: McpActivityEntry[];
  onClear: () => void;
}

export function McpActivityPanel({
  isExpanded,
  onToggle,
  clients,
  activity,
  onClear,
}: McpActivityPanelProps) {
  const clientCount = clients.size;
  const hasActivity = activity.length > 0;

  return (
    <div className={`mcp-activity-panel ${isExpanded ? "expanded" : "collapsed"}`}>
      <div className="mcp-activity-header" onClick={onToggle}>
        <div className="mcp-activity-header-left">
          <span className="mcp-activity-toggle">{isExpanded ? "▼" : "▶"}</span>
          <span className="mcp-activity-title">MCP Activity</span>
          {clientCount > 0 && (
            <span className="mcp-activity-client-count">{clientCount} client{clientCount !== 1 ? "s" : ""}</span>
          )}
        </div>
        <div className="mcp-activity-header-right">
          {hasActivity && (
            <button
              className="mcp-activity-clear"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="mcp-activity-content">
          {clientCount > 0 && (
            <div className="mcp-activity-clients">
              {Array.from(clients.values()).map((client) => (
                <div key={client.clientId} className="mcp-activity-client">
                  <span className="mcp-client-dot" />
                  <span className="mcp-client-name">
                    {client.clientInfo?.name || "Unknown Client"}
                  </span>
                  {client.clientInfo?.version && (
                    <span className="mcp-client-version">v{client.clientInfo.version}</span>
                  )}
                  {client.runtime?.hostApp && (
                    <span className="mcp-client-host">({client.runtime.hostApp})</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mcp-activity-list">
            {activity.length === 0 ? (
              <div className="mcp-activity-empty">No activity yet</div>
            ) : (
              activity.map((entry) => (
                <ActivityItem key={entry.id} entry={entry} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityItem({ entry }: { entry: McpActivityEntry }) {
  const timeStr = new Date(entry.timestamp).toLocaleTimeString();

  if (entry.type === "client_connected") {
    return (
      <div className="mcp-activity-item mcp-activity-item-connect">
        <span className="mcp-activity-time">{timeStr}</span>
        <span className="mcp-activity-icon">→</span>
        <span className="mcp-activity-message">
          {entry.clientName || entry.clientId} connected
        </span>
      </div>
    );
  }

  if (entry.type === "client_disconnected") {
    return (
      <div className="mcp-activity-item mcp-activity-item-disconnect">
        <span className="mcp-activity-time">{timeStr}</span>
        <span className="mcp-activity-icon">←</span>
        <span className="mcp-activity-message">
          {entry.clientName || entry.clientId} disconnected
        </span>
      </div>
    );
  }

  if (entry.type === "started") {
    return (
      <div className="mcp-activity-item mcp-activity-item-started">
        <span className="mcp-activity-time">{timeStr}</span>
        <span className="mcp-activity-icon">⋯</span>
        <span className="mcp-activity-tool">{entry.tool}</span>
        {entry.args && Object.keys(entry.args).length > 0 && (
          <span className="mcp-activity-args">
            {formatArgs(entry.args)}
          </span>
        )}
      </div>
    );
  }

  if (entry.type === "completed") {
    return (
      <div className="mcp-activity-item mcp-activity-item-completed">
        <span className="mcp-activity-time">{timeStr}</span>
        <span className="mcp-activity-icon">✓</span>
        <span className="mcp-activity-tool">{entry.tool}</span>
        {entry.duration !== undefined && (
          <span className="mcp-activity-duration">{entry.duration}ms</span>
        )}
      </div>
    );
  }

  if (entry.type === "error") {
    return (
      <div className="mcp-activity-item mcp-activity-item-error">
        <span className="mcp-activity-time">{timeStr}</span>
        <span className="mcp-activity-icon">✗</span>
        <span className="mcp-activity-tool">{entry.tool}</span>
        {entry.error && (
          <span className="mcp-activity-error-msg" title={entry.error}>
            {truncate(entry.error, 50)}
          </span>
        )}
      </div>
    );
  }

  return null;
}

function formatArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return "";

  // Show first arg value, truncated
  const [key, value] = entries[0];
  const strValue = typeof value === "string" ? value : JSON.stringify(value);
  return truncate(strValue, 30);
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

// Helper to create activity entry from tool call started event
export function createStartedEntry(event: McpToolCallStarted): McpActivityEntry {
  return {
    id: `started-${event.id}-${event.timestamp}`,
    type: "started",
    tool: event.tool,
    clientId: event.clientId,
    timestamp: event.timestamp,
    args: event.args,
  };
}

// Helper to create activity entry from tool call completed event
export function createCompletedEntry(event: McpToolCallCompleted): McpActivityEntry {
  return {
    id: `completed-${event.id}-${event.timestamp}`,
    type: event.success ? "completed" : "error",
    tool: event.tool,
    clientId: "", // Will be filled in by caller if known
    timestamp: event.timestamp,
    duration: event.duration,
    error: event.error,
  };
}

// Helper to create client connected entry
export function createClientConnectedEntry(
  clientId: string,
  clientName?: string,
  timestamp?: number
): McpActivityEntry {
  return {
    id: `connect-${clientId}-${timestamp || Date.now()}`,
    type: "client_connected",
    clientId,
    clientName,
    timestamp: timestamp || Date.now(),
  };
}

// Helper to create client disconnected entry
export function createClientDisconnectedEntry(
  clientId: string,
  clientName?: string,
  timestamp?: number
): McpActivityEntry {
  return {
    id: `disconnect-${clientId}-${timestamp || Date.now()}`,
    type: "client_disconnected",
    clientId,
    clientName,
    timestamp: timestamp || Date.now(),
  };
}
