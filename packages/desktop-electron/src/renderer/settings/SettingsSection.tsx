/**
 * Settings Section Component
 *
 * A collapsible section wrapper for grouping related settings.
 */

import { useState, type ReactNode } from 'react';

interface SettingsSectionProps {
  title: string;
  icon?: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export function SettingsSection({
  title,
  icon,
  children,
  defaultExpanded = true,
}: SettingsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`settings-section ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <button
        type="button"
        className="settings-section-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="settings-section-toggle">
          {isExpanded ? '▼' : '▶'}
        </span>
        {icon && <span className="settings-section-icon">{icon}</span>}
        <span className="settings-section-title">{title}</span>
      </button>
      {isExpanded && (
        <div className="settings-section-content">{children}</div>
      )}
    </div>
  );
}
