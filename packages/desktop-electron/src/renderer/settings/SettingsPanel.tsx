/**
 * Settings Panel Component
 *
 * Main settings UI panel with all configuration options.
 * Draggable panel with live preview for font settings.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSettings } from './useSettings';
import { SettingsSection } from './SettingsSection';
import {
  ToggleControl,
  SliderControl,
  ThemeSelector,
  FontSelector,
  CursorStyleSelector,
  LiveSelectControl,
  McpConfigControl,
  RecordingsManager,
} from './controls';
import {
  fontSizes,
  SCROLLBACK_MIN,
  SCROLLBACK_MAX,
  OPACITY_MIN,
  OPACITY_MAX,
} from './defaults';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, updateSettings, resetSettings } = useSettings();
  const panelRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  });

  // Reset position when panel closes
  useEffect(() => {
    if (!isOpen) {
      setPosition(null);
    }
  }, [isOpen]);

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Mouse move handler for dragging
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const state = dragStateRef.current;
    if (!state.isDragging) return;

    const newX = e.clientX - state.offsetX;
    const newY = e.clientY - state.offsetY;

    setPosition({ x: newX, y: newY });
  }, []);

  // Mouse up handler to stop dragging
  const handleMouseUp = useCallback(() => {
    dragStateRef.current.isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Set up global mouse listeners for dragging
  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isOpen, handleMouseMove, handleMouseUp]);

  // Start dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag on left click and on the header itself
    if (e.button !== 0) return;

    e.preventDefault();

    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();

    // Initialize position if not set (first drag)
    if (position === null) {
      setPosition({ x: rect.left, y: rect.top });
    }

    dragStateRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  };

  if (!isOpen) return null;

  // Build font size options
  const fontSizeOptions = fontSizes.map((size) => ({
    value: String(size),
    label: `${size}px`,
  }));

  // Panel style - either positioned or centered
  const panelStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: position.x,
        top: position.y,
        transform: 'none',
      }
    : {};

  return (
    <div
      className={`settings-overlay ${position ? 'dragged' : ''}`}
      onClick={position ? undefined : onClose}
    >
      <div
        ref={panelRef}
        className="settings-panel"
        onClick={(e) => e.stopPropagation()}
        style={panelStyle}
      >
        <div
          className="settings-header"
          onMouseDown={handleMouseDown}
          style={{ cursor: dragStateRef.current.isDragging ? 'grabbing' : 'grab' }}
        >
          <h2 className="settings-title">Settings</h2>
          <button
            type="button"
            className="settings-close"
            onClick={onClose}
            aria-label="Close settings"
            onMouseDown={(e) => e.stopPropagation()}
          >
            ×
          </button>
        </div>

        <div className="settings-content">
          {/* Appearance Section */}
          <SettingsSection title="Appearance" icon="🎨" defaultExpanded={true}>
            <ThemeSelector
              value={settings.appearance.theme}
              onChange={(theme) =>
                updateSettings({ appearance: { theme } })
              }
            />

            <FontSelector
              value={settings.appearance.fontFamily}
              onChange={(fontFamily) =>
                updateSettings({ appearance: { fontFamily } })
              }
            />

            <LiveSelectControl
              label="Font Size"
              value={String(settings.appearance.fontSize)}
              options={fontSizeOptions}
              onChange={(value) =>
                updateSettings({ appearance: { fontSize: Number(value) } })
              }
            />

            <ToggleControl
              label="Font Ligatures"
              description="Enable programming ligatures (e.g., =>, !=)"
              value={settings.appearance.fontLigatures}
              onChange={(fontLigatures) =>
                updateSettings({ appearance: { fontLigatures } })
              }
            />
          </SettingsSection>

          {/* Terminal Section */}
          <SettingsSection title="Terminal" icon="⌨️" defaultExpanded={true}>
            <CursorStyleSelector
              value={settings.terminal.cursorStyle}
              onChange={(cursorStyle) =>
                updateSettings({ terminal: { cursorStyle } })
              }
            />

            <ToggleControl
              label="Cursor Blink"
              description="Animate the cursor"
              value={settings.terminal.cursorBlink}
              onChange={(cursorBlink) =>
                updateSettings({ terminal: { cursorBlink } })
              }
            />

            <SliderControl
              label="Scrollback Lines"
              description="Number of lines to keep in history"
              value={settings.terminal.scrollbackLines}
              min={SCROLLBACK_MIN}
              max={SCROLLBACK_MAX}
              step={1000}
              onChange={(scrollbackLines) =>
                updateSettings({ terminal: { scrollbackLines } })
              }
            />

            <ToggleControl
              label="Bell Sound"
              description="Play sound on terminal bell"
              value={settings.terminal.bellSound}
              onChange={(bellSound) =>
                updateSettings({ terminal: { bellSound } })
              }
            />

            <ToggleControl
              label="Forward LC_CTYPE"
              description="Also set LC_CTYPE (in addition to LANG). May cause SSH locale errors on remote servers. Keep off to match iTerm2 behavior."
              value={settings.terminal.setLocaleEnv}
              onChange={(setLocaleEnv) =>
                updateSettings({ terminal: { setLocaleEnv } })
              }
            />
          </SettingsSection>

          {/* Advanced Section */}
          <SettingsSection title="Advanced" icon="⚙️" defaultExpanded={false}>
            <ToggleControl
              label="GPU Acceleration"
              description="Use WebGL for faster rendering (restart terminal to apply)"
              value={settings.advanced.gpuAcceleration}
              onChange={(gpuAcceleration) =>
                updateSettings({ advanced: { gpuAcceleration } })
              }
            />

            <SliderControl
              label="Window Opacity"
              description="Transparency of the application window"
              value={settings.advanced.windowOpacity}
              min={OPACITY_MIN}
              max={OPACITY_MAX}
              unit="%"
              onChange={(windowOpacity) =>
                updateSettings({ advanced: { windowOpacity } })
              }
            />

            <ToggleControl
              label="Debug Mode"
              description="Show additional debugging information"
              value={settings.advanced.debugMode}
              onChange={(debugMode) =>
                updateSettings({ advanced: { debugMode } })
              }
            />
          </SettingsSection>

          {/* MCP Configuration Section */}
          <SettingsSection title="MCP Configuration" icon="🔌" defaultExpanded={false}>
            <McpConfigControl />
          </SettingsSection>

          {/* Recordings Section */}
          <SettingsSection title="Recordings" icon="🎬" defaultExpanded={false}>
            <RecordingsManager />
          </SettingsSection>
        </div>

        <div className="settings-footer">
          <button
            type="button"
            className="settings-reset-btn"
            onClick={resetSettings}
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
