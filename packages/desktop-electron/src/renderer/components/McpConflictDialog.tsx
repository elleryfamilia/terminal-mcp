/**
 * MCP Conflict Dialog Component
 *
 * Modal dialog shown when user tries to enable MCP on a terminal
 * while another terminal already has MCP attached.
 */

interface McpConflictDialogProps {
  isOpen: boolean;
  currentMcpTabTitle: string;
  targetTabTitle: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function McpConflictDialog({
  isOpen,
  currentMcpTabTitle,
  targetTabTitle,
  onCancel,
  onConfirm,
}: McpConflictDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>MCP Already Enabled</h2>
        </div>
        <div className="dialog-body">
          <p>
            <strong>"{currentMcpTabTitle}"</strong> already has MCP enabled.
          </p>
          <p>
            Only one terminal can be AI-controlled at a time. Transfer MCP to{" "}
            <strong>"{targetTabTitle}"</strong>?
          </p>
        </div>
        <div className="dialog-footer">
          <button className="dialog-button dialog-button-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="dialog-button dialog-button-primary" onClick={onConfirm}>
            Disconnect & Enable Here
          </button>
        </div>
      </div>
    </div>
  );
}
