// SortableContainer.jsx
import React, { useMemo, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import SortableInstance from "./SortableInstance";

import { Settings, Maximize, Minimize, PlusSquare, GripVertical } from "lucide-react";
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
    transition: {
      duration: 120,
      easing: "cubic-bezier(0.25, 1, 0.5, 1)",
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    pointerEvents: isDragging ? "none" : "auto"
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

  const EDGE = 30;
  const HIT_PAD = 20;
  const INSET_X = 10; // match your real padding
  const DEBUG_HITBOXES = false;
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


        borderRadius: 10,
      }}
      className="container-shell bg-background2 rounded-md border border-border shadow-inner"

    >
      {/* HEADER */}
      <div
        className="container-header no-select"
        style={{
          userSelect: "none",
          flex: "0 0 auto",
          display: "flex",
          alignItems: "end",
          pointerEvents: (highlightDrop ? "none" : "auto"),
        }}
      >
        <div
          className="drag-handle cursor-grab active:cursor-grabbing touch-none"
          style={{ touchAction: "none" }}
          {...handleDragProps}
        >
          <GripVertical className="h-4 w-4 text-white" />
        </div>

        <div className="font-mono text-[10px] sm:text-xs"
          style={{ fontWeight: 500, padding: "0px 0px 0px 3px" }}>
          {container.label}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={onAdd}
        >

          <PlusSquare className="h-4 w-4 mr-[1px]" /> Instance
        </Button>

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
              left: -13,
              right: -13,
              top: -45,
              height: 95,
              pointerEvents: "none",
              borderRadius: 10,
              background: DEBUG_HITBOXES ? "rgba(255,0,0,0.15)" : "unset",
              zIndex: 2,
              maxWidth: "unset",

            }}
          />

          {/* LIST hitbox */}
          <div
            ref={list.setNodeRef}
            style={{
              position: "absolute",
              left: -13,
              right: -13,
              top: 50,
              bottom: 48,
              pointerEvents: "none",
              background: DEBUG_HITBOXES ? "rgba(255,0,0,0.15)" : "unset",
              zIndex: 1,
              borderRadius: 10,
              maxWidth: "unset",
            }}
          />

          {/* VISIBLE LIST */}
          <div
            className="container-list instance-pocket"
            style={{ position: "relative", zIndex: 2, overflow: "visible" }}
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


          </div>

          {/* BOTTOM hitbox */}
          <div
            ref={bottom.setNodeRef}
            style={{
              position: "absolute",
              left: -15,
              right: -15,
              bottom: -7,
              height: 55,
              zIndex: 2,
              pointerEvents: "none",
              background: DEBUG_HITBOXES ? "rgba(255,0,0,0.15)" : "unset",

              borderRadius: 10,
              maxWidth: "unset"

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