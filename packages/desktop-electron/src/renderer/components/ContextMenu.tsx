/**
 * Context Menu Component
 *
 * Custom right-click context menu for the terminal with standard actions,
 * pane management, tab/window controls, and feature toggles.
 */

import { useEffect, useRef, useCallback } from "react";

export interface ContextMenuAction {
  id: string;
  label: string;
  shortcut?: string;
  enabled?: boolean;
  onClick: () => void;
  indicator?: "recording" | "mcp";
  indicatorActive?: boolean;
}

export interface ContextMenuGroup {
  id: string;
  items: ContextMenuAction[];
}

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  groups: ContextMenuGroup[];
  onClose: () => void;
}

export function ContextMenu({
  isOpen,
  position,
  groups,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    // Use capture phase to catch clicks before they bubble
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Smart positioning to keep menu within viewport
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = position.x;
    let adjustedY = position.y;

    // Adjust horizontal position
    if (position.x + rect.width > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 8;
    }

    // Adjust vertical position
    if (position.y + rect.height > viewportHeight) {
      adjustedY = viewportHeight - rect.height - 8;
    }

    // Ensure minimum distance from edges
    adjustedX = Math.max(8, adjustedX);
    adjustedY = Math.max(8, adjustedY);

    menu.style.left = `${adjustedX}px`;
    menu.style.top = `${adjustedY}px`;
  }, [isOpen, position]);

  const handleItemClick = useCallback(
    (action: ContextMenuAction) => {
      if (action.enabled === false) return;
      action.onClick();
      onClose();
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: position.x, top: position.y }}
    >
      {groups.map((group, groupIndex) => (
        <div key={group.id} className="context-menu-group">
          {group.items.map((item) => (
            <button
              key={item.id}
              className={`context-menu-item ${item.enabled === false ? "context-menu-item-disabled" : ""}`}
              onClick={() => handleItemClick(item)}
              disabled={item.enabled === false}
            >
              <span className="context-menu-item-label">{item.label}</span>
              {item.indicator && (
                <span
                  className={`context-menu-item-indicator context-menu-item-indicator-${item.indicator} ${item.indicatorActive ? "active" : ""}`}
                />
              )}
              {item.shortcut && (
                <span className="context-menu-item-shortcut">
                  {item.shortcut}
                </span>
              )}
            </button>
          ))}
          {groupIndex < groups.length - 1 && (
            <div className="context-menu-separator" />
          )}
        </div>
      ))}
    </div>
  );
}
