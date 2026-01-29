/**
 * Title Bar Component
 *
 * Unified title bar with tabs on macOS. Provides draggable area
 * and integrates tabs at the same level as window controls.
 * Shows MCP and sandbox status icons in tabs.
 */

import { useCallback } from "react";
import { getProcessIcon, getProcessDisplayName } from "../utils/processIcons";
import { McpIcon, SandboxIcon } from "./icons";

export interface Tab {
  id: string;
  title: string;
  sessionId: string;
  processName: string;
  isSandboxed: boolean;
}

interface TitleBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  mcpAttachedSessionId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
}

export function TitleBar({
  tabs,
  activeTabId,
  mcpAttachedSessionId,
  onTabSelect,
  onTabClose,
  onNewTab,
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

  const handleNewTabClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      onNewTab();
    },
    [onNewTab]
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
              const hasMcp = tab.sessionId === mcpAttachedSessionId;
              const icon = getProcessIcon(tab.processName);
              const displayName = getProcessDisplayName(tab.processName);

              return (
                <div
                  key={tab.id}
                  className={`title-tab ${tab.id === activeTabId ? "title-tab-active" : ""} ${hasMcp ? "title-tab-mcp" : ""}`}
                  onClick={(e) => handleTabClick(tab.id, e)}
                  title={hasMcp ? `${displayName} (AI-controlled)` : displayName}
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
                      {hasMcp && <McpIcon isActive={true} size={11} className="title-tab-mcp-icon" />}
                    </span>
                  </span>
                </div>
              );
            })
          ) : singleTab ? (
            // Single tab - show centered process name
            <div className="title-bar-single">
              <span className="title-bar-single-icon">
                {getProcessIcon(singleTab.processName)}
              </span>
              <span className="title-bar-single-name">
                {getProcessDisplayName(singleTab.processName)}
              </span>
              <span className="title-bar-single-status">
                {singleTab.isSandboxed && <SandboxIcon size={12} className="title-bar-single-sandbox" />}
                {singleTab.sessionId === mcpAttachedSessionId && (
                  <McpIcon isActive={true} size={12} className="title-bar-single-mcp" />
                )}
              </span>
            </div>
          ) : null}
        </div>

        {/* New tab button - always visible */}
        <button
          className="title-bar-new-tab"
          onClick={handleNewTabClick}
          title="New terminal (Cmd+T)"
        >
          +
        </button>
      </div>
    </div>
  );
}
