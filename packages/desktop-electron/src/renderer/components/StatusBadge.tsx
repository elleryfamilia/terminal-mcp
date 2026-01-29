/**
 * Status Badge Component
 *
 * Reusable badge with icon and optional label.
 * Supports multiple variants for different status indicators.
 */

interface StatusBadgeProps {
  icon: React.ReactNode;
  label?: string;
  variant:
    | "mcp-active"
    | "mcp-inactive"
    | "sandbox"
    | "recording"
    | "recording-inactive";
  onClick?: () => void;
}

export function StatusBadge({ icon, label, variant, onClick }: StatusBadgeProps) {
  const isClickable = !!onClick;

  return (
    <button
      className={`status-badge status-badge-${variant} ${isClickable ? "status-badge-clickable" : ""}`}
      onClick={onClick}
      disabled={!isClickable}
      type="button"
    >
      <span className="status-badge-icon">{icon}</span>
      {label && <span className="status-badge-label">{label}</span>}
    </button>
  );
}
