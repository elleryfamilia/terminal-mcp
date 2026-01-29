/**
 * Title Bar Component
 *
 * Unified title bar with tabs on macOS. Provides draggable area
 * and integrates tabs at the same level as window controls.
 */

import { useCallback } from "react";
import { getProcessIcon, getProcessDisplayName } from "../utils/processIcons";

export interface Tab {
  id: string;
  title: string;
  sessionId: string;
  processName: string;
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
    <div className="title-bar">
      {/* Drag region for window movement - behind everything */}
      <div className="title-bar-drag-region" />

      {/* Traffic light spacer on macOS */}
      <div className="title-bar-spacer" />

      {/* Tabs area - full width */}
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
                  ×
                </button>
                <span className="title-tab-content">
                  <span className="title-tab-icon">{icon}</span>
                  <span className="title-tab-text">{displayName}</span>
                  {hasMcp && <span className="title-tab-ai">AI</span>}
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
            {singleTab.sessionId === mcpAttachedSessionId && (
              <span className="title-bar-single-ai">AI</span>
            )}
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
  );
}
