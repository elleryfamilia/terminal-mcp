/**
 * Main Application Component
 *
 * Root component that manages the terminal layout and multi-tab state.
 * Supports split panes within each tab.
 * Shows mode selection dialog for new tabs, inline selector for split panes.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { TitleBar } from "./components/TitleBar";
import { McpConflictDialog } from "./components/McpConflictDialog";
import { McpDisconnectDialog } from "./components/McpDisconnectDialog";
import { SandboxSettingsTooltip } from "./components/SandboxSettingsTooltip";
import { ModeSelectionModal } from "./components/ModeSelectionModal";
import { PaneContainer } from "./components/PaneContainer";
import { McpDashboard } from "./components/mcp-dashboard";
import type { SandboxConfig } from "./types/sandbox";
import type { TabState, SplitDirection, PaneSandboxConfig } from "./types/pane";
import { isTerminalPane, isPendingPane } from "./types/pane";
import {
  createTerminalPane,
  createPendingPane,
  splitPane as splitPaneInTree,
  removePaneFromTree,
  updateSplitRatio,
  getAllTerminalPanes,
  findAdjacentPane,
  updateTerminalProcessName,
  getFirstTerminalPane,
  findPaneById,
  getAdjacentTerminalPane,
  replacePaneInTree,
  hasPendingPanes,
} from "./utils/paneTree";
import type { NavigationDirection } from "./utils/paneTree";

// Conflict dialog state
interface ConflictDialogState {
  isOpen: boolean;
  targetSessionId: string | null;
}

// Detect macOS for title bar styling
const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

// Calculate terminal dimensions based on window size
function calculateTerminalSize() {
  const charWidth = 9;
  const lineHeight = 17;
  const titleBarHeight = isMac ? 42 : 0;
  const statusBarHeight = 24;
  const paneHeaderHeight = 28;

  const availableHeight =
    window.innerHeight - titleBarHeight - statusBarHeight - paneHeaderHeight;

  return {
    cols: Math.floor(window.innerWidth / charWidth),
    rows: Math.floor(availableHeight / lineHeight),
  };
}

export function App() {
  const [tabs, setTabs] = useState<TabState[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tabCounter = useRef(0);

  // Mode selection modal state (for new tabs only)
  const [showModeModal, setShowModeModal] = useState(true);

  // Track which mode was selected for the pending tab creation
  const pendingTabModeRef = useRef<"direct" | "sandbox">("direct");

  // Keep refs to current state for use in callbacks without stale closures
  const tabsRef = useRef<TabState[]>([]);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef<string | null>(null);
  activeTabIdRef.current = activeTabId;

  // MCP attachment state
  const [mcpAttachedSessionId, setMcpAttachedSessionId] = useState<
    string | null
  >(null);
  const [conflictDialog, setConflictDialog] = useState<ConflictDialogState>({
    isOpen: false,
    targetSessionId: null,
  });

  // Recording state
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(
    null
  );

  // MCP disconnect confirmation dialog
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  // Sandbox settings tooltip
  const [sandboxTooltipConfig, setSandboxTooltipConfig] = useState<PaneSandboxConfig | null>(null);

  // MCP dashboard state
  const [mcpPanelExpanded, setMcpPanelExpanded] = useState(false);

  // Toggle MCP dashboard panel
  const toggleMcpPanel = useCallback(() => {
    setMcpPanelExpanded((prev) => !prev);
  }, []);

  // Helper to get the active tab
  const getActiveTab = useCallback(() => {
    return tabsRef.current.find((t) => t.id === activeTabIdRef.current) || null;
  }, []);

  // Create a new terminal session with specified mode
  const createTerminalSession = useCallback(
    async (mode: "direct" | "sandbox", config?: SandboxConfig) => {
      if (mode === "sandbox" && config) {
        try {
          await window.terminalAPI.setSandboxMode(config);
        } catch (err) {
          console.error("Failed to set sandbox mode:", err);
          throw err;
        }
      }

      const size = calculateTerminalSize();
      const result = await window.terminalAPI.createSession({
        cols: size.cols,
        rows: size.rows,
      });

      if (!result.success || !result.sessionId) {
        throw new Error(result.error || "Failed to create session");
      }

      let processName = "shell";
      try {
        const processResult = await window.terminalAPI.getProcess(
          result.sessionId
        );
        if (processResult.success && processResult.process) {
          processName = processResult.process;
        }
      } catch {
        // Use default
      }

      return {
        sessionId: result.sessionId,
        processName,
        isSandboxed: mode === "sandbox",
        sandboxConfig: mode === "sandbox" ? config : undefined,
      };
    },
    []
  );

  // Create a new tab with a single terminal pane
  const createTabWithMode = useCallback(
    async (mode: "direct" | "sandbox", config?: SandboxConfig) => {
      try {
        const { sessionId, processName, isSandboxed, sandboxConfig } = await createTerminalSession(
          mode,
          config
        );
        const tabId = `tab-${++tabCounter.current}`;
        const pane = createTerminalPane(sessionId, processName, isSandboxed, sandboxConfig);

        const newTab: TabState = {
          id: tabId,
          title: `Terminal ${tabCounter.current}`,
          rootPane: pane,
          focusedPaneId: pane.id,
          isActive: true,
        };

        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(tabId);

        return tabId;
      } catch (err) {
        console.error("Failed to create tab:", err);
        setError(
          err instanceof Error ? err.message : "Failed to create terminal"
        );
        return null;
      }
    },
    [createTerminalSession]
  );

  // Request to create a new tab (shows modal)
  const requestNewTab = useCallback(() => {
    setShowModeModal(true);
  }, []);

  // Handle mode selection from modal (for new tabs)
  const handleModeSelected = useCallback(
    async (mode: "direct" | "sandbox", config?: SandboxConfig) => {
      setShowModeModal(false);
      pendingTabModeRef.current = mode;
      await createTabWithMode(mode, config);
    },
    [createTabWithMode]
  );

  // Split the focused pane immediately with a pending pane
  const splitFocusedPane = useCallback(
    (direction: SplitDirection) => {
      const activeTab = getActiveTab();
      if (!activeTab) return;

      // Don't allow split if there's already a pending pane
      if (hasPendingPanes(activeTab.rootPane)) return;

      const pendingPane = createPendingPane();
      const newRootPane = splitPaneInTree(
        activeTab.rootPane,
        activeTab.focusedPaneId,
        direction,
        pendingPane
      );

      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTab.id
            ? {
                ...t,
                rootPane: newRootPane,
                focusedPaneId: pendingPane.id, // Focus the pending pane so modal gets focus
              }
            : t
        )
      );
    },
    [getActiveTab]
  );

  // Handle mode selection from inline pending pane
  const handlePendingModeSelected = useCallback(
    async (
      paneId: string,
      mode: "direct" | "sandbox",
      config?: SandboxConfig
    ) => {
      const activeTab = getActiveTab();
      if (!activeTab) return;

      try {
        const { sessionId, processName, isSandboxed, sandboxConfig } = await createTerminalSession(
          mode,
          config
        );
        const terminalPane = createTerminalPane(sessionId, processName, isSandboxed, sandboxConfig);
        // Preserve the pane ID so focus works correctly
        terminalPane.id = paneId;

        const newRootPane = replacePaneInTree(
          activeTab.rootPane,
          paneId,
          terminalPane
        );

        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTab.id
              ? {
                  ...t,
                  rootPane: newRootPane,
                  focusedPaneId: paneId, // Focus the new terminal
                }
              : t
          )
        );
      } catch (err) {
        console.error("Failed to create terminal in pane:", err);
        // Remove the pending pane on error
        const newRootPane = removePaneFromTree(activeTab.rootPane, paneId);
        if (newRootPane) {
          setTabs((prev) =>
            prev.map((t) =>
              t.id === activeTab.id ? { ...t, rootPane: newRootPane } : t
            )
          );
        }
      }
    },
    [getActiveTab, createTerminalSession]
  );

  // Handle cancellation of pending pane (escape key)
  const handlePendingCancel = useCallback(
    (paneId: string) => {
      const activeTab = getActiveTab();
      if (!activeTab) return;

      const newRootPane = removePaneFromTree(activeTab.rootPane, paneId);
      if (newRootPane) {
        // Find a terminal pane to focus
        const terminalToFocus = getFirstTerminalPane(newRootPane);
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTab.id
              ? {
                  ...t,
                  rootPane: newRootPane,
                  focusedPaneId: terminalToFocus?.id || t.focusedPaneId,
                }
              : t
          )
        );
      }
    },
    [getActiveTab]
  );

  // Remove a tab from state
  const removeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== tabId);

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

  // Close a tab (closes all its sessions)
  const closeTab = useCallback(
    (tabId: string) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (tab) {
        const terminals = getAllTerminalPanes(tab.rootPane);
        terminals.forEach((terminal) => {
          window.terminalAPI
            .closeSession(terminal.sessionId)
            .catch(console.error);
        });
      }
      removeTab(tabId);
    },
    [removeTab]
  );

  // Handle session close (from terminal exit)
  const handleSessionClose = useCallback(
    (sessionId: string) => {
      for (const tab of tabsRef.current) {
        const terminals = getAllTerminalPanes(tab.rootPane);
        const terminal = terminals.find((t) => t.sessionId === sessionId);

        if (terminal) {
          if (terminals.length === 1) {
            removeTab(tab.id);
          } else {
            const newRootPane = removePaneFromTree(tab.rootPane, terminal.id);
            if (newRootPane) {
              setTabs((prev) =>
                prev.map((t) =>
                  t.id === tab.id
                    ? {
                        ...t,
                        rootPane: newRootPane,
                        focusedPaneId:
                          t.focusedPaneId === terminal.id
                            ? getFirstTerminalPane(newRootPane)?.id ||
                              t.focusedPaneId
                            : t.focusedPaneId,
                      }
                    : t
                )
              );
            }
          }
          break;
        }
      }
    },
    [removeTab]
  );

  // Close the focused pane (Cmd+W)
  const closeFocusedPane = useCallback(() => {
    const activeTab = getActiveTab();
    if (!activeTab) return;

    const focusedPane = findPaneById(
      activeTab.rootPane,
      activeTab.focusedPaneId
    );
    if (!focusedPane) return;

    // Handle closing a pending pane (cancel the split)
    if (isPendingPane(focusedPane)) {
      const newRootPane = removePaneFromTree(
        activeTab.rootPane,
        focusedPane.id
      );
      if (newRootPane) {
        const newFocusedPane = getFirstTerminalPane(newRootPane);
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTab.id
              ? {
                  ...t,
                  rootPane: newRootPane,
                  focusedPaneId: newFocusedPane?.id || t.focusedPaneId,
                }
              : t
          )
        );
      }
      return;
    }

    if (!isTerminalPane(focusedPane)) return;

    const terminals = getAllTerminalPanes(activeTab.rootPane);
    if (terminals.length === 1) {
      closeTab(activeTab.id);
    } else {
      window.terminalAPI
        .closeSession(focusedPane.sessionId)
        .catch(console.error);

      const newRootPane = removePaneFromTree(
        activeTab.rootPane,
        focusedPane.id
      );
      if (newRootPane) {
        const newFocusedPane = getFirstTerminalPane(newRootPane);
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTab.id
              ? {
                  ...t,
                  rootPane: newRootPane,
                  focusedPaneId: newFocusedPane?.id || t.focusedPaneId,
                }
              : t
          )
        );
      }
    }
  }, [getActiveTab, closeTab]);

  // Navigate focus between panes (directional)
  const navigateFocus = useCallback(
    (direction: NavigationDirection) => {
      const activeTab = getActiveTab();
      if (!activeTab) return;

      const adjacentPaneId = findAdjacentPane(
        activeTab.rootPane,
        activeTab.focusedPaneId,
        direction
      );

      if (adjacentPaneId) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTab.id ? { ...t, focusedPaneId: adjacentPaneId } : t
          )
        );
      }
    },
    [getActiveTab]
  );

  // Cycle focus between panes (Cmd+] / Cmd+[)
  const cycleFocus = useCallback(
    (direction: "next" | "prev") => {
      const activeTab = getActiveTab();
      if (!activeTab) return;

      const nextPane = getAdjacentTerminalPane(
        activeTab.rootPane,
        activeTab.focusedPaneId,
        direction
      );

      if (nextPane) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTab.id ? { ...t, focusedPaneId: nextPane.id } : t
          )
        );
      }
    },
    [getActiveTab]
  );

  // Set focused pane (from click)
  const setFocusedPane = useCallback((paneId: string) => {
    const activeTabId = activeTabIdRef.current;
    if (!activeTabId) return;

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId ? { ...t, focusedPaneId: paneId } : t
      )
    );
  }, []);

  // Update split ratio
  const handleSplitRatioChange = useCallback(
    (splitPaneId: string, newRatio: number) => {
      const activeTabId = activeTabIdRef.current;
      if (!activeTabId) return;

      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                rootPane: updateSplitRatio(t.rootPane, splitPaneId, newRatio),
              }
            : t
        )
      );
    },
    []
  );

  // Switch to a tab
  const selectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  // Handle MCP toggle from pane header
  const handleMcpToggle = useCallback(
    (sessionId: string) => {
      const currentSessionHasMcp = sessionId === mcpAttachedSessionId;

      if (currentSessionHasMcp) {
        // Show disconnect confirmation dialog
        setShowDisconnectDialog(true);
      } else if (mcpAttachedSessionId) {
        // Another session has MCP - show conflict dialog
        setConflictDialog({
          isOpen: true,
          targetSessionId: sessionId,
        });
      } else {
        // No MCP attached anywhere - attach directly
        window.terminalAPI.mcpAttach(sessionId).catch(console.error);
      }
    },
    [mcpAttachedSessionId]
  );

  // Handle disconnect dialog confirm
  const handleDisconnectConfirm = useCallback(() => {
    window.terminalAPI.mcpDetach().catch(console.error);
    setShowDisconnectDialog(false);
  }, []);

  // Handle disconnect dialog cancel
  const handleDisconnectCancel = useCallback(() => {
    setShowDisconnectDialog(false);
  }, []);

  // Handle sandbox badge click - show settings tooltip
  const handleSandboxClick = useCallback((config: PaneSandboxConfig) => {
    setSandboxTooltipConfig(config);
  }, []);

  // Handle sandbox tooltip close
  const handleSandboxTooltipClose = useCallback(() => {
    setSandboxTooltipConfig(null);
  }, []);

  // Handle conflict dialog confirm
  const handleConflictConfirm = useCallback(() => {
    if (conflictDialog.targetSessionId) {
      window.terminalAPI
        .mcpAttach(conflictDialog.targetSessionId)
        .catch(console.error);
    }
    setConflictDialog({
      isOpen: false,
      targetSessionId: null,
    });
  }, [conflictDialog.targetSessionId]);

  // Handle conflict dialog cancel
  const handleConflictCancel = useCallback(() => {
    setConflictDialog({
      isOpen: false,
      targetSessionId: null,
    });
  }, []);

  // Handle recording toggle from pane header
  const handleRecordingToggle = useCallback(
    async (sessionId: string) => {
      if (recordingSessionId === sessionId) {
        // Stop recording
        await window.terminalAPI.stopRecording(sessionId);
        setRecordingSessionId(null);
      } else {
        // Stop any existing recording first
        if (recordingSessionId) {
          await window.terminalAPI.stopRecording(recordingSessionId);
        }
        // Start recording
        await window.terminalAPI.startRecording(sessionId);
        setRecordingSessionId(sessionId);
      }
    },
    [recordingSessionId]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when modal is open
      if (showModeModal) return;

      const isMod = isMac ? e.metaKey : e.ctrlKey;

      // Cmd+T - New tab
      if (isMod && e.key === "t") {
        e.preventDefault();
        requestNewTab();
        return;
      }

      // Cmd+W - Close focused pane or tab
      if (isMod && e.key === "w") {
        e.preventDefault();
        closeFocusedPane();
        return;
      }

      // Cmd+D - Split horizontally (side-by-side)
      if (isMod && !e.shiftKey && e.key === "d") {
        e.preventDefault();
        splitFocusedPane("horizontal");
        return;
      }

      // Cmd+Shift+D - Split vertically (stacked)
      if (isMod && e.shiftKey && e.key === "d") {
        e.preventDefault();
        splitFocusedPane("vertical");
        return;
      }

      // Cmd+] - Next pane, Cmd+[ - Previous pane
      if (isMod && e.key === "]") {
        e.preventDefault();
        cycleFocus("next");
        return;
      }
      if (isMod && e.key === "[") {
        e.preventDefault();
        cycleFocus("prev");
        return;
      }

      // Cmd+1-9 - Switch tabs
      if (isMod && e.key >= "1" && e.key <= "9") {
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
  }, [
    showModeModal,
    requestNewTab,
    closeFocusedPane,
    splitFocusedPane,
    navigateFocus,
    cycleFocus,
  ]);

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
    window.terminalAPI
      .mcpGetAttached()
      .then(setMcpAttachedSessionId)
      .catch(console.error);

    const cleanup = window.terminalAPI.onMcpAttachmentChanged((data) => {
      setMcpAttachedSessionId(data.attachedSessionId);
    });
    return cleanup;
  }, []);

  // Listen for process change events
  useEffect(() => {
    const cleanup = window.terminalAPI.onMessage((message: unknown) => {
      const msg = message as {
        type: string;
        sessionId?: string;
        process?: string;
      };
      if (msg.type === "process-changed" && msg.sessionId && msg.process) {
        setTabs((prev) =>
          prev.map((tab) => ({
            ...tab,
            rootPane: updateTerminalProcessName(
              tab.rootPane,
              msg.sessionId as string,
              msg.process as string
            ),
          }))
        );
      }
    });
    return cleanup;
  }, []);

  // Subscribe to recording changes
  useEffect(() => {
    const cleanup = window.terminalAPI.onRecordingChanged((data) => {
      if (data.isRecording) {
        setRecordingSessionId(data.sessionId);
      } else if (data.sessionId === recordingSessionId) {
        setRecordingSessionId(null);
      }
    });
    return cleanup;
  }, [recordingSessionId]);


  // Get active tab
  const activeTab = tabs.find((t) => t.id === activeTabId);

  // For title bar, extract tab info with process name from focused pane
  const titleBarTabs = tabs.map((tab) => {
    const focusedPaneInTab = findPaneById(tab.rootPane, tab.focusedPaneId);
    const terminalPane =
      focusedPaneInTab && isTerminalPane(focusedPaneInTab)
        ? focusedPaneInTab
        : getFirstTerminalPane(tab.rootPane);
    return {
      id: tab.id,
      title: tab.title,
      sessionId: terminalPane?.sessionId || "",
      processName: terminalPane?.processName || "shell",
      isSandboxed: terminalPane?.isSandboxed || false,
    };
  });

  // Find which tab has the MCP-attached session
  const mcpTab = tabs.find((tab) => {
    const terminals = getAllTerminalPanes(tab.rootPane);
    return terminals.some((t) => t.sessionId === mcpAttachedSessionId);
  });

  // Get the focused pane's session for status bar
  const focusedPane = activeTab
    ? findPaneById(activeTab.rootPane, activeTab.focusedPaneId)
    : null;
  const focusedSessionId =
    focusedPane && isTerminalPane(focusedPane) ? focusedPane.sessionId : null;

  // Render error state (only if no tabs and no modal)
  if (error && tabs.length === 0 && !showModeModal) {
    return (
      <div className="app app-error">
        <div className="error-icon">!</div>
        <h2>Failed to start terminal</h2>
        <p>{error}</p>
        <button
          onClick={() => {
            setError(null);
            requestNewTab();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Render main UI
  return (
    <div className="app">
      {isMac && (
        <TitleBar
          tabs={titleBarTabs}
          activeTabId={activeTabId}
          mcpAttachedSessionId={mcpAttachedSessionId}
          onTabSelect={selectTab}
          onTabClose={closeTab}
          onNewTab={requestNewTab}
        />
      )}
      <div className="terminal-container">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`terminal-wrapper ${tab.id === activeTabId ? "visible" : "hidden"}`}
          >
            <PaneContainer
              pane={tab.rootPane}
              focusedPaneId={tab.focusedPaneId}
              isTabVisible={tab.id === activeTabId}
              mcpAttachedSessionId={mcpAttachedSessionId}
              recordingSessionId={recordingSessionId}
              isSinglePane={isTerminalPane(tab.rootPane)}
              onFocus={setFocusedPane}
              onSessionClose={handleSessionClose}
              onSplitRatioChange={handleSplitRatioChange}
              onPendingModeSelected={handlePendingModeSelected}
              onPendingCancel={handlePendingCancel}
              onMcpToggle={handleMcpToggle}
              onSandboxClick={handleSandboxClick}
              onRecordingToggle={handleRecordingToggle}
            />
          </div>
        ))}
        {tabs.length === 0 && !showModeModal && (
          <div className="no-tabs">
            <p>No terminals open</p>
            <button onClick={requestNewTab}>New Terminal</button>
          </div>
        )}
      </div>
      <McpDashboard
        isExpanded={mcpPanelExpanded}
        onToggle={toggleMcpPanel}
        mcpAttachedSessionId={mcpAttachedSessionId}
        isRecording={focusedSessionId === recordingSessionId}
      />
      <McpConflictDialog
        isOpen={conflictDialog.isOpen}
        onCancel={handleConflictCancel}
        onConfirm={handleConflictConfirm}
      />
      <McpDisconnectDialog
        isOpen={showDisconnectDialog}
        onCancel={handleDisconnectCancel}
        onConfirm={handleDisconnectConfirm}
      />
      {sandboxTooltipConfig && (
        <SandboxSettingsTooltip
          isOpen={true}
          config={sandboxTooltipConfig}
          onClose={handleSandboxTooltipClose}
        />
      )}
      <ModeSelectionModal
        isOpen={showModeModal}
        onModeSelected={handleModeSelected}
      />
    </div>
  );
}
