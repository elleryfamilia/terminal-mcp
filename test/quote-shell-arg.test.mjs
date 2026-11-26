import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { quoteShellArg } from "../dist/sandbox/controller.js";

// The sandbox wraps a shell invocation by building a command line that is
// re-parsed by a shell, so a badly quoted argument is a command injection, not
// a cosmetic bug. Each case is round-tripped through /bin/sh to prove the shell
// hands back exactly the argument we put in.
const POSIX_CASES = [
  "/usr/bin/zsh",
  "-l",
  "/Users/me/My Shell/zsh",
  "it's",
  "-c",
  "a; rm -rf /",
  "`id`",
  "$HOME",
  "*.txt",
  "tab\there",
  "new\nline",
];

const isWindows = process.platform === "win32";

test(
  "quoted arguments survive a shell round trip unchanged",
  { skip: isWindows ? "POSIX quoting; see the Windows case below" : false },
  () => {
    for (const arg of POSIX_CASES) {
      const roundTripped = execFileSync("/bin/sh", ["-c", `printf %s ${quoteShellArg(arg)}`], {
        encoding: "utf8",
      });
      assert.equal(roundTripped, arg, `round trip changed ${JSON.stringify(arg)}`);
    }
  }
);

test(
  "quoting neutralises POSIX metacharacters",
  { skip: isWindows ? "POSIX quoting; see the Windows case below" : false },
  () => {
    for (const arg of ["a; rm -rf /", "`id`", "$HOME", "$(id)"]) {
      const quoted = quoteShellArg(arg);
      assert.ok(
        quoted.startsWith("'") && quoted.endsWith("'"),
        `${JSON.stringify(arg)} should be single-quoted, got ${quoted}`
      );
    }
  }
);

test(
  "Windows arguments get cmd.exe quoting rules",
  { skip: isWindows ? false : "Windows quoting" },
  () => {
    // Plain paths stay unquoted, so the common case reads normally.
    assert.equal(quoteShellArg("C:\\Windows\\System32\\cmd.exe"), "C:\\Windows\\System32\\cmd.exe");
    assert.equal(quoteShellArg("-l"), "-l");
    // Anything else is wrapped, and embedded quotes are doubled.
    assert.equal(quoteShellArg("C:\\Program Files\\Git\\bin\\bash.exe"), '"C:\\Program Files\\Git\\bin\\bash.exe"');
    assert.equal(quoteShellArg('a"b'), '"a""b"');
    assert.equal(quoteShellArg("a&calc"), '"a&calc"');
  }
);
