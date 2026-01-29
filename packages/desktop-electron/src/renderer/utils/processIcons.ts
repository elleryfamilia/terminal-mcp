/**
 * Process Icons
 *
 * Nerd Font icons for common shells and processes.
 * These icons require a Nerd Font to be installed/loaded.
 */

// Map of process names to their Nerd Font icons
const PROCESS_ICONS: Record<string, string> = {
  // Shells
  bash: "\ue795", //
  zsh: "\ue795", //
  fish: "\udb81\ude3a", // 󰈺
  sh: "\ue795", //
  dash: "\ue795", //
  ksh: "\ue795", //
  tcsh: "\ue795", //
  csh: "\ue795", //
  pwsh: "\uebc7", //
  powershell: "\uebc7", //

  // Programming languages / runtimes
  python: "\ue73c", //
  python3: "\ue73c", //
  node: "\ue718", //
  deno: "\ue628", //
  bun: "\ue76d", //
  ruby: "\ue791", //
  irb: "\ue791", //
  perl: "\ue769", //
  php: "\ue73d", //
  lua: "\ue620", //
  java: "\ue738", //
  kotlin: "\ue634", //
  scala: "\ue737", //
  go: "\ue627", //
  rust: "\ue7a8", //
  cargo: "\ue7a8", //
  swift: "\ue755", //
  elixir: "\ue62d", //
  erl: "\ue7b1", //
  ghci: "\ue777", //
  julia: "\ue624", //
  r: "\ue68a", //
  clj: "\ue76a", //

  // Tools
  vim: "\ue62b", //
  nvim: "\ue62b", //
  neovim: "\ue62b", //
  nano: "\uf40d", //
  emacs: "\ue632", //
  code: "\ue70c", //
  git: "\ue702", //
  ssh: "\udb80\udce0", // 󰣀
  docker: "\ue7b0", //
  kubectl: "\udb84\udf36", // 󱎶
  helm: "\udb84\udfc5", // 󱟅
  make: "\ue673", //
  cmake: "\ue673", //
  npm: "\ue71e", //
  yarn: "\ue6a7", //
  pnpm: "\ue71e", //
  pip: "\ue73c", //
  brew: "\uf1b2", //
  apt: "\uf306", //

  // System tools
  htop: "\uf0e4", //
  top: "\uf0e4", //
  btop: "\uf0e4", //
  man: "\uf02d", //
  less: "\uf02d", //
  cat: "\uf02d", //
  tail: "\uf02d", //
  grep: "\uf002", //
  find: "\uf002", //
  fzf: "\uf002", //
  tmux: "\uebc8", //
  screen: "\uebc8", //
  curl: "\uf0ac", //
  wget: "\uf0ac", //

  // Databases
  mysql: "\ue704", //
  psql: "\ue76e", //
  postgres: "\ue76e", //
  redis: "\ue76d", //
  mongo: "\ue7a4", //
  sqlite3: "\ue7c4", //
};

// Default icon for unknown processes
const DEFAULT_ICON = "\ue795"; //

/**
 * Get the Nerd Font icon for a process name
 */
export function getProcessIcon(processName: string): string {
  if (!processName) return DEFAULT_ICON;

  // Normalize: lowercase and remove path/extension
  const normalized = processName
    .toLowerCase()
    .replace(/^.*[/\\]/, "") // Remove path
    .replace(/\.(exe|sh|py|rb|js)$/, ""); // Remove common extensions

  return PROCESS_ICONS[normalized] || DEFAULT_ICON;
}

/**
 * Get a display name for a process (capitalize first letter)
 */
export function getProcessDisplayName(processName: string): string {
  if (!processName) return "shell";

  // Remove path and extension
  const name = processName
    .replace(/^.*[/\\]/, "")
    .replace(/\.(exe|sh|py|rb|js)$/, "");

  // Special cases for display names
  const displayNames: Record<string, string> = {
    zsh: "zsh",
    bash: "bash",
    fish: "fish",
    sh: "sh",
    pwsh: "PowerShell",
    python: "Python",
    python3: "Python",
    node: "Node.js",
    nvim: "Neovim",
    vim: "Vim",
  };

  return displayNames[name.toLowerCase()] || name;
}
