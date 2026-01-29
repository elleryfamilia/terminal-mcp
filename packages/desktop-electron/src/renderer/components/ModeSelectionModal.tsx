import React, { useState, useEffect, useRef } from 'react';
import type { SandboxConfig, FilesystemAccess } from '../types/sandbox';

interface ModeSelectionModalProps {
  isOpen: boolean;
  onModeSelected: (mode: 'direct' | 'sandbox', config?: SandboxConfig) => void;
}

// Single path permission
interface PathPermission {
  path: string;
  access: FilesystemAccess;
}

// Permission item - either a single path or an expandable group
interface PermissionGroup {
  id: string;
  type: 'single' | 'group';
  label: string;
  paths: PathPermission[];
  expanded?: boolean;
}

// Default permission groups and individual items
const getDefaultPermissions = (): PermissionGroup[] => [
  { id: 'cwd', type: 'single', label: '(current directory)', paths: [{ path: '.', access: 'readWrite' }] },
  { id: 'tmp', type: 'single', label: '/tmp', paths: [{ path: '/tmp', access: 'readWrite' }] },
  { id: 'home', type: 'single', label: '~ (home directory)', paths: [{ path: '~', access: 'readOnly' }] },
  {
    id: 'shell',
    type: 'group',
    label: 'Shell & History',
    expanded: false,
    paths: [
      { path: '~/.zsh_history', access: 'readWrite' },
      { path: '~/.bash_history', access: 'readWrite' },
      { path: '~/.zhistory', access: 'readWrite' },
      { path: '~/.zsh_sessions', access: 'readWrite' },
      { path: '~/.zcompdump', access: 'readWrite' },
      { path: '~/.zcompdump-*', access: 'readWrite' },
      { path: '~/.node_repl_history', access: 'readWrite' },
      { path: '~/.python_history', access: 'readWrite' },
    ]
  },
  {
    id: 'cache',
    type: 'group',
    label: 'Cache & Build',
    expanded: false,
    paths: [
      { path: '~/.cache', access: 'readWrite' },
      { path: '~/.local', access: 'readWrite' },
      { path: '~/.npm', access: 'readWrite' },
      { path: '~/.yarn', access: 'readWrite' },
      { path: '~/.pnpm', access: 'readWrite' },
      { path: '~/.bun', access: 'readWrite' },
    ]
  },
  {
    id: 'creds',
    type: 'group',
    label: 'Credentials',
    expanded: false,
    paths: [
      { path: '~/.ssh', access: 'blocked' },
      { path: '~/.aws', access: 'blocked' },
      { path: '~/.config/gcloud', access: 'blocked' },
      { path: '~/.azure', access: 'blocked' },
      { path: '~/.kube', access: 'blocked' },
      { path: '~/.gnupg', access: 'blocked' },
      { path: '~/.config/gh', access: 'blocked' },
      { path: '~/.npmrc', access: 'blocked' },
      { path: '~/.netrc', access: 'blocked' },
      { path: '~/.docker/config.json', access: 'blocked' },
    ]
  },
];

// Navigation target - can be a group header or a path within a group
type NavTarget =
  | { section: 'mode'; index: number }
  | { section: 'permission'; groupIndex: number; pathIndex?: number }
  | { section: 'network'; index: number };

