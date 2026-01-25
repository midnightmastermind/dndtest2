// SortableContainer.jsx — DUMB COMPONENT
// ============================================================
// DRAG: Header is draggable (type: CONTAINER)
// DROP: List accepts INSTANCE, FILE, TEXT, URL
// ============================================================

import React, { useMemo, useCallback, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

import SortableInstance from "./SortableInstance";
import { Settings, PlusSquare, GripVertical } from "lucide-react";
import ButtonPopover from "./ui/ButtonPopover";
import ContainerForm from "./ui/ContainerForm";

import * as CommitHelpers from "./helpers/CommitHelpers";
import { useDragDrop, useDroppable, useDragContext, DragType, DropAccepts } from "./helpers/dragSystem";

function SortableContainer({
  container,
  panelId,
  panelLayoutOrientation = 'vertical',
  instancesById,
  addInstanceToContainer,
  isHot = false,
  dispatch,
  socket,
  gapPx = 12,
}) {
  // ============================================================
  // CONTEXT
  // ============================================================
  const dragCtx = useDragContext();
  const { isContainerDrag, isInstanceDrag, isExternalDrag } = dragCtx;

  // ============================================================
  // LOCAL STATE
  // ============================================================
  const [draft, setDraft] = useState(() => ({ label: container.label ?? "" }));

  useEffect(() => {
    setDraft({ label: container.label ?? "" });
  }, [container.id, container.label]);

  // ============================================================
  // ACTIONS
  // ============================================================
  const onAdd = useCallback(() => addInstanceToContainer(container.id), [addInstanceToContainer, container.id]);

  const commitLabel = useCallback(() => {
    const next = (draft?.label ?? "").trim();
    if (!next) return;
    CommitHelpers.updateContainer({ dispatch, socket, container: { ...container, label: next }, emit: true });
  }, [draft?.label, container, dispatch, socket]);

  const deleteMe = useCallback(() => {
    CommitHelpers.deleteContainer({ dispatch, socket, containerId: container.id, emit: true });
  }, [container.id, dispatch, socket]);

  // ============================================================
  // LAYOUT DETECTION
  // ============================================================
  // Allow ALL four edges for maximum flexibility
  // Users can drop containers from any direction, insertion position calculated by closest edge
  const containerAllowedEdges = useMemo(() => ['top', 'bottom', 'left', 'right'], []);

  // ============================================================
  // DRAG+DROP: Container is both draggable and accepts other containers for reordering
  // ============================================================
  const { ref: containerRef, isDragging, isOver: isContainerOver, closestEdge, props: containerProps } = useDragDrop({
    type: DragType.CONTAINER,
    id: container.id,
    data: container,
    context: { panelId, containerId: container.id },
    disabled: isInstanceDrag || isExternalDrag,
    accepts: [DragType.CONTAINER], // Only accept other containers for reordering
    allowedEdges: containerAllowedEdges,
  });

  // ============================================================
  // DROP: Container header accepts instances/external (inserts at top of list)
  // ============================================================
  const { ref: headerDropRef, isOver: isHeaderOver } = useDroppable({
    type: "container-header",
    id: `container-header:${container.id}`,
    context: { panelId, containerId: container.id, insertAt: 0 }, // insertAt: 0 signals top insertion
    accepts: DropAccepts.CONTAINER_LIST,
    disabled: isContainerDrag,
  });

  // ============================================================
  // DROP: Container list accepts instances + external
  // ============================================================
  const { ref: listDropRef, isOver: isListOver } = useDroppable({
    type: "container-list",
    id: `container-list:${container.id}`,
    context: { panelId, containerId: container.id },
    accepts: DropAccepts.CONTAINER_LIST,
    disabled: isContainerDrag,
  });

  // ============================================================
  // ITEMS
  // ============================================================
  const items = useMemo(() => {
    return (container.items || []).map((id) => instancesById[id]).filter(Boolean);
  }, [container.items, instancesById]);

  // ============================================================
  // HIGHLIGHT
  // ============================================================
  const highlightDrop = (isInstanceDrag || isExternalDrag) && (isHot || isHeaderOver || isListOver);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div
      ref={containerRef}
      data-container-id={container.id}
      className="container-shell bg-background2 rounded-md border border-border shadow-inner"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "visible",
        outline: highlightDrop ? "2px solid rgba(50,150,255,0.9)" : "none",
        outlineOffset: 0,
        borderRadius: 10,
        pointerEvents: isDragging ? "none" : "auto",
        position: "relative",
        zIndex: isDragging ? 0 : 1,
        opacity: isDragging ? 0.4 : 1,
        transition: "opacity 0.15s, outline 0.1s",
      }}
      {...containerProps}
    >
      {/* Drop Indicator - Container Reordering */}
      {isContainerOver && closestEdge === "top" && (
        <div
          style={{
            position: "absolute",
            top: -2,
            left: 0,
            right: 0,
            height: 2,
            backgroundColor: "rgb(50, 150, 255)",
            borderRadius: 1,
            zIndex: 10,
          }}
        />
      )}
      {isContainerOver && closestEdge === "bottom" && (
        <div
          style={{
            position: "absolute",
            bottom: -2,
            left: 0,
            right: 0,
            height: 2,
            backgroundColor: "rgb(50, 150, 255)",
            borderRadius: 1,
            zIndex: 10,
          }}
        />
      )}
      {isContainerOver && closestEdge === "left" && (
        <div
          style={{
            position: "absolute",
            left: -2,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: "rgb(50, 150, 255)",
            borderRadius: 1,
            zIndex: 10,
          }}
        />
      )}
      {isContainerOver && closestEdge === "right" && (
        <div
          style={{
            position: "absolute",
            right: -2,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: "rgb(50, 150, 255)",
            borderRadius: 1,
            zIndex: 10,
          }}
        />
      )}

      {/* HEADER - Draggable & Droppable (for inserting at top) */}
      <div
        ref={headerDropRef}
        className="container-header no-select"
        style={{
          userSelect: "none",
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          padding: "4px 6px",
          borderBottom: "1px solid var(--border)",
          cursor: (isInstanceDrag || isExternalDrag) ? "default" : "grab",
          background: isHeaderOver ? "rgba(50, 150, 255, 0.1)" : "transparent",
          transition: "background 0.1s",
          position: "relative",
        }}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground mr-1" />

        <span className="text-xs font-medium flex-1 truncate">
          {container.label || "Container"}
        </span>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onAdd}>
            <PlusSquare className="h-3 w-3" />
          </Button>

          <ButtonPopover label={<Settings className="h-3 w-3" />}>
            <ContainerForm
              value={draft}
              onChange={setDraft}
              onCommitLabel={commitLabel}
              onDeleteContainer={deleteMe}
              containerId={container.id}
            />
          </ButtonPopover>
        </div>

        {/* Top drop indicator - when hovering header to insert at top of list */}
        {/* Only show if container has items */}
        {isHeaderOver && items.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: -1,
              left: 4,
              right: 4,
              height: 2,
              backgroundColor: "rgb(50, 150, 255)",
              borderRadius: 1,
              zIndex: 10,
            }}
          />
        )}
      </div>

      {/* LIST - Droppable */}
      <div
        ref={listDropRef}
        className="container-list"
        style={{
          flex: items.length === 0 ? 1 : "0 0 auto",
          minHeight: items.length === 0 ? 40 : "fit-content",
          overflow: "auto",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          background: isListOver ? "rgba(50, 150, 255, 0.05)" : "transparent",
          transition: "background 0.1s",
          position: "relative",
        }}
      >
        {/* Always-visible pocket background */}
        <div
          style={{
            position: "absolute",
            top: "5px",
            left: "5px",
            right: "5px",
            bottom: items.length === 0 ? "8px" : "36px",
            minHeight: items.length === 0 ? "36px" : 0,
            borderRadius: "4px",
            background: "rgba(20, 25, 30, 0.4)",
            border: "1px solid rgba(0, 0, 0, 0.5)",
            boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.3)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        <div style={{ position: "relative", zIndex: 1, padding: "5px", flex: 1, display: "flex", flexDirection: "column" }}>
          {items.map((instance) => (
            <SortableInstance
              key={instance.id}
              instance={instance}
              containerId={container.id}
              panelId={panelId}
              dispatch={dispatch}
              socket={socket}
              allowedEdges={containerAllowedEdges}
            />
          ))}

          {items.length === 0 && (
            <div
              className="text-xs text-muted-foreground p-2 text-center"
              style={{
                fontStyle: "italic",
                opacity: 0.6,
                position: "relative",
                zIndex: 2,
                marginTop: "-5px",
                minHeight: "36px",
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Drop items here
            </div>
          )}
        </div>
      </div>

      {/* Invisible hitbox extending into gap below container */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: gapPx,
          marginBottom: -gapPx,
          pointerEvents: "auto",
          zIndex: 2,
        }}
      />
    </div>
  );
}

export default React.memo(SortableContainer);
