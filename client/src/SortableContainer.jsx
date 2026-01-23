// SortableContainer.jsx — DUMB COMPONENT
// ============================================================
// DRAG: Header is draggable (type: CONTAINER)
// DROP: List accepts INSTANCE, FILE, TEXT, URL
// ============================================================

import React, { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

import SortableInstance from "./SortableInstance";
import { Settings, PlusSquare, GripVertical } from "lucide-react";
import ButtonPopover from "./ui/ButtonPopover";
import ContainerForm from "./ui/ContainerForm";

import * as CommitHelpers from "./helpers/CommitHelpers";
import { useDraggable, useDroppable, useDragContext, DragType, DropAccepts } from "./helpers/dragSystem";

function SortableContainer({
  container,
  panelId,
  instancesById,
  addInstanceToContainer,
  isHot = false,
  dispatch,
  socket,
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
  // DRAG: Container header is draggable (disabled during instance drags)
  // ============================================================
  const { ref: dragRef, isDragging } = useDraggable({
    type: DragType.CONTAINER,
    id: container.id,
    data: container,
    context: { panelId, containerId: container.id },
    disabled: isInstanceDrag || isExternalDrag,
  });

  // ============================================================
  // DROP: Container list accepts instances + external
  // ============================================================
  const { ref: dropRef, isOver } = useDroppable({
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
  const highlightDrop = (isInstanceDrag || isExternalDrag) && (isHot || isOver);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div
      data-container-id={container.id}
      className="container-shell bg-background2 rounded-md border border-border shadow-inner"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "visible",
        outline: highlightDrop ? "2px solid rgba(50,150,255,0.9)" : "none",
        outlineOffset: 0,
        borderRadius: 10,
        pointerEvents: isDragging ? "none" : "auto",
        position: "relative",
        zIndex: isDragging ? 0 : 1,
        opacity: isDragging ? 0.3 : 1,
        transition: "opacity 0.15s, outline 0.1s",
      }}
    >
      {/* HEADER - Draggable */}
      <div
        ref={dragRef}
        className="container-header no-select"
        style={{
          userSelect: "none",
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          padding: "4px 6px",
          borderBottom: "1px solid var(--border)",
          cursor: (isInstanceDrag || isExternalDrag) ? "default" : "grab",
          pointerEvents: highlightDrop ? "none" : "auto",
        }}
      >
        {!(isInstanceDrag || isExternalDrag) && (
          <GripVertical className="h-4 w-4 text-muted-foreground mr-1" />
        )}

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
      </div>

      {/* LIST - Droppable */}
      <div
        ref={dropRef}
        className="container-list"
        style={{
          flex: 1,
          minHeight: 60,
          overflow: "auto",
          padding: 4,
        }}
      >
        {items.map((instance) => (
          <SortableInstance
            key={instance.id}
            instance={instance}
            containerId={container.id}
            panelId={panelId}
            dispatch={dispatch}
            socket={socket}
          />
        ))}

        {items.length === 0 && (
          <div
            className="text-xs text-muted-foreground p-2 text-center"
            style={{ fontStyle: "italic", opacity: 0.6 }}
          >
            Drop items here
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(SortableContainer);
