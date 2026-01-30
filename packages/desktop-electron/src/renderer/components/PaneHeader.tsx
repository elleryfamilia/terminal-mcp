/**
 * Pane Header Component
 *
 * A header bar (~28px) showing process icon and name.
 * Displays status badges with labels for sandbox, MCP, and recording.
 * MCP badge is clickable to toggle MCP attachment.
 * Sandbox badge is clickable to show sandbox settings.
 * Recording badge toggles terminal recording.
 * Has green-tinted background when MCP is active.
 */

import {
  getProcessIcon,
  getProcessDisplayName,
} from "../utils/processIcons";
import { McpIcon, SandboxIcon, RecordIcon } from "./icons";
import { StatusBadge } from "./StatusBadge";
import type { PaneSandboxConfig } from "../types/pane";

interface PaneHeaderProps {
  processName: string;
  isFocused: boolean;
  hasMcp?: boolean;
  isSandboxed?: boolean;
  sandboxConfig?: PaneSandboxConfig;
  isRecording?: boolean;
  showCloseButton?: boolean;
  onMcpToggle?: () => void;
  onSandboxClick?: () => void;
  onRecordingToggle?: () => void;
  onClose?: () => void;
}

export function PaneHeader({
  processName,
  isFocused,
  hasMcp = false,
  isSandboxed = false,
  sandboxConfig,
  isRecording = false,
  showCloseButton = false,
  onMcpToggle,
  onSandboxClick,
  onRecordingToggle,
  onClose,
}: PaneHeaderProps) {
  const icon = getProcessIcon(processName);
  const displayName = getProcessDisplayName(processName);

  const headerClasses = [
    "pane-header",
    isFocused ? "pane-header-focused" : "",
    hasMcp ? "pane-header-mcp" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose?.();
  };

  return (
    <div className={headerClasses}>
      {showCloseButton && (
        <button
          className="pane-header-close"
          onClick={handleCloseClick}
          title="Close pane"
          type="button"
        >
          ×
        </button>
      )}
      <span className="pane-header-icon">{icon}</span>
      <span className="pane-header-name">{displayName}</span>
      <div className="pane-header-badges">
        {isSandboxed && (
          <StatusBadge
            icon={<SandboxIcon size={12} />}
            label="Sandboxed"
            variant="sandbox"
            onClick={sandboxConfig ? onSandboxClick : undefined}
          />
        )}
        <StatusBadge
          icon={<McpIcon isActive={hasMcp} size={12} />}
          label="MCP"
          variant={hasMcp ? "mcp-active" : "mcp-inactive"}
          onClick={onMcpToggle}
        />
        <StatusBadge
          icon={<RecordIcon size={12} />}
          label={isRecording ? "Recording" : undefined}
          variant={isRecording ? "recording" : "recording-inactive"}
          onClick={onRecordingToggle}
        />
      </div>
    </div>
  );
}
