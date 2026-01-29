/**
 * Pane Types
 *
 * Type definitions for the split pane tree structure.
 * Each tab contains a tree of panes where leaves are terminals
 * and internal nodes are split containers.
 */

/**
 * Direction of a split pane
 * - horizontal: panes are side-by-side (first on left, second on right)
 * - vertical: panes are stacked (first on top, second on bottom)
 */
export type SplitDirection = "horizontal" | "vertical";

/**
 * A terminal pane - a leaf node in the pane tree
 */
export interface TerminalPane {
  id: string;
  type: "terminal";
  sessionId: string;
  processName: string; // For pane header display
}

/**
 * A pending pane - awaiting mode selection before creating terminal
 */
export interface PendingPane {
  id: string;
  type: "pending";
}

/**
 * A split pane - an internal node in the pane tree
 */
export interface SplitPane {
  id: string;
  type: "split";
  direction: SplitDirection;
  first: Pane; // First child (left or top)
  second: Pane; // Second child (right or bottom)
  splitRatio: number; // 0-1, default 0.5
}

/**
 * A pane is either a terminal, pending, or split
 */
export type Pane = TerminalPane | PendingPane | SplitPane;

/**
 * Tab state with pane tree support
 */
export interface TabState {
  id: string;
  title: string;
  rootPane: Pane; // Tree of panes
  focusedPaneId: string; // Which pane receives keyboard input
  isActive: boolean;
}

/**
 * Type guard to check if a pane is a terminal pane
 */
export function isTerminalPane(pane: Pane): pane is TerminalPane {
  return pane.type === "terminal";
}

/**
 * Type guard to check if a pane is a pending pane
 */
export function isPendingPane(pane: Pane): pane is PendingPane {
  return pane.type === "pending";
}

/**
 * Type guard to check if a pane is a split pane
 */
export function isSplitPane(pane: Pane): pane is SplitPane {
  return pane.type === "split";
}
