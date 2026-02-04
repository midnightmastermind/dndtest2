// Panel.jsx — DUMB COMPONENT
// ============================================================
// DRAG: Header is draggable (type: PANEL)
// DROP: Content accepts CONTAINER, INSTANCE, FILE, TEXT, URL
// ============================================================

import React, { useRef, useMemo, useState, useCallback, useEffect, useContext } from "react";
import ResizeHandle from "./ResizeHandle";
import RadialMenu from "./ui/RadialMenu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

import { Button } from "./components/ui/button";
import ButtonPopover from "./ui/ButtonPopover";
import LayoutForm from "./ui/LayoutForm";

import { GridActionsContext } from "./GridActionsContext";
import * as CommitHelpers from "./helpers/CommitHelpers";
import { getPanelContainers, getContainerItems } from "./helpers/LayoutHelpers";
import { useDraggable, useDroppable, useDragContext, DragType, DropAccepts } from "./helpers/dragSystem";

import {
  Settings,
  Maximize,
  Minimize,
  PlusSquare,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Copy,
} from "lucide-react";

// ============================================================
// LAYOUT HELPERS
// ============================================================
function getDefaultLayout() {
  return {
    name: "",
    display: "grid",
    flow: "row",
    wrap: "wrap",
    columns: 0,
    rows: 0,
    gapPx: 12,
    alignItems: "start",
    alignContent: "start",
    justify: "start",
    dense: false,
    padding: "none",
    scrollY: "auto",
    widthMode: "auto",
    fixedWidth: 340,
    heightMode: "auto",
    fixedHeight: 0,
    style: { display: "block" },
    lock: { enabled: false, containersDrag: true, containersDrop: true, instancesDrag: true, instancesDrop: true },
  };
}

function mergeLayout(panelLayout) {
  const base = getDefaultLayout();
  const next = panelLayout && typeof panelLayout === "object" ? panelLayout : {};
  return {
    ...base,
    ...next,
    style: { ...base.style, ...(next.style || {}) },
    lock: { ...base.lock, ...(next.lock || {}) },
  };
}

