/**
 * Cursor Style Selector Component
 *
 * Visual selector for terminal cursor styles with actual cursor representations.
 */

import type { CursorStyle } from '../types';

interface CursorStyleSelectorProps {
  value: CursorStyle;
  onChange: (value: CursorStyle) => void;
}

const cursorStyles: { value: CursorStyle; label: string; icon: string }[] = [
  { value: 'block', label: 'Block', icon: '█' },
  { value: 'bar', label: 'Bar', icon: '▏' },
  { value: 'underline', label: 'Underline', icon: '▁' },
];

export function CursorStyleSelector({ value, onChange }: CursorStyleSelectorProps) {
  return (
    <div className="settings-control settings-cursor-selector">
      <div className="settings-control-info">
        <label className="settings-control-label">Cursor Style</label>
        <span className="settings-control-description">
          Shape of the terminal cursor
        </span>
      </div>
      <div className="cursor-style-options">
        {cursorStyles.map((style) => (
          <button
            key={style.value}
            type="button"
            className={`cursor-style-option ${value === style.value ? 'cursor-style-selected' : ''}`}
            onClick={() => onChange(style.value)}
            title={style.label}
          >
            <span className="cursor-style-icon">{style.icon}</span>
            <span className="cursor-style-label">{style.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
