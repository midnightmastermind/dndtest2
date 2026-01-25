import { useCallback, useRef } from "react";

/**
 * GridResizeHandle - Renders resize handles between grid cells
 * @param {string} direction - "horizontal" (resize rows) or "vertical" (resize columns)
 * @param {number} index - The index of the cell before this handle
 * @param {number} row - Grid row position
 * @param {number} col - Grid column position
 * @param {function} onResize - Callback(index, delta) when resizing
 */
function GridResizeHandle({ direction, index, row, col, onResize }) {
  const startRef = useRef(null);

  const handleStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    const startPos = direction === "vertical"
      ? (e.clientX || e.touches?.[0]?.clientX)
      : (e.clientY || e.touches?.[0]?.clientY);

    startRef.current = { startPos, totalDelta: 0 };

    const handleMove = (moveEvent) => {
      if (!startRef.current) return;

      const currentPos = direction === "vertical"
        ? (moveEvent.clientX || moveEvent.touches?.[0]?.clientX)
        : (moveEvent.clientY || moveEvent.touches?.[0]?.clientY);

      const delta = currentPos - startRef.current.startPos;
      startRef.current.totalDelta = delta;

      // Call onResize with accumulated delta
      onResize?.(index, delta);
    };

    const handleEnd = () => {
      if (startRef.current) {
        startRef.current = null;
      }

      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);
  }, [direction, index, onResize]);

  const isVertical = direction === "vertical";

  return (
    <div
      onMouseDown={handleStart}
      onTouchStart={handleStart}
      style={{
        position: "absolute",
        ...(isVertical ? {
          // Vertical handle (between columns)
          left: `calc(${(col / (col + 1)) * 100}% - 3px)`,
          top: 0,
          width: "6px",
          height: "100%",
          cursor: "col-resize",
        } : {
          // Horizontal handle (between rows)
          top: `calc(${(row / (row + 1)) * 100}% - 3px)`,
          left: 0,
          width: "100%",
          height: "6px",
          cursor: "row-resize",
        }),
        background: "transparent",
        zIndex: 100,
        touchAction: "none",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(50, 150, 255, 0.3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    />
  );
}

export default GridResizeHandle;
