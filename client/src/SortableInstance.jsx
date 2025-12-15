import React, { useContext } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { GridActionsContext } from "./GridActionsContext";
import Instance from "./Instance";

function SortableInstanceInner({ instance, containerId }) {
  const { useRenderCount } = useContext(GridActionsContext);

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: instance.id,
    data: { role: "instance", containerId, label: instance.label },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  useRenderCount(`SortableInstance ${instance.id}`);

  return (
    <div className="no-select" ref={setNodeRef} style={style}>
      <Instance
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