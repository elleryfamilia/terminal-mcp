/**
 * Terminal Pane Component
 *
 * Wraps a Terminal with a header bar and focus indicator.
 */

import { useCallback } from "react";
import { Terminal } from "./Terminal";
import { PaneHeader } from "./PaneHeader";

interface TerminalPaneProps {
  paneId: string;
  sessionId: string;
  processName: string;
  isFocused: boolean;
  isVisible: boolean;
  hasMcp: boolean;
  showHeader: boolean;
  onFocus: (paneId: string) => void;
  onSessionClose: (sessionId: string) => void;
}

export function TerminalPane({
  paneId,
  sessionId,
  processName,
  isFocused,
  isVisible,
  hasMcp,
  showHeader,
  onFocus,
  onSessionClose,
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
          isFocused={isFocused}
          hasMcp={hasMcp}
        />
      )}
      <div className="terminal-pane-content">
        <Terminal
          sessionId={sessionId}
          onClose={handleClose}
          isVisible={isVisible}
          isFocused={isFocused}
          onFocus={handleTerminalFocus}
        />
      </div>
    </div>
  );
}
