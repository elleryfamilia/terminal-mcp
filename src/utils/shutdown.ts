export interface ShutdownOptions {
  /**
   * Release anything the OS will NOT reclaim on exit — above all the PTY shell,
   * a separate process that outlives us. Do the synchronous, must-happen work
   * (dispose the PTY) FIRST and return any async tail as a promise: on the
   * process 'exit' path only the synchronous prefix can run.
   */
  cleanup: () => void | Promise<void>;
}

const CLEANUP_TIMEOUT_MS = 2000;

/**
 * Wire up shutdown for a stdio MCP server: SIGINT/SIGTERM/SIGHUP, stdin
 * end/close, and a synchronous-only last resort on process 'exit'.
 *
 * An MCP client signals shutdown by closing stdin, but StdioServerTransport
 * only listens for 'data'/'error', so EOF alone does nothing. Signals don't
 * help either: clients spawn us via npx (`npm exec` -> `sh -c` -> `node`), so a
 * SIGTERM hits `npm exec`, not us. Without this, the PTY fd (headless) or Unix
 * socket (client mode) keeps the event loop alive and the process is orphaned.
 *
 * NOT for interactive mode: there stdin is a TTY that never EOFs and SIGINT
 * must reach the shell as ^C (see src/index.ts). Hence "Stdio" in the name.
 */
export function installStdioShutdownHandlers({ cleanup }: ShutdownOptions): {
  isShuttingDown: () => boolean;
} {
  let shuttingDown = false;

  const shutdown = (code = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;

    // A hung cleanup must never resurrect the orphan this module exists to kill.
    const hardExit = setTimeout(() => process.exit(code), CLEANUP_TIMEOUT_MS);
    hardExit.unref();

    // A response may still be sitting in stdout's buffer (the client can close
    // our stdin and then read stdout to EOF); exiting immediately would
    // truncate it. An empty write's callback fires only after everything
    // queued before it has been flushed. The hard-exit timer above still
    // bounds a client that never drains the pipe.
    const exitAfterStdoutDrain = () => {
      process.stdout.write("", () => process.exit(code));
    };

    Promise.resolve()
      .then(cleanup)
      .catch((err) => {
        // stderr is safe in stdio MCP mode; a stranded recording or failed
        // teardown must not vanish without a trace.
        console.error("[terminal-mcp] Shutdown cleanup failed:", err);
      })
      .finally(exitAfterStdoutDrain);
  };

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
  process.on("SIGHUP", () => shutdown(0));

  process.stdin.on("end", () => shutdown(0));
  process.stdin.on("close", () => shutdown(0));

  // Last resort for exits that skip the handlers above (uncaughtException,
  // main().catch(), process.exit() elsewhere). Only cleanup's synchronous
  // prefix runs here — that is why manager.dispose() must stay synchronous.
  process.on("exit", () => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      void Promise.resolve(cleanup()).catch(() => {});
    } catch {
      // Ignore.
    }
  });

  return { isShuttingDown: () => shuttingDown };
}
