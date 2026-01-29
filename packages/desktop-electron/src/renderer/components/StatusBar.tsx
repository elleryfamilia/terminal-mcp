/**
 * Status Bar Component
 *
 * Displays session status and other information at the bottom of the terminal window.
 * MCP info has been moved to the MCP Dashboard.
 */

import { useEffect, useState } from "react";
import type { McpStatus } from "../types/electron";

interface StatusBarProps {
  sessionId: string | null;
  isRecording: boolean;
  isConnected: boolean;
  mcpAttachedSessionId: string | null;
  activeTabTitle: string | null;
}

export function StatusBar({
  sessionId,
  isRecording,
  isConnected,
  mcpAttachedSessionId,
  activeTabTitle,
}: StatusBarProps) {
  const [mcpStatus, setMcpStatus] = useState<McpStatus | null>(null);

  // Fetch initial MCP status and subscribe to changes
  useEffect(() => {
    // Get initial status
    window.terminalAPI.mcpGetStatus().then(setMcpStatus).catch(console.error);

    // Subscribe to status changes
    const cleanup = window.terminalAPI.onMcpStatusChanged(setMcpStatus);
    return cleanup;
  }, []);

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        {/* Connection status */}
        <span className={`status-indicator ${isConnected ? "connected" : "disconnected"}`}>
          <span className="status-dot" />
          {isConnected ? "Terminal" : "Disconnected"}
        </span>

        {/* Recording indicator */}
        {isRecording && (
          <span className="status-indicator recording">
            <span className="recording-dot" />
            Recording
          </span>
        )}

        {/* MCP attachment indicator (simple) */}
        {mcpAttachedSessionId && (
          <span className="status-indicator mcp mcp-connected" title="MCP enabled">
            <span className="mcp-icon active">MCP</span>
          </span>
        )}
      </div>

      <div className="status-bar-center">
        {/* Socket path for connection */}
        {mcpStatus?.isRunning && (
          <span className="socket-path" title={`Connect: ${mcpStatus.socketPath}`}>
            {mcpStatus.socketPath}
          </span>
        )}
      </div>

      <div className="status-bar-right">
        {/* Terminal MCP branding */}
        <span className="branding">Terminal MCP</span>
      </div>
    </div>
  );
}
