/**
 * MCP Disconnect Dialog Component
 *
 * Confirmation dialog shown when user tries to disable MCP,
 * warning that it will disconnect any connected AI clients.
 */

interface McpDisconnectDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function McpDisconnectDialog({
  isOpen,
  onCancel,
  onConfirm,
}: McpDisconnectDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Disable MCP?</h2>
        </div>
        <div className="dialog-body">
          <p>This will disconnect any AI clients currently using this terminal.</p>
        </div>
        <div className="dialog-footer">
          <button className="dialog-button dialog-button-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="dialog-button dialog-button-primary" onClick={onConfirm}>
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
