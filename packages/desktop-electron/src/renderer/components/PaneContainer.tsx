/**
 * Pane Container Component
 *
 * Recursively renders the pane tree.
 * Renders TerminalPane for terminal nodes, PendingPaneView for pending nodes,
 * and SplitContainer for split nodes.
 */

import type { Pane, PaneSandboxConfig } from "../types/pane";
import { isTerminalPane, isPendingPane, isSplitPane } from "../types/pane";
import { TerminalPane } from "./TerminalPane";
import type { TerminalMethods } from "./Terminal";
import { PendingPaneView } from "./PendingPaneView";
import { SplitContainer } from "./SplitContainer";
import type { SandboxConfig } from "../types/sandbox";

interface PaneContainerProps {
  pane: Pane;
  focusedPaneId: string;
  isTabVisible: boolean;
  mcpAttachedSessionId: string | null;
  recordingSessionId: string | null;
  isSinglePane: boolean;
  hideHeader?: boolean;
  onFocus: (paneId: string) => void;
  onSessionClose: (sessionId: string) => void;
  onSplitRatioChange: (splitPaneId: string, newRatio: number) => void;
  onPendingModeSelected: (
    paneId: string,
    mode: "direct" | "sandbox",
    config?: SandboxConfig
  ) => void;
  onPendingCancel: (paneId: string) => void;
  onMcpToggle?: (sessionId: string) => void;
  onSandboxClick?: (config: PaneSandboxConfig) => void;
  onRecordingToggle?: (sessionId: string) => void;
  onContextMenu?: (e: React.MouseEvent, methods: TerminalMethods, sessionId: string) => void;
}

export function PaneContainer({
  pane,
  focusedPaneId,
  isTabVisible,
  mcpAttachedSessionId,
  recordingSessionId,
  isSinglePane,
  hideHeader = false,
  onFocus,
  onSessionClose,
  onSplitRatioChange,
  onPendingModeSelected,
  onPendingCancel,
  onMcpToggle,
  onSandboxClick,
  onRecordingToggle,
  onContextMenu,
}: PaneContainerProps) {
  if (isTerminalPane(pane)) {
    const hasMcp = pane.sessionId === mcpAttachedSessionId;
    const isRecording = pane.sessionId === recordingSessionId;
    // Show close button only when there are multiple panes (not single pane mode)
    const showCloseButton = !isSinglePane && !hideHeader;
    return (
      <TerminalPane
        paneId={pane.id}
        sessionId={pane.sessionId}
        processName={pane.processName}
        isFocused={pane.id === focusedPaneId}
        isVisible={isTabVisible}
        hasMcp={hasMcp}
        isSandboxed={pane.isSandboxed}
        sandboxConfig={pane.sandboxConfig}
        isRecording={isRecording}
        showHeader={!hideHeader}
        showCloseButton={showCloseButton}
        onFocus={onFocus}
        onSessionClose={onSessionClose}
        onMcpToggle={onMcpToggle ? () => onMcpToggle(pane.sessionId) : undefined}
        onSandboxClick={onSandboxClick && pane.sandboxConfig ? () => onSandboxClick(pane.sandboxConfig!) : undefined}
        onRecordingToggle={onRecordingToggle ? () => onRecordingToggle(pane.sessionId) : undefined}
        onClose={() => onSessionClose(pane.sessionId)}
        onContextMenu={onContextMenu ? (e, methods) => onContextMenu(e, methods, pane.sessionId) : undefined}
      />
    );
  }

  if (isPendingPane(pane)) {
    return (
      <PendingPaneView
        paneId={pane.id}
        onModeSelected={onPendingModeSelected}
        onCancel={onPendingCancel}
      />
    );
  }

  if (isSplitPane(pane)) {
    return (
      <SplitContainer
        id={pane.id}
        direction={pane.direction}
        splitRatio={pane.splitRatio}
        onRatioChange={onSplitRatioChange}
        first={
          <PaneContainer
            pane={pane.first}
            focusedPaneId={focusedPaneId}
            isTabVisible={isTabVisible}
            mcpAttachedSessionId={mcpAttachedSessionId}
            recordingSessionId={recordingSessionId}
            isSinglePane={false}
            onFocus={onFocus}
            onSessionClose={onSessionClose}
            onSplitRatioChange={onSplitRatioChange}
            onPendingModeSelected={onPendingModeSelected}
            onPendingCancel={onPendingCancel}
            onMcpToggle={onMcpToggle}
            onSandboxClick={onSandboxClick}
            onRecordingToggle={onRecordingToggle}
            onContextMenu={onContextMenu}
          />
        }
        second={
          <PaneContainer
            pane={pane.second}
            focusedPaneId={focusedPaneId}
            isTabVisible={isTabVisible}
            mcpAttachedSessionId={mcpAttachedSessionId}
            recordingSessionId={recordingSessionId}
            isSinglePane={false}
            onFocus={onFocus}
            onSessionClose={onSessionClose}
            onSplitRatioChange={onSplitRatioChange}
            onPendingModeSelected={onPendingModeSelected}
            onPendingCancel={onPendingCancel}
            onMcpToggle={onMcpToggle}
            onSandboxClick={onSandboxClick}
            onRecordingToggle={onRecordingToggle}
            onContextMenu={onContextMenu}
          />
        }
      />
    );
  }

  return null;
}
