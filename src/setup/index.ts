import { adapters, adaptersByName, ClientAdapter, InstallResult } from "./clients.js";

export interface SetupOptions {
  clients?: string[]; // explicit client names; undefined → all detected
  dryRun: boolean;
  uninstall: boolean;
}

function selectClients(opts: SetupOptions): { selected: ClientAdapter[]; unknown: string[] } {
  if (!opts.clients || opts.clients.length === 0) {
    return { selected: adapters.filter((a) => a.detect()), unknown: [] };
  }
  if (opts.clients.length === 1 && opts.clients[0] === "all") {
    return { selected: adapters.slice(), unknown: [] };
  }
  const selected: ClientAdapter[] = [];
  const unknown: string[] = [];
  for (const name of opts.clients) {
    const a = adaptersByName.get(name);
    if (a) selected.push(a);
    else unknown.push(name);
  }
  return { selected, unknown };
}

const STATUS_ICON: Record<InstallResult["status"], string> = {
  installed: "✓",
  updated: "✓",
  removed: "✓",
  "already-present": "·",
  "not-present": "·",
  "would-install": "→",
  "would-update": "→",
  "would-remove": "→",
  skipped: "·",
  error: "✗",
};

function printResult(r: InstallResult): void {
  const icon = STATUS_ICON[r.status];
  console.log(`${icon} ${r.label.padEnd(22)} ${r.status.padEnd(16)} ${r.configPath}`);
  if (r.detail && r.status !== "installed" && r.status !== "removed") {
    console.log(`  ${r.detail}`);
  }
  if (r.restartHint) {
    console.log(`  → ${r.restartHint}`);
  }
}

export async function runSetup(opts: SetupOptions): Promise<number> {
  const { selected, unknown } = selectClients(opts);

  if (unknown.length > 0) {
    console.error(`Unknown client(s): ${unknown.join(", ")}`);
    console.error(`Known: ${adapters.map((a) => a.name).join(", ")}, all`);
    return 1;
  }

  if (selected.length === 0) {
    console.log("No supported AI tools detected on this machine.");
    console.log(`To force a specific client, pass --client <name>. Known: ${adapters.map((a) => a.name).join(", ")}.`);
    return 0;
  }

  const action = opts.uninstall ? "Uninstalling from" : "Installing into";
  const mode = opts.dryRun ? " (dry run — no files will be modified)" : "";
  console.log(`${action} ${selected.length} tool${selected.length === 1 ? "" : "s"}${mode}:`);
  console.log();

  let exitCode = 0;
  for (const a of selected) {
    try {
      const r = opts.uninstall ? a.uninstall(opts.dryRun) : a.install(opts.dryRun);
      printResult(r);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      printResult({
        client: a.name,
        label: a.label,
        configPath: a.configPath(),
        status: "error",
        detail: message,
      });
      exitCode = 1;
    }
  }

  console.log();
  if (opts.dryRun) {
    console.log("Re-run without --dry-run to apply changes.");
  } else if (!opts.uninstall) {
    console.log(`MCP entry installed as "terminal-mcp" with command: terminal-mcp --headless`);
    console.log(`Make sure 'terminal-mcp' is on PATH (or use 'npm install -g @ellery/terminal-mcp').`);
  }

  return exitCode;
}
