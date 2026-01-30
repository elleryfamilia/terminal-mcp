/**
 * Select Control Component
 *
 * A reusable dropdown select for choice-based settings.
 */

interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface SelectControlProps<T extends string> {
  label: string;
  description?: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function SelectControl<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
  disabled = false,
}: SelectControlProps<T>) {
  return (
    <div className="settings-control settings-select">
      <div className="settings-control-info">
        <label className="settings-control-label">{label}</label>
        {description && (
          <span className="settings-control-description">{description}</span>
        )}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        disabled={disabled}
        className="settings-select-input"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