export const ModeSelectionModal: React.FC<ModeSelectionModalProps> = ({
  isOpen,
  onModeSelected,
}) => {
  const [selectedMode, setSelectedMode] = useState<'direct' | 'sandbox'>('direct');
  const [permissions, setPermissions] = useState<PermissionGroup[]>(getDefaultPermissions());
  const [networkMode, setNetworkMode] = useState<'all' | 'none' | 'allowlist'>('all');
  const [allowedDomains, setAllowedDomains] = useState<string>('');
  const [newPath, setNewPath] = useState<string>('');
  const [showPlatformWarning] = useState(navigator.platform.toLowerCase().includes('win'));

  // Navigation state
  const [navTarget, setNavTarget] = useState<NavTarget>({ section: 'mode', index: 0 });

  const itemRefs = useRef<Map<string, HTMLDivElement | HTMLLabelElement | null>>(new Map());

  // Build flat list of navigable items
  const getNavItems = (): NavTarget[] => {
    const items: NavTarget[] = [
      { section: 'mode', index: 0 },
      { section: 'mode', index: 1 },
    ];

    if (selectedMode === 'sandbox') {
      permissions.forEach((group, groupIndex) => {
        // Group header (or single item)
        items.push({ section: 'permission', groupIndex });
        // If group is expanded, add child paths
        if (group.type === 'group' && group.expanded) {
          group.paths.forEach((_, pathIndex) => {
            items.push({ section: 'permission', groupIndex, pathIndex });
          });
        }
      });

      // Network options
      items.push({ section: 'network', index: 0 });
      items.push({ section: 'network', index: 1 });
      items.push({ section: 'network', index: 2 });
    }

    return items;
  };

  const navItems = getNavItems();
  const currentNavIndex = navItems.findIndex(item =>
    item.section === navTarget.section &&
    (item.section === 'mode' ? item.index === navTarget.index :
     item.section === 'network' ? item.index === navTarget.index :
     item.groupIndex === (navTarget as any).groupIndex && item.pathIndex === (navTarget as any).pathIndex)
  );

  const getRefKey = (target: NavTarget): string => {
    if (target.section === 'mode') return `mode-${target.index}`;
    if (target.section === 'network') return `network-${target.index}`;
    if (target.pathIndex !== undefined) return `perm-${target.groupIndex}-${target.pathIndex}`;
    return `perm-${target.groupIndex}`;
  };

  const scrollToTarget = (target: NavTarget) => {
    const key = getRefKey(target);
    const el = itemRefs.current.get(key);
    el?.scrollIntoView({ block: 'nearest' });
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter - continue
      if (e.key === 'Enter') {
        e.preventDefault();
        handleContinue();
        return;
      }

      // Number keys for mode selection
      if (e.key === '1') {
        e.preventDefault();
        setSelectedMode('direct');
        setNavTarget({ section: 'mode', index: 0 });
        return;
      }
      if (e.key === '2') {
        e.preventDefault();
        setSelectedMode('sandbox');
        setNavTarget({ section: 'mode', index: 1 });
        return;
      }

      // Arrow up
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentNavIndex > 0) {
          const newTarget = navItems[currentNavIndex - 1];
          setNavTarget(newTarget);
          if (newTarget.section === 'mode') {
            setSelectedMode(newTarget.index === 0 ? 'direct' : 'sandbox');
          }
          scrollToTarget(newTarget);
        }
        return;
      }

      // Arrow down
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentNavIndex < navItems.length - 1) {
          const newTarget = navItems[currentNavIndex + 1];
          setNavTarget(newTarget);
          if (newTarget.section === 'mode') {
            setSelectedMode(newTarget.index === 0 ? 'direct' : 'sandbox');
          }
          scrollToTarget(newTarget);
        }
        return;
      }

      // Arrow right - expand group
      if (e.key === 'ArrowRight' && navTarget.section === 'permission') {
        e.preventDefault();
        const group = permissions[navTarget.groupIndex];
        if (group.type === 'group' && !group.expanded) {
          toggleExpand(navTarget.groupIndex);
        }
        return;
      }

      // Arrow left - collapse group or go to parent
      if (e.key === 'ArrowLeft' && navTarget.section === 'permission') {
        e.preventDefault();
        const target = navTarget as { section: 'permission'; groupIndex: number; pathIndex?: number };
        if (target.pathIndex !== undefined) {
          // Go to parent group
          setNavTarget({ section: 'permission', groupIndex: target.groupIndex });
        } else {
          // Collapse group
          const group = permissions[target.groupIndex];
          if (group.type === 'group' && group.expanded) {
            toggleExpand(target.groupIndex);
          }
        }
        return;
      }

      // Space to toggle
      if (e.key === ' ') {
        e.preventDefault();
        if (navTarget.section === 'permission') {
          const target = navTarget as { section: 'permission'; groupIndex: number; pathIndex?: number };
          if (target.pathIndex !== undefined) {
            cyclePathAccess(target.groupIndex, target.pathIndex);
          } else {
            const group = permissions[target.groupIndex];
            if (group.type === 'group') {
              // Toggle expand/collapse
              toggleExpand(target.groupIndex);
            } else {
              // Cycle access for single item
              cycleGroupAccess(target.groupIndex);
            }
          }
        } else if (navTarget.section === 'network') {
          const modes: ('all' | 'none' | 'allowlist')[] = ['all', 'none', 'allowlist'];
          setNetworkMode(modes[navTarget.index]);
        }
        return;
      }

      // Tab to cycle access on groups/paths
      if (e.key === 'Tab' && navTarget.section === 'permission') {
        e.preventDefault();
        const target = navTarget as { section: 'permission'; groupIndex: number; pathIndex?: number };
        if (target.pathIndex !== undefined) {
          cyclePathAccess(target.groupIndex, target.pathIndex);
        } else {
          cycleGroupAccess(target.groupIndex);
        }
        return;
      }

      // Delete/Backspace to remove
      if ((e.key === 'Delete' || e.key === 'Backspace') && navTarget.section === 'permission') {
        e.preventDefault();
        const target = navTarget as { section: 'permission'; groupIndex: number; pathIndex?: number };
        if (target.pathIndex !== undefined) {
          removePathFromGroup(target.groupIndex, target.pathIndex);
        } else {
          removeGroup(target.groupIndex);
        }
        return;
      }

      // Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        setNavTarget({ section: 'mode', index: selectedMode === 'direct' ? 0 : 1 });
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedMode, navTarget, permissions, currentNavIndex]);

  if (!isOpen) return null;

  const toggleExpand = (groupIndex: number) => {
    setPermissions(prev => prev.map((g, i) =>
      i === groupIndex ? { ...g, expanded: !g.expanded } : g
    ));
  };

  const cycleGroupAccess = (groupIndex: number) => {
    const cycle: FilesystemAccess[] = ['readWrite', 'readOnly', 'blocked'];
    setPermissions(prev => prev.map((g, i) => {
      if (i !== groupIndex) return g;
      const currentAccess = g.paths[0]?.access || 'readWrite';
      const nextAccess = cycle[(cycle.indexOf(currentAccess) + 1) % cycle.length];
      return {
        ...g,
        paths: g.paths.map(p => ({ ...p, access: nextAccess }))
      };
    }));
  };

  const cyclePathAccess = (groupIndex: number, pathIndex: number) => {
    const cycle: FilesystemAccess[] = ['readWrite', 'readOnly', 'blocked'];
    setPermissions(prev => prev.map((g, gi) => {
      if (gi !== groupIndex) return g;
      return {
        ...g,
        paths: g.paths.map((p, pi) => {
          if (pi !== pathIndex) return p;
          return { ...p, access: cycle[(cycle.indexOf(p.access) + 1) % cycle.length] };
        })
      };
    }));
  };

  const removeGroup = (groupIndex: number) => {
    setPermissions(prev => prev.filter((_, i) => i !== groupIndex));
    // Adjust nav target
    if (permissions.length > 1) {
      const newGroupIndex = Math.min(groupIndex, permissions.length - 2);
      setNavTarget({ section: 'permission', groupIndex: newGroupIndex });
    } else {
      setNavTarget({ section: 'mode', index: 1 });
    }
  };

  const removePathFromGroup = (groupIndex: number, pathIndex: number) => {
    setPermissions(prev => prev.map((g, gi) => {
      if (gi !== groupIndex) return g;
      const newPaths = g.paths.filter((_, pi) => pi !== pathIndex);
      return { ...g, paths: newPaths };
    }).filter(g => g.paths.length > 0));

    // Adjust nav target
    const group = permissions[groupIndex];
    if (group.paths.length > 1) {
      const newPathIndex = Math.min(pathIndex, group.paths.length - 2);
      setNavTarget({ section: 'permission', groupIndex, pathIndex: newPathIndex });
    } else {
      setNavTarget({ section: 'permission', groupIndex });
    }
  };

  const handleContinue = () => {
    if (selectedMode === 'sandbox') {
      const readWrite: string[] = [];
      const readOnly: string[] = [];
      const blocked: string[] = [];

      permissions.forEach(group => {
        group.paths.forEach(p => {
          const targetArray = p.access === 'readWrite' ? readWrite
            : p.access === 'readOnly' ? readOnly
            : blocked;
          targetArray.push(p.path);
        });
      });

      const config: SandboxConfig = {
        filesystem: { readWrite, readOnly, blocked },
        network: {
          mode: networkMode,
          ...(networkMode === 'allowlist' && allowedDomains.trim() && {
            allowedDomains: allowedDomains.split(',').map(d => d.trim()).filter(Boolean),
          }),
        },
      };
      onModeSelected('sandbox', config);
    } else {
      onModeSelected('direct');
    }
  };

  const getAccessLabel = (access: FilesystemAccess): string => {
    switch (access) {
      case 'readWrite': return 'read/write';
      case 'readOnly': return 'read only';
      case 'blocked': return 'blocked';
    }
  };

  const getAccessColor = (access: FilesystemAccess): string => {
    switch (access) {
      case 'readWrite': return 'tui-access-readwrite';
      case 'readOnly': return 'tui-access-readonly';
      case 'blocked': return 'tui-access-blocked';
    }
  };

  const getGroupAccessSummary = (group: PermissionGroup): { access: FilesystemAccess | 'mixed'; label: string } => {
    const accesses = new Set(group.paths.map(p => p.access));
    if (accesses.size === 1) {
      const access = group.paths[0].access;
      return { access, label: getAccessLabel(access) };
    }
    return { access: 'mixed', label: 'mixed' };
  };

  const handleAddPath = () => {
    if (!newPath.trim()) return;
    setPermissions([...permissions, {
      id: `custom-${Date.now()}`,
      type: 'single',
      label: newPath.trim(),
      paths: [{ path: newPath.trim(), access: 'readWrite' }]
    }]);
    setNewPath('');
  };

  const isTargetMatch = (target: NavTarget, groupIndex: number, pathIndex?: number): boolean => {
    if (target.section !== 'permission') return false;
    const t = target as { section: 'permission'; groupIndex: number; pathIndex?: number };
    return t.groupIndex === groupIndex && t.pathIndex === pathIndex;
  };

  return (
    <div className="mode-modal-overlay">
      <div className="tui-mode-dialog">
        <div className="tui-mode-content">
          <button
            ref={el => itemRefs.current.set('mode-0', el)}
            className={`tui-mode-option ${selectedMode === 'direct' ? 'tui-mode-selected' : ''} ${navTarget.section === 'mode' && navTarget.index === 0 ? 'tui-mode-focused' : ''}`}
            onClick={() => { setSelectedMode('direct'); setNavTarget({ section: 'mode', index: 0 }); }}
          >
            <span className="tui-mode-indicator">{selectedMode === 'direct' ? '●' : '○'}</span>
            <div className="tui-mode-info">
              <span className="tui-mode-name">Standard</span>
              <span className="tui-mode-desc">full access to resources</span>
            </div>
          </button>

          <button
            ref={el => itemRefs.current.set('mode-1', el)}
            className={`tui-mode-option ${selectedMode === 'sandbox' ? 'tui-mode-selected' : ''} ${navTarget.section === 'mode' && navTarget.index === 1 ? 'tui-mode-focused' : ''}`}
            onClick={() => { setSelectedMode('sandbox'); setNavTarget({ section: 'mode', index: 1 }); }}
          >
            <span className="tui-mode-indicator">{selectedMode === 'sandbox' ? '●' : '○'}</span>
            <div className="tui-mode-info">
              <span className="tui-mode-name">Sandboxed</span>
              <span className="tui-mode-desc">restricted access with controls</span>
            </div>
          </button>

          <div className={`tui-sandbox-config ${selectedMode === 'sandbox' ? 'tui-sandbox-expanded' : ''}`}>
              {showPlatformWarning && (
                <div className="tui-warning">
                  ⚠ Sandbox not supported on Windows
                </div>
              )}

              <div className="tui-section">
                <div className={`tui-section-header ${navTarget.section === 'permission' ? 'tui-section-focused' : ''}`}>
                  Filesystem
                  <span className="tui-section-hint">
                    {navTarget.section === 'permission' ? '←→ expand · tab/space toggle · del remove' : ''}
                  </span>
                </div>
                <div className="tui-table">
                  {permissions.map((group, groupIndex) => {
                    const accessSummary = getGroupAccessSummary(group);
                    const isFocused = isTargetMatch(navTarget, groupIndex);

                    return (
                      <React.Fragment key={group.id}>
                        {/* Group header or single item */}
                        <div
                          ref={el => itemRefs.current.set(`perm-${groupIndex}`, el)}
                          className={`tui-table-row ${isFocused ? 'tui-row-focused' : ''} ${group.type === 'group' ? 'tui-row-group' : ''}`}
                          onClick={() => setNavTarget({ section: 'permission', groupIndex })}
                        >
                          {group.type === 'group' && (
                            <span className="tui-expand-icon">{group.expanded ? '▼' : '▶'}</span>
                          )}
                          <span className="tui-col-path">
                            {group.label}
                            {group.type === 'group' && (
                              <span className="tui-path-count">{group.paths.length}</span>
                            )}
                          </span>
                          <button
                            className={`tui-access-badge ${accessSummary.access === 'mixed' ? 'tui-access-mixed' : getAccessColor(accessSummary.access as FilesystemAccess)}`}
                            onClick={(e) => { e.stopPropagation(); cycleGroupAccess(groupIndex); }}
                          >
                            {accessSummary.label}
                          </button>
                          <button
                            className="tui-remove-btn"
                            onClick={(e) => { e.stopPropagation(); removeGroup(groupIndex); }}
                          >
                            ×
                          </button>
                        </div>

                        {/* Expanded paths */}
                        {group.type === 'group' && group.expanded && group.paths.map((pathPerm, pathIndex) => {
                          const isPathFocused = isTargetMatch(navTarget, groupIndex, pathIndex);
                          return (
                            <div
                              key={pathPerm.path}
                              ref={el => itemRefs.current.set(`perm-${groupIndex}-${pathIndex}`, el)}
                              className={`tui-table-row tui-row-child ${isPathFocused ? 'tui-row-focused' : ''}`}
                              onClick={() => setNavTarget({ section: 'permission', groupIndex, pathIndex })}
                            >
                              <span className="tui-col-path">{pathPerm.path}</span>
                              <button
                                className={`tui-access-badge ${getAccessColor(pathPerm.access)}`}
                                onClick={(e) => { e.stopPropagation(); cyclePathAccess(groupIndex, pathIndex); }}
                              >
                                {getAccessLabel(pathPerm.access)}
                              </button>
                              <button
                                className="tui-remove-btn"
                                onClick={(e) => { e.stopPropagation(); removePathFromGroup(groupIndex, pathIndex); }}
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
                <div className="tui-input-row">
                  <input
                    type="text"
                    className="tui-input"
                    placeholder="Add path..."
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleAddPath(); }}}
                  />
                  <button
                    className="tui-btn-add"
                    onClick={handleAddPath}
                    disabled={!newPath.trim()}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="tui-section">
                <div className={`tui-section-header ${navTarget.section === 'network' ? 'tui-section-focused' : ''}`}>
                  Network
                  {navTarget.section === 'network' && <span className="tui-section-hint">space select</span>}
                </div>
                <div className="tui-radio-group">
                  {(['all', 'none', 'allowlist'] as const).map((mode, index) => (
                    <label
                      key={mode}
                      ref={el => itemRefs.current.set(`network-${index}`, el)}
                      className={`tui-radio ${navTarget.section === 'network' && navTarget.index === index ? 'tui-radio-focused' : ''}`}
                      onClick={() => setNavTarget({ section: 'network', index })}
                    >
                      <input
                        type="radio"
                        name="network"
                        value={mode}
                        checked={networkMode === mode}
                        onChange={(e) => setNetworkMode(e.target.value as typeof mode)}
                      />
                      <span>
                        {networkMode === mode ? '●' : '○'} {mode === 'all' ? 'Allow all' : mode === 'none' ? 'Block all' : 'Allowlist'}
                      </span>
                    </label>
                  ))}
                  {networkMode === 'allowlist' && (
                    <div className="tui-input-row tui-indent">
                      <input
                        type="text"
                        className="tui-input"
                        placeholder="example.com, api.service.com"
                        value={allowedDomains}
                        onChange={(e) => setAllowedDomains(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
        </div>

        <div className="tui-mode-footer">
          <div className="tui-mode-hint">
            ↑↓ navigate · ←→ expand/collapse · tab toggle · enter continue
          </div>
          <button className="tui-btn" onClick={handleContinue}>Continue</button>
        </div>
      </div>
    </div>
  );
};
