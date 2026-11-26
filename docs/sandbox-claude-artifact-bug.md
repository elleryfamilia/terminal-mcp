# Sandbox .claude Artifact Bug

## Issue Summary

On Linux, running terminal-mcp with `--sandbox` fails on the second invocation with:

```
bwrap: Can't mkdir parents for /path/to/.claude/commands: Not a directory
```

## Root Cause

The `@anthropic-ai/sandbox-runtime` package has a bug in how it handles the `.claude` directory protection:

1. **First run** (no `.claude` exists):
   - sandbox-runtime binds `/dev/null` to `.claude` to block it
   - Child paths `.claude/commands` and `.claude/agents` are skipped (they don't exist)
   - After sandbox exits, `.claude` remains as a **0-byte file** (artifact from the `/dev/null` bind)

2. **Second run** (`.claude` exists as 0-byte file):
   - sandbox-runtime skips `.claude` itself (it already exists)
   - sandbox-runtime tries to bind `/dev/null` to `.claude/commands` and `.claude/agents`
   - bwrap fails because `.claude` is a **file**, not a directory - you can't create subdirectories inside a file

## Debug Output

With `DEBUG_SANDBOX=1`, you can see the difference:

**First run** (works):
```
--ro-bind /dev/null /path/.claude --ro-bind /dev/null /path/.claude
```
Note: Binds `.claude` twice, skips child paths since they don't exist.

**Second run** (fails):
```
--ro-bind /dev/null /path/.claude/commands --ro-bind /dev/null /path/.claude/agents
```
Note: Skips `.claude` (exists), tries to bind child paths which fails.

## Workaround (Implemented)

In `src/sandbox/controller.ts`, we added `cleanupSandboxArtifacts()`:

```typescript
cleanupSandboxArtifacts(): void {
  const claudePath = path.join(process.cwd(), ".claude");
  try {
    const stat = fs.statSync(claudePath);
    // If .claude is a file (not directory) and 0 bytes, it's a sandbox artifact
    if (stat.isFile() && stat.size === 0) {
      fs.unlinkSync(claudePath);
    }
  } catch {
    // File doesn't exist or can't be accessed - that's fine
  }
}
```

This is called in `initialize()` before setting up the sandbox.

## Proper Fix (for sandbox-runtime)

The fix should be in `@anthropic-ai/sandbox-runtime`. Options include:

1. **Don't leave artifacts**: Ensure bwrap mounts don't persist after sandbox exits
2. **Handle file vs directory**: Check if parent path is a file and handle appropriately
3. **Skip child paths when parent is blocked**: If `.claude` is being blocked, don't also try to block `.claude/commands` separately

## Related Links

- sandbox-runtime repo: https://github.com/anthropics/sandbox-runtime (private)
- PR #91 in sandbox-runtime: "Fix non-existent deny paths" - partially addresses this but doesn't handle the case where `.claude` exists as a file
- Dangerous directories defined in `sandbox-runtime/src/sandbox/sandbox-utils.ts`:
  ```typescript
  export function getDangerousDirectories(): string[] {
    return [
      ...DANGEROUS_DIRECTORIES.filter(d => d !== '.git'),
      '.claude/commands',
      '.claude/agents',
    ]
  }
  ```

## Testing

To reproduce:

```bash
# On Linux with bwrap and socat installed
cd /path/to/terminal-mcp

# Clean state
rm -f .claude

# First run (works)
npm run dev -- --sandbox
# Exit with Ctrl+C

# Check artifact
ls -la .claude
# Shows: -r--r--r-- 1 root root 0 .claude (0-byte file)

# Second run (fails without workaround)
npm run dev -- --sandbox
# Error: bwrap: Can't mkdir parents for .claude/commands: Not a directory
```

## Status

- **Upstream fix**: `sandbox-runtime` 0.0.83 (the version this project now
  depends on) no longer leaves the artifact behind on a normal exit. It decides
  the mount-point kind before bwrap runs — a directory when a deny path sits
  beneath, so `.claude` no longer becomes an unreadable file — and `reset()`
  removes any mount points it created.
- **Workaround**: Still present (`SandboxController.cleanupSandboxArtifacts`,
  originally commit 7d462ac) as a safety net, because `reset()` never runs if
  the process is killed with SIGKILL. It only unlinks a 0-byte `.claude` file.
- **Affected platforms**: Linux only (uses bwrap)

This document is history: the reproduction steps below describe the pre-0.0.83
behaviour and may not fail on current versions.
