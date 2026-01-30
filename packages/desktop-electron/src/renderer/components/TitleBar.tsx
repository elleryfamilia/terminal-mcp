/**
 * Title Bar Component
 *
 * Unified title bar with tabs on macOS. Provides draggable area
 * and integrates tabs at the same level as window controls.
 * Shows MCP and sandbox status icons in tabs.
 * When there's only one terminal (single tab, single pane), shows
 * full status badges in the title bar instead of the pane header.
 */

import { useCallback } from "react";
import { getProcessIcon, getProcessDisplayName } from "../utils/processIcons";
import { McpIcon, SandboxIcon, RecordIcon } from "./icons";
import { StatusBadge } from "./StatusBadge";
import type { PaneSandboxConfig } from "../types/pane";

export interface Tab {
  id: string;
  title: string;
  sessionId: string;
  processName: string;
  windowTitle?: string;
  isSandboxed: boolean;
  sandboxConfig?: PaneSandboxConfig;
  hasMultiplePanes: boolean;
  hasMcpSession: boolean;
  focusedPaneHasMcp: boolean;
}

interface TitleBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  mcpAttachedSessionId: string | null;
  recordingSessionId: string | null;
  isSingleTerminal: boolean;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  onOpenSettings?: () => void;
  onMcpToggle?: (sessionId: string) => void;
  onSandboxClick?: (config: PaneSandboxConfig) => void;
  onRecordingToggle?: (sessionId: string) => void;
}

export function TitleBar({
  tabs,
  activeTabId,
  mcpAttachedSessionId,
  recordingSessionId,
  isSingleTerminal,
  onTabSelect,
  onTabClose,
  onNewTab,
  onOpenSettings,
  onMcpToggle,
  onSandboxClick,
  onRecordingToggle,
}: TitleBarProps) {
  const handleTabClick = useCallback(
    (tabId: string, event: React.MouseEvent) => {
      event.preventDefault();
      onTabSelect(tabId);
    },
    [onTabSelect]
  );

  const handleCloseClick = useCallback(
    (tabId: string, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onTabClose(tabId);
    },
    [onTabClose]
  );

  const handleSettingsClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      onOpenSettings?.();
    },
    [onOpenSettings]
  );

  // Show tabs if 2+, otherwise show single process name centered
  const showTabs = tabs.length > 1;
  const singleTab = tabs.length === 1 ? tabs[0] : null;

  return (
    <div className={`title-bar ${showTabs ? "title-bar-with-tabs" : ""}`}>
      {/* Dedicated drag bar with traffic lights - only visible when multiple tabs */}
      {showTabs && (
        <div className="title-bar-drag-strip">
          <div className="title-bar-spacer" />
        </div>
      )}

      {/* Row containing tabs and new tab button */}
      <div className="title-bar-row">
        {/* Traffic light spacer on macOS - only needed when no drag strip */}
        {!showTabs && <div className="title-bar-spacer" />}

        {/* Tabs area - full width with equal distribution */}
        <div className="title-bar-tabs">
          {showTabs ? (
            // Multiple tabs - show tab bar
            tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              // Icon is always derived from the actual PTY process
              const icon = getProcessIcon(tab.processName);
              // Display text: use windowTitle if set, otherwise the process display name
              const displayName = tab.windowTitle || getProcessDisplayName(tab.processName);
              // Show MCP in tab if:
              // - Inactive tab: any pane has MCP
              // - Active tab: focused pane has MCP
              const showMcpInTab = isActive ? tab.focusedPaneHasMcp : tab.hasMcpSession;

              return (
                <div
                  key={tab.id}
                  className={`title-tab ${isActive ? "title-tab-active" : ""}`}
                  onClick={(e) => handleTabClick(tab.id, e)}
                  title={tab.hasMcpSession ? `${displayName} (AI-controlled)` : displayName}
                >
                  <button
                    className="title-tab-close"
                    onClick={(e) => handleCloseClick(tab.id, e)}
                    title="Close tab"
                  >
                    x
                  </button>
                  <span className="title-tab-content">
                    <span className="title-tab-icon">{icon}</span>
                    <span className="title-tab-text">{displayName}</span>
                    <span className="title-tab-status">
                      {tab.isSandboxed && <SandboxIcon size={11} className="title-tab-sandbox" />}
                      {showMcpInTab && (
                        <span className="title-tab-mcp-label">
                          <McpIcon isActive={true} size={11} />
                          <span>MCP</span>
                        </span>
                      )}
                    </span>
                  </span>
                </div>
              );
            })
          ) : singleTab ? (
            // Single tab - show centered process name with full status badges when single terminal
            <div className={`title-bar-single ${isSingleTerminal ? 'title-bar-single-merged' : ''}`}>
              <div className="title-bar-single-title">
                <span className="title-bar-single-icon">
                  {getProcessIcon(singleTab.processName)}
                </span>
                <span className="title-bar-single-name">
                  {singleTab.windowTitle || getProcessDisplayName(singleTab.processName)}
                </span>
              </div>
              {isSingleTerminal ? (
                // Full status badges when single terminal (merged with pane header)
                <div className="title-bar-single-badges">
                  {singleTab.isSandboxed && (
                    <StatusBadge
                      icon={<SandboxIcon size={12} />}
                      label="Sandboxed"
                      variant="sandbox"
                      onClick={singleTab.sandboxConfig && onSandboxClick ? () => onSandboxClick(singleTab.sandboxConfig!) : undefined}
                    />
                  )}
                  <StatusBadge
                    icon={<McpIcon isActive={singleTab.hasMcpSession} size={12} />}
                    label="MCP"
                    variant={singleTab.hasMcpSession ? "mcp-active" : "mcp-inactive"}
                    onClick={onMcpToggle ? () => onMcpToggle(singleTab.sessionId) : undefined}
                  />
                  <StatusBadge
                    icon={<RecordIcon size={12} />}
                    label={singleTab.sessionId === recordingSessionId ? "Recording" : undefined}
                    variant={singleTab.sessionId === recordingSessionId ? "recording" : "recording-inactive"}
                    onClick={onRecordingToggle ? () => onRecordingToggle(singleTab.sessionId) : undefined}
                  />
                </div>
              ) : (
                // Multiple panes - show MCP only if focused pane has it
                <span className="title-bar-single-status">
                  {singleTab.isSandboxed && <SandboxIcon size={12} className="title-bar-single-sandbox" />}
                  {singleTab.focusedPaneHasMcp && (
                    <span className="title-tab-mcp-label">
                      <McpIcon isActive={true} size={12} />
                      <span>MCP</span>
                    </span>
                  )}
                </span>
              )}
            </div>
          ) : null}
        </div>

        {/* Settings button */}
        {onOpenSettings && (
          <button
            className="title-bar-settings"
            onClick={handleSettingsClick}
            title="Settings (Cmd+,)"
          >
            ⚙
          </button>
        )}
      </div>
    </div>
  );
}
