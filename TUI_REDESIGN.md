# TUI-Style Sandbox Configuration Dialog

## Overview

Redesigned the sandbox configuration modal to have a true TUI (Text User Interface) aesthetic that feels native to a terminal application, using ASCII box-drawing characters and a classic terminal color scheme.

## Key Design Changes

### Visual Style
- **ASCII Box Characters**: Uses `┌─┐│└┘├┤` for borders and structure
- **Monospace Font**: JetBrainsMono Nerd Font throughout
- **Classic Terminal Colors**:
  - Green (#00ff00) for primary text and borders
  - Black/dark backgrounds (#000, #0f0f0f, #1a1a1a)
  - Red for blocked/delete actions
  - Blue for read-only
  - Yellow for warnings
- **Terminal Aesthetic**: No rounded corners, sharp borders, CRT glow effects

### Layout Structure

```
┌─ SANDBOX CONFIGURATION ─────────────────────────────────────┐
│ ⚠ WARNING: Sandbox not supported on Windows                  │
├───────────────────────────────────────────────────────────────┤
│ FILESYSTEM PERMISSIONS
├───────────────────────────────────────────────────────────────┤
│ PATH                                          ACCESS           │
│ ~/.ssh                                        [XX]       [x]│
│ ~/.aws                                        [XX]       [x]│
│ .                                             [RW]       [x]│
│ Add path: _________________________________ [+]
├───────────────────────────────────────────────────────────────┤
│ NETWORK ACCESS
├───────────────────────────────────────────────────────────────┤
│ (•) Allow all network
│ ( ) Block all network
│ ( ) Allowlist domains only:
│   Domains: _________________________________
└───────────────────────────────────────────────────────────────┘
[ Back ]                                     [ Start Terminal ]
```

### Interactive Elements

#### Access Badges
- **`[RW]`** - Read/Write (green) - Click to cycle through modes
- **`[R-]`** - Read-Only (blue)
- **`[XX]`** - Blocked (red)
- Single click cycles: RW → R- → XX → RW

#### Radio Buttons
- **`(•)`** - Selected (ASCII filled circle)
- **`( )`** - Unselected (ASCII empty circle)
- Text-based, no custom components

#### Action Buttons
- **`[x]`** - Delete/Remove (red)
- **`[+]`** - Add new entry (green)
- Brackets for TUI button style

#### Inputs
- Black background with green border
- Green text on black
- Glow effect on focus
- Monospace placeholder text

### Color Coding

| Element | Color | Meaning |
|---------|-------|---------|
| Primary text/borders | Green (#00ff00) | Normal/interactive |
| Read/Write badge | Green (#00ff00) | Full access |
| Read-Only badge | Blue (#00aaff) | Limited access |
| Blocked badge | Red (#ff0000) | No access |
| Remove button | Red (#ff0000) | Destructive action |
| Warning text | Yellow (#ffcc00) | Caution |
| Background | Black/Dark Gray | Terminal backdrop |

### Hover Effects
- Subtle background color changes (darker green/red/blue tints)
- CRT-style glow on buttons and inputs
- Row highlighting on hover
- Selected row gets darker green background

### Typography
- **Font**: JetBrainsMono Nerd Font (monospace)
- **Sizes**: 11-13px (terminal-appropriate)
- **Spacing**: Tight, compact like a TUI
- **Case**: UPPERCASE for headers, normal for content

## Component Changes

### SandboxConfigModal.tsx
- Replaced dropdown with click-to-cycle badge
- Added row selection state
- Replaced styled inputs with TUI-style bordered inputs
- Changed radio buttons to ASCII `(•)` and `( )`
- Simplified interaction model (click to cycle vs dropdown)
- Added visual feedback for selected row

### CSS Changes
- Removed all rounded corners
- Added ASCII box-drawing characters
- Implemented green terminal color scheme
- Added glow/shadow effects for CRT aesthetic
- Monospace font throughout
- Compact spacing and padding
- Sharp, geometric design

## User Interaction

### Filesystem Permissions
1. **View**: See all paths with their access levels
2. **Cycle Access**: Click the badge `[RW]`/`[R-]`/`[XX]` to change
3. **Remove**: Click `[x]` to delete a path
4. **Add**: Type path in input, press Enter or click `[+]`
5. **Select**: Click any row to highlight it

### Network Access
1. **Select Mode**: Click on radio option text
2. **Visual Feedback**: ASCII circles show selection `(•)` vs `( )`
3. **Allowlist**: Input appears when "Allowlist domains only" selected
4. **Domain Entry**: Comma-separated domains in monospace input

### Navigation
- **[ Back ]**: Return to mode selection (left side)
- **[ Start Terminal ]**: Proceed with configuration (right side, green)
- Uppercase brackets for button style

## Benefits of TUI Design

1. **Native Feel**: Looks like it belongs in a terminal application
2. **Consistent Aesthetic**: Matches the terminal emulator's monospace, text-based nature
3. **Clear Hierarchy**: ASCII boxes clearly separate sections
4. **Keyboard-Friendly**: Designed for keyboard navigation (future enhancement)
5. **Retro Cool**: Classic hacker/sysadmin aesthetic
6. **Accessibility**: High contrast (green on black)
7. **Performance**: Simple rendering, no complex graphics
8. **Distinctive**: Memorable, unique visual identity

## Technical Implementation

### CSS Classes
- `.tui-dialog` - Main dialog container
- `.tui-title` - Header with box drawing
- `.tui-section-divider` - ASCII horizontal lines
- `.tui-table-row` - File permission rows
- `.tui-access-badge` - Clickable access level badges
- `.tui-radio` - ASCII radio buttons
- `.tui-input` - Monospace text inputs with borders
- `.tui-btn` - Bracketed button style

### Colors (CSS Variables Ready)
Currently hardcoded but easy to extract to CSS variables:
- `--tui-primary: #00ff00`
- `--tui-bg-dark: #000000`
- `--tui-bg-mid: #0f0f0f`
- `--tui-bg-light: #1a1a1a`
- `--tui-accent-readonly: #00aaff`
- `--tui-accent-blocked: #ff0000`
- `--tui-warning: #ffcc00`

## Future Enhancements

1. **Keyboard Navigation**: Arrow keys to navigate rows, Space to cycle access
2. **Vim Bindings**: j/k for up/down, h/l for cycling, dd to delete
3. **Status Line**: Bottom info line like vim (`:` commands)
4. **Color Themes**: Amber, cyan, white terminal themes
5. **ASCII Art**: Logo/branding in ASCII art
6. **Sound Effects**: Optional terminal beeps for actions
7. **Blink Effect**: Classic cursor blink in inputs

## Comparison

### Before (Material Design)
- Rounded corners, shadows
- Dropdown menus
- Modern, flat design
- Felt like a web app
- Multiple colors, gradients

### After (TUI Design)
- Sharp ASCII borders
- Click-to-cycle badges
- Retro terminal aesthetic
- Feels like ncurses/dialog
- Green monochrome (classic terminal)
- CRT glow effects

The redesign makes the configuration dialog feel like a natural part of the terminal environment rather than an overlay web UI.