// ============================================================
// PANEL COMPONENT
// ============================================================
function Panel({
  panel,
  components,
  dispatch,
  socket,
  cols,
  rows,
  addContainerToPanel,
  addInstanceToContainer,
  sizesRef,
  fullscreenPanelId,
  setFullscreenPanelId,
  forceFullscreen = false,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const panelDragMode = panel?.defaultDragMode || "move";
  // ============================================================
  // CONTEXT
  // ============================================================
  const { occurrencesById, instancesById, containersById } = useContext(GridActionsContext);
  const dragCtx = useDragContext();
  const {
    hotTarget,
    isContainerDrag,
    isInstanceDrag,
    isExternalDrag,
    getStackForPanel,
    cyclePanelStack,
    dragMode,
    toggleDragMode,
  } = dragCtx;

  // ============================================================
  // LAYOUT STATE
  // ============================================================
  const layout = useMemo(() => mergeLayout(panel?.layout), [panel?.layout]);
  const layoutSaveTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(layoutSaveTimer.current), []);

  const togglePanelDragModeQuick = useCallback(() => {
    const nextMode = panelDragMode === "move" ? "copy" : "move";
    CommitHelpers.updatePanel({
      dispatch,
      socket,
      panel: { ...panel, defaultDragMode: nextMode },
      emit: true,
    });
  }, [panel, panelDragMode, dispatch, socket]);


  const commitPanelLayout = useCallback((nextLayout) => {
    if (!panel) return;
    const curr = panel.layout || {};
    const merged = mergeLayout({ ...curr, ...nextLayout });
    CommitHelpers.updatePanel({ dispatch, socket, panel: { ...panel, layout: merged }, emit: true });
  }, [panel, socket, dispatch]);

  const commitPanelIteration = useCallback((nextIteration) => {
    if (!panel) return;
    CommitHelpers.updatePanel({ dispatch, socket, panel: { ...panel, iteration: nextIteration }, emit: true });
  }, [panel, socket, dispatch]);

  const commitPanelDragMode = useCallback((nextMode) => {
    if (!panel) return;
    CommitHelpers.updatePanel({ dispatch, socket, panel: { ...panel, defaultDragMode: nextMode }, emit: true });
  }, [panel, socket, dispatch]);

  const setLayout = useCallback((nextLayout) => {
    if (!panel) return;
    const curr = panel.layout || {};
    const merged = mergeLayout({ ...curr, ...nextLayout });
    CommitHelpers.updatePanel({ dispatch, socket, panel: { ...panel, layout: merged }, emit: false });

    window.clearTimeout(layoutSaveTimer.current);
    layoutSaveTimer.current = window.setTimeout(() => {
      CommitHelpers.updatePanel({ dispatch, socket, panel: { ...panel, layout: merged }, emit: true });
    }, 150);
  }, [panel, socket, dispatch]);

  // ============================================================
  // DISPLAY STATE
  // ============================================================
  const display = layout?.style?.display ?? "block";
  const hidden = display === "none";
  const isFullscreen = forceFullscreen || fullscreenPanelId === panel.id;
  const [liveSize, setLiveSize] = useState({ w: null, h: null });

  const openFullscreen = useCallback(() => setFullscreenPanelId?.(panel.id), [setFullscreenPanelId, panel.id]);
  const closeFullscreen = useCallback(() => setFullscreenPanelId?.(null), [setFullscreenPanelId]);

  // ============================================================
  // STACK
  // ============================================================
  const stackPanels = useMemo(() => getStackForPanel?.(panel) || [], [getStackForPanel, panel]);
  const showStackNav = stackPanels.length > 1;

  // ============================================================
  // LAYOUT ORIENTATION (needed before drop zones)
  // ============================================================
  const panelLayoutOrientation = useMemo(() => {
    const l = layout;
    if (l.display === "flex") {
      return l.flow === "row" ? "horizontal" : "vertical";
    } else if (l.display === "grid") {
      // Grid with multiple columns = horizontal, otherwise vertical
      return (l.columns || 0) > 1 ? "horizontal" : "vertical";
    }
    // Block and columns display = vertical
    return "vertical";
  }, [layout]);

  // ============================================================
  // DRAG: Panel header is draggable
  // ============================================================
  const isChildDrag = isContainerDrag || isInstanceDrag || isExternalDrag;

  // Include full container and instance objects for cross-window copying
  const panelWithChildren = useMemo(() => {
    // Get containers via occurrence lookups
    const containers = getPanelContainers(panel, occurrencesById, containersById);
    const containerObjects = containers.map(container => ({
      ...container,
      instanceObjects: getContainerItems(container, occurrencesById, instancesById),
    }));
    return {
      ...panel,
      containerObjects, // Add resolved containers with instances for cross-window copy
    };
  }, [panel, occurrencesById, containersById, instancesById]);

  const { ref: dragRef, isDragging } = useDraggable({
    type: DragType.PANEL,
    id: panel.id,
    data: panelWithChildren,
    context: { panelId: panel.id, cellId: `cell-${panel.row}-${panel.col}` },
    disabled: hidden || isChildDrag,
  });

  // ============================================================
  // DROP: Panel header accepts containers/instances/external (inserts at top for vertical layouts)
  // ============================================================
  const { ref: headerDropRef, isOver: isHeaderOver } = useDroppable({
    type: "panel-header",
    id: `panel-header:${panel.id}`,
    context: { panelId: panel.id, insertAt: 0 }, // insertAt: 0 for top insertion
    accepts: DropAccepts.PANEL_CONTENT,
    disabled: hidden || panelLayoutOrientation !== 'vertical',
  });

  // ============================================================
  // DROP: Panel content accepts containers + instances + external
  // ============================================================
  const { ref: dropRef, isOver } = useDroppable({
    type: "panel-content",
    id: `panel-content:${panel.id}`,
    context: { panelId: panel.id },
    accepts: DropAccepts.PANEL_CONTENT,
    disabled: hidden,
  });

  // ============================================================
  // HOT TARGET CHECK
  // ============================================================
  const isHotPanel = hotTarget?.panelId === panel.id;

  // ============================================================
  // CONTAINERS - lookup via occurrences
  // ============================================================
  const SortableContainer = components["SortableContainer"];
  const containersList = useMemo(
    () => getPanelContainers(panel, occurrencesById, containersById),
    [panel, occurrencesById, containersById]
  );

  // ============================================================
  // LAYOUT STYLES & ORIENTATION
  // ============================================================
  const getLayoutStyles = () => {
    const l = layout;
    const styles = {};

    // Display mode
    if (l.display === "grid") {
      styles.display = "grid";
      const minWidth = l.minWidthPx > 0 ? `${l.minWidthPx}px` : "280px";
      styles.gridTemplateColumns = l.columns > 0 ? `repeat(${l.columns}, 1fr)` : `repeat(auto-fill, minmax(${minWidth}, 1fr))`;
      if (l.rows > 0) styles.gridTemplateRows = `repeat(${l.rows}, auto)`;
      if (l.dense) styles.gridAutoFlow = "dense";
    } else if (l.display === "flex") {
      styles.display = "flex";
      styles.flexDirection = l.flow === "column" ? "column" : "row";
      styles.flexWrap = l.wrap === "nowrap" ? "nowrap" : "wrap";
    } else if (l.display === "columns") {
      // CSS columns for masonry layout
      styles.display = "block";
      styles.columnCount = l.columns > 0 ? l.columns : "auto";
      if (l.minWidthPx > 0) styles.columnWidth = `${l.minWidthPx}px`;
      styles.columnGap = `${l.gapPx || 12}px`;
    } else {
      styles.display = "block";
    }

    // Gap (for grid/flex)
    if (l.display !== "columns") {
      styles.gap = `${l.gapPx || 12}px`;
    }

    // Alignment
    styles.alignItems = l.alignItems || "start";
    styles.alignContent = l.alignContent || "start";
    styles.justifyContent = l.justify || "start";

    // Width constraints
    if (l.widthMode === "fixed" && l.fixedWidth > 0) {
      styles.width = `${l.fixedWidth}px`;
    }
    if (l.minWidthPx > 0 && l.display !== "grid") {
      styles.minWidth = `${l.minWidthPx}px`;
    }
    if (l.maxWidthPx > 0) {
      styles.maxWidth = `${l.maxWidthPx}px`;
    }

    // Height constraints
    if (l.heightMode === "fixed" && l.fixedHeight > 0) {
      styles.height = `${l.fixedHeight}px`;
    }
    if (l.minHeightPx > 0) {
      styles.minHeight = `${l.minHeightPx}px`;
    }
    if (l.maxHeightPx > 0) {
      styles.maxHeight = `${l.maxHeightPx}px`;
    }

    return styles;
  };

  // ============================================================
  // RENDER
  // ============================================================
  if (hidden && !forceFullscreen) return null;

  // Panel cell spanning (width/height in terms of cells, not pixels)
  const cellWidth = liveSize.w !== null ? liveSize.w : (panel.width || 1);
  const cellHeight = liveSize.h !== null ? liveSize.h : (panel.height || 1);
  const isExtended = cellWidth > 1 || cellHeight > 1;
  const isPanelDrag = dragCtx.isPanelDrag;

  return (
    <div
      data-panel-id={panel.id}
      className="panel-shell bg-background rounded-lg border border-border shadow-md"
      style={{
        gridRow: isFullscreen ? "auto" : `${panel.row + 1} / span ${cellHeight}`,
        gridColumn: isFullscreen ? "auto" : `${panel.col + 1} / span ${cellWidth}`,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 0,
        minWidth: 0,
        opacity: isDragging ? 0.4 : 1,
        // Inset margins to create "pocket" effect within grid cell
        margin: isFullscreen ? 0 : "6px",
        // Extended panels should be on top of grid resize handles (which are at zIndex 50)
        zIndex: isExtended ? 60 : 1,
        // When dragging a panel, disable pointer events on other panels so drops work
        pointerEvents: isPanelDrag && !isDragging ? "none" : "auto",
        ...(isFullscreen && {
          position: "fixed",
          top: 16, left: 16, right: 16, bottom: 16,
          zIndex: 1000,
        }),
      }}
    >
      {/* HEADER - Draggable & Droppable */}
      <div
        ref={(node) => {
          // Combine both refs
          if (typeof dragRef === 'function') {
            dragRef(node);
          } else if (dragRef) {
            dragRef.current = node;
          }

          if (typeof headerDropRef === 'function') {
            headerDropRef(node);
          } else if (headerDropRef) {
            headerDropRef.current = node;
          }
        }}
        className="panel-header no-select border-b border-gray-700 border-solid"
        style={{
          userSelect: "none",
          cursor: isChildDrag ? "default" : "grab",
          display: "flex",
          alignItems: "center",
          flex: "0 0 auto",
          position: "relative",
        }}
      >
        <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
          <PopoverTrigger asChild>
            <div
              style={{ position: "relative", zIndex: 50, display: "flex", height: "100%" }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <RadialMenu
                dragMode={panelDragMode}
                onToggleDragMode={togglePanelDragModeQuick}
                onSettings={() => setSettingsOpen(true)}
                onAddChild={() => addContainerToPanel?.(panel.id)} 
                addLabel="Container"
                size="sm"
              />
            </div>
          </PopoverTrigger>

          <PopoverContent align="start" side="right" className="w-auto">
            <LayoutForm
              value={layout}
              onChange={setLayout}
              onCommit={commitPanelLayout}
              panelId={panel.id}
              iteration={panel.iteration}
              onIterationChange={commitPanelIteration}
              defaultDragMode={panel.defaultDragMode}
              onDragModeChange={commitPanelDragMode}
            />
          </PopoverContent>
        </Popover>


        {/* Top drop indicator - when hovering header to insert at top (vertical layouts only) */}
        {/* Only show if panel has containers */}
        {isHeaderOver && panelLayoutOrientation === 'vertical' && containersList.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: -1,
              left: 8,
              right: 8,
              height: 2,
              backgroundColor: "rgb(50, 150, 255)",
              borderRadius: 1,
              zIndex: 10,
            }}
          />
        )}

        <span className="text-sm font-small pl-1 flex-1 truncate">
          {layout.name || panel.id}
        </span>

        {showStackNav && (
          <div className="flex items-center gap-1 mr-2">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => cyclePanelStack?.({ panelId: panel.id, dir: -1 })}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {stackPanels.findIndex((p) => p.id === panel.id) + 1}/{stackPanels.length}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => cyclePanelStack?.({ panelId: panel.id, dir: 1 })}>
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* CONTENT - Droppable */}
      <div
        ref={dropRef}
        className="panel-content"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: layout.scrollY === "auto" ? "auto" : (layout.scrollY === "scroll" ? "scroll" : "hidden"),
          overflowX: layout.scrollX === "auto" ? "auto" : (layout.scrollX === "scroll" ? "scroll" : "hidden"),
          padding: 0,
          outline: (isOver && isContainerDrag) ? "2px solid rgba(50,150,255,0.5)" : "none",
          outlineOffset: -2,
          position: "relative",
        }}
      >
        {/* Always-visible pocket background */}
        <div
          style={{
            position: "absolute",
            inset: "5px",
            borderRadius: "6px",
            background: "rgba(20, 25, 30, 0.4)",
            border: "1px solid rgba(0, 0, 0, 0.5)",
            boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.3)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        <div style={{ ...getLayoutStyles(), position: "relative", minHeight: "100%", zIndex: 1, padding: layout.padding === "none" ? "5px" : "12px" }}>
          {containersList.map((container) => (
            <SortableContainer
              key={container.id}
              container={container}
              panelId={panel.id}
              panelLayoutOrientation={panelLayoutOrientation}
              addInstanceToContainer={addInstanceToContainer}
              isHot={isHotPanel && hotTarget?.containerId === container.id}
              dispatch={dispatch}
              socket={socket}
              gapPx={layout.gapPx || 12}
            />
          ))}

          {containersList.length === 0 && (
            <div
              className="text-xs text-muted-foreground text-center"
              style={{
                fontStyle: "italic",
                opacity: 0.6,
                position: "absolute",
                top: "40%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 2,
              }}
            >
              Drop containers here
            </div>
          )}
        </div>
      </div>

      {!isFullscreen && (
        <ResizeHandle
          panel={panel}
          cols={cols}
          rows={rows}
          onResize={({ width, height }) => setLiveSize({ w: width, h: height })}
          onResizeEnd={({ width, height }) => {
            setLiveSize({ w: null, h: null });
            // Update panel's cell span (width/height represent cell counts)
            if (width !== panel.width || height !== panel.height) {
              CommitHelpers.updatePanel({
                dispatch,
                socket,
                panel: { ...panel, width, height },
                emit: true,
              });
            }
          }}
        />
      )}
    </div>
  );
}

export default React.memo(Panel);
