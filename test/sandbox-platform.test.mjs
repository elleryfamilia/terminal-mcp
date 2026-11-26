import { test } from "node:test";
import assert from "node:assert/strict";
import { SandboxController } from "../dist/sandbox/controller.js";

// These hold on windows-latest, which is where the Windows sandbox path is
// actually exercised. Nothing here needs a provisioned sandbox: the point is
// that the decision comes from the runtime instead of a platform allowlist.
const isWindows = process.platform === "win32";

test("reports the platform it is running on", () => {
  const controller = new SandboxController();
  assert.equal(controller.getPlatform(), process.platform);
  assert.ok(["darwin", "linux", "win32"].includes(controller.getPlatform()));
});

test("Windows is offered the sandbox instead of being refused", () => {
  // Regression: win32 was hardcoded to "Sandbox not available on Windows"
  // while sandbox-runtime supports an srt-win backend.
  if (!isWindows) return;
  assert.equal(new SandboxController().isSupported(), true);
});

test("the packaged srt-win binary is configured on Windows", { timeout: 120_000 }, async (t) => {
  // Regression: srt-win is never discovered on its own, so without
  // windows.srtWin.path the check fails with "no srt-win path configured" and
  // the sandbox can never start. Whatever is missing on this host, it must not
  // be that.
  if (!isWindows) return;
  const check = await new SandboxController().checkDependencies();
  t.diagnostic(`win32 after wiring the vendored binary: ${check.message ?? "supported"}`);
  assert.ok(
    !check.message?.includes("no srt-win path configured"),
    `windows.srtWin.path should point at the packaged binary, got: ${check.message}`
  );
});

test("dependency check resolves rather than throwing", { timeout: 120_000 }, async (t) => {
  const check = await new SandboxController().checkDependencies();
  // Recorded as a diagnostic so CI shows what each platform actually reports
  // instead of only asserting that it answered.
  t.diagnostic(`${process.platform}: supported=${check.supported} message=${check.message ?? "(none)"}`);

  assert.equal(typeof check.supported, "boolean");
  if (check.supported) {
    assert.equal(check.message, undefined);
  } else {
    assert.equal(typeof check.message, "string");
    assert.ok(check.message.length > 0, "an unsupported result must say what is missing");
    assert.ok(
      !check.message.includes("Sandbox not available on Windows"),
      "must not fall back to the old hardcoded platform refusal"
    );
  }
});

test(
  "missing Linux dependencies are named the way the docs describe them",
  { skip: isWindows ? "Linux only" : false, timeout: 120_000 },
  async () => {
    const check = await new SandboxController().checkDependencies();
    if (check.supported) return; // bwrap + socat + rg all present (dev machines)

    assert.match(
      check.message,
      /bwrap|bubblewrap|socat|ripgrep|\brg\b/,
      `expected a tool name from docs/sandbox.md, got: ${check.message}`
    );
  }
);

test("initialize() reports Windows prerequisites rather than a missing binary", { timeout: 180_000 }, async (t) => {
  // The pre-flight check above cannot see windows.srtWin.path, so this is the
  // one that proves the config is actually applied: initialize() runs with the
  // config in place, and on an unprovisioned runner must name the host
  // prerequisite it wants (sandbox user / WFP filters), not the binary.
  if (!isWindows) return;

  const controller = new SandboxController();
  const status = await controller.initialize({
    filesystem: { readWrite: ["."], readOnly: [], blocked: [] },
    network: { mode: "none" },
  });
  t.diagnostic(`win32 initialize(): enabled=${status.enabled} reason=${status.reason ?? "(none)"}`);

  if (!status.enabled) {
    assert.ok(status.reason && status.reason.length > 0, "a refusal must say why");
    assert.ok(
      !status.reason.includes("no srt-win path configured"),
      `windows.srtWin.path should be applied by initialize(), got: ${status.reason}`
    );
  }
  await controller.cleanup();
});

test("failed dependency checks come with instructions for this platform", () => {
  const instructions = new SandboxController().setupInstructions().join("\n");

  if (process.platform === "linux") {
    assert.match(instructions, /bubblewrap/);
    assert.match(instructions, /socat/);
  } else if (isWindows) {
    assert.match(instructions, /srt-win/);
    assert.match(instructions, /install/i);
  }
});

test("wrapping without initializing is refused", async () => {
  await assert.rejects(
    () => new SandboxController().wrapShellCommand("/bin/sh", ["-l"]),
    /not initialized/
  );
});

test("a controller that was never initialized reports itself inactive", async () => {
  const controller = new SandboxController();
  assert.equal(controller.isActive(), false);
  assert.equal(controller.getPermissions(), null);
  await controller.cleanup(); // must not throw
  assert.equal(controller.isActive(), false);
});
