// SortableContainer.jsx
import React, { useMemo, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import SortableInstance from "./SortableInstance";
import MoreVerticalIcon from "@atlaskit/icon/glyph/more-vertical";

function SortableContainerInner({
  container,
  panelId,

  // ✅ injected (no context subscriptions)
  instancesById,
  addInstanceToContainer,
  isDraggingContainer,
  overData, // ✅ add
  isInstanceDrag,
}) {
  const onAdd = useCallback(() => addInstanceToContainer(container.id), [
    addInstanceToContainer,
    container.id,
  ]);

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: container.id,
    data: {
      role: "container",
      containerId: container.id,
      panelId,
      label: container.label,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    pointerEvents: isDragging ? "none" : "auto",
  };

  const items = useMemo(() => {
    return (container.items || []).map((id) => instancesById[id]).filter(Boolean);
  }, [container.items, instancesById]);

  const itemIds = useMemo(() => items.map((x) => x.id), [items]);

  const top = useDroppable({
    id: `top:${container.id}`,
    disabled: isDraggingContainer,
    data: {
      role: "container:top",
      containerId: container.id,
      label: container.label,
      panelId,
    },
  });

  const list = useDroppable({
    id: `list:${container.id}`,
    disabled: isDraggingContainer,
    data: {
      role: "container:list",
      containerId: container.id,
      label: container.label,
      panelId,
    },
  });

  const bottom = useDroppable({
    id: `bottom:${container.id}`,
    disabled: isDraggingContainer,
    data: {
      role: "container:bottom",
      containerId: container.id,
      label: container.label,
      panelId,
    },
  });

  const EDGE = 15;
  const HIT_PAD = 30;

  const roleStr = typeof overData?.role === "string" ? overData.role : "";
  const isOverThisContainer =
    (roleStr.startsWith("container:") && overData?.containerId === container.id) ||
    (roleStr === "instance" && overData?.containerId === container.id);

  const highlightDrop = isInstanceDrag && isOverThisContainer;
// inside SortableContainerInner()

const handleDragProps = isInstanceDrag
  ? {} // ✅ do NOT attach activators during instance drag
  : { ...attributes, ...listeners };
  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: "flex",
        flexDirection: "column",
        overflow: "visible",

        // ✅ LAYOUT-SAFE HIGHLIGHT (does not change element rect)
        outline: highlightDrop
          ? "2px solid rgba(50,150,255,0.9)"
          : "0px solid transparent",
        outlineOffset: 0,

        // keep your inset glow (doesn't affect layout)
        boxShadow: highlightDrop
          ? "0 0 0 3px rgba(50,150,255,0.25) inset"
          : undefined,

        borderRadius: 10,
      }}
      className="container-shell"
    >
      {/* HEADER */}
      <div
        className="container-header no-select"
        style={{
          userSelect: "none",
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          pointerEvents: (highlightDrop ? "none" : "auto"),
        }}
      >
        {!highlightDrop && <div
          className="drag-handle"
          style={{ cursor: "grab", touchAction: "none" }}
          {...handleDragProps}
        >
          <MoreVerticalIcon size="small" primaryColor="#9AA0A6" />
        </div>
}
        <div style={{ fontWeight: 600, padding: "0px 0px 0px 10px" }}>
          {container.label}
        </div>

        {!highlightDrop && <button
  style={{ marginLeft: "auto", touchAction: "manipulation" }}
  onPointerDown={(e) => {
    if (!isInstanceDrag) {
      e.stopPropagation();
      e.preventDefault();
    }
  }}
  onClick={onAdd}
>
  + Instance
</button>
}
      </div>

      {/* BODY */}
      <div
        className="container-body"
        style={{ flex: "1", overflow: "visible", padding: 5, display: "flex" }}
      >
        <div className="container-list-wrap" style={{ position: "relative", flex: 1 }}>
          {/* TOP hitbox */}
          <div
            ref={top.setNodeRef}
            style={{
              position: "absolute",
              left: -HIT_PAD,
              right: -HIT_PAD,
              top: -HIT_PAD,
              height: EDGE + HIT_PAD,
              pointerEvents: "none",
              borderRadius: 10,
            }}
          />

          {/* LIST hitbox */}
          <div
            ref={list.setNodeRef}
            style={{
              position: "absolute",
              left: -HIT_PAD,
              right: -HIT_PAD,
              top: EDGE,
              bottom: EDGE,
              pointerEvents: "none",
              borderRadius: 10,
            }}
          />

          {/* VISIBLE LIST */}
          <div
            className="container-list"
            style={{ position: "relative", zIndex: 1, overflow: "visible" }}
          >
            <SortableContext
              id={`container-sortable:${container.id}`}
              items={itemIds}
              strategy={verticalListSortingStrategy}
            >
              {items.map((inst) => (
                <SortableInstance
                  key={inst.id}
                  instance={inst}
                  containerId={container.id}
                  panelId={panelId}
                />
              ))}
            </SortableContext>

            {items.length === 0 && (
              <div
                className="no-select"
                style={{
                  fontSize: 12,
                  opacity: 0.6,
                  fontStyle: "italic",
                  pointerEvents: "none",
                }}
              >
                Drop items here
              </div>
            )}
          </div>

          {/* BOTTOM hitbox */}
          <div
            ref={bottom.setNodeRef}
            style={{
              position: "absolute",
              left: -HIT_PAD,
              right: -HIT_PAD,
              bottom: -HIT_PAD,
              height: EDGE + HIT_PAD,
              pointerEvents: "none",
              borderRadius: 10,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default React.memo(SortableContainerInner, (prev, next) => {
  if (prev.container?.id !== next.container?.id) return false;
  if (prev.container?.label !== next.container?.label) return false;

  const a = prev.container?.items || [];
  const b = next.container?.items || [];
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;

  if (prev.instancesById !== next.instancesById) return false;
  if (prev.isDraggingContainer !== next.isDraggingContainer) return false;
  if (prev.isInstanceDrag !== next.isInstanceDrag) return false;

  const pr = prev.overData?.role ?? null;
  const nr = next.overData?.role ?? null;
  if (pr !== nr) return false;

  const pc = prev.overData?.containerId ?? null;
  const nc = next.overData?.containerId ?? null;
  if (pc !== nc) return false;

  return true;
});