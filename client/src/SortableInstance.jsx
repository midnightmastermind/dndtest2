// SortableInstance.jsx — DUMB COMPONENT
// ============================================================
// DRAG: Entire element is draggable (type: INSTANCE)
// DROP: Accepts INSTANCE (for sorting/reordering)
// ============================================================

import React from "react";
import Instance from "./Instance";
import { useDragDrop, useDragContext, DragType, DropAccepts } from "./helpers/dragSystem";

function SortableInstance({
  instance,
  occurrence,
  containerId,
  panelId,
  dispatch,
  socket,
  allowedEdges = ['top', 'bottom'], // Default to vertical layout
}) {
  // ============================================================
  // CONTEXT
  // ============================================================
  const dragCtx = useDragContext();
  const { isContainerDrag } = dragCtx;

  // Determine if horizontal layout based on allowedEdges
  const isHorizontal = allowedEdges.includes('left') || allowedEdges.includes('right');

  // ============================================================
  // DRAG + DROP: Instance is both draggable AND a drop target (for sorting)
  // ============================================================
  const { ref, isDragging, isOver, closestEdge, props } = useDragDrop({
    type: DragType.INSTANCE,
    id: instance.id,
    data: instance,
    context: { containerId, panelId, instanceId: instance.id },
    disabled: isContainerDrag,
    nativeEnabled: true,
    accepts: DropAccepts.INSTANCE,
    allowedEdges,
  });

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div
      ref={ref}
      data-instance-id={instance.id}
      className="no-select instance-wrap"
      style={{
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        opacity: isDragging ? 0.4 : 1,
        background: "transparent",
        borderRadius: 4,
        transition: "opacity 0.1s",
        marginBottom: 2,
        position: "relative",
      }}
      {...props}
    >
      {/* Drop Indicator - shows where item will be inserted */}
      {/* Only show "before" indicators (top/left) to avoid duplicate lines */}
      {isOver && closestEdge === "top" && (
        <div
          style={{
            position: "absolute",
            top: -3,
            left: -1,
            right: -1,
            height: 3,
            backgroundColor: "rgb(50, 150, 255)",
            borderRadius: 1,
            zIndex: 100,
          }}
        />
      )}
      {isOver && closestEdge === "bottom" && (
        <div
          style={{
            position: "absolute",
            bottom: -3,
            left: -1,
            right: -1,
            height: 3,
            backgroundColor: "rgb(50, 150, 255)",
            borderRadius: 1,
            zIndex: 100,
          }}
        />
      )}
      {isOver && closestEdge === "left" && (
        <div
          style={{
            position: "absolute",
            left: -3,
            top: -1,
            bottom: -1,
            width: 3,
            backgroundColor: "rgb(50, 150, 255)",
            borderRadius: 1,
            zIndex: 100,
          }}
        />
      )}
      {isOver && closestEdge === "right" && (
        <div
          style={{
            position: "absolute",
            right: -3,
            top: -1,
            bottom: -1,
            width: 3,
            backgroundColor: "rgb(50, 150, 255)",
            borderRadius: 1,
            zIndex: 100,
          }}
        />
      )}

      <Instance
        id={instance.id}
        label={instance.label}
        instance={instance}
        occurrence={occurrence}
        dispatch={dispatch}
        socket={socket}
      />
    </div>
  );
}

export default React.memo(SortableInstance);
