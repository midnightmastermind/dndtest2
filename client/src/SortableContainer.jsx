import React, { useContext, useMemo, useCallback } from "react";
import { useDroppable, useDndContext } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { GridDataContext } from "./GridDataContext";
import { GridActionsContext } from "./GridActionsContext";
import SortableInstance from "./SortableInstance";

function SortableContainerInner({ container }) {
  const { instances } = useContext(GridDataContext);
  const { addInstanceToContainer, useRenderCount } = useContext(GridActionsContext);
  const { over } = useDndContext();

  const onAdd = useCallback(() => addInstanceToContainer(container.id), [
    addInstanceToContainer,
    container.id,
  ]);

  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({
      id: container.id,
      data: { role: "container", containerId: container.id, label: container.label },
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const top = useDroppable({
    id: `top:${container.id}`,
    data: { role: "container:top", containerId: container.id, label: container.label },
  });

  const list = useDroppable({
    id: `list:${container.id}`,
    data: { role: "container:list", containerId: container.id, label: container.label },
  });

  const bottom = useDroppable({
    id: `bottom:${container.id}`,
    data: { role: "container:bottom", containerId: container.id, label: container.label },
  });

  const instanceMap = useMemo(() => {
    const map = {};
    for (const inst of instances) map[inst.id] = inst;
    return map;
  }, [instances]);

  const items = useMemo(() => {
    return container.items.map((id) => instanceMap[id]).filter(Boolean);
  }, [container.items, instanceMap]);

  const itemIds = useMemo(() => items.map((x) => x.id), [items]);

  const overContainerId =
    over?.data?.current?.containerId ??
    (typeof over?.id === "string" && over.id.startsWith("list:")
      ? over.id.slice("list:".length)
      : null);

  const isHoveringThisContainer =
    list.isOver || (overContainerId && overContainerId === container.id);

  useRenderCount(`SortableContainer ${container.id}`);

  return (
    <div ref={setNodeRef} style={style} className="container-shell">
      <div className="container-header" {...attributes} {...listeners}>
        <div style={{ fontWeight: 600 }}>{container.label}</div>
        <button onClick={onAdd}>+ Instance</button>
      </div>

      <div
        ref={list.setNodeRef}
        className={"container-list" + (isHoveringThisContainer ? " over" : "")}
      >
        <SortableContext
          id={`container-sortable:${container.id}`}
          items={itemIds}
          strategy={verticalListSortingStrategy}
        >
          {items.map((inst) => (
            <SortableInstance key={inst.id} instance={inst} containerId={container.id} />
          ))}
        </SortableContext>

        {items.length === 0 && (
          <div style={{ fontSize: 12, opacity: 0.6, fontStyle: "italic" }}>
            Drop items here
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(SortableContainerInner, (prev, next) => {
  // Rerender container if label changes OR items list changed
  if (prev.container?.id !== next.container?.id) return false;
  if (prev.container?.label !== next.container?.label) return false;

  const a = prev.container?.items || [];
  const b = next.container?.items || [];
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;

  return true;
});
