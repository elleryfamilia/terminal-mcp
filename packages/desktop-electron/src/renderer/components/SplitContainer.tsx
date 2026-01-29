/**
 * Split Container Component
 *
 * A flexbox container that holds two child panes with a resize handle.
 */

import { useCallback, useRef } from "react";
import { ResizeHandle } from "./ResizeHandle";
import type { SplitDirection } from "../types/pane";

interface SplitContainerProps {
  id: string;
  direction: SplitDirection;
  splitRatio: number;
  onRatioChange: (splitPaneId: string, newRatio: number) => void;
  first: React.ReactNode;
  second: React.ReactNode;
}

export function SplitContainer({
  id,
  direction,
  splitRatio,
  onRatioChange,
  first,
  second,
}: SplitContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDrag = useCallback(
    (delta: number) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const totalSize = direction === "horizontal" ? rect.width : rect.height;

      if (totalSize === 0) return;

      const deltaRatio = delta / totalSize;
      const newRatio = Math.max(0.1, Math.min(0.9, splitRatio + deltaRatio));

      onRatioChange(id, newRatio);
    },
    [id, direction, splitRatio, onRatioChange]
  );

  const handleDragEnd = useCallback(() => {
    // Could save the ratio here if persistence is needed
  }, []);

  const isHorizontal = direction === "horizontal";
  const firstSize = `${splitRatio * 100}%`;
  const secondSize = `${(1 - splitRatio) * 100}%`;

  return (
    <div
      ref={containerRef}
      className={`split-container split-container-${direction}`}
      style={{
        flexDirection: isHorizontal ? "row" : "column",
      }}
    >
      <div
        className="split-pane-first"
        style={{
          [isHorizontal ? "width" : "height"]: firstSize,
          flexShrink: 0,
          flexGrow: 0,
        }}
      >
        {first}
      </div>
      <ResizeHandle
        direction={direction}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
      />
      <div
        className="split-pane-second"
        style={{
          [isHorizontal ? "width" : "height"]: secondSize,
          flexShrink: 0,
          flexGrow: 0,
        }}
      >
        {second}
      </div>
    </div>
  );
}
