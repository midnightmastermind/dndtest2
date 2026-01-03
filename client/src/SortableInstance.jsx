// SortableInstance.jsx — UPDATED: CommitHelpers emit-flag compatibility pass-through unchanged
import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Instance from "./Instance";

function SortableInstanceInner({ instance, containerId, panelId, dispatch, socket }) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: instance.id,
    data: { role: "instance", containerId, label: instance.label, panelId, instanceId: instance.id},
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    willChange: "transform",
    opacity: isDragging ? 0 : 1,
    pointerEvents: isDragging ? "none" : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      data-instance-id={instance.id}
      className={`no-select instance-wrap ${isDragging ? "is-dragging" : ""}`}
      style={{ ...style, touchAction: "none", boxSizing: "border-box" }}
    >
      <Instance
        dispatch={dispatch}
        socket={socket}
        id={instance.id}
        label={instance.label}
        overlay={false}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  );
}

export default React.memo(SortableInstanceInner, (prev, next) => {
  return (
    prev.containerId === next.containerId &&
    prev.panelId === next.panelId &&
    prev.instance?.id === next.instance?.id &&
    prev.instance?.label === next.instance?.label &&
    prev.dispatch === next.dispatch &&
    prev.socket === next.socket
  );
});