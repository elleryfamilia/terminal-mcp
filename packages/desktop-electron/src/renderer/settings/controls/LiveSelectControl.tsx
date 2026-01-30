/**
 * Live Select Control Component
 *
 * A custom dropdown that applies changes immediately on arrow navigation,
 * allowing live preview of settings as you browse options.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

interface LiveSelectOption<T extends string> {
  value: T;
  label: string;
  style?: React.CSSProperties;
}

interface LiveSelectControlProps<T extends string> {
  label: string;
  description?: string;
  value: T;
  options: LiveSelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Style to apply to each option (e.g., font preview) */
  getOptionStyle?: (value: T) => React.CSSProperties;
}

export function LiveSelectControl<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
  disabled = false,
  getOptionStyle,
}: LiveSelectControlProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Find current value index
  const currentIndex = options.findIndex((opt) => opt.value === value);

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
      if (disabled) return;

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            setHighlightedIndex(currentIndex);
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
            setHighlightedIndex(currentIndex);
          } else {
            const nextIndex = Math.min(highlightedIndex + 1, options.length - 1);
            setHighlightedIndex(nextIndex);
            // Live preview - apply the change immediately
            onChange(options[nextIndex].value);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            setHighlightedIndex(currentIndex);
          } else {
            const prevIndex = Math.max(highlightedIndex - 1, 0);
            setHighlightedIndex(prevIndex);
            // Live preview - apply the change immediately
            onChange(options[prevIndex].value);
          }
          break;

        case 'Home':
          e.preventDefault();
          if (isOpen) {
            setHighlightedIndex(0);
            onChange(options[0].value);
          }
          break;

        case 'End':
          e.preventDefault();
          if (isOpen) {
            const lastIndex = options.length - 1;
            setHighlightedIndex(lastIndex);
            onChange(options[lastIndex].value);
          }
          break;
      }
    },
    [isOpen, highlightedIndex, options, onChange, currentIndex, disabled]
  );

  // Handle option click
  const handleOptionClick = (index: number) => {
    onChange(options[index].value);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  // Handle toggle click
  const handleToggleClick = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHighlightedIndex(currentIndex);
    }
  };

  const selectedOption = options.find((opt) => opt.value === value);
  const selectedStyle = getOptionStyle ? getOptionStyle(value) : selectedOption?.style;

  return (
    <div className="settings-control settings-live-select" ref={containerRef}>
      <div className="settings-control-info">
        <label className="settings-control-label">{label}</label>
        {description && (
          <span className="settings-control-description">{description}</span>
        )}
      </div>
      <div
        className={`live-select-trigger ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={handleToggleClick}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="live-select-value" style={selectedStyle}>
          {selectedOption?.label || value}
        </span>
        <span className="live-select-arrow">▾</span>
      </div>
      {isOpen && (
        <ul
          ref={listRef}
          className="live-select-dropdown"
          role="listbox"
        >
          {options.map((option, index) => {
            const optionStyle = getOptionStyle
              ? getOptionStyle(option.value)
              : option.style;
            return (
              <li
                key={option.value}
                className={`live-select-option ${
                  index === highlightedIndex ? 'highlighted' : ''
                } ${option.value === value ? 'selected' : ''}`}
                onClick={() => handleOptionClick(index)}
                onMouseEnter={() => {
                  setHighlightedIndex(index);
                  // Live preview on hover too
                  onChange(option.value);
                }}
                role="option"
                aria-selected={option.value === value}
                style={optionStyle}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
