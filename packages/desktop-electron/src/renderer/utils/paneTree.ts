/**
 * Pane Tree Utilities
 *
 * Functions for manipulating the pane tree structure.
 */

import type {
  Pane,
  TerminalPane,
  PendingPane,
  SplitPane,
  SplitDirection,
} from "../types/pane";
import { isTerminalPane, isPendingPane, isSplitPane } from "../types/pane";

/**
 * Find a pane by ID in the tree
 */
export function findPaneById(root: Pane, id: string): Pane | null {
  if (root.id === id) {
    return root;
  }

  if (isSplitPane(root)) {
    const inFirst = findPaneById(root.first, id);
    if (inFirst) return inFirst;

    const inSecond = findPaneById(root.second, id);
    if (inSecond) return inSecond;
  }

  return null;
}

/**
 * Find the parent of a pane by ID
 */
export function findPaneParent(
  root: Pane,
  id: string
): { parent: SplitPane; isFirst: boolean } | null {
  if (!isSplitPane(root)) {
    return null;
  }

  if (root.first.id === id) {
    return { parent: root, isFirst: true };
  }

  if (root.second.id === id) {
    return { parent: root, isFirst: false };
  }

  const inFirst = findPaneParent(root.first, id);
  if (inFirst) return inFirst;

  const inSecond = findPaneParent(root.second, id);
  if (inSecond) return inSecond;

  return null;
}

/**
 * Transform a pane in the tree (immutably)
 */
export function transformPaneInTree(
  root: Pane,
  id: string,
  transform: (pane: Pane) => Pane
): Pane {
  if (root.id === id) {
    return transform(root);
  }

  if (isSplitPane(root)) {
    return {
      ...root,
      first: transformPaneInTree(root.first, id, transform),
      second: transformPaneInTree(root.second, id, transform),
    };
  }

  return root;
}

/**
 * Replace a pane in the tree with a new pane (immutably)
 */
export function replacePaneInTree(root: Pane, id: string, newPane: Pane): Pane {
  return transformPaneInTree(root, id, () => newPane);
}

/**
 * Remove a pane from the tree
 * Returns the new root (sibling takes its place) or null if root was removed
 */
export function removePaneFromTree(root: Pane, id: string): Pane | null {
  // If removing the root itself
  if (root.id === id) {
    return null;
  }

  if (!isSplitPane(root)) {
    return root;
  }

  // Check if either child is the target
  if (root.first.id === id) {
    return root.second;
  }

  if (root.second.id === id) {
    return root.first;
  }

  // Recursively search children
  if (isSplitPane(root.first)) {
    const newFirst = removePaneFromTree(root.first, id);
    if (newFirst !== root.first) {
      // Found and removed in first subtree
      if (newFirst === null) {
        return root.second;
      }
      return { ...root, first: newFirst };
    }
  }

  if (isSplitPane(root.second)) {
    const newSecond = removePaneFromTree(root.second, id);
    if (newSecond !== root.second) {
      // Found and removed in second subtree
      if (newSecond === null) {
        return root.first;
      }
      return { ...root, second: newSecond };
    }
  }

  return root;
}

/**
 * Get all terminal panes in the tree
 */
export function getAllTerminalPanes(root: Pane): TerminalPane[] {
  if (isTerminalPane(root)) {
    return [root];
  }

  if (isPendingPane(root)) {
    return [];
  }

  return [
    ...getAllTerminalPanes(root.first),
    ...getAllTerminalPanes(root.second),
  ];
}

/**
 * Get terminal pane by session ID
 */
export function findTerminalBySessionId(
  root: Pane,
  sessionId: string
): TerminalPane | null {
  const terminals = getAllTerminalPanes(root);
  return terminals.find((t) => t.sessionId === sessionId) || null;
}

/**
 * Update the process name for a terminal pane by session ID
 */
