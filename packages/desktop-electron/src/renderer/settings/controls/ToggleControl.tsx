/**
 * Toggle Control Component
 *
 * A reusable toggle switch for boolean settings.
 */

interface ToggleControlProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function ToggleControl({
  label,
  description,
  value,
  onChange,
  disabled = false,
}: ToggleControlProps) {
  return (
    <div className="settings-control settings-toggle">
      <div className="settings-control-info">
        <label className="settings-control-label">{label}</label>
        {description && (
          <span className="settings-control-description">{description}</span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        className={`toggle-switch ${value ? 'toggle-on' : 'toggle-off'}`}
        onClick={() => onChange(!value)}
        disabled={disabled}
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  );
}
