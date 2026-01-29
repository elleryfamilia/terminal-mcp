/**
 * Pending Pane View Component
 *
 * Renders a placeholder in the pane and displays the mode selection modal
 * floating above, positioned as close to the pane as possible while staying
 * fully visible within the viewport.
 *
 * If there's more space above the pane center, the modal expands upward.
 * If there's more space below, it expands downward.
 */

import { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { ModeSelectionModal } from "./ModeSelectionModal";
import type { SandboxConfig } from "../types/sandbox";

interface PendingPaneViewProps {
  paneId: string;
  onModeSelected: (
    paneId: string,
    mode: "direct" | "sandbox",
    config?: SandboxConfig
  ) => void;
  onCancel: (paneId: string) => void;
}

interface ModalPosition {
  top?: number;
  bottom?: number;
  left: number;
  expandUp: boolean;
}

// Modal dimensions (from CSS)
const MODAL_WIDTH = 420;
const VIEWPORT_PADDING = 12;

/**
 * Calculate optimal modal position to be as close to pane center as possible
 * while ensuring the modal stays fully within the viewport.
 */
function calculateModalPosition(
  paneRect: DOMRect,
  modalHeight: number,
  viewportWidth: number,
  viewportHeight: number
): ModalPosition {
  const modalWidth = MODAL_WIDTH;

  // Calculate pane center
  const paneCenterX = paneRect.left + paneRect.width / 2;
  const paneCenterY = paneRect.top + paneRect.height / 2;

  // Calculate horizontal position
  let idealLeft = paneCenterX - modalWidth / 2;
  const minLeft = VIEWPORT_PADDING;
  const maxLeft = viewportWidth - modalWidth - VIEWPORT_PADDING;
  const left = Math.max(minLeft, Math.min(idealLeft, maxLeft));

  // Calculate available space above and below pane center
  const spaceAbove = paneCenterY - VIEWPORT_PADDING;
  const spaceBelow = viewportHeight - paneCenterY - VIEWPORT_PADDING;

  // Determine expansion direction based on available space
  const expandUp = spaceAbove > spaceBelow;

  if (expandUp) {
    // Anchor from bottom - modal expands upward
    let idealBottom = viewportHeight - paneCenterY - modalHeight / 2;
    const minBottom = VIEWPORT_PADDING;
    const maxBottom = viewportHeight - modalHeight - VIEWPORT_PADDING;
    const bottom = Math.max(minBottom, Math.min(idealBottom, maxBottom));

    return { bottom, left, expandUp: true };
  } else {
    // Anchor from top - modal expands downward
    let idealTop = paneCenterY - modalHeight / 2;
    const minTop = VIEWPORT_PADDING;
    const maxTop = viewportHeight - modalHeight - VIEWPORT_PADDING;
    const top = Math.max(minTop, Math.min(idealTop, maxTop));

    return { top, left, expandUp: false };
  }
}

export function PendingPaneView({
  paneId,
  onModeSelected,
  onCancel,
}: PendingPaneViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [modalPosition, setModalPosition] = useState<ModalPosition | null>(null);
  const [isPositioned, setIsPositioned] = useState(false);

  // Calculate and update modal position
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;

    const paneRect = containerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Get actual modal height if available, otherwise estimate
    let modalHeight: number;
    if (modalRef.current) {
      const dialog = modalRef.current.querySelector('.tui-mode-dialog') as HTMLElement;
      modalHeight = dialog?.offsetHeight || 400;
    } else {
      modalHeight = 400;
    }

    const position = calculateModalPosition(
      paneRect,
      modalHeight,
      viewportWidth,
      viewportHeight
    );

    setModalPosition(position);
    setIsPositioned(true);
  }, []);

  // Initial position calculation and updates
  useEffect(() => {
    updatePosition();

    const handleResize = () => updatePosition();
    window.addEventListener("resize", handleResize);

    const resizeObserver = new ResizeObserver(updatePosition);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  }, [updatePosition]);

  // Recalculate position when modal content changes
  useEffect(() => {
    if (!modalRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updatePosition);
    });

    const dialog = modalRef.current.querySelector('.tui-mode-dialog');
    if (dialog) {
      resizeObserver.observe(dialog);
    }

    return () => resizeObserver.disconnect();
  }, [updatePosition, isPositioned]);

  // Focus the modal when positioned - blur any active element first
  useEffect(() => {
    if (isPositioned && modalRef.current) {
      // Use longer timeout to ensure focus happens after terminal's auto-focus attempts (10ms)
      const focusTimeout = setTimeout(() => {
        // First, blur whatever currently has focus (likely the terminal)
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }

        // Focus the first button in the dialog (the mode options)
        const firstButton = modalRef.current?.querySelector('.tui-mode-option') as HTMLElement;
        if (firstButton) {
          firstButton.focus();
        }
      }, 50);

      return () => clearTimeout(focusTimeout);
    }
  }, [isPositioned]);

  // Handle escape key to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel(paneId);
      }
    };

    // Capture phase to intercept before other handlers
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [paneId, onCancel]);

  const handleModeSelected = useCallback(
    (mode: "direct" | "sandbox", config?: SandboxConfig) => {
      onModeSelected(paneId, mode, config);
    },
    [paneId, onModeSelected]
  );

  // Build style object based on position
  const overlayStyle: React.CSSProperties = {
    left: modalPosition?.left ?? -9999,
    visibility: isPositioned ? "visible" : "hidden",
  };

  if (modalPosition?.expandUp) {
    overlayStyle.bottom = modalPosition.bottom;
  } else {
    overlayStyle.top = modalPosition?.top ?? -9999;
  }

  return (
    <>
      {/* Placeholder in the pane */}
      <div ref={containerRef} className="pending-pane">
        <div className="pending-pane-indicator">
          <span className="pending-pane-spinner" />
        </div>
      </div>

      {/* Backdrop overlay to darken the interface */}
      {createPortal(
        <div className="pending-modal-backdrop" />,
        document.body
      )}

      {/* Modal floating above, positioned relative to pane */}
      {createPortal(
        <div
          ref={modalRef}
          className={`pending-modal-overlay ${modalPosition?.expandUp ? "expand-up" : "expand-down"}`}
          style={overlayStyle}
        >
          <ModeSelectionModal
            isOpen={true}
            onModeSelected={handleModeSelected}
          />
        </div>,
        document.body
      )}
    </>
  );
}