export function updateTerminalProcessName(
  root: Pane,
  sessionId: string,
  processName: string
): Pane {
  if (isTerminalPane(root)) {
    if (root.sessionId === sessionId) {
      return { ...root, processName };
    }
    return root;
  }

  if (isPendingPane(root)) {
    return root;
  }

  return {
    ...root,
    first: updateTerminalProcessName(root.first, sessionId, processName),
    second: updateTerminalProcessName(root.second, sessionId, processName),
  };
}

/**
 * Direction for navigation between panes
 */
export type NavigationDirection = "left" | "right" | "up" | "down";

/**
 * Position information for a pane (computed during tree traversal)
 */
interface PanePosition {
  paneId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute positions of all terminal panes
 * Used for navigation calculation
 */
function computePanePositions(
  root: Pane,
  x = 0,
  y = 0,
  width = 1,
  height = 1
): PanePosition[] {
  if (isTerminalPane(root)) {
    return [{ paneId: root.id, x, y, width, height }];
  }

  if (isPendingPane(root)) {
    // Include pending panes in navigation
    return [{ paneId: root.id, x, y, width, height }];
  }

  const ratio = root.splitRatio;

  if (root.direction === "horizontal") {
    const firstWidth = width * ratio;
    const secondWidth = width * (1 - ratio);
    return [
      ...computePanePositions(root.first, x, y, firstWidth, height),
      ...computePanePositions(
        root.second,
        x + firstWidth,
        y,
        secondWidth,
        height
      ),
    ];
  } else {
    const firstHeight = height * ratio;
    const secondHeight = height * (1 - ratio);
    return [
      ...computePanePositions(root.first, x, y, width, firstHeight),
      ...computePanePositions(
        root.second,
        x,
        y + firstHeight,
        width,
        secondHeight
      ),
    ];
  }
}

/**
 * Find the adjacent pane in a given direction
 * Returns the pane ID or null if no adjacent pane exists
 */
export function findAdjacentPane(
  root: Pane,
  currentPaneId: string,
  direction: NavigationDirection
): string | null {
  const positions = computePanePositions(root);
  const current = positions.find((p) => p.paneId === currentPaneId);

  if (!current) return null;

  // Find center point of current pane
  const centerX = current.x + current.width / 2;
  const centerY = current.y + current.height / 2;

  // Filter candidates based on direction
  let candidates: PanePosition[];

  switch (direction) {
    case "left":
      candidates = positions.filter(
        (p) =>
          p.paneId !== currentPaneId &&
          p.x + p.width <= current.x + 0.001 // Left edge of current
      );
      break;
    case "right":
      candidates = positions.filter(
        (p) =>
          p.paneId !== currentPaneId &&
          p.x >= current.x + current.width - 0.001 // Right edge of current
      );
      break;
    case "up":
      candidates = positions.filter(
        (p) =>
          p.paneId !== currentPaneId &&
          p.y + p.height <= current.y + 0.001 // Top edge of current
      );
      break;
    case "down":
      candidates = positions.filter(
        (p) =>
          p.paneId !== currentPaneId &&
          p.y >= current.y + current.height - 0.001 // Bottom edge of current
      );
      break;
  }

  if (candidates.length === 0) return null;

  // Find the closest candidate
  // Prefer candidates that overlap on the perpendicular axis
  candidates.sort((a, b) => {
    const isHorizontal = direction === "left" || direction === "right";

    // Check overlap on perpendicular axis
    const aOverlaps = isHorizontal
      ? a.y < current.y + current.height && a.y + a.height > current.y
      : a.x < current.x + current.width && a.x + a.width > current.x;

    const bOverlaps = isHorizontal
      ? b.y < current.y + current.height && b.y + b.height > current.y
      : b.x < current.x + current.width && b.x + b.width > current.x;

    // Prefer overlapping candidates
    if (aOverlaps && !bOverlaps) return -1;
    if (!aOverlaps && bOverlaps) return 1;

    // Calculate distance from center
    const aCenterX = a.x + a.width / 2;
    const aCenterY = a.y + a.height / 2;
    const bCenterX = b.x + b.width / 2;
    const bCenterY = b.y + b.height / 2;

    const aDistX = Math.abs(aCenterX - centerX);
    const aDistY = Math.abs(aCenterY - centerY);
    const bDistX = Math.abs(bCenterX - centerX);
    const bDistY = Math.abs(bCenterY - centerY);

    // Primary sort by perpendicular distance (prefer aligned)
    // Secondary sort by parallel distance (prefer closer)
    if (isHorizontal) {
      if (aDistY !== bDistY) return aDistY - bDistY;
      return aDistX - bDistX;
    } else {
      if (aDistX !== bDistX) return aDistX - bDistX;
      return aDistY - bDistY;
    }
  });

  return candidates[0]?.paneId || null;
}

/**
 * Create a new terminal pane
 */
export function createTerminalPane(
  sessionId: string,
  processName = "shell"
): TerminalPane {
  return {
    id: `pane-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type: "terminal",
    sessionId,
    processName,
  };
}

/**
 * Create a new pending pane (awaiting mode selection)
 */
export function createPendingPane(): PendingPane {
  return {
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type: "pending",
  };
}

/**
 * Check if there are any pending panes in the tree
 */
export function hasPendingPanes(root: Pane): boolean {
  if (isPendingPane(root)) {
    return true;
  }
  if (isSplitPane(root)) {
    return hasPendingPanes(root.first) || hasPendingPanes(root.second);
  }
  return false;
}

/**
 * Get the first pending pane in the tree
 */
export function getFirstPendingPane(root: Pane): PendingPane | null {
  if (isPendingPane(root)) {
    return root;
  }
  if (isSplitPane(root)) {
    const inFirst = getFirstPendingPane(root.first);
    if (inFirst) return inFirst;
    return getFirstPendingPane(root.second);
  }
  return null;
}

/**
 * Split a pane into two panes
 * The original pane stays in the first position, a new pane goes in the second
 */
export function splitPane(
  root: Pane,
  targetPaneId: string,
  direction: SplitDirection,
  newPane: TerminalPane | PendingPane
): Pane {
  return transformPaneInTree(root, targetPaneId, (pane) => {
    const splitPaneNode: SplitPane = {
      id: `split-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: "split",
      direction,
      first: pane,
      second: newPane,
      splitRatio: 0.5,
    };
    return splitPaneNode;
  });
}

