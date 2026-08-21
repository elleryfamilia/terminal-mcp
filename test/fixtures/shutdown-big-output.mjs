// Fixture: install the stdio shutdown handlers, then queue a large stdout
// write. The parent test closes our stdin while the write is still buffered
// and asserts every byte still arrives before we exit.
import { installStdioShutdownHandlers } from "../../dist/utils/shutdown.js";

installStdioShutdownHandlers({ cleanup: () => {} });

// The real server's MCP transport resumes stdin; do the same so 'end' fires.
process.stdin.resume();

const chunk = Buffer.alloc(5 * 1024 * 1024, 0x61); // 5MB of 'a'
process.stdout.write(chunk);
process.stderr.write("READY\n");
