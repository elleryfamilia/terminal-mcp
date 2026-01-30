/**
 * Sandbox Icon Component
 *
 * Informational icon indicating a sandboxed terminal.
 * Non-interactive, amber colored.
 */

interface SandboxIconProps {
  size?: number;
  className?: string;
}

export function SandboxIcon({ size = 14, className = "" }: SandboxIconProps) {
  return (
    <span
      className={`sandbox-icon ${className}`}
      title="Sandboxed terminal"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Simple box/container icon */}
        <rect x="3" y="3" width="18" height="18" rx="2" />
        {/* Inner box to suggest containment */}
        <rect x="7" y="7" width="10" height="10" rx="1" strokeWidth="1.5" />
      </svg>
    </span>
  );
}
