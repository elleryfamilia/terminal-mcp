/**
 * Main Application Component
 *
 * Root component that manages the terminal layout and multi-tab state.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { Terminal } from "./components/Terminal";
import { TitleBar } from "./components/TitleBar";
import { StatusBar } from "./components/StatusBar";
import { McpConflictDialog } from "./components/McpConflictDialog";
import { ModeSelectionModal } from "./components/ModeSelectionModal";
import type { SandboxConfig } from "./types/sandbox";

// Tab state interface
interface TabState {
  id: string;
  sessionId: string;
  title: string;
  processName: string;
  isActive: boolean;
}

// Conflict dialog state
interface ConflictDialogState {
  isOpen: boolean;
  targetSessionId: string | null;
  targetTabTitle: string;
}

// Detect macOS for title bar styling
const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

// Calculate terminal dimensions based on window size
function calculateTerminalSize() {
  const charWidth = 9; // Approximate monospace character width
  const lineHeight = 17; // Approximate line height
  const titleBarHeight = isMac ? 42 : 0; // Unified title bar with tabs (macOS only)
  const statusBarHeight = 24; // Status bar

  const availableHeight = window.innerHeight - titleBarHeight - statusBarHeight;

  return {
    cols: Math.floor(window.innerWidth / charWidth),
    rows: Math.floor(availableHeight / lineHeight),
  };
}

export function App() {
  const [tabs, setTabs] = useState<TabState[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showModeModal, setShowModeModal] = useState(true);
  const [selectedMode, setSelectedMode] = useState<'direct' | 'sandbox' | null>(null);
  const tabCounter = useRef(0);

  // Keep refs to current state for use in callbacks without stale closures
  const tabsRef = useRef<TabState[]>([]);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef<string | null>(null);
  activeTabIdRef.current = activeTabId;


  // MCP attachment state
  const [mcpAttachedSessionId, setMcpAttachedSessionId] = useState<string | null>(null);
  const [conflictDialog, setConflictDialog] = useState<ConflictDialogState>({
    isOpen: false,
    targetSessionId: null,
    targetTabTitle: "",
  });

  // Create a new tab with a terminal session
  const createTab = useCallback(async () => {
    try {
      const size = calculateTerminalSize();
      const tabId = `tab-${++tabCounter.current}`;

      // Create the terminal session
      const result = await window.terminalAPI.createSession({
        cols: size.cols,
        rows: size.rows,
      });

      if (result.success && result.sessionId) {
        // Fetch initial process name
        let processName = "shell";
        try {
          const processResult = await window.terminalAPI.getProcess(result.sessionId);
          if (processResult.success && processResult.process) {
            processName = processResult.process;
          }
        } catch {
          // Use default
        }

        const newTab: TabState = {
          id: tabId,
          sessionId: result.sessionId,
          title: `Terminal ${tabCounter.current}`,
          processName,
          isActive: true,
        };

        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(tabId);

        return tabId;
      } else {
        throw new Error(result.error || "Failed to create session");
      }
    } catch (err) {
      console.error("Failed to create tab:", err);
      setError(err instanceof Error ? err.message : "Failed to create terminal");
      return null;
    }
  }, []);

  // Remove a tab from state and update active tab
  const removeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== tabId);

      // If closing active tab, switch to another
      setActiveTabId((currentActiveTabId) => {
        if (currentActiveTabId === tabId && newTabs.length > 0) {
          const closedIndex = prev.findIndex((t) => t.id === tabId);
          const newActiveIndex = Math.min(closedIndex, newTabs.length - 1);
          return newTabs[newActiveIndex].id;
        } else if (newTabs.length === 0) {
          return null;
        }
        return currentActiveTabId;
      });

      return newTabs;
    });
  }, []);

  // Close a tab (called when user clicks X or presses Cmd+W)
  const closeTab = useCallback((tabId: string) => {
    const tab = tabsRef.current.find((t) => t.id === tabId);
    if (tab) {
      // Close the session on backend
      window.terminalAPI.closeSession(tab.sessionId).catch(console.error);
    }
    removeTab(tabId);
  }, [removeTab]);

  // Handle session close (from terminal exit - shell exited on its own)
  const handleSessionClose = useCallback((sessionId: string) => {
    const tab = tabsRef.current.find((t) => t.sessionId === sessionId);
    if (tab) {
      // Just remove the tab - session already closed on backend
      removeTab(tab.id);
    }
  }, [removeTab]);

  // Switch to a tab
  const selectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  // Handle MCP toggle from status bar
  const handleMcpToggle = useCallback(() => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (!activeTab) return;

    const currentSessionHasMcp = activeTab.sessionId === mcpAttachedSessionId;

    if (currentSessionHasMcp) {
      // Detach MCP from current session
      window.terminalAPI.mcpDetach().catch(console.error);
    } else if (mcpAttachedSessionId) {
      // Another session has MCP - show conflict dialog
      const mcpTab = tabs.find((t) => t.sessionId === mcpAttachedSessionId);
      setConflictDialog({
        isOpen: true,
        targetSessionId: activeTab.sessionId,
        targetTabTitle: activeTab.title,
      });
    } else {
      // No session has MCP - attach to current
      window.terminalAPI.mcpAttach(activeTab.sessionId).catch(console.error);
    }
  }, [tabs, activeTabId, mcpAttachedSessionId]);

  // Handle conflict dialog confirm
  const handleConflictConfirm = useCallback(() => {
    if (conflictDialog.targetSessionId) {
      window.terminalAPI.mcpAttach(conflictDialog.targetSessionId).catch(console.error);
    }
    setConflictDialog({ isOpen: false, targetSessionId: null, targetTabTitle: "" });
  }, [conflictDialog.targetSessionId]);

  // Handle conflict dialog cancel
  const handleConflictCancel = useCallback(() => {
    setConflictDialog({ isOpen: false, targetSessionId: null, targetTabTitle: "" });
  }, []);

  // Handle mode selection from modal
  const handleModeSelected = useCallback(async (mode: 'direct' | 'sandbox', config?: SandboxConfig) => {
    setSelectedMode(mode);
    setShowModeModal(false);

    if (mode === 'sandbox' && config) {
      // Tell main process to use sandbox mode
      try {
        await window.terminalAPI.setSandboxMode(config);
      } catch (err) {
        console.error("Failed to set sandbox mode:", err);
        setError(err instanceof Error ? err.message : "Failed to configure sandbox mode");
      }
    }
  }, []);

  // Initialize first tab after mode selection
  useEffect(() => {
    // Wait for mode selection before creating first tab
    if (selectedMode === null) return;

    const init = async () => {
      setIsInitializing(true);
      await createTab();
      setIsInitializing(false);
    };
    init();

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = isMac ? e.metaKey : e.ctrlKey;

      if (isMod && e.key === "t") {
        e.preventDefault();
        createTab();
      } else if (isMod && e.key === "w") {
        e.preventDefault();
        const currentActiveTabId = activeTabIdRef.current;
        if (currentActiveTabId) {
          closeTab(currentActiveTabId);
        }
      } else if (isMod && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        const currentTabs = tabsRef.current;
        if (index < currentTabs.length) {
          setActiveTabId(currentTabs[index].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createTab, closeTab, selectedMode]);

  // Listen for session close events
  useEffect(() => {
    const cleanup = window.terminalAPI.onMessage((message: unknown) => {
      const msg = message as { type: string; sessionId?: string };
      if (msg.type === "session-closed" && msg.sessionId) {
        handleSessionClose(msg.sessionId);
      }
    });
    return cleanup;
  }, [handleSessionClose]);

  // Fetch initial MCP attachment state and subscribe to changes
  useEffect(() => {
    // Get initial attached session
    window.terminalAPI.mcpGetAttached()
      .then(setMcpAttachedSessionId)
      .catch(console.error);

    // Subscribe to attachment changes
    const cleanup = window.terminalAPI.onMcpAttachmentChanged((data) => {
      setMcpAttachedSessionId(data.attachedSessionId);
    });
    return cleanup;
  }, []);

  // Listen for process change events (triggered by terminal output)
  useEffect(() => {
    const cleanup = window.terminalAPI.onMessage((message: unknown) => {
      const msg = message as { type: string; sessionId?: string; process?: string };
      if (msg.type === "process-changed" && msg.sessionId && msg.process) {
        setTabs((prev) =>
          prev.map((tab) =>
            tab.sessionId === msg.sessionId
              ? { ...tab, processName: msg.process as string }
              : tab
          )
        );
      }
    });
    return cleanup;
  }, []);

  // Get active tab
  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Render mode selection modal
  if (showModeModal) {
    return (
      <>
        <div className="app app-loading">
          <div className="loading-spinner" style={{ visibility: 'hidden' }} />
        </div>
        <ModeSelectionModal
          isOpen={showModeModal}
          onModeSelected={handleModeSelected}
        />
      </>
    );
  }

  // Render loading state - but only if there are no tabs yet
  // If we have tabs (even with placeholder sessions), render them so they can receive output
  if (isInitializing && tabs.length === 0) {
    return (
      <div className="app app-loading">
        <div className="loading-spinner" />
        <p>Initializing terminal...</p>
      </div>
    );
  }

  // Render error state (only if no tabs)
  if (error && tabs.length === 0) {
    return (
      <div className="app app-error">
        <div className="error-icon">!</div>
        <h2>Failed to start terminal</h2>
        <p>{error}</p>
        <button onClick={() => { setError(null); createTab(); }}>Retry</button>
      </div>
    );
  }

  // Get the tab that currently has MCP attached (for conflict dialog)
  const mcpTab = tabs.find((t) => t.sessionId === mcpAttachedSessionId);

  // Render main UI
  return (
    <div className="app">
      {isMac && (
        <TitleBar
          tabs={tabs.map((t) => ({
            id: t.id,
            title: t.title,
            sessionId: t.sessionId,
            processName: t.processName,
          }))}
          activeTabId={activeTabId}
          mcpAttachedSessionId={mcpAttachedSessionId}
          onTabSelect={selectTab}
          onTabClose={closeTab}
          onNewTab={createTab}
        />
      )}
      <div className="terminal-container">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`terminal-wrapper ${tab.id === activeTabId ? "visible" : "hidden"}`}
          >
            <Terminal
              sessionId={tab.sessionId}
              onClose={() => handleSessionClose(tab.sessionId)}
              isVisible={tab.id === activeTabId}
            />
          </div>
        ))}
        {tabs.length === 0 && (
          <div className="no-tabs">
            <p>No terminals open</p>
            <button onClick={createTab}>New Terminal</button>
          </div>
        )}
      </div>
      <StatusBar
        sessionId={activeTab?.sessionId || null}
        isRecording={false}
        isConnected={activeTab?.isActive || false}
        mcpAttachedSessionId={mcpAttachedSessionId}
        activeTabTitle={mcpTab?.title || null}
        onMcpToggle={handleMcpToggle}
      />
      <McpConflictDialog
        isOpen={conflictDialog.isOpen}
        currentMcpTabTitle={mcpTab?.title || "Unknown"}
        targetTabTitle={conflictDialog.targetTabTitle}
        onCancel={handleConflictCancel}
        onConfirm={handleConflictConfirm}
      />
    </div>
  );
}
