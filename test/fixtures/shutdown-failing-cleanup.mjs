// Fixture: install the stdio shutdown handlers with a cleanup that throws.
// The parent test asserts the failure is reported on stderr instead of
// being swallowed silently.
import { installStdioShutdownHandlers } from "../../dist/utils/shutdown.js";

installStdioShutdownHandlers({
  cleanup: () => {
    throw new Error("boom: cleanup exploded");
  },
});

process.stdin.resume();
process.stderr.write("READY\n");
