import React, { useContext, useMemo, useCallback } from "react";
import { useDroppable, useDndContext, DragOverlay } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createPortal } from "react-dom";

import { GridDataContext } from "./GridDataContext";
import { GridActionsContext } from "./GridActionsContext";
import SortableInstance from "./SortableInstance";
import Instance from "./Instance";
import MoreVerticalIcon from "@atlaskit/icon/glyph/more-vertical";

function SortableContainerInner({ container, panelId }) {
  const { state, containersRender } = useContext(GridDataContext);
  const { addInstanceToContainer, useRenderCount } = useContext(GridActionsContext);
  const { over, active } = useDndContext();

  const activeRole = active?.data?.current?.role ?? null;
  const isDraggingContainer = activeRole === "container";
  const isDraggingInstance = activeRole === "instance";

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
    data: { role: "container", containerId: container.id, panelId, label: container.label },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
opacity: isDragging ? 0 : 1,
pointerEvents: isDragging ? "none" : "auto",
  };

  useDroppable({
    id: `top:${container.id}`,
    disabled: isDraggingContainer,
    data: { role: "container:top", containerId: container.id, label: container.label },
  });

  const list = useDroppable({
    id: `list:${container.id}`,
    disabled: isDraggingContainer,
    data: { role: "container:list", containerId: container.id, label: container.label },
  });

  useDroppable({
    id: `bottom:${container.id}`,
    disabled: isDraggingContainer,
    data: { role: "container:bottom", containerId: container.id, label: container.label },
  });

  const instanceMap = useMemo(() => {
    const map = {};
    for (const inst of state.instances || []) map[inst.id] = inst;
    return map;
  }, [state.instances]);

  const items = useMemo(() => {
    return (container.items || []).map((id) => instanceMap[id]).filter(Boolean);
  }, [container.items, instanceMap]);

  const itemIds = useMemo(() => items.map((x) => x.id), [items]);

  const overContainerId =
    isDraggingInstance
      ? (over?.data?.current?.containerId ??
        (typeof over?.id === "string" && over.id.startsWith("list:")
          ? over.id.slice("list:".length)
          : null))
      : null;

  const isHoveringThisContainer =
    isDraggingInstance &&
    (list.isOver || (overContainerId && overContainerId === container.id));

  const activeInstance =
  active?.data?.current?.role === "instance"
    ? state.instances.find((x) => x.id === active.id)
    : null;

  const isOverlayHost =
    isDraggingInstance &&
    (!containersRender?.length || containersRender[0]?.id === container.id);

  useRenderCount(`SortableContainer ${container.id}`);

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,

        // ✅ make container-shell a column layout so only content scrolls
        display: "flex",
        flexDirection: "column",
        overflow: "visible" // keep scroll contained to our inner scroller
      }}
      className="container-shell"
    >
      {/* HEADER (fixed) */}
      <div
        className="container-header no-select"
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div style={{ cursor: "grab", touchAction: "none" }} {...attributes} {...listeners}>
          <MoreVerticalIcon size="small" primaryColor="#9AA0A6" />
        </div>

        <div style={{ fontWeight: 600, padding: "0px 10px" }}>{container.label}</div>

        <button
          style={{ marginLeft: "auto" }}
          onPointerDown={(e) => e.stopPropagation()} // ✅ prevents accidental drag
          onClick={onAdd}
        >
          + Instance
        </button>
      </div>

      {/* ✅ SCROLL AREA (only this scrolls) */}
      <div
  style={{
    flex: "0 0 auto",
    overflow: "visible",
    padding: 5,
  }}
>
  <div
    ref={list.setNodeRef}
    className={"container-list" + (isHoveringThisContainer ? " over" : "")}
    style={{ overflow: "visible" }}
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
            <div className="no-select" style={{ fontSize: 12, opacity: 0.6, fontStyle: "italic" }}>
              Drop items here
            </div>
          )}
        </div>
      </div>

{activeInstance &&
  createPortal(
    <DragOverlay adjustScale={false}>
      <div
        style={{
          pointerEvents: "none",
          opacity: 0.95,
        }}
      >
        <Instance
          id={`overlay-${activeInstance.id}`}
          label={activeInstance.label}
          overlay
        />
      </div>
    </DragOverlay>,
    document.body
  )}
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

  return true;
});
