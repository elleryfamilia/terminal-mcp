/**
 * Record Icon Component
 *
 * Simple circular icon for recording indicator.
 */

interface RecordIconProps {
  size?: number;
}

export function RecordIcon({ size = 14 }: RecordIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ display: "block" }}
    >
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}
