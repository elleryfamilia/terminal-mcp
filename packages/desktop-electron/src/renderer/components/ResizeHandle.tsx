/**
 * Resize Handle Component
 *
 * A draggable divider between split panes that allows resizing.
 */

import { useCallback, useRef, useEffect } from "react";
import type { SplitDirection } from "../types/pane";

interface ResizeHandleProps {
  direction: SplitDirection;
  onDrag: (delta: number) => void;
  onDragEnd: () => void;
}

export function ResizeHandle({
  direction,
  onDrag,
  onDragEnd,
}: ResizeHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const lastPositionRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      lastPositionRef.current =
        direction === "horizontal" ? e.clientX : e.clientY;
      document.body.style.cursor =
        direction === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [direction]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const currentPosition =
        direction === "horizontal" ? e.clientX : e.clientY;
      const delta = currentPosition - lastPositionRef.current;
      lastPositionRef.current = currentPosition;

      onDrag(delta);
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        onDragEnd();
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [direction, onDrag, onDragEnd]);

  return (
    <div
      ref={handleRef}
      className={`resize-handle resize-handle-${direction}`}
      onMouseDown={handleMouseDown}
    />
  );
}
