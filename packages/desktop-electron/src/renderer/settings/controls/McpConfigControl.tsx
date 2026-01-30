/**
 * MCP Configuration Control
 *
 * Displays the MCP socket path and copyable mcp.json configuration
 * for setting up AI assistants to connect to this terminal.
 */

import { useState, useEffect, useCallback } from 'react';
import type { McpStatus } from '../../types/electron';

export function McpConfigControl() {
  const [mcpStatus, setMcpStatus] = useState<McpStatus | null>(null);
  const [copied, setCopied] = useState<'path' | 'config' | null>(null);

  // Fetch MCP status
  useEffect(() => {
    window.terminalAPI.mcpGetStatus().then(setMcpStatus).catch(console.error);
    const cleanup = window.terminalAPI.onMcpStatusChanged(setMcpStatus);
    return cleanup;
  }, []);

  const mcpConfig = {
    mcpServers: {
      "terminal-mcp": {
        command: "npx",
        args: ["-y", "terminal-mcp"]
      }
    }
  };

  const handleCopyPath = useCallback(async () => {
    if (mcpStatus?.socketPath) {
      try {
        await navigator.clipboard.writeText(mcpStatus.socketPath);
        setCopied('path');
        setTimeout(() => setCopied(null), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  }, [mcpStatus?.socketPath]);

  const handleCopyConfig = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(mcpConfig, null, 2));
      setCopied('config');
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  return (
    <div className="settings-control settings-mcp-config">
      {/* Socket Path */}
      <div className="mcp-config-item">
        <div className="mcp-config-label">Socket Path</div>
        <div className="mcp-config-value-row">
          <code className="mcp-config-code">
            {mcpStatus?.socketPath || 'Not running'}
          </code>
          {mcpStatus?.socketPath && (
            <button
              className="mcp-config-copy-btn"
              onClick={handleCopyPath}
              title="Copy socket path"
            >
              {copied === 'path' ? '✓' : 'Copy'}
            </button>
          )}
        </div>
      </div>

      {/* MCP JSON Config */}
      <div className="mcp-config-item">
        <div className="mcp-config-label-row">
          <span className="mcp-config-label">mcp.json configuration</span>
          <button
            className="mcp-config-copy-btn"
            onClick={handleCopyConfig}
            title="Copy configuration"
          >
            {copied === 'config' ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <pre className="mcp-config-json">
          {JSON.stringify(mcpConfig, null, 2)}
        </pre>
      </div>
    </div>
  );
}
