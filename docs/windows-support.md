# Windows Support

This document describes the changes made to support Windows in terminal-mcp.

## Overview

Terminal-mcp now supports Windows with cmd.exe as the default shell. The following issues were addressed:

## Issues and Solutions

### 1. node-pty Package Compatibility

**Issue:** The original `node-pty-prebuilt-multiarch` package had build/compatibility issues on Windows, and later `@homebridge/node-pty-prebuilt-multiarch` added restrictive Node.js version caps.

**Solution:** Switched to Microsoft's official `node-pty` package which has no engine restrictions and works with newer Node.js versions.

```json
// package.json
"node-pty": "^1.2.0-beta.18"
```

This version includes prebuilt binaries for all platforms (Windows, macOS, Linux) on both x64 and arm64 architectures.

### 2. Socket Path for Windows

**Issue:** Unix sockets (`/tmp/terminal-mcp.sock`) don't work on Windows.

**Solution:** Use Windows named pipes instead. The `getDefaultSocketPath()` function in `src/utils/platform.ts` returns the appropriate path based on platform:

- **Unix/Mac:** `/tmp/terminal-mcp.sock`
- **Windows:** `\\.\pipe\terminal-mcp`

### 3. Default Shell Detection

**Issue:** Need to detect the correct default shell per platform.

**Solution:** The `getDefaultShell()` function in `src/utils/platform.ts` returns:

- **Unix/Mac:** `$SHELL` environment variable or `/bin/bash`
- **Windows:** `cmd.exe`

### 4. Startup Banner Getting Cleared

**Issue:** On Windows, the startup banner printed before the shell started would get cleared/overwritten when cmd.exe initialized.

**Solution:** Platform-specific banner display:

- **Unix/Mac:** Banner is printed via the shell's rc file (bashrc/zshrc) after shell initialization
- **Windows:** Banner is printed to stdout after detecting the first prompt (`⚡`) in the shell output, then sends `\r` (Enter) to get a fresh prompt

```typescript
// src/index.ts
if (isWindows && !bannerShown && data.includes("⚡")) {
  bannerShown = true;
  process.stdout.write("\n" + startupBanner + "\n");
  session.write("\r");  // Send Enter for fresh prompt
}
```

### 5. /info Command Not Working

**Issue:** The `/info` command detection relied on buffering stdin and checking for the command before passing to the shell. On Windows:
- Each character was immediately written to cmd.exe
- By the time Enter was pressed, `/info` was already sent to the shell
- cmd.exe would show: `'/info' is not recognized as an internal or external command`

**Solution:** Removed the `/info` command entirely. Instead:
- MCP configuration is now shown directly in the startup banner
- The banner includes the JSON config that users can copy/paste
- This approach is cleaner and works consistently across all platforms

### 6. Enter Key Handling

**Issue:** On Windows, the Enter key sends `\r` (carriage return), not `\n` (newline).

**Solution:** When triggering a fresh prompt after showing the banner on Windows, use `\r` instead of `\n`:

```typescript
session.write("\r");  // Not "\n"
```

### 7. Sandbox Mode

**Issue:** `--sandbox` used to be refused on Windows, and the wrapper ended in
`/bin/sh -c <command>`, which does not exist there.

**Solution:** `SandboxController` now asks `sandbox-runtime` for the
requirements of the current platform (`checkDependenciesAsync`) instead of
assuming Linux, and wraps to an **argv array** on Windows via
`wrapWithSandboxArgv`, which must be spawned without a shell — a shell in
between would re-expand the command and defeat the sandbox. macOS/Linux keep
the string form run through `/bin/sh -c`.

srt-win is never discovered on its own — the runtime only reads
`windows.srtWin.path` — so the config now names the packaged
`vendor/srt-win/<arch>/srt-win.exe` (`VENDORED_SRT_WIN_EXE`). Without that, the
check failed with "no srt-win path configured" however well the backend was
installed; the windows-latest CI job is what caught it.

The command line is parsed by `cmd.exe /d /s /c` (the runtime's default inner
shell) rather than by the user's shell, because `quoteShellArg` emits cmd rules.
Pointing the wrapper at `pwsh`/`bash` instead would have it parse a cmd-quoted
executable path, where a quoted path is a string expression and never a command.

Known gaps in a sandboxed Windows session, both from the runtime's design of
running the child as a separate `srt-sandbox` user:

- The child starts from that user's fresh profile and receives only the
  `--env` overlay the runtime builds (PATH, proxy, git config). Our prompt
  customisation (`PROMPT` for cmd.exe, the `TERMINAL_MCP_*` banner variables)
  does not reach it, so the sandboxed shell shows its default prompt.
- Read-only paths are granted explicitly via `filesystem.allowRead`, since the
  sandbox user does not inherit the caller's read access. The profile root
  (`~`) is deliberately *not* granted: the one-time install already grants the
  profile minus its exclusions, and a session grant that reached an exclusion
  is refused at `initialize()`.
- Because the child keeps that user's default prompt, the `⚡` marker the
  startup banner waits for never appears, so a sandboxed Windows session does
  not print the banner or its socket path.
- A `--shell` path containing a `%NAME%` segment is refused: `cmd.exe` expands
  it even inside quotes, which would launch a different executable.

On Windows the `srt-win` backend also needs its one-time setup (sandbox user and
network filters). Until that is done, `--sandbox` prints what is missing —
including the install command — and exits rather than starting an unconfined
shell; it no longer silently falls back to an unsandboxed session.

Because the runtime only reads `windows.srtWin.path` from configuration it has
already been given, the pre-flight check cannot see it: on Windows the
pre-flight verifies the packaged binary, and `initialize()` (which runs with the
config applied) reports the host prerequisites.

## Platform-Specific Code Paths

### Shell Prompt Setup (`src/terminal/session.ts`)

| Shell | Setup Method |
|-------|-------------|
| bash/sh | Temp rcfile with `--rcfile` flag, includes banner via `printf` |
| zsh | Temp ZDOTDIR with `.zshrc`, includes banner via `printf` |
| PowerShell | `-NoLogo` flag, env var for prompt |
| cmd.exe | `PROMPT` env var set to `⚡ $P$G` |

### Banner Display (`src/index.ts`)

| Platform | Method |
|----------|--------|
| Unix/Mac | Printed via shell rc file during shell startup |
| Windows | Printed to stdout after first prompt appears |

## Testing Checklist

When testing Windows support, verify:

- [ ] `terminal-mcp` starts without errors
- [ ] Startup banner displays correctly and doesn't get cleared
- [ ] MCP configuration JSON is visible and copyable
- [ ] Fresh prompt appears after banner
- [ ] MCP tools work: `takeScreenshot`, `type`, `sendKey`, `getContent`
- [ ] Special keys work (Enter, Ctrl+C, arrows, etc.)
- [ ] Terminal resize works
- [ ] `--sandbox` reports missing `srt-win` prerequisites (rather than claiming
      Windows is unsupported), and starts a sandboxed shell once they are set up
- [ ] Clean exit on shell close
