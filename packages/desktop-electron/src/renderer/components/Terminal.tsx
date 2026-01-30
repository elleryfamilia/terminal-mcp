/**
 * Terminal Component
 *
 * Renders an xterm.js terminal and connects it to the terminal-mcp backend
 * via Electron IPC.
 */

import { useEffect, useRef, useCallback, useMemo } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { CanvasAddon } from "@xterm/addon-canvas";
import "@xterm/xterm/css/xterm.css";
import { useSettings } from "../settings";
import type { Theme } from "../settings";

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
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Open terminal in container
    xterm.open(containerRef.current);
    fitAddon.fit();

    // Store refs
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Set up input handler
    xterm.onData((data) => {
      window.terminalAPI.input(sessionId, data).catch(console.error);
    });

    // Set up binary input handler (for things like Ctrl+C)
    xterm.onBinary((data) => {
      window.terminalAPI.input(sessionId, data).catch(console.error);
    });

    // Initial resize
    const { cols, rows } = xterm;
    window.terminalAPI.resize(sessionId, cols, rows).catch(console.error);

    // Focus terminal
    xterm.focus();

    // Clean up
    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      webglAddonRef.current = null;
      canvasAddonRef.current = null;
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

  return (
    <div
      ref={containerRef}
      className="terminal"
      onContextMenu={handleContextMenu}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: theme.colors.background,
      }}
    />
  );
}
