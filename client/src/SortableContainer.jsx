// SortableContainer.jsx
import React, { useMemo, useCallback, useState, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";

import SortableInstance from "./SortableInstance";
import { Settings, PlusSquare, GripVertical } from "lucide-react";
import ButtonPopover from "./ui/ButtonPopover";
import ContainerForm from "./ui/ContainerForm";

import * as CommitHelpers from "./helpers/CommitHelpers";

function SortableContainerInner({
  container,
  panelId,

  instancesById,
  addInstanceToContainer,
  isDraggingContainer,
  isInstanceDrag,

  // ✅ from parent
  isHot = false,
  hotRole = "",

  dispatch,
  socket, // ✅ required for hard commits
}) {
  const onAdd = useCallback(
    () => addInstanceToContainer(container.id),
    [addInstanceToContainer, container.id]
  );

  const [draft, setDraft] = useState(() => ({ label: container.label ?? "" }));

  useEffect(() => {
    setDraft({ label: container.label ?? "" });
  }, [container.id, container.label]);

  const commitLabel = useCallback(() => {
    const next = (draft?.label ?? "").trim();
    if (!next) return;

    // ✅ CommitHelpers expects { container } with id
    CommitHelpers.updateContainer({
      dispatch,
      socket,
      container: { id: container.id, label: next },
    });
  }, [draft?.label, container.id, dispatch, socket]);

  const deleteMe = useCallback(() => {
    CommitHelpers.deleteContainer({
      dispatch,
      socket,
      containerId: container.id,
    });
  }, [container.id, dispatch, socket]);

  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({
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
    willChange: "transform",
    opacity: isDragging ? 0 : 1,
    pointerEvents: isDragging ? "none" : "auto",
  };

  const items = useMemo(() => {
    return (container.items || []).map((id) => instancesById[id]).filter(Boolean);
  }, [container.items, instancesById]);

  const itemIds = useMemo(() => items.map((x) => x.id), [items]);

  // ✅ SINGLE droppable for entire container dropzone (top+list+bottom combined)
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

  const DEBUG_HITBOXES = false;
  const highlightDrop = isInstanceDrag && isHot;
  const handleDragProps = isInstanceDrag ? {} : { ...attributes, ...listeners };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "visible",
        outline: highlightDrop ? "2px solid rgba(50,150,255,0.9)" : "0px solid transparent",
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
          pointerEvents: highlightDrop ? "none" : "auto",
          gap: 6,
        }}
      >
        <div
          className="drag-handle cursor-grab active:cursor-grabbing touch-none"
          style={{ touchAction: "none" }}
          {...handleDragProps}
        >
          <GripVertical className="h-4 w-4 text-white" />
        </div>

        <div className="font-mono text-[10px] sm:text-xs" style={{ fontWeight: 500, paddingLeft: 3 }}>
          {container.label}
        </div>

        <div className="flex ml-auto">
          <ButtonPopover label={<Settings className="h-4 w-4" />}>
            <ContainerForm
              value={draft}
              onChange={setDraft}
              onCommitLabel={commitLabel}
              onDeleteContainer={deleteMe}
              containerId={container.id}
            />
          </ButtonPopover>

          <Button variant="ghost" size="sm" className="ml-auto" onClick={onAdd}>
            <PlusSquare className="h-4 w-4 mr-[1px]" />
          </Button>
        </div>
      </div>

      {/* BODY */}
      <div className="container-body" style={{ flex: 1, overflow: "visible", display: "flex" }}>
        <div className="container-list-wrap" style={{ position: "relative", flex: 1 }}>
          <div
            ref={list.setNodeRef}
            style={{
              position: "absolute",
              left: -15,
              right: -15,
              top: -30,
              bottom: -5,
              borderRadius: 10,
              background: DEBUG_HITBOXES ? "rgba(255,0,0,0.15)" : "unset",
              zIndex: 2,
              pointerEvents: "none",
              maxWidth: "unset",
              minHeight: "60px",
            }}
          />

          <div className="container-list instance-pocket" style={{ position: "relative", overflow: "visible", zIndex: 1 }}>
            {items.length > 0 && (
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
                    dispatch={dispatch}
                    socket={socket} // ✅ pass through for InstanceInner commits
                  />
                ))}
              </SortableContext>
            )}
          </div>
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

  if (prev.isHot !== next.isHot) return false;
  if (prev.hotRole !== next.hotRole) return false;

  if (prev.dispatch !== next.dispatch) return false;
  if (prev.socket !== next.socket) return false;
  return true;
});
