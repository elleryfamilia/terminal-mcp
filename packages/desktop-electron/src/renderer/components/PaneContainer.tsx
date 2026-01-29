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
}

export function PaneContainer({
  pane,
  focusedPaneId,
  isTabVisible,
  mcpAttachedSessionId,
  recordingSessionId,
  isSinglePane,
  onFocus,
  onSessionClose,
  onSplitRatioChange,
  onPendingModeSelected,
  onPendingCancel,
  onMcpToggle,
  onSandboxClick,
  onRecordingToggle,
}: PaneContainerProps) {
  if (isTerminalPane(pane)) {
    const hasMcp = pane.sessionId === mcpAttachedSessionId;
    const isRecording = pane.sessionId === recordingSessionId;
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
        showHeader={true}
        onFocus={onFocus}
        onSessionClose={onSessionClose}
        onMcpToggle={onMcpToggle ? () => onMcpToggle(pane.sessionId) : undefined}
        onSandboxClick={onSandboxClick && pane.sandboxConfig ? () => onSandboxClick(pane.sandboxConfig!) : undefined}
        onRecordingToggle={onRecordingToggle ? () => onRecordingToggle(pane.sessionId) : undefined}
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
          />
        }
      />
    );
  }

  return null;
}
