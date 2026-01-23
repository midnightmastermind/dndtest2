// Panel.jsx — DUMB COMPONENT
// ============================================================
// DRAG: Header is draggable (type: PANEL)
// DROP: Content accepts CONTAINER, INSTANCE, FILE, TEXT, URL
// ============================================================

import React, { useRef, useMemo, useState, useCallback, useEffect } from "react";
import ResizeHandle from "./ResizeHandle";

import { Button } from "./components/ui/button";
import ButtonPopover from "./ui/ButtonPopover";
import LayoutForm from "./ui/LayoutForm";

import * as CommitHelpers from "./helpers/CommitHelpers";
import { useDraggable, useDroppable, useDragContext, DragType, DropAccepts } from "./helpers/dragSystem";

import {
  Settings,
  Maximize,
  Minimize,
  PlusSquare,
  GripVertical,
  ChevronLeft,
  ChevronRight,
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
  instancesById,
  containersById,
  sizesRef,
  fullscreenPanelId,
  setFullscreenPanelId,
  forceFullscreen = false,
}) {
  // ============================================================
  // CONTEXT
  // ============================================================
  const dragCtx = useDragContext();
  const {
    hotTarget,
    isContainerDrag,
    isInstanceDrag,
    isExternalDrag,
    getStackForPanel,
    cyclePanelStack,
  } = dragCtx;

  // ============================================================
  // LAYOUT STATE
  // ============================================================
  const layout = useMemo(() => mergeLayout(panel?.layout), [panel?.layout]);
  const layoutSaveTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(layoutSaveTimer.current), []);

  const commitPanelLayout = useCallback((nextLayout) => {
    if (!panel) return;
    const curr = panel.layout || {};
    const merged = mergeLayout({ ...curr, ...nextLayout });
    CommitHelpers.updatePanel({ dispatch, socket, panel: { ...panel, layout: merged }, emit: true });
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
  // DRAG: Panel header is draggable
  // ============================================================
  const isChildDrag = isContainerDrag || isInstanceDrag || isExternalDrag;

  const { ref: dragRef, isDragging } = useDraggable({
    type: DragType.PANEL,
    id: panel.id,
    data: panel,
    context: { panelId: panel.id, cellId: `cell-${panel.row}-${panel.col}` },
    disabled: hidden || isChildDrag,
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
  // CONTAINERS
  // ============================================================
  const SortableContainer = components["SortableContainer"];
  const containerIds = panel.containers || [];
  const containersList = useMemo(() => containerIds.map((id) => containersById?.[id]).filter(Boolean), [containerIds, containersById]);

  // ============================================================
  // LAYOUT STYLES
  // ============================================================
  const getLayoutStyles = () => {
    const l = layout;
    const styles = {};

    if (l.display === "grid") {
      styles.display = "grid";
      styles.gridTemplateColumns = l.columns > 0 ? `repeat(${l.columns}, 1fr)` : "repeat(auto-fill, minmax(280px, 1fr))";
      if (l.rows > 0) styles.gridTemplateRows = `repeat(${l.rows}, auto)`;
      if (l.dense) styles.gridAutoFlow = "dense";
    } else if (l.display === "flex") {
      styles.display = "flex";
      styles.flexDirection = l.flow === "column" ? "column" : "row";
      styles.flexWrap = l.wrap === "nowrap" ? "nowrap" : "wrap";
    } else {
      styles.display = "block";
    }

    styles.gap = `${l.gapPx || 12}px`;
    styles.alignItems = l.alignItems || "start";
    styles.alignContent = l.alignContent || "start";
    styles.justifyContent = l.justify || "start";

    return styles;
  };

  // ============================================================
  // RENDER
  // ============================================================
  if (hidden && !forceFullscreen) return null;

  return (
    <div
      data-panel-id={panel.id}
      className="panel-shell bg-background rounded-lg border border-border shadow-md"
      style={{
        gridRow: panel.row + 1,
        gridColumn: panel.col + 1,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 0,
        minWidth: 0,
        opacity: isDragging ? 0.5 : 1,
        ...(isFullscreen && {
          position: "fixed",
          top: 16, left: 16, right: 16, bottom: 16,
          zIndex: 1000,
          gridRow: "auto",
          gridColumn: "auto",
        }),
      }}
    >
      {/* HEADER - Draggable */}
      <div
        ref={dragRef}
        className="panel-header no-select"
        style={{
          userSelect: "none",
          cursor: isChildDrag ? "default" : "grab",
          display: "flex",
          alignItems: "center",
          padding: "6px 8px",
          borderBottom: "1px solid var(--border)",
          flex: "0 0 auto",
        }}
      >
        {!isChildDrag && <GripVertical className="h-4 w-4 text-muted-foreground mr-2" />}

        <span className="text-sm font-medium flex-1 truncate">
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

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => addContainerToPanel?.(panel.id)}>
            <PlusSquare className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={isFullscreen ? closeFullscreen : openFullscreen}>
            {isFullscreen ? <Minimize className="h-3 w-3" /> : <Maximize className="h-3 w-3" />}
          </Button>
          <ButtonPopover label={<Settings className="h-3 w-3" />}>
            <LayoutForm value={layout} onChange={setLayout} onCommit={commitPanelLayout} panelId={panel.id} />
          </ButtonPopover>
        </div>
      </div>

      {/* CONTENT - Droppable */}
      <div
        ref={dropRef}
        className="panel-content"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: layout.padding === "none" ? 0 : 12,
          outline: isOver ? "2px solid rgba(50,150,255,0.5)" : "none",
          outlineOffset: -2,
        }}
      >
        <div style={getLayoutStyles()}>
          {containersList.map((container) => (
            <SortableContainer
              key={container.id}
              container={container}
              panelId={panel.id}
              instancesById={instancesById}
              addInstanceToContainer={addInstanceToContainer}
              isHot={isHotPanel && hotTarget?.containerId === container.id}
              dispatch={dispatch}
              socket={socket}
            />
          ))}

          {containersList.length === 0 && (
            <div className="text-sm text-muted-foreground p-4 text-center">
              No containers. Click + to add one.
            </div>
          )}
        </div>
      </div>

      {!isFullscreen && (
        <ResizeHandle
          panel={panel}
          onResize={({ width, height }) => setLiveSize({ w: width, h: height })}
          onResizeEnd={({ width, height }) => {
            setLiveSize({ w: null, h: null });
            if (width || height) {
              setLayout({
                widthMode: width ? "fixed" : layout.widthMode,
                fixedWidth: width || layout.fixedWidth,
                heightMode: height ? "fixed" : layout.heightMode,
                fixedHeight: height || layout.fixedHeight,
              });
            }
          }}
        />
      )}
    </div>
  );
}

export default React.memo(Panel);
