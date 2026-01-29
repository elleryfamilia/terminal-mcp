/**
 * Window State Manager
 *
 * Persists window size and position between app launches.
 */

import { screen, type BrowserWindow, type Rectangle } from "electron";
import Store from "electron-store";

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized?: boolean;
}

interface StoreSchema {
  windowState: WindowState;
}

const DEFAULT_STATE: WindowState = {
  width: 1200,
  height: 800,
};

const store = new Store<StoreSchema>({
  name: "window-state",
  defaults: {
    windowState: DEFAULT_STATE,
  },
});

/**
 * Check if a window bounds is visible on any display
 */
function isVisibleOnDisplay(bounds: Rectangle): boolean {
  const displays = screen.getAllDisplays();

  return displays.some((display) => {
    const { x, y, width, height } = display.bounds;
    // Check if at least part of the window is visible
    return (
      bounds.x < x + width &&
      bounds.x + bounds.width > x &&
      bounds.y < y + height &&
      bounds.y + bounds.height > y
    );
  });
}

/**
 * Get saved window state, with fallback to defaults
 */
export function getWindowState(): WindowState {
  const state = store.get("windowState", DEFAULT_STATE);

  // Validate that the position is still visible (monitors may have changed)
  if (state.x !== undefined && state.y !== undefined) {
    const bounds: Rectangle = {
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height,
    };

    if (!isVisibleOnDisplay(bounds)) {
      // Reset position if window would be off-screen
      return {
        width: state.width,
        height: state.height,
      };
    }
  }

  return state;
}

/**
 * Save current window state
 */
export function saveWindowState(window: BrowserWindow): void {
  if (window.isDestroyed()) return;

  const isMaximized = window.isMaximized();

  // Don't save position if maximized (we'll restore maximized state instead)
  if (!isMaximized) {
    const bounds = window.getBounds();
    store.set("windowState", {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: false,
    });
  } else {
    // Just update the maximized flag, keep previous bounds
    const current = store.get("windowState", DEFAULT_STATE);
    store.set("windowState", {
      ...current,
      isMaximized: true,
    });
  }
}

/**
 * Track window state changes and save on close
 */
export function trackWindowState(window: BrowserWindow): void {
  // Save state periodically when resizing/moving (debounced by electron)
  const saveState = () => saveWindowState(window);

  window.on("resize", saveState);
  window.on("move", saveState);
  window.on("close", saveState);

  // Restore maximized state
  const state = store.get("windowState", DEFAULT_STATE);
  if (state.isMaximized) {
    window.maximize();
  }
}
