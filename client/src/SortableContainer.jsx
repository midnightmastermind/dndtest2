// SortableContainer.jsx — DUMB COMPONENT
// ============================================================
// DRAG: Header is draggable (type: CONTAINER)
// DROP: List accepts INSTANCE, FILE, TEXT, URL
// ============================================================

import React, { useMemo, useCallback, useState, useEffect, useContext } from "react";
import { Button } from "@/components/ui/button";

import SortableInstance from "./SortableInstance";
import { Settings, PlusSquare, GripVertical, Copy } from "lucide-react";
import ButtonPopover from "./ui/ButtonPopover";
import ContainerForm from "./ui/ContainerForm";
import RadialMenu from "./ui/RadialMenu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { GridActionsContext } from "./GridActionsContext";
import * as CommitHelpers from "./helpers/CommitHelpers";
import { getContainerItems, getContainerItemsWithOccurrences } from "./helpers/LayoutHelpers";
import { useDragDrop, useDroppable, useDragContext, DragType, DropAccepts } from "./helpers/dragSystem";

function SortableContainer({
  container,
  panelId,
  panelLayoutOrientation = 'vertical',
  addInstanceToContainer,
  isHot = false,
  dispatch,
  socket,
  gapPx = 12,
}) {
  // ============================================================
  // CONTEXT
  // ============================================================
  const { occurrencesById, instancesById } = useContext(GridActionsContext);
  const dragCtx = useDragContext();
  const { isContainerDrag, isInstanceDrag, isExternalDrag, isPanelDrag, dragMode, toggleDragMode } = dragCtx;

  // ============================================================
  // LOCAL STATE
  // ============================================================
  const [draft, setDraft] = useState(() => ({ label: container.label ?? "" }));
  const [isHoveringBottomSpace, setIsHoveringBottomSpace] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const containerDragMode = container?.defaultDragMode || "move";

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

  const commitIteration = useCallback((nextIteration) => {
    CommitHelpers.updateContainer({ dispatch, socket, container: { ...container, iteration: nextIteration }, emit: true });
  }, [container, dispatch, socket]);

  const commitDragMode = useCallback((nextMode) => {
    CommitHelpers.updateContainer({ dispatch, socket, container: { ...container, defaultDragMode: nextMode }, emit: true });
  }, [container, dispatch, socket]);

  // ============================================================
  // LAYOUT DETECTION
  // ============================================================
  // Allow ALL four edges for maximum flexibility
  // Users can drop containers from any direction, insertion position calculated by closest edge
  const containerAllowedEdges = useMemo(() => ['top', 'bottom', 'left', 'right'], []);

  // ============================================================
  // DRAG+DROP: Container is both draggable and accepts other containers for reordering
  // ============================================================
  // Include full instance objects for cross-window copying
  const containerWithInstances = useMemo(() => {
    const instanceObjects = getContainerItems(container, occurrencesById, instancesById);
    return {
      ...container,
      instanceObjects, // Add resolved instances for cross-window copy
    };
  }, [container, occurrencesById, instancesById]);

  const { ref: containerRef, isDragging, isOver: isContainerOver, closestEdge, props: containerProps } = useDragDrop({
    type: DragType.CONTAINER,
    id: container.id,
    data: containerWithInstances,
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
  // ITEMS - lookup instances via occurrences (with occurrence data for fields)
  // ============================================================
  const itemsWithOccurrences = useMemo(
    () => getContainerItemsWithOccurrences(container, occurrencesById, instancesById),
    [container, occurrencesById, instancesById]
  );

  // For backward compatibility with code that just needs instance count
  const items = useMemo(
    () => itemsWithOccurrences.map(item => item.instance),
    [itemsWithOccurrences]
  );

  // ============================================================
  // HIGHLIGHT
  // ============================================================
  // Show outline only for instance/external drops, not container reordering
  const highlightDrop = (isHot || isHeaderOver || isListOver) && (isInstanceDrag || isExternalDrag);

  const toggleContainerDragModeQuick = useCallback(() => {
    const nextMode = containerDragMode === "move" ? "copy" : "move";
    CommitHelpers.updateContainer({
      dispatch,
      socket,
      container: { ...container, defaultDragMode: nextMode },
      emit: true,
    });
  }, [container, containerDragMode, dispatch, socket]);

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
        pointerEvents: (isDragging || isPanelDrag) ? "none" : "auto",
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

      <div
        ref={headerDropRef}
        className="container-header no-select border-b border-gray-700 border-solid"
        style={{
          userSelect: "none",
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          cursor: (isInstanceDrag || isExternalDrag) ? "default" : "grab",
          position: "relative",
          height: "20px"
        }}
      >
        {/* ✅ Radial drag/menu handle + settings popover + add */}
        <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
          <PopoverTrigger asChild>
            <div
              style={{ position: "relative", zIndex: 50, height: "100%", display: "flex" }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <RadialMenu
                dragMode={containerDragMode}
                onToggleDragMode={toggleContainerDragModeQuick}
                onSettings={() => setSettingsOpen(true)}
                onAddChild={onAdd}
                addLabel="Item"
                size="sm"
              />
            </div>
          </PopoverTrigger>

          <PopoverContent align="start" side="right" className="w-auto">
            <ContainerForm
              value={draft}
              onChange={setDraft}
              onCommitLabel={commitLabel}
              onDeleteContainer={deleteMe}
              containerId={container.id}
              iteration={container.iteration}
              onIterationChange={commitIteration}
              defaultDragMode={container.defaultDragMode}
              onDragModeChange={commitDragMode}
            />
          </PopoverContent>
        </Popover>

        {/* label */}
        <span className="text-xs font-medium flex-1 pl-1 truncate">
          {container.label || "Container"}
        </span>

        {/* Top insert indicator stays exactly as you had it */}
        {isHeaderOver && (isInstanceDrag || isExternalDrag) && items.length > 0 && (
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

        {/* Bottom drop indicator - when hovering empty space at bottom 
        {isListOver && (isInstanceDrag || isExternalDrag) && items.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 5,
              left: 9,
              right: 9,
              height: 2,
              backgroundColor: "rgb(50, 150, 255)",
              borderRadius: 1,
              zIndex: 10,
              pointerEvents: "none",
            }}
          />
        )}*/}

        <div style={{ position: "relative", zIndex: 1, padding: "5px", flex: 1, display: "flex", flexDirection: "column" }}>
          {itemsWithOccurrences.map(({ instance, occurrence }) => (
            <SortableInstance
              key={instance.id}
              instance={instance}
              occurrence={occurrence}
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
