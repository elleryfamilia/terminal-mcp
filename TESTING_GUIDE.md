# Testing Guide: Unified Mode Selector

## Quick Start

### Test CLI (Interactive Mode)

```bash
# In terminal-mcp-gui root directory
npm run dev
```

**What you should see:**
1. Ink-rendered mode selection prompt with:
   - "┌─ Terminal Mode ─┐" header
   - "● 1 Direct" (selected, green)
   - "○ 2 Sandbox" (unselected, gray)
   - "1/2/↑/↓ · enter" instructions

2. **Try these interactions:**
   - Press `1` → Direct mode selected (green dot moves)
   - Press `2` → Sandbox mode selected (green dot moves)
   - Press `↑` or `↓` → Toggle between modes
   - Press `Enter` → Confirm selection

3. **If you selected Direct:**
   - Terminal should start immediately
   - Normal shell prompt appears

4. **If you selected Sandbox:**
   - Permission prompt should appear (interactive TUI)
   - You should be able to navigate with arrows
   - You should be able to change permissions with ←→
   - Press `Enter` to confirm
   - Sandboxed shell starts

### Test Electron (GUI Mode)

```bash
# In terminal-mcp-gui root directory
cd packages/desktop-electron
npm run start
```

**What you should see:**
1. Electron window opens
2. xterm.js terminal area shows the mode selection prompt
   - Should look identical to CLI version
   - ANSI box drawing characters should render

3. **Try these interactions:**
   - Type `1` or `2` in the window
   - Press arrow keys
   - Press Enter
   - **Important**: Keyboard input should work!

4. **If sandbox mode:**
   - Permission prompt should appear in xterm.js
   - Should be fully interactive
   - Configure and press Enter

5. **After selection:**
   - Terminal should transition to normal operation
   - You should see the shell prompt
   - Normal terminal functionality resumes

## Troubleshooting

### CLI: Permission prompt not interactive

**Symptom**: After selecting sandbox, the prompt "prints" but doesn't respond to keyboard

**Possible causes:**
1. stdin not properly cleaned up after Ink
2. Event listeners still attached
3. stdin not in raw mode

**Debug steps:**
```bash
# Add this to src/sandbox/prompt.ts after line 92 (setRawMode):
console.error('DEBUG: stdin.isRaw =', process.stdin.isRaw);
console.error('DEBUG: data listeners =', process.stdin.listenerCount('data'));
```

**Expected output:**
```
DEBUG: stdin.isRaw = true
DEBUG: data listeners = 1
```

**If stdin.isRaw = false:**
- The cleanup in mode-prompt.tsx may be preventing raw mode
- Try removing `process.stdin.pause()` from line 32

**If data listeners > 1:**
- Multiple listeners are attached
- Ink didn't clean up properly
- Try adding `process.stdin.removeAllListeners('data')` before `setRawMode(true)`

### Electron: Prompts not showing

**Symptom**: Window opens but no mode selector appears

**Check:**
1. Open DevTools (View → Toggle Developer Tools)
2. Look for terminal-mcp process logs in Console
3. Check if xterm.js is receiving data

**Debug steps:**
```typescript
// In packages/desktop-electron/src/renderer/Terminal.tsx
// Find where data is written to term.write(), add:
console.log('Writing to xterm:', data);
```

**If no data appears:**
- terminal-mcp process may have crashed
- Check main process logs
- Verify `--gui-mode` flag is passed

**If data appears but doesn't render:**
- xterm.js theme may hide ANSI colors
- Try with default theme first
- Check if Nerd Font is loaded

### Electron: Keyboard not working

**Symptom**: Can't interact with the prompt in Electron

**Check:**
1. Is xterm.js focused?
2. Are keyboard events being captured?
3. Is stdin receiving the input?

**Debug steps:**
```typescript
// In Terminal.tsx, add to onKey handler:
term.onKey((e) => {
  console.log('Key pressed:', e.key, 'Code:', e.key.charCodeAt(0));
  // ... existing code
});
```

**Expected:** You should see key presses logged

**If no logs:**
- xterm.js input is not focused
- Click in the terminal area first
- Check if any modal is blocking input

**If logs appear but prompt doesn't respond:**
- Keyboard events may not be reaching terminal-mcp stdin
- Check `handleInput` method in `terminal-bridge.ts`
- Verify stdio connection to terminal-mcp process

## Verification Checklist

### CLI
- [ ] Mode selector renders correctly
- [ ] Keyboard input (1/2/arrows) works
- [ ] Enter confirms selection
- [ ] Direct mode starts immediately
- [ ] Sandbox mode shows permission prompt
- [ ] Permission prompt is interactive
- [ ] Can navigate and configure permissions
- [ ] Sandbox shell starts after configuration
- [ ] Ctrl+C cancels gracefully

### Electron
- [ ] Window opens without modal
- [ ] Mode selector renders in xterm.js
- [ ] ANSI box drawing characters display correctly
- [ ] Colors render correctly (green/gray)
- [ ] Keyboard input works (1/2/arrows/Enter)
- [ ] Direct mode starts normally
- [ ] Sandbox permission prompt appears
- [ ] Permission prompt is interactive in GUI
- [ ] Terminal transitions to normal operation
- [ ] No console errors in DevTools

## Expected Behavior Differences

### CLI vs Electron
There should be **NO functional differences**:
- ✓ Same prompts
- ✓ Same keyboard shortcuts
- ✓ Same visual appearance (ANSI codes render identically)
- ✓ Same error handling

The **only** difference should be:
- CLI: Renders in your terminal emulator
- Electron: Renders in xterm.js embedded in Electron

## Success Indicators

✅ **Working correctly if:**
- Mode selector appears and is interactive
- Sandbox permission prompt appears and is interactive
- Both prompts look identical in CLI and Electron
- Keyboard navigation feels natural
- Terminal starts normally after selection

❌ **Not working if:**
- Prompts appear but don't respond to keyboard
- ANSI codes render as raw escape sequences
- Electron shows old React modal
- Terminal doesn't start after selection
- stdin/stdout seems frozen

## Performance Notes

The 50ms delay in `mode-prompt.tsx` is intentional:
```typescript
setTimeout(() => {
  if (selectedMode) {
    resolve(selectedMode);
  }
}, 50);
```

This ensures stdin is fully restored between Ink and the raw mode prompt.

**If you experience issues:**
- Try increasing to 100ms
- Try decreasing to 0ms (may cause race condition)
- Check if `process.stdin.pause()` helps or hurts

## Next Steps After Testing

### If Everything Works ✅
1. Delete old modal files
2. Clean up commented code
3. Remove unused IPC handlers
4. Commit changes

### If Issues Found ❌
1. Document the specific issue
2. Test with debug logging
3. Try the troubleshooting steps above
4. Adjust timing/cleanup as needed
5. Retest until working

## Getting Help

If you're stuck, check:
1. `INK_MODE_SELECTOR_IMPLEMENTATION.md` - Implementation details
2. `UNIFIED_MODE_SELECTOR_STATUS.md` - Current status and known issues
3. This file's troubleshooting section
4. Ink documentation: https://github.com/vadimdemedes/ink
5. xterm.js documentation: https://xtermjs.org/
