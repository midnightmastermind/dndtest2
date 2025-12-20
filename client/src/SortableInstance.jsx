import React, { useContext } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Instance from "./Instance";

function SortableInstanceInner({ instance, containerId, panelId, dispatch }) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: instance.id,
    data: { role: "instance", containerId, label: instance.label, panelId },
    transition: {
      duration: 120,
      easing: "cubic-bezier(0.25, 1, 0.5, 1)",
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    willChange: "transform",
    opacity: isDragging ? 0 : 1,
  };


  return (
    <div
      ref={setNodeRef}
      className={`no-select instance-wrap ${isDragging ? "is-dragging" : ""}`}
      style={{ ...style, touchAction: "none", boxSizing: "border-box" }}
    >
      <Instance
        dispatch={dispatch}
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
    prev.instance?.id === next.instance?.id &&
    prev.instance?.label === next.instance?.label
  );
});