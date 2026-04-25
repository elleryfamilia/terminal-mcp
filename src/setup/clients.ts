import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import * as toml from "smol-toml";

const SERVER_NAME = "terminal-mcp";
const SERVER_COMMAND = "terminal-mcp";
const SERVER_ARGS = ["--headless"];

export interface InstallResult {
  client: string;
  label: string;
  configPath: string;
  status: "installed" | "updated" | "already-present" | "removed" | "not-present" | "would-install" | "would-update" | "would-remove" | "skipped" | "error";
  detail: string;
  restartHint?: string;
}

export interface ClientAdapter {
  name: string;
  label: string;
  detect(): boolean;
  configPath(): string;
  install(dryRun: boolean): InstallResult;
  uninstall(dryRun: boolean): InstallResult;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function existsOnPath(bin: string): boolean {
  try {
    const cmd = process.platform === "win32" ? `where ${bin}` : `command -v ${bin}`;
    execSync(cmd, { stdio: "ignore", shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh" });
    return true;
  } catch {
    return false;
  }
}

function dirExists(p: string): boolean {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function fileExists(p: string): boolean {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function readJson(p: string): Record<string, unknown> {
  if (!fileExists(p)) return {};
  const text = fs.readFileSync(p, "utf8");
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse ${p} as JSON: ${(err as Error).message}`);
  }
}

function writeJsonAtomic(p: string, data: unknown): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (fileExists(p)) fs.copyFileSync(p, `${p}.bak`);
  const tmp = `${p}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(tmp, p);
}

function readToml(p: string): Record<string, any> {
  if (!fileExists(p)) return {};
  const text = fs.readFileSync(p, "utf8");
  if (!text.trim()) return {};
  return toml.parse(text);
}

function writeTomlAtomic(p: string, data: Record<string, any>): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (fileExists(p)) fs.copyFileSync(p, `${p}.bak`);
  const tmp = `${p}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, toml.stringify(data));
  fs.renameSync(tmp, p);
}

function shallowEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Standard MCP server entry shape used by claude-code, claude-desktop, gemini, copilot.
function standardEntry(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { command: SERVER_COMMAND, args: [...SERVER_ARGS], ...extra };
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

const codex: ClientAdapter = {
  name: "codex",
  label: "OpenAI Codex CLI",
  configPath: () => path.join(os.homedir(), ".codex", "config.toml"),
  detect() {
    return dirExists(path.join(os.homedir(), ".codex")) || existsOnPath("codex");
  },
  install(dryRun) {
    const p = this.configPath();
    const config = readToml(p);
    const servers = (config.mcp_servers ?? {}) as Record<string, any>;
    const desired = { command: SERVER_COMMAND, args: [...SERVER_ARGS] };
    const existing = servers[SERVER_NAME];
    if (existing && shallowEqual({ command: existing.command, args: existing.args }, desired)) {
      return { client: this.name, label: this.label, configPath: p, status: "already-present", detail: "entry already matches" };
    }
    if (dryRun) {
      return { client: this.name, label: this.label, configPath: p, status: existing ? "would-update" : "would-install", detail: existing ? "would update existing entry" : "would add new entry" };
    }
    servers[SERVER_NAME] = desired;
    config.mcp_servers = servers;
    writeTomlAtomic(p, config);
    return { client: this.name, label: this.label, configPath: p, status: existing ? "updated" : "installed", detail: existing ? "updated existing entry" : "added new entry", restartHint: "restart codex to pick up the new server" };
  },
  uninstall(dryRun) {
    const p = this.configPath();
    const config = readToml(p);
    const servers = (config.mcp_servers ?? {}) as Record<string, any>;
    if (!servers[SERVER_NAME]) {
      return { client: this.name, label: this.label, configPath: p, status: "not-present", detail: "no entry to remove" };
    }
    if (dryRun) {
      return { client: this.name, label: this.label, configPath: p, status: "would-remove", detail: "would remove entry" };
    }
    delete servers[SERVER_NAME];
    config.mcp_servers = servers;
    writeTomlAtomic(p, config);
    return { client: this.name, label: this.label, configPath: p, status: "removed", detail: "entry removed", restartHint: "restart codex" };
  },
};

// Generic adapter for tools using { mcpServers: { <name>: { command, args, ... } } } JSON shape.
function makeMcpServersJsonAdapter(opts: {
  name: string;
  label: string;
  configPath: () => string;
  detect: () => boolean;
  entry?: Record<string, unknown>;
  restartHint?: string;
}): ClientAdapter {
  const desired = opts.entry ?? standardEntry();
  return {
    name: opts.name,
    label: opts.label,
    configPath: opts.configPath,
    detect: opts.detect,
    install(dryRun) {
      const p = opts.configPath();
      const config = readJson(p);
      const servers = ((config.mcpServers ?? {}) as Record<string, unknown>);
      const existing = servers[SERVER_NAME];
      if (existing && shallowEqual(existing, desired)) {
        return { client: opts.name, label: opts.label, configPath: p, status: "already-present", detail: "entry already matches" };
      }
      if (dryRun) {
        return { client: opts.name, label: opts.label, configPath: p, status: existing ? "would-update" : "would-install", detail: existing ? "would update existing entry" : "would add new entry" };
      }
      servers[SERVER_NAME] = desired;
      config.mcpServers = servers;
      writeJsonAtomic(p, config);
      return { client: opts.name, label: opts.label, configPath: p, status: existing ? "updated" : "installed", detail: existing ? "updated existing entry" : "added new entry", restartHint: opts.restartHint };
    },
    uninstall(dryRun) {
      const p = opts.configPath();
      const config = readJson(p);
      const servers = ((config.mcpServers ?? {}) as Record<string, unknown>);
      if (!servers[SERVER_NAME]) {
        return { client: opts.name, label: opts.label, configPath: p, status: "not-present", detail: "no entry to remove" };
      }
      if (dryRun) {
        return { client: opts.name, label: opts.label, configPath: p, status: "would-remove", detail: "would remove entry" };
      }
      delete servers[SERVER_NAME];
      config.mcpServers = servers;
      writeJsonAtomic(p, config);
      return { client: opts.name, label: opts.label, configPath: p, status: "removed", detail: "entry removed", restartHint: opts.restartHint };
    },
  };
}

const copilot = makeMcpServersJsonAdapter({
  name: "copilot",
  label: "GitHub Copilot CLI",
  configPath: () => path.join(process.env.COPILOT_HOME || path.join(os.homedir(), ".copilot"), "mcp-config.json"),
  detect: () =>
    dirExists(path.join(process.env.COPILOT_HOME || path.join(os.homedir(), ".copilot"))) ||
    existsOnPath("copilot"),
  entry: { type: "local", command: SERVER_COMMAND, args: [...SERVER_ARGS], tools: ["*"] },
  restartHint: "no restart needed; copilot picks up changes immediately",
});

const gemini = makeMcpServersJsonAdapter({
  name: "gemini",
  label: "Gemini CLI",
  configPath: () => path.join(os.homedir(), ".gemini", "settings.json"),
  detect: () => dirExists(path.join(os.homedir(), ".gemini")) || existsOnPath("gemini"),
  entry: { command: SERVER_COMMAND, args: [...SERVER_ARGS], timeout: 15000 },
  restartHint: "restart gemini to pick up the new server",
});

const claudeCode = makeMcpServersJsonAdapter({
  name: "claude-code",
  label: "Claude Code",
  // Use ~/.claude/settings.json (stable user file) rather than ~/.claude.json
  // (runtime-state file with OAuth tokens and session caches we shouldn't munge).
  configPath: () => path.join(os.homedir(), ".claude", "settings.json"),
  detect: () => dirExists(path.join(os.homedir(), ".claude")) || existsOnPath("claude"),
  restartHint: "starts on next claude session",
});

const claudeDesktop = makeMcpServersJsonAdapter({
  name: "claude-desktop",
  label: "Claude Desktop",
  configPath: () => {
    if (process.platform === "darwin") {
      return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
    }
    if (process.platform === "win32") {
      const appdata = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
      return path.join(appdata, "Claude", "claude_desktop_config.json");
    }
    // Linux is unofficial; community builds use ~/.config/Claude/
    return path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json");
  },
  detect() {
    // Claude Desktop has no first-party Linux build, so only auto-detect if
    // the config dir already exists. On macOS/Windows, also check for the dir.
    return dirExists(path.dirname(this.configPath()));
  },
  restartHint: "fully quit and relaunch Claude Desktop",
});

// OpenCode: top-level key is `mcp` (not mcpServers), command is a single
// array (not split command/args), env key is `environment`.
const opencode: ClientAdapter = {
  name: "opencode",
  label: "OpenCode",
  configPath: () => path.join(os.homedir(), ".config", "opencode", "opencode.json"),
  detect() {
    return dirExists(path.join(os.homedir(), ".config", "opencode")) || existsOnPath("opencode");
  },
  install(dryRun) {
    const p = this.configPath();
    const config = readJson(p);
    const mcp = ((config.mcp ?? {}) as Record<string, unknown>);
    const desired = {
      type: "local",
      command: [SERVER_COMMAND, ...SERVER_ARGS],
      enabled: true,
    };
    const existing = mcp[SERVER_NAME];
    if (existing && shallowEqual(existing, desired)) {
      return { client: this.name, label: this.label, configPath: p, status: "already-present", detail: "entry already matches" };
    }
    if (dryRun) {
      return { client: this.name, label: this.label, configPath: p, status: existing ? "would-update" : "would-install", detail: existing ? "would update existing entry" : "would add new entry" };
    }
    mcp[SERVER_NAME] = desired;
    config.mcp = mcp;
    if (!config.$schema) config.$schema = "https://opencode.ai/config.json";
    writeJsonAtomic(p, config);
    return { client: this.name, label: this.label, configPath: p, status: existing ? "updated" : "installed", detail: existing ? "updated existing entry" : "added new entry", restartHint: "no restart needed" };
  },
  uninstall(dryRun) {
    const p = this.configPath();
    const config = readJson(p);
    const mcp = ((config.mcp ?? {}) as Record<string, unknown>);
    if (!mcp[SERVER_NAME]) {
      return { client: this.name, label: this.label, configPath: p, status: "not-present", detail: "no entry to remove" };
    }
    if (dryRun) {
      return { client: this.name, label: this.label, configPath: p, status: "would-remove", detail: "would remove entry" };
    }
    delete mcp[SERVER_NAME];
    config.mcp = mcp;
    writeJsonAtomic(p, config);
    return { client: this.name, label: this.label, configPath: p, status: "removed", detail: "entry removed" };
  },
};

export const adapters: ClientAdapter[] = [
  codex,
  copilot,
  gemini,
  opencode,
  claudeCode,
  claudeDesktop,
];

export const adaptersByName = new Map(adapters.map((a) => [a.name, a]));
