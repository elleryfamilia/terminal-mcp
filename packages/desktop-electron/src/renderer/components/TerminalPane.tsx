/**
 * Terminal Pane Component
 *
 * Wraps a Terminal with a header bar and focus indicator.
 */

import { useCallback } from "react";
import { Terminal } from "./Terminal";
import type { TerminalMethods } from "./Terminal";
import { PaneHeader } from "./PaneHeader";
import type { PaneSandboxConfig } from "../types/pane";

interface TerminalPaneProps {
  paneId: string;
  sessionId: string;
  processName: string;
  windowTitle?: string;
  isFocused: boolean;
  isVisible: boolean;
  hasMcp: boolean;
  isSandboxed: boolean;
  sandboxConfig?: PaneSandboxConfig;
  isRecording: boolean;
  showHeader: boolean;
  showCloseButton?: boolean;
  onFocus: (paneId: string) => void;
  onSessionClose: (sessionId: string) => void;
  onMcpToggle?: () => void;
  onSandboxClick?: () => void;
  onRecordingToggle?: () => void;
  onClose?: () => void;
  onContextMenu?: (e: React.MouseEvent, methods: TerminalMethods) => void;
}

export function TerminalPane({
  paneId,
  sessionId,
  processName,
  windowTitle,
  isFocused,
  isVisible,
  hasMcp,
  isSandboxed,
  sandboxConfig,
  isRecording,
  showHeader,
  showCloseButton = false,
  onFocus,
  onSessionClose,
  onMcpToggle,
  onSandboxClick,
  onRecordingToggle,
  onClose,
  onContextMenu,
}: TerminalPaneProps) {
  const handleClick = useCallback(() => {
    onFocus(paneId);
  }, [paneId, onFocus]);

  const handleClose = useCallback(() => {
    onSessionClose(sessionId);
  }, [sessionId, onSessionClose]);

  const handleTerminalFocus = useCallback(() => {
    onFocus(paneId);
  }, [paneId, onFocus]);

  return (
    <div
      className={`terminal-pane ${isFocused && showHeader ? "terminal-pane-focused" : ""}`}
      onClick={handleClick}
    >
      {showHeader && (
        <PaneHeader
          processName={processName}
          windowTitle={windowTitle}
          isFocused={isFocused}
          hasMcp={hasMcp}
          isSandboxed={isSandboxed}
          sandboxConfig={sandboxConfig}
          isRecording={isRecording}
          showCloseButton={showCloseButton}
          onMcpToggle={onMcpToggle}
          onSandboxClick={onSandboxClick}
          onRecordingToggle={onRecordingToggle}
          onClose={onClose}
        />
      )}
      <div className="terminal-pane-content">
        <Terminal
          sessionId={sessionId}
          onClose={handleClose}
          isVisible={isVisible}
          isFocused={isFocused}
          onFocus={handleTerminalFocus}
          onContextMenu={onContextMenu}
        />
      </div>
    </div>
  );
}
