/**
 * Status Bar Component
 *
 * Displays session status and other information at the bottom of the terminal window.
 */

import { useEffect, useState, useCallback } from "react";
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
  const [copied, setCopied] = useState(false);

  // Fetch initial MCP status and subscribe to changes
  useEffect(() => {
    // Get initial status
    window.terminalAPI.mcpGetStatus().then(setMcpStatus).catch(console.error);

    // Subscribe to status changes
    const cleanup = window.terminalAPI.onMcpStatusChanged(setMcpStatus);
    return cleanup;
  }, []);

  // Copy socket path to clipboard
  const handleCopySocketPath = useCallback(async () => {
    if (mcpStatus?.socketPath) {
      try {
        await navigator.clipboard.writeText(mcpStatus.socketPath);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  }, [mcpStatus?.socketPath]);

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        {/* Connection status */}
        <span className={`status-indicator ${isConnected ? "connected" : "disconnected"}`}>
          <span className="status-dot" />
          {isConnected ? "Connected" : "Disconnected"}
        </span>

        {/* Recording indicator */}
        {isRecording && (
          <span className="status-indicator recording">
            <span className="recording-dot" />
            Recording
          </span>
        )}

        {/* MCP attachment indicator */}
        {mcpAttachedSessionId && (
          <span className="status-indicator mcp" title="MCP attached to terminal">
            MCP Active
          </span>
        )}
      </div>

      <div className="status-bar-center">
        {/* Socket path - click to copy */}
        {mcpStatus?.isRunning && mcpStatus.socketPath && (
          <button
            className="socket-path-btn"
            onClick={handleCopySocketPath}
            title={copied ? "Copied!" : `Click to copy: ${mcpStatus.socketPath}`}
          >
            {copied ? "Copied!" : mcpStatus.socketPath}
          </button>
        )}
      </div>

      <div className="status-bar-right">
        {/* Could add more status info here */}
      </div>
    </div>
  );
}
