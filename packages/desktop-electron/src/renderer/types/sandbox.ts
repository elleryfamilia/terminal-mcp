/**
 * Sandbox configuration types
 */

export interface SandboxConfig {
  filesystem: {
    readWrite: string[];
    readOnly: string[];
    blocked: string[];
  };
  network: {
    mode: 'all' | 'none' | 'allowlist';
    allowedDomains?: string[];
  };
}

export type FilesystemAccess = 'readWrite' | 'readOnly' | 'blocked';

export interface FilesystemPermission {
  path: string;
  access: FilesystemAccess;
}

/**
 * Default sandbox configuration matching CLI implementation
 */
export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  filesystem: {
    readWrite: [
      '.',  // Current directory
      '/tmp',
      '~/.cache',
      '~/.local',
      '~/.npm',
      '~/.yarn',
      '~/.pnpm',
      '~/.bun',
      '~/.zsh_history',
      '~/.bash_history',
      '~/.zhistory',
    ],
    readOnly: [
      '~',  // Home directory
    ],
    blocked: [
      '~/.ssh',
      '~/.aws',
      '~/.config/gcloud',
      '~/.azure',
      '~/.kube',
      '~/.gnupg',
      '~/.config/gh',
      '~/.npmrc',
      '~/.netrc',
      '~/.docker/config.json',
    ],
  },
  network: {
    mode: 'all',
  },
};
