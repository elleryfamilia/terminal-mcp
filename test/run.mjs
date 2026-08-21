// Runs every *.test.mjs in this directory via node:test.
//
// Not a glob in the npm script: quoted globs need Node 21+'s own expansion,
// unquoted ones need a POSIX shell (so they break on Windows), and bare
// `node --test` scans far more of the tree than we want. Listing the files
// explicitly works the same way everywhere.
import { readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(testDir)
  .filter((f) => f.endsWith(".test.mjs"))
  .sort()
  .map((f) => path.join("test", f));

if (files.length === 0) {
  console.error("No test files found in test/");
  process.exit(1);
}

const child = spawn(process.execPath, ["--test", ...files], { stdio: "inherit" });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
