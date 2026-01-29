/**
 * Pane Header Component
 *
 * A small header bar (~22px) showing process icon and name.
 * Visually highlights when the pane is focused.
 */

import {
  getProcessIcon,
  getProcessDisplayName,
} from "../utils/processIcons";

interface PaneHeaderProps {
  processName: string;
  isFocused: boolean;
  hasMcp?: boolean;
}

export function PaneHeader({
  processName,
  isFocused,
  hasMcp = false,
}: PaneHeaderProps) {
  const icon = getProcessIcon(processName);
  const displayName = getProcessDisplayName(processName);

  return (
    <div className={`pane-header ${isFocused ? "pane-header-focused" : ""}`}>
      <span className="pane-header-icon">{icon}</span>
      <span className="pane-header-name">{displayName}</span>
      {hasMcp && (
        <span className="pane-header-ai" title="Shared with AI">
          ✦
        </span>
      )}
    </div>
  );
}
