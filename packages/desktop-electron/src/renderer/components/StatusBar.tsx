/**
 * Status Bar Component
 *
 * Displays session status, MCP connection indicator, and other information
 * at the bottom of the terminal window.
 */

import { useEffect, useState } from "react";
import type { McpStatus } from "../types/electron";

interface StatusBarProps {
  sessionId: string | null;
  isRecording: boolean;
  isConnected: boolean;
  mcpAttachedSessionId: string | null;
  activeTabTitle: string | null;
  onMcpToggle: () => void;
}

export function StatusBar({
  sessionId,
  isRecording,
  isConnected,
  mcpAttachedSessionId,
  activeTabTitle,
  onMcpToggle,
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

  // Check if current session has MCP attached
  const currentSessionHasMcp = sessionId && sessionId === mcpAttachedSessionId;

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

        {/* MCP attachment toggle */}
        {mcpStatus?.isRunning && (
          <button
            className={`mcp-toggle ${currentSessionHasMcp ? "mcp-enabled" : ""}`}
            onClick={onMcpToggle}
            title={currentSessionHasMcp
              ? "Disable MCP on this terminal"
              : "Enable MCP on this terminal"
            }
          >
            <span className="mcp-toggle-icon">AI</span>
            <span className="mcp-toggle-label">
              {currentSessionHasMcp ? "Disable MCP" : "Enable MCP"}
            </span>
          </button>
        )}

        {/* MCP client connection count */}
        {mcpStatus && mcpStatus.isRunning && mcpStatus.clientCount > 0 && (
          <span
            className="status-indicator mcp mcp-connected"
            title={`${mcpStatus.clientCount} AI assistant(s) connected`}
          >
            <span className="mcp-count">{mcpStatus.clientCount}</span>
          </span>
        )}
      </div>

      <div className="status-bar-center">
        {/* MCP attachment status */}
        {mcpAttachedSessionId ? (
          <span className="mcp-status-text" title={`MCP attached to ${mcpAttachedSessionId}`}>
            MCP: {activeTabTitle || "Terminal"}
          </span>
        ) : (
          <span className="mcp-status-text mcp-disabled" title="MCP not attached to any terminal">
            MCP: Disabled
          </span>
        )}
      </div>

      <div className="status-bar-right">
        {/* MCP socket path hint */}
        {mcpStatus?.isRunning && (
          <span className="socket-path" title={`Connect: ${mcpStatus.socketPath}`}>
            {mcpStatus.socketPath.split("/").pop()}
          </span>
        )}
        {/* Terminal MCP branding */}
        <span className="branding">Terminal MCP</span>
      </div>
    </div>
  );
}
