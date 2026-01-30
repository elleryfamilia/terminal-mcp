# Mode Selection Modal - TUI Redesign

## Overview

Redesigned the mode selection modal to match the TUI aesthetic of the sandbox configuration dialog. Added default selection (Direct Mode) and keyboard navigation including Enter key support.

## Visual Design

### Layout
```
┌─ SELECT TERMINAL MODE ──────────────────────────────────────┐
│ Choose how Terminal MCP should run:
├───────────────────────────────────────────────────────────────┤
│ [•] 1. DIRECT MODE [RECOMMENDED]
│        Full access to your system. Terminal runs with normal permissions.
├───────────────────────────────────────────────────────────────┤
│ [ ] 2. SANDBOX MODE
│        Restricted filesystem and network access. Good for AI sessions.
└───────────────────────────────────────────────────────────────┘
Press 1 or 2 to select, ↑/↓ to navigate, Enter to continue
                        [ Continue ]
```

### TUI Elements

#### Selection Indicators
- **`[•]`** - Selected mode (green filled bracket)
- **`[ ]`** - Unselected mode (green empty bracket)
- ASCII-based, consistent with terminal aesthetics

#### Mode Numbers
- **`1.`** - Direct Mode (quick select with '1' key)
- **`2.`** - Sandbox Mode (quick select with '2' key)

#### Badges
- **`[RECOMMENDED]`** - Green text on green background for Direct Mode
- Inverted terminal style (black text on green)

#### Box Drawing
- Same ASCII characters as sandbox config: `┌─┐│└┘├┤`
- Consistent border and divider style
- Full-width dialog with uniform spacing

## Key Features

### 1. Default Selection
- **Direct Mode is selected by default** when dialog opens
- No need to click before pressing Enter
- Visual indicator `[•]` shows selection immediately
- Most common use case (unrestricted mode) is one keypress away

### 2. Keyboard Navigation

| Key | Action |
|-----|--------|
| **Enter** | Continue with selected mode |
| **1** | Select Direct Mode |
| **2** | Select Sandbox Mode |
| **↑ / ↓** | Toggle between modes |

### 3. Visual Feedback
- Selected option has darker green background (`#1a3a1a`)
- Hover effect on both options (`#1a2a1a`)
- Clear visual distinction between selected/unselected
- Hint text at bottom explains keyboard shortcuts

### 4. Color Scheme
- **Primary**: Green (#00ff00) - text, borders, indicators
- **Secondary**: Darker green (#00aa00) - descriptions, hints
- **Background**: Black/dark gray (#0f0f0f, #1a1a1a)
- **Selected**: Dark green tint (#1a3a1a)
- **Badge**: Inverted (black on green)

## Component Changes

### ModeSelectionModal.tsx

#### State Changes
```typescript
// Before: null default, required selection
const [selectedMode, setSelectedMode] = useState<'direct' | 'sandbox' | null>(null);

// After: Direct mode default
const [selectedMode, setSelectedMode] = useState<'direct' | 'sandbox'>('direct');
```

#### Keyboard Support
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleContinue(); // Immediately proceed with selected mode
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMode(prev => prev === 'direct' ? 'sandbox' : 'direct');
    } else if (e.key === '1') {
      setSelectedMode('direct');
    } else if (e.key === '2') {
      setSelectedMode('sandbox');
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isOpen, showSandboxConfig, selectedMode]);
```

#### UI Structure
- Replaced card-based layout with TUI boxes
- Added ASCII selection indicators `[•]` and `[ ]`
- Added numbered options (1, 2)
- Added keyboard hint at bottom
- Removed emoji icons (not TUI-appropriate)
- Simplified to single "Continue" button

## CSS Changes

### Removed
- `.mode-modal` - Rounded, modern dialog
- `.mode-option` - Card-based selection
- `.mode-option-icon` - Emoji icons
- Rounded corners and shadows
- Multiple background colors

### Added
- `.tui-mode-dialog` - Green bordered TUI box
- `.tui-mode-option` - Button-like selectable row
- `.tui-mode-indicator` - ASCII bracket indicators
- `.tui-mode-number` - Number prefix for quick select
- `.tui-mode-badge` - Inverted badge style
- `.tui-mode-hint` - Keyboard shortcut help text
- Sharp borders with box-drawing characters
- Monospace font throughout

## User Experience Flow

### Quick Start (Default - Most Common)
1. Dialog opens with Direct Mode selected
2. User presses **Enter**
3. App starts immediately with full permissions
4. **Total: 1 keypress** 🎯

### Choose Sandbox Mode
1. Dialog opens with Direct Mode selected
2. User presses **2** or **↓**
3. Sandbox Mode becomes selected
4. User presses **Enter**
5. Sandbox configuration dialog appears

### Mouse Users
1. Dialog opens
2. Click on desired mode (visual feedback)
3. Click **[ Continue ]** button
4. Proceeds with selection

## Benefits

1. **Faster Default Path**: Direct mode is one Enter press away
2. **Keyboard-First**: Full keyboard navigation (TUI tradition)
3. **Consistent Aesthetic**: Matches sandbox config TUI design
4. **Clear Hierarchy**: Box drawing shows structure
5. **Terminal Native**: Looks like ncurses dialog
6. **Accessibility**: High contrast, clear indicators
7. **Power User Friendly**: Number keys for quick selection

## Technical Details

### Default Selection Logic
```typescript
// Direct mode selected on mount
const [selectedMode, setSelectedMode] = useState<'direct' | 'sandbox'>('direct');

// No "Continue" button disabling needed - always has selection
<button className="tui-btn tui-btn-primary" onClick={handleContinue}>
  [ Continue ]
</button>
```

### Keyboard Event Handling
- Events only active when modal is open and not showing sandbox config
- Arrow keys toggle between two modes
- Number keys (1, 2) directly select modes
- Enter key triggers continue action
- Events are cleaned up on unmount

### Visual States
- **Default**: Direct mode selected, green bracket `[•]`
- **Selected**: Dark green background highlight
- **Hover**: Lighter green tint on hover
- **Unselected**: Empty bracket `[ ]`, normal background

## Comparison

### Before
- Modern card-based UI
- No default selection
- Emoji icons (🚀, 🛡️)
- Rounded corners
- "Continue" button disabled until selection
- Mouse-first interaction

### After
- TUI ASCII box design
- Direct mode selected by default
- Text-based indicators `[•]` / `[ ]`
- Sharp ASCII borders
- "Continue" button always enabled
- Keyboard-first with mouse support
- Press Enter to proceed immediately

## Testing

### Keyboard Navigation
- [ ] Dialog opens with Direct Mode selected
- [ ] Press Enter → starts with Direct Mode
- [ ] Press 2 → selects Sandbox Mode
- [ ] Press 1 → selects Direct Mode
- [ ] Press ↓ → toggles from Direct to Sandbox
- [ ] Press ↑ → toggles from Sandbox to Direct
- [ ] Press Enter on Sandbox → shows config dialog

### Mouse Interaction
- [ ] Click on Direct Mode → selects it
- [ ] Click on Sandbox Mode → selects it
- [ ] Click Continue → proceeds with selected mode
- [ ] Hover effects work on both options

### Visual
- [ ] Selected mode shows `[•]` indicator
- [ ] Unselected mode shows `[ ]` indicator
- [ ] Dark green background on selected mode
- [ ] ASCII borders render correctly
- [ ] Badge shows on Direct Mode
- [ ] Hint text displays at bottom

The redesign makes the mode selection feel native to a terminal environment while optimizing for the most common use case (Direct Mode).
