/**
 * Font Selector Component
 *
 * A dropdown for selecting terminal font family with live preview.
 * Uses queryLocalFonts() API to enumerate system fonts.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { FontFamily } from '../types';
import { fontFamilies as fallbackFonts } from '../defaults';

interface FontSelectorProps {
  value: FontFamily;
  onChange: (value: FontFamily) => void;
}

// Filter for monospace fonts (heuristics based on common naming patterns)
function isLikelyMonospace(fontFamily: string): boolean {
  const lower = fontFamily.toLowerCase();
  return (
    lower.includes('mono') ||
    lower.includes('code') ||
    lower.includes('consol') ||
    lower.includes('courier') ||
    lower.includes('terminal') ||
    lower.includes('fixed') ||
    lower.includes('nerd font') ||
    lower.includes('menlo') ||
    lower.includes('monaco') ||
    lower.includes('hack') ||
    lower.includes('iosevka') ||
    lower.includes('fira') ||
    lower.includes('jetbrains') ||
    lower.includes('source code') ||
    lower.includes('ubuntu mono') ||
    lower.includes('dejavu sans mono') ||
    lower.includes('andale') ||
    lower.includes('sf mono') ||
    lower.includes('cascadia') ||
    lower.includes('inconsolata') ||
    lower.includes('droid sans mono') ||
    lower.includes('liberation mono') ||
    lower.includes('roboto mono') ||
    lower.includes('ibm plex mono') ||
    lower.includes('space mono') ||
    lower.includes('anonymous') ||
    lower.includes('0xproto') ||
    lower.includes('audiolink')
  );
}

// Type for the Font Access API
interface FontData {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
}

export function FontSelector({ value, onChange }: FontSelectorProps) {
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Load system fonts
  useEffect(() => {
    async function loadFonts() {
      try {
        // queryLocalFonts is available in Chromium/Electron
        if ('queryLocalFonts' in window) {
          const fonts = await (window as unknown as { queryLocalFonts: () => Promise<FontData[]> }).queryLocalFonts();

          // Get unique font families, filtered to likely monospace fonts
          const families = new Set<string>();
          for (const font of fonts) {
            if (isLikelyMonospace(font.family)) {
              families.add(font.family);
            }
          }

          // Sort alphabetically
          const sortedFonts = Array.from(families).sort((a, b) =>
            a.toLowerCase().localeCompare(b.toLowerCase())
          );

          setSystemFonts(sortedFonts);
        }
      } catch (err) {
        console.warn('Could not query local fonts:', err);
      }
      setIsLoading(false);
    }

    loadFonts();
  }, []);

  // Use system fonts if available, otherwise fall back to curated list
  const fonts = systemFonts.length > 0 ? systemFonts : fallbackFonts.slice();

  // Find current value index
  const currentIndex = fonts.indexOf(value);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isOpen, highlightedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isLoading) return;

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
          } else {
            setIsOpen(false);
            setHighlightedIndex(-1);
          }
          break;

        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
          } else {
            const nextIndex = Math.min(highlightedIndex + 1, fonts.length - 1);
            setHighlightedIndex(nextIndex);
            // Live preview - apply the change immediately
            onChange(fonts[nextIndex]);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
          } else {
            const prevIndex = Math.max(highlightedIndex - 1, 0);
            setHighlightedIndex(prevIndex);
            // Live preview - apply the change immediately
            onChange(fonts[prevIndex]);
          }
          break;

        case 'Home':
          e.preventDefault();
          if (isOpen) {
            setHighlightedIndex(0);
            onChange(fonts[0]);
          }
          break;

        case 'End':
          e.preventDefault();
          if (isOpen) {
            const lastIndex = fonts.length - 1;
            setHighlightedIndex(lastIndex);
            onChange(fonts[lastIndex]);
          }
          break;
      }
    },
    [isOpen, highlightedIndex, fonts, onChange, currentIndex, isLoading]
  );

  // Handle option click
  const handleOptionClick = (index: number) => {
    onChange(fonts[index]);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  // Handle toggle click
  const handleToggleClick = () => {
    if (isLoading) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
  };

  return (
    <div className="settings-control settings-live-select settings-font-selector" ref={containerRef}>
      <div className="settings-control-info">
        <label className="settings-control-label">Font Family</label>
        <span className="settings-control-description">
          {isLoading ? 'Loading fonts...' : `${fonts.length} monospace fonts`}
        </span>
      </div>
      <div
        className={`live-select-trigger ${isOpen ? 'open' : ''} ${isLoading ? 'disabled' : ''}`}
        onClick={handleToggleClick}
        onKeyDown={handleKeyDown}
        tabIndex={isLoading ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="live-select-value" style={{ fontFamily: value }}>
          {value}
        </span>
        <span className="live-select-arrow">▾</span>
      </div>
      {isOpen && (
        <ul
          ref={listRef}
          className="live-select-dropdown"
          role="listbox"
        >
          {fonts.map((font, index) => (
            <li
              key={font}
              className={`live-select-option ${
                index === highlightedIndex ? 'highlighted' : ''
              } ${font === value ? 'selected' : ''}`}
              onClick={() => handleOptionClick(index)}
              onMouseEnter={() => {
                setHighlightedIndex(index);
                // Live preview on hover
                onChange(font);
              }}
              role="option"
              aria-selected={font === value}
              style={{ fontFamily: font }}
            >
              {font}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
