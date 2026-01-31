/**
 * Terminal Component
 *
 * Renders an xterm.js terminal and connects it to the terminal-mcp backend
 * via Electron IPC.
 */

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { CanvasAddon } from "@xterm/addon-canvas";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { useSettings } from "../settings";
import type { Theme } from "../settings";

/**
 * Escape a file path for safe shell usage.
 * Wraps in single quotes and escapes embedded single quotes.
 */
function escapePathForShell(path: string): string {
  // If the path contains any special characters that need escaping
  if (/[^a-zA-Z0-9_./-]/.test(path)) {
    // Wrap in single quotes, escape embedded single quotes with '\''
    return `'${path.replace(/'/g, "'\\''")}'`;
  }
  return path;
}

export interface TerminalMethods {
  copy: () => void;
  paste: () => Promise<void>;
  selectAll: () => void;
  clear: () => void;
  hasSelection: () => boolean;
}

interface TerminalProps {
  sessionId: string;
  onClose?: () => void;
  isVisible?: boolean;
  isFocused?: boolean;
  onFocus?: () => void;
  onContextMenu?: (e: React.MouseEvent, methods: TerminalMethods) => void;
}

/**
 * Build xterm theme from app theme
 */
function buildXtermTheme(theme: Theme) {
  const { colors } = theme;
  return {
    background: colors.background,
    foreground: colors.foreground,
    cursor: colors.foreground,
    cursorAccent: colors.background,
    selectionBackground: colors.accent + "80", // 50% opacity
    selectionForeground: colors.foreground,
    black: colors.ansi.black,
    red: colors.ansi.red,
    green: colors.ansi.green,
    yellow: colors.ansi.yellow,
    blue: colors.ansi.blue,
    magenta: colors.ansi.magenta,
    cyan: colors.ansi.cyan,
    white: colors.ansi.white,
    brightBlack: colors.ansi.brightBlack,
    brightRed: colors.ansi.brightRed,
    brightGreen: colors.ansi.brightGreen,
    brightYellow: colors.ansi.brightYellow,
    brightBlue: colors.ansi.brightBlue,
    brightMagenta: colors.ansi.brightMagenta,
    brightCyan: colors.ansi.brightCyan,
    brightWhite: colors.ansi.brightWhite,
  };
}

