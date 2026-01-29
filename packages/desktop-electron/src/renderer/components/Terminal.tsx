/**
 * Terminal Component
 *
 * Renders an xterm.js terminal and connects it to the terminal-mcp backend
 * via Electron IPC.
 */

import { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  sessionId: string;
  onClose?: () => void;
  isVisible?: boolean;
  isFocused?: boolean;
  onFocus?: () => void;
}

// Terminal theme (VS Code Dark+ inspired)
const TERMINAL_THEME = {
  background: "#1e1e1e",
  foreground: "#d4d4d4",
  cursor: "#d4d4d4",
  cursorAccent: "#1e1e1e",
  selectionBackground: "#264f78",
  black: "#000000",
  red: "#cd3131",
  green: "#0dbc79",
  yellow: "#e5e510",
  blue: "#2472c8",
  magenta: "#bc3fbc",
  cyan: "#11a8cd",
  white: "#e5e5e5",
  brightBlack: "#666666",
  brightRed: "#f14c4c",
  brightGreen: "#23d18b",
  brightYellow: "#f5f543",
  brightBlue: "#3b8eea",
  brightMagenta: "#d670d6",
  brightCyan: "#29b8db",
  brightWhite: "#e5e5e5",
};

export function Terminal({ sessionId, onClose, isVisible = true, isFocused = true, onFocus }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Create terminal
    const xterm = new XTerm({
      fontFamily: '"JetBrainsMono Nerd Font", Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      theme: TERMINAL_THEME,
      cursorBlink: true,
      cursorStyle: "block",
      allowProposedApi: true,
      scrollback: 10000,
    });

    // Load addons
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    // Try to load WebGL addon for better performance
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      xterm.loadAddon(webglAddon);
    } catch (e) {
      console.warn("WebGL addon not available, falling back to canvas renderer");
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
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]);

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

  return (
    <div
      ref={containerRef}
      className="terminal"
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: TERMINAL_THEME.background,
      }}
    />
  );
}
