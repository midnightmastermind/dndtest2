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
  containerId,
  panelId,
  dispatch,
  socket,
}) {
  // ============================================================
  // CONTEXT
  // ============================================================
  const dragCtx = useDragContext();
  const { isContainerDrag } = dragCtx;

  // ============================================================
  // DRAG + DROP: Instance is both draggable AND a drop target (for sorting)
  // ============================================================
  const { ref, isDragging, isOver, props } = useDragDrop({
    type: DragType.INSTANCE,
    id: instance.id,
    data: instance,
    context: { containerId, panelId, instanceId: instance.id },
    disabled: isContainerDrag,
    nativeEnabled: true,
    accepts: DropAccepts.INSTANCE,
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
        background: isOver ? "rgba(50,150,255,0.1)" : "transparent",
        borderRadius: 4,
        transition: "opacity 0.1s, background 0.1s",
        marginBottom: 2,
      }}
      {...props}
    >
      <Instance
        id={instance.id}
        label={instance.label}
        dispatch={dispatch}
        socket={socket}
      />
    </div>
  );
}

export default React.memo(SortableInstance);
