/**
 * Slider Control Component
 *
 * A reusable slider for numeric range settings.
 */

interface SliderControlProps {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function SliderControl({
  label,
  description,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  disabled = false,
}: SliderControlProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="settings-control settings-slider">
      <div className="settings-control-header">
        <div className="settings-control-info">
          <label className="settings-control-label">{label}</label>
          {description && (
            <span className="settings-control-description">{description}</span>
          )}
        </div>
        <span className="settings-slider-value">
          {value}
          {unit}
        </span>
      </div>
      <div className="settings-slider-track-wrapper">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="settings-slider-input"
          style={{
            background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${percentage}%, var(--border) ${percentage}%, var(--border) 100%)`,
          }}
        />
      </div>
    </div>
  );
}
