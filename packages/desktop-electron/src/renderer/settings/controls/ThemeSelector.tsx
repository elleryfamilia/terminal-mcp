/**
 * Theme Selector Component
 *
 * A visual theme picker with color preview swatches.
 */

import type { ThemeId } from '../types';
import { getAllThemes } from '../themes';

interface ThemeSelectorProps {
  value: ThemeId;
  onChange: (value: ThemeId) => void;
}

export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const themes = getAllThemes();

  return (
    <div className="settings-control settings-theme-selector">
      <div className="settings-control-info">
        <label className="settings-control-label">Theme</label>
        <span className="settings-control-description">
          Choose your preferred color scheme
        </span>
      </div>
      <div className="theme-grid">
        {themes.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className={`theme-option ${value === theme.id ? 'theme-selected' : ''}`}
            onClick={() => onChange(theme.id)}
            title={theme.name}
          >
            <div
              className="theme-preview"
              style={{
                backgroundColor: theme.colors.background,
                borderColor:
                  value === theme.id
                    ? theme.colors.accent
                    : theme.colors.border,
              }}
            >
              <div className="theme-preview-colors">
                <span
                  className="theme-color-dot"
                  style={{ backgroundColor: theme.colors.accent }}
                />
                <span
                  className="theme-color-dot"
                  style={{ backgroundColor: theme.colors.success }}
                />
                <span
                  className="theme-color-dot"
                  style={{ backgroundColor: theme.colors.ansi.red }}
                />
                <span
                  className="theme-color-dot"
                  style={{ backgroundColor: theme.colors.ansi.yellow }}
                />
              </div>
              <span
                className="theme-preview-text"
                style={{ color: theme.colors.foreground }}
              >
                Aa
              </span>
            </div>
            <span className="theme-name">{theme.name}</span>
            {!theme.isDark && <span className="theme-light-badge">Light</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