export function Terminal({ sessionId, onClose, isVisible = true, isFocused = true, onFocus, onContextMenu }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const canvasAddonRef = useRef<CanvasAddon | null>(null);
  const webLinksAddonRef = useRef<WebLinksAddon | null>(null);
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selection state for keyboard selection (Shift+Arrow)
  const selectionStateRef = useRef<{
    anchor: { x: number; y: number };
    active: { x: number; y: number };
  } | null>(null);

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false);

  // Scroll state for auto-hiding scrollbar
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get settings and theme
  const { settings, theme } = useSettings();

  // Build xterm theme from current theme
  const xtermTheme = useMemo(() => buildXtermTheme(theme), [theme]);

  // Handle terminal output from backend
  const handleOutput = useCallback((data: string) => {
    if (xtermRef.current) {
      xtermRef.current.write(data);
    }
  }, []);

  // Handle session close
  const handleSessionClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  // Resize handler with debounce
  const handleResize = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    resizeTimeoutRef.current = setTimeout(() => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();

        const { cols, rows } = xtermRef.current;
        window.terminalAPI.resize(sessionId, cols, rows).catch(console.error);
      }
    }, 100);
  }, [sessionId]);

  // Initialize xterm.js
  useEffect(() => {
    if (!containerRef.current) return;

    // Build font family string with fallbacks
    const fontFamily = `"${settings.appearance.fontFamily}", Menlo, Monaco, "Courier New", monospace`;

    // Create terminal with settings
    const xterm = new XTerm({
      fontFamily,
      fontSize: settings.appearance.fontSize,
      lineHeight: 1.2,
      theme: xtermTheme,
      cursorBlink: settings.terminal.cursorBlink,
      cursorStyle: settings.terminal.cursorStyle,
      allowProposedApi: true,
      scrollback: settings.terminal.scrollbackLines,
      // Disable ligatures via font features if setting is off
      fontWeightBold: "bold",
    });

    // Load addons
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    // Load renderer addon based on GPU acceleration setting
    if (settings.advanced.gpuAcceleration) {
      try {
        const webglAddon = new WebglAddon();
        webglAddon.onContextLoss(() => {
          webglAddon.dispose();
          webglAddonRef.current = null;
        });
        xterm.loadAddon(webglAddon);
        webglAddonRef.current = webglAddon;
      } catch (e) {
        console.warn("WebGL addon not available, falling back to canvas renderer");
        try {
          const canvasAddon = new CanvasAddon();
          xterm.loadAddon(canvasAddon);
          canvasAddonRef.current = canvasAddon;
        } catch (e2) {
          console.warn("Canvas addon also not available");
        }
      }
    } else {
      // Use canvas renderer when GPU acceleration is disabled
      try {
        const canvasAddon = new CanvasAddon();
        xterm.loadAddon(canvasAddon);
        canvasAddonRef.current = canvasAddon;
      } catch (e) {
        console.warn("Canvas addon not available");
      }
    }

    // Load WebLinksAddon for clickable URLs
    try {
      const webLinksAddon = new WebLinksAddon((event, uri) => {
        event.preventDefault();
        // Open URL in default browser via secure IPC
        window.terminalAPI.openExternal(uri).catch(console.error);
      });
      xterm.loadAddon(webLinksAddon);
      webLinksAddonRef.current = webLinksAddon;
    } catch (e) {
      console.warn("WebLinks addon not available:", e);
    }

    // Open terminal in container
    xterm.open(containerRef.current);
    fitAddon.fit();

    // Store refs
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Set up keyboard shortcut handler
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

    xterm.attachCustomKeyEventHandler((event) => {
      // Only handle keydown events
      if (event.type !== "keydown") return true;

      const isMod = isMac ? event.metaKey : event.ctrlKey;

      // Shift+Enter - insert newline (useful for multi-line input)
      if (event.shiftKey && event.key === "Enter" && !isMod) {
        event.preventDefault();
        window.terminalAPI.input(sessionId, "\n").catch(console.error);
        return false;
      }

      // Cmd/Ctrl+C - smart copy/SIGINT
      if (isMod && event.key === "c" && !event.shiftKey) {
        if (xterm.hasSelection()) {
          navigator.clipboard.writeText(xterm.getSelection());
          return false; // Prevent xterm handling, we copied
        }
        return true; // Let through for SIGINT (no selection)
      }

      // Cmd/Ctrl+Shift+C - always copy (alternative shortcut)
      if (isMod && event.shiftKey && event.key.toLowerCase() === "c") {
        const selection = xterm.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
        }
        return false;
      }

      // Cmd/Ctrl+V - paste
      if (isMod && event.key === "v" && !event.shiftKey) {
        event.preventDefault(); // Prevent browser's default paste
        navigator.clipboard.readText().then((text) => {
          if (text) {
            window.terminalAPI.input(sessionId, text).catch(console.error);
          }
        });
        return false;
      }

      // Cmd/Ctrl+Shift+V - paste (alternative shortcut, same behavior)
      if (isMod && event.shiftKey && event.key.toLowerCase() === "v") {
        event.preventDefault(); // Prevent browser's default paste
        navigator.clipboard.readText().then((text) => {
          if (text) {
            window.terminalAPI.input(sessionId, text).catch(console.error);
          }
        });
        return false;
      }

      // Cmd/Ctrl+A - select all
      if (isMod && event.key === "a" && !event.shiftKey) {
        xterm.selectAll();
        selectionStateRef.current = null; // Clear keyboard selection state
        return false;
      }

      // Shift+Arrow keys - keyboard selection
      if (event.shiftKey && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
        const buffer = xterm.buffer.active;
        const cols = xterm.cols;
        const totalRows = buffer.length;

        // Helper to get character at position
        const getCharAt = (col: number, row: number): string => {
          const line = buffer.getLine(row);
          if (!line || col < 0 || col >= cols) return " ";
          const cell = line.getCell(col);
          return cell?.getChars() || " ";
        };

        // Helper to check if character is a word character
        const isWordChar = (char: string): boolean => /[\w]/.test(char);

        // Helper to find previous word boundary
        const findPrevWordBoundary = (col: number, row: number): { x: number; y: number } => {
          let x = col;
          let y = row;
          // Skip current word characters
          while ((x > 0 || y > 0) && isWordChar(getCharAt(x, y))) {
            x--;
            if (x < 0 && y > 0) {
              y--;
              x = cols - 1;
            }
          }
          // Skip non-word characters
          while ((x > 0 || y > 0) && !isWordChar(getCharAt(x, y))) {
            x--;
            if (x < 0 && y > 0) {
              y--;
              x = cols - 1;
            }
          }
          // Find start of word
          while (x > 0 && isWordChar(getCharAt(x - 1, y))) {
            x--;
          }
          return { x: Math.max(0, x), y };
        };

        // Helper to find next word boundary
        const findNextWordBoundary = (col: number, row: number): { x: number; y: number } => {
          let x = col;
          let y = row;
          // Skip current word characters
          while ((x < cols - 1 || y < totalRows - 1) && isWordChar(getCharAt(x, y))) {
            x++;
            if (x >= cols && y < totalRows - 1) {
              y++;
              x = 0;
            }
          }
          // Skip non-word characters
          while ((x < cols - 1 || y < totalRows - 1) && !isWordChar(getCharAt(x, y))) {
            x++;
            if (x >= cols && y < totalRows - 1) {
              y++;
              x = 0;
            }
          }
          return { x: Math.min(cols - 1, x), y };
        };

        // Initialize selection state if not exists
        if (!selectionStateRef.current) {
          // Start selection from cursor position
          const startX = buffer.cursorX;
          const startY = buffer.cursorY + buffer.viewportY;
          selectionStateRef.current = {
            anchor: { x: startX, y: startY },
            active: { x: startX, y: startY },
          };
        }

        const state = selectionStateRef.current;
        let { x, y } = state.active;

        // Word selection: Option+Shift on Mac, Ctrl+Shift on Windows/Linux
        const isWordMod = isMac ? event.altKey : event.ctrlKey;
        // Line jump: Cmd+Shift on Mac, use Home/End on Windows/Linux
        const isLineMod = isMac ? event.metaKey : false;

        // Move active position based on key
        switch (event.key) {
          case "ArrowLeft":
            if (isLineMod) {
              // Cmd+Shift+Left (Mac) - jump to start of line
              x = 0;
            } else if (isWordMod) {
              // Option+Shift+Left (Mac) or Ctrl+Shift+Left (Win/Linux) - word selection
              const boundary = findPrevWordBoundary(x, y);
              x = boundary.x;
              y = boundary.y;
            } else {
              x--;
              if (x < 0) {
                if (y > 0) {
                  y--;
                  x = cols - 1;
                } else {
                  x = 0;
                }
              }
            }
            break;
          case "ArrowRight":
            if (isLineMod) {
              // Cmd+Shift+Right (Mac) - jump to end of line
              x = cols - 1;
            } else if (isWordMod) {
              // Option+Shift+Right (Mac) or Ctrl+Shift+Right (Win/Linux) - word selection
              const boundary = findNextWordBoundary(x, y);
              x = boundary.x;
              y = boundary.y;
            } else {
              x++;
              if (x >= cols) {
                if (y < totalRows - 1) {
                  y++;
                  x = 0;
                } else {
                  x = cols - 1;
                }
              }
            }
            break;
          case "ArrowUp":
            if (isMod) {
              // Cmd/Ctrl+Shift+Up - jump to top of buffer
              y = 0;
            } else {
              y = Math.max(0, y - 1);
            }
            break;
          case "ArrowDown":
            if (isMod) {
              // Cmd/Ctrl+Shift+Down - jump to bottom of buffer
              y = totalRows - 1;
            } else {
              y = Math.min(totalRows - 1, y + 1);
            }
            break;
          case "Home":
            if (isMod) {
              // Cmd/Ctrl+Shift+Home - select to start of buffer
              x = 0;
              y = 0;
            } else {
              // Shift+Home - select to start of line
              x = 0;
            }
            break;
          case "End":
            if (isMod) {
              // Cmd/Ctrl+Shift+End - select to end of buffer
              x = cols - 1;
              y = totalRows - 1;
            } else {
              // Shift+End - select to end of line
              x = cols - 1;
            }
            break;
        }

        state.active = { x, y };

        // Apply selection - determine start and end points
        const anchor = state.anchor;
        const active = state.active;

        let startX: number, startY: number, endX: number, endY: number;
        if (anchor.y < active.y || (anchor.y === active.y && anchor.x <= active.x)) {
          startX = anchor.x;
          startY = anchor.y;
          endX = active.x;
          endY = active.y;
        } else {
          startX = active.x;
          startY = active.y;
          endX = anchor.x;
          endY = anchor.y;
        }

        // Calculate length for selection
        const length = (endY - startY) * cols + (endX - startX) + 1;
        xterm.select(startX, startY, length);

        return false; // Prevent default handling
      }

      // Any key without Shift clears keyboard selection state
      if (!event.shiftKey && selectionStateRef.current) {
        selectionStateRef.current = null;
      }

      return true; // Let all other keys through
    });

    // Set up input handler
    xterm.onData((data) => {
      window.terminalAPI.input(sessionId, data).catch(console.error);
    });

    // Set up binary input handler (for things like Ctrl+C)
    xterm.onBinary((data) => {
      window.terminalAPI.input(sessionId, data).catch(console.error);
    });

    // Clear keyboard selection state when mouse selection starts
    const handleMouseDown = () => {
      selectionStateRef.current = null;
    };
    containerRef.current?.addEventListener("mousedown", handleMouseDown);

    // Initial resize
    const { cols, rows } = xterm;
    window.terminalAPI.resize(sessionId, cols, rows).catch(console.error);

    // Focus terminal
    xterm.focus();

    // Clean up
    const container = containerRef.current;
    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      container?.removeEventListener("mousedown", handleMouseDown);
      webglAddonRef.current = null;
      canvasAddonRef.current = null;
      webLinksAddonRef.current = null;
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]);

  // Update terminal options when settings change (without recreating terminal)
  useEffect(() => {
    if (!xtermRef.current) return;

    const xterm = xtermRef.current;
    const fontFamily = `"${settings.appearance.fontFamily}", Menlo, Monaco, "Courier New", monospace`;

    // Update font settings
    xterm.options.fontFamily = fontFamily;
    xterm.options.fontSize = settings.appearance.fontSize;

    // Update cursor settings
    xterm.options.cursorBlink = settings.terminal.cursorBlink;
    xterm.options.cursorStyle = settings.terminal.cursorStyle;

    // Force cursor refresh by toggling focus
    xterm.blur();
    xterm.focus();

    // Update theme
    xterm.options.theme = xtermTheme;

    // Refit after font changes
    if (fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 10);
    }
  }, [
    settings.appearance.fontFamily,
    settings.appearance.fontSize,
    settings.terminal.cursorBlink,
    settings.terminal.cursorStyle,
    xtermTheme,
  ]);

  // Set up message listener
  useEffect(() => {
    const cleanup = window.terminalAPI.onMessage((message: unknown) => {
      const msg = message as { type: string; sessionId?: string; data?: string; exitCode?: number };

      // Only handle messages for this session
      if (msg.sessionId && msg.sessionId !== sessionId) return;

      switch (msg.type) {
        case "output":
          if (msg.data) {
            // Decode base64 data with proper UTF-8 support
            const binaryString = atob(msg.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const decoded = new TextDecoder().decode(bytes);
            handleOutput(decoded);
          }
          break;

        case "session-closed":
          handleSessionClose();
          break;

        case "resize":
          // Backend confirmed resize, nothing to do
          break;

        default:
          // Ignore unknown message types
          break;
      }
    });

    return cleanup;
  }, [sessionId, handleOutput, handleSessionClose]);

  // Set up container resize observer (for split pane resizing)
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserver.observe(containerRef.current);

    // Also listen for window resize events from Electron
    const cleanup = window.terminalAPI.onWindowResize(handleResize);

    return () => {
      resizeObserver.disconnect();
      cleanup();
    };
  }, [handleResize]);

  // Handle scroll detection for auto-hiding scrollbar
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const showScrollbar = () => {
      setIsScrolling(true);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 1000);
    };

    // Wheel events for trackpad/mouse wheel scrolling
    const handleWheel = () => {
      showScrollbar();
    };

    // Also detect scrollbar drag via mousedown on the scrollbar area
    // and xterm viewport scroll events
    const handleScroll = () => {
      showScrollbar();
    };

    container.addEventListener("wheel", handleWheel, { passive: true });

    // Listen for scroll events on the xterm viewport
    const viewport = container.querySelector(".xterm-viewport");
    if (viewport) {
      viewport.addEventListener("scroll", handleScroll, { passive: true });
    }

    return () => {
      container.removeEventListener("wheel", handleWheel);
      if (viewport) {
        viewport.removeEventListener("scroll", handleScroll);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Handle visibility changes (tab switching)
  useEffect(() => {
    if (isVisible && xtermRef.current && fitAddonRef.current) {
      // Refit when becoming visible
      setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 10);
    }
  }, [isVisible]);

  // Handle focus changes (for split panes)
  useEffect(() => {
    if (isVisible && isFocused && xtermRef.current) {
      // Focus the terminal when the pane is focused
      setTimeout(() => {
        xtermRef.current?.focus();
      }, 10);
    }
  }, [isVisible, isFocused]);

  // Notify parent when terminal receives focus
  useEffect(() => {
    if (!containerRef.current || !onFocus) return;

    const handleContainerFocus = () => {
      onFocus();
    };

    // Listen for focus on the container (bubbles up from xterm)
    containerRef.current.addEventListener("focusin", handleContainerFocus);

    return () => {
      containerRef.current?.removeEventListener("focusin", handleContainerFocus);
    };
  }, [onFocus]);

  // Terminal methods for context menu
  const terminalMethods = useMemo<TerminalMethods>(() => ({
    copy: () => {
      if (xtermRef.current) {
        const selection = xtermRef.current.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
        }
      }
    },
    paste: async () => {
      if (xtermRef.current) {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            window.terminalAPI.input(sessionId, text).catch(console.error);
          }
        } catch (err) {
          console.error("Failed to paste:", err);
        }
      }
    },
    selectAll: () => {
      if (xtermRef.current) {
        xtermRef.current.selectAll();
      }
    },
    clear: () => {
      if (xtermRef.current) {
        xtermRef.current.clear();
      }
    },
    hasSelection: () => {
      if (xtermRef.current) {
        return xtermRef.current.hasSelection();
      }
      return false;
    },
  }), [sessionId]);

  // Handle context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (onContextMenu) {
        onContextMenu(e, terminalMethods);
      }
    },
    [onContextMenu, terminalMethods]
  );

  // Drag and drop handlers - use native events with capture phase
  // because xterm.js creates its own DOM that intercepts events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let dragCounter = 0; // Track enter/leave for nested elements

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      if (dragCounter === 1) {
        setIsDragOver(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        setIsDragOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      setIsDragOver(false);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        // Convert files to escaped paths and join with spaces
        // Use Electron's webUtils API to get file paths (required for sandboxed renderer)
        const paths = Array.from(files)
          .map((f) => {
            const filePath = window.terminalAPI.getPathForFile(f);
            return escapePathForShell(filePath);
          })
          .join(" ");
        window.terminalAPI.input(sessionId, paths).catch(console.error);
      }
    };

    // Use capture phase to intercept events before xterm.js elements
    container.addEventListener("dragenter", handleDragEnter, true);
    container.addEventListener("dragover", handleDragOver, true);
    container.addEventListener("dragleave", handleDragLeave, true);
    container.addEventListener("drop", handleDrop, true);

    return () => {
      container.removeEventListener("dragenter", handleDragEnter, true);
      container.removeEventListener("dragover", handleDragOver, true);
      container.removeEventListener("dragleave", handleDragLeave, true);
      container.removeEventListener("drop", handleDrop, true);
    };
  }, [sessionId]);

  return (
    <div
      ref={containerRef}
      className={`terminal${isDragOver ? " drag-over" : ""}${isScrolling ? " scrolling" : ""}`}
      onContextMenu={handleContextMenu}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: theme.colors.background,
      }}
    />
  );
}
