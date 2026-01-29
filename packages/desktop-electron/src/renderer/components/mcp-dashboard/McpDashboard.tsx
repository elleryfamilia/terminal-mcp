/**
 * MCP Dashboard Component
 *
 * Main dashboard container that integrates all sub-components.
 * Also serves as the status bar when collapsed.
 */

import { useState, useCallback, useEffect } from 'react';
import type { DashboardView } from './types';
import type { McpStatus } from '../../types/electron';
import { useEnhancedClients } from './useEnhancedClients';
import { McpDashboardHeader } from './McpDashboardHeader';
import { ClientCard } from './ClientCard';
import { ClientDrilldown } from './ClientDrilldown';

interface McpDashboardProps {
  isExpanded: boolean;
  onToggle: () => void;
  mcpAttachedSessionId: string | null;
  isRecording: boolean;
}

export function McpDashboard({ isExpanded, onToggle, mcpAttachedSessionId, isRecording }: McpDashboardProps) {
  const {
    clients,
    aggregateMetrics,
    getHealthStatus,
    getSparklineData,
    disconnectClient,
    clearHistory,
  } = useEnhancedClients();

  const [view, setView] = useState<DashboardView>('cards');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState<string | null>(null);
  const [mcpStatus, setMcpStatus] = useState<McpStatus | null>(null);

  // Fetch MCP status
  useEffect(() => {
    window.terminalAPI.mcpGetStatus().then(setMcpStatus).catch(console.error);
    const cleanup = window.terminalAPI.onMcpStatusChanged(setMcpStatus);
    return cleanup;
  }, []);

  const handleDetails = useCallback((clientId: string) => {
    setSelectedClientId(clientId);
    setView('drilldown');
  }, []);

  const handleBack = useCallback(() => {
    setSelectedClientId(null);
    setView('cards');
  }, []);

  const handleDisconnect = useCallback((clientId: string) => {
    setShowDisconnectConfirm(clientId);
  }, []);

  const confirmDisconnect = useCallback(async () => {
    if (showDisconnectConfirm) {
      await disconnectClient(showDisconnectConfirm);
      setShowDisconnectConfirm(null);
      // If we were viewing that client's drilldown, go back to cards
      if (selectedClientId === showDisconnectConfirm) {
        setView('cards');
        setSelectedClientId(null);
      }
    }
  }, [showDisconnectConfirm, disconnectClient, selectedClientId]);

  const cancelDisconnect = useCallback(() => {
    setShowDisconnectConfirm(null);
  }, []);

  const selectedClient = selectedClientId ? clients.get(selectedClientId) : null;

  // If selected client disconnected, go back to cards
  if (view === 'drilldown' && selectedClientId && !selectedClient) {
    setView('cards');
    setSelectedClientId(null);
  }

  return (
    <div className={`mcp-dashboard ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <McpDashboardHeader
        isExpanded={isExpanded}
        metrics={aggregateMetrics}
        onToggle={onToggle}
        onClear={clearHistory}
        mcpAttached={!!mcpAttachedSessionId}
        isRecording={isRecording}
        socketPath={mcpStatus?.socketPath}
      />

      {isExpanded && (
        <div className="mcp-dashboard-content">
          {view === 'cards' && (
            <div className="mcp-dashboard-cards">
              {clients.size === 0 ? (
                <div className="mcp-dashboard-empty">
                  <span className="mcp-dashboard-empty-icon">◉</span>
                  <span>No clients connected</span>
                  <span className="mcp-dashboard-empty-hint">
                    Waiting for AI assistants to connect...
                  </span>
                </div>
              ) : (
                Array.from(clients.values()).map((client) => (
                  <ClientCard
                    key={client.clientId}
                    client={client}
                    healthStatus={getHealthStatus(client)}
                    sparklineData={getSparklineData(client)}
                    onDetails={handleDetails}
                    onDisconnect={handleDisconnect}
                  />
                ))
              )}
            </div>
          )}

          {view === 'drilldown' && selectedClient && (
            <ClientDrilldown
              client={selectedClient}
              sparklineData={getSparklineData(selectedClient)}
              onBack={handleBack}
              onDisconnect={handleDisconnect}
            />
          )}
        </div>
      )}

      {/* Disconnect Confirmation Dialog */}
      {showDisconnectConfirm && (
        <div className="mcp-dashboard-dialog-overlay" onClick={cancelDisconnect}>
          <div className="mcp-dashboard-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="mcp-dashboard-dialog-header">
              Disconnect Client
            </div>
            <div className="mcp-dashboard-dialog-body">
              <p>
                Are you sure you want to disconnect{' '}
                <strong>
                  {clients.get(showDisconnectConfirm)?.friendlyName || 'this client'}
                </strong>
                ?
              </p>
              <p>The client will need to reconnect to resume activity.</p>
            </div>
            <div className="mcp-dashboard-dialog-footer">
              <button
                className="mcp-dashboard-dialog-btn mcp-dashboard-dialog-btn-secondary"
                onClick={cancelDisconnect}
              >
                Cancel
              </button>
              <button
                className="mcp-dashboard-dialog-btn mcp-dashboard-dialog-btn-danger"
                onClick={confirmDisconnect}
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
