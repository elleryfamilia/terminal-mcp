/**
 * Record Icon Component
 *
 * Simple circular icon for recording indicator.
 */

interface RecordIconProps {
  size?: number;
  className?: string;
}

export function RecordIcon({ size = 14, className = "" }: RecordIconProps) {
  return (
    <span className={`record-icon ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        style={{ display: "block" }}
      >
        <circle cx="12" cy="12" r="8" />
      </svg>
    </span>
  );
}