/**
 * Update the split ratio of a split pane
 */
export function updateSplitRatio(
  root: Pane,
  splitPaneId: string,
  ratio: number
): Pane {
  const clampedRatio = Math.max(0.1, Math.min(0.9, ratio));
  return transformPaneInTree(root, splitPaneId, (pane) => {
    if (isSplitPane(pane)) {
      return { ...pane, splitRatio: clampedRatio };
    }
    return pane;
  });
}

/**
 * Get the first terminal pane in the tree (for default focus)
 */
export function getFirstTerminalPane(root: Pane): TerminalPane | null {
  if (isTerminalPane(root)) {
    return root;
  }

  if (isPendingPane(root)) {
    return null;
  }

  return getFirstTerminalPane(root.first);
}

/**
 * Get the next or previous terminal pane in tree order
 * Used for Cmd+] and Cmd+[ cycling
 */
export function getAdjacentTerminalPane(
  root: Pane,
  currentPaneId: string,
  direction: "next" | "prev"
): TerminalPane | null {
  const terminals = getAllTerminalPanes(root);
  if (terminals.length <= 1) return null;

  const currentIndex = terminals.findIndex((t) => t.id === currentPaneId);
  if (currentIndex === -1) return terminals[0];

  if (direction === "next") {
    return terminals[(currentIndex + 1) % terminals.length];
  } else {
    return terminals[(currentIndex - 1 + terminals.length) % terminals.length];
  }
}
