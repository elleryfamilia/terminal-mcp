/**
 * Sandbox Settings Tooltip Component
 *
 * Displays the sandbox configuration in a readonly tooltip dialog.
 * Shows filesystem permissions and network settings.
 */

import type { PaneSandboxConfig } from "../types/pane";

interface SandboxSettingsTooltipProps {
  isOpen: boolean;
  config: PaneSandboxConfig;
  onClose: () => void;
}

export function SandboxSettingsTooltip({
  isOpen,
  config,
  onClose,
}: SandboxSettingsTooltipProps) {
  if (!isOpen) {
    return null;
  }

  const networkModeLabel = {
    all: "All network access allowed",
    none: "No network access",
    allowlist: "Allowlist only",
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="sandbox-tooltip-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="sandbox-tooltip-header">
          <h3>Sandbox Settings</h3>
          <button className="sandbox-tooltip-close" onClick={onClose} type="button">
            ×
          </button>
        </div>
        <div className="sandbox-tooltip-content">
          <div className="sandbox-tooltip-section">
            <div className="sandbox-tooltip-section-title">Filesystem</div>

            {config.filesystem.readWrite.length > 0 && (
              <div className="sandbox-tooltip-group">
                <div className="sandbox-tooltip-label sandbox-tooltip-label-readwrite">
                  Read/Write
                </div>
                <div className="sandbox-tooltip-paths">
                  {config.filesystem.readWrite.map((path, i) => (
                    <code key={i} className="sandbox-tooltip-path">{path}</code>
                  ))}
                </div>
              </div>
            )}

            {config.filesystem.readOnly.length > 0 && (
              <div className="sandbox-tooltip-group">
                <div className="sandbox-tooltip-label sandbox-tooltip-label-readonly">
                  Read Only
                </div>
                <div className="sandbox-tooltip-paths">
                  {config.filesystem.readOnly.map((path, i) => (
                    <code key={i} className="sandbox-tooltip-path">{path}</code>
                  ))}
                </div>
              </div>
            )}

            {config.filesystem.blocked.length > 0 && (
              <div className="sandbox-tooltip-group">
                <div className="sandbox-tooltip-label sandbox-tooltip-label-blocked">
                  Blocked
                </div>
                <div className="sandbox-tooltip-paths">
                  {config.filesystem.blocked.map((path, i) => (
                    <code key={i} className="sandbox-tooltip-path">{path}</code>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="sandbox-tooltip-section">
            <div className="sandbox-tooltip-section-title">Network</div>
            <div className="sandbox-tooltip-network">
              <span className={`sandbox-tooltip-network-mode sandbox-tooltip-network-${config.network.mode}`}>
                {networkModeLabel[config.network.mode]}
              </span>
              {config.network.mode === "allowlist" && config.network.allowedDomains && (
                <div className="sandbox-tooltip-domains">
                  {config.network.allowedDomains.map((domain, i) => (
                    <code key={i} className="sandbox-tooltip-path">{domain}</code>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
