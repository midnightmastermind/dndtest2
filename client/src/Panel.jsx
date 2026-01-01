// Panel.jsx — MERGED: persist layout on panel, derive from panel.layout, debounce backend writes
import React, { useRef, useMemo, useState, useCallback, useEffect } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import ResizeHandle from "./ResizeHandle";
import { emit } from "./socket";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";

import { Button } from "./components/ui/button";
import ButtonPopover from "./ui/ButtonPopover";
import LayoutForm from "./ui/LayoutForm";
import { ListWrapper } from "./components/ui/list-wrapper";

import * as CommitHelpers from "./helpers/CommitHelpers";

import {
  Settings,
  Maximize,
  Minimize,
  PlusSquare,
  GripVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import FormInput from "./ui/FormInput";

// ----------------------------
// memo helpers
// ----------------------------
function sameIdList(a = [], b = []) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}


/* ------------------------------------------------------------
   ✅ Layout defaults + merge (back-compat safe)
------------------------------------------------------------ */
function getDefaultLayout() {
  return {
    name: "",
    display: "grid", // "grid" | "flex" | "columns"
    flow: "row",
    wrap: "wrap",
    columns: 0,
    rows: 0,

    gapPx: 12,
    gapPreset: "md",

    alignItems: "start",
    alignContent: "start",
    justify: "start",

    dense: false,
    insetX: "panel",
    padding: "none",
    variant: "default",

    scrollType: "auto",
    scrollHideDelay: 600,
    scrollX: "none", // "none" | "auto" | "always"
    scrollY: "auto", // "none" | "auto" | "always"

    widthMode: "auto", // "auto" | "fixed"
    fixedWidth: 340,
    minWidthPx: 0,
    maxWidthPx: 0,

    heightMode: "auto", // "auto" | "fixed"
    fixedHeight: 0,
    minHeightPx: 0,
    maxHeightPx: 0,

    style: {
      display: "block", // ✅ default (used for stacking)
    },
    lock: {
      enabled: false,
      containersDrag: true,
      containersDrop: true,
      instancesDrag: true,
      instancesDrop: true,
    },
  };
}

function mergeLayout(panelLayout) {
  const base = getDefaultLayout();
  const next = panelLayout && typeof panelLayout === "object" ? panelLayout : {};

  return {
    ...base,
    ...next,
    style: {
      ...base.style,
      ...(next.style && typeof next.style === "object" ? next.style : {}),
    },
    lock: {
      ...base.lock,
      ...(next.lock && typeof next.lock === "object" ? next.lock : {}),
    },
  };
}

function gapPxToPreset(px) {
  const n = Number(px) || 0;
  if (n <= 0) return "none";
  if (n <= 8) return "sm";
  if (n <= 16) return "md";
  return "lg";
}

function Panel({
  panel,
  components,
  dispatch,
  socket,
  gridRef,
  cols,
  rows,

  hotTarget,
  isContainerDrag,
  isInstanceDrag,
  addContainerToPanel,
  addInstanceToContainer,
  instancesById,
  containersById,
  sizesRef,
  fullscreenPanelId,
  setFullscreenPanelId,
  forceFullscreen = false,
  // ✅ new (optional): stacking UI support
  onSelectStackPanel, // (row, col, nextPanelId) => void
  onCycleStack,       // ({ panelId, dir }) => void
  stackPanels,        // [{id, layout?...}] for this cell

}) {
  // ----------------------------------------------------------
  // ✅ Layout: derive from panel.layout + debounced backend write
  // ----------------------------------------------------------
  const layout = useMemo(() => mergeLayout(panel?.layout), [panel?.layout]);
  const layoutSaveTimer = useRef(null);

  useEffect(() => {
    return () => window.clearTimeout(layoutSaveTimer.current);
  }, []);

  /**
   * ✅ Immediate commit helper (blur/enter commits)
   * - cancels pending debounce
   * - writes reducer + emits once
   */
  const commitPanelLayout = useCallback(
    (nextLayout) => {
      if (!panel) return;

      const curr = panel.layout || {};
      const currStyle = curr?.style || {};
      const incoming = nextLayout || {};
      const incomingStyle = incoming?.style || {};

      const preservedStyle = {
        ...currStyle,
        ...incomingStyle,
        display: incomingStyle.display ?? (currStyle.display ?? "block"),
      };

      const merged = mergeLayout({
        ...curr,
        ...incoming,
        style: preservedStyle,
      });

      const nextPanel = { ...panel, layout: merged };

      // ✅ Cancel any pending debounce
      window.clearTimeout(layoutSaveTimer.current);

      // ✅ Immediate commit via CommitHelpers (does dispatch + emit)
      CommitHelpers.updatePanel({ dispatch, socket, panel: nextPanel });
    },
    [panel, socket, dispatch]
  );

  /**
   * ✅ Debounced setLayout (sliders / continuous changes)
   * - writes reducer immediately (optimistic)
   * - emits after 150ms pause
   */
  const setLayout = useCallback(
    (nextLayout) => {
      if (!panel) return;

      const curr = panel.layout || {};
      const currStyle = curr?.style || {};
      const incoming = nextLayout || {};
      const incomingStyle = incoming?.style || {};

      const preservedStyle = {
        ...currStyle,
        ...incomingStyle,
        display: incomingStyle.display ?? (currStyle.display ?? "block"),
      };

      const merged = mergeLayout({
        ...curr,
        ...incoming,
        style: preservedStyle,
      });

      const nextPanel = { ...panel, layout: merged };

      CommitHelpers.updatePanel({ dispatch, socket: null, panel: nextPanel });

      // ✅ Cancel any previous timer
      window.clearTimeout(layoutSaveTimer.current);

      // ✅ Debounced commit via CommitHelpers (does dispatch + emit internally)
      layoutSaveTimer.current = window.setTimeout(() => {
        CommitHelpers.updatePanel({ dispatch: null, socket, panel: nextPanel });
      }, 150);
    },
    [panel, socket, dispatch]
  );

  // ----------------------------------------------------------
  // ✅ display/hidden derived from layout.style.display
  // ----------------------------------------------------------
  const display = layout?.style?.display ?? "block";
  const hidden = display === "none";

  useEffect(() => {
    // prevent pending debounce from re-overwriting stacking display changes
    window.clearTimeout(layoutSaveTimer.current);
  }, [display]);

  const resizeTransformRef = useRef({ w: null, h: null });
  const [liveSize, setLiveSize] = useState({ w: null, h: null });
  const isResizing = liveSize.w != null || liveSize.h != null;

  const isFullscreen = forceFullscreen || fullscreenPanelId === panel.id;

  const openFullscreen = useCallback(() => {
    setFullscreenPanelId?.(panel.id);
  }, [setFullscreenPanelId, panel.id]);

  const closeFullscreen = useCallback(() => {
    setFullscreenPanelId?.(null);
  }, [setFullscreenPanelId]);

  const SortableContainer = components["SortableContainer"];
  const isChildDrag = isContainerDrag || isInstanceDrag;

  // ✅ panel dropzone on shell (NOT scroll)
  const { setNodeRef: setPanelDropRef, isOver: isOverPanelDrop } = useDroppable({
    id: `panelDrop:${panel.id}`,
    disabled: hidden,
    data: { role: "panel:drop", panelId: panel.id },
  });


  const collapsed = false;

  const isHotPanel = hotTarget?.panelId === panel.id;

  const highlightPanel =
    isContainerDrag && (isOverPanelDrop || isHotPanel) && !collapsed;


  const data = useMemo(
    () => ({
      role: "panel",
      panelId: panel.id,
      fromCol: panel.col,
      fromRow: panel.row,
      width: panel.width,
      height: panel.height,
    }),
    [panel.id, panel.col, panel.row, panel.width, panel.height]
  );

  const { setNodeRef: setPanelDragRef, attributes, listeners } = useDraggable({
    id: panel.id,
    data,
    disabled: hidden || fullscreenPanelId === panel.id,
  });

  // ✅ merge droppable + draggable refs on shell
  const setPanelShellRef = useCallback(
    (node) => {
      setPanelDragRef(node);
      setPanelDropRef(node);
    },
    [setPanelDragRef, setPanelDropRef]
  );

  const panelContainerIds = panel?.containers || [];

  const panelContainers = useMemo(() => {
    const out = [];
    for (const id of panelContainerIds) {
      const c = containersById?.[id];
      if (c) out.push(c);
    }
    return out;
  }, [panelContainerIds, containersById]);

  // ----------------------------------------------------------
  // ✅ Persist helpers
  // ----------------------------------------------------------
  const updatePanelFinal = useCallback(
    (updatedPanel) => {
      CommitHelpers.updatePanel({ dispatch, socket, panel: updatedPanel });
    },
    [dispatch, socket]
  );

  const deletePanelFinal = useCallback(() => {
    CommitHelpers.deletePanel({ dispatch, socket, panelId: panel.id });
    window.clearTimeout(layoutSaveTimer.current);
  }, [dispatch, socket, panel.id]);

  const getTrackInfo = () => sizesRef?.current ?? null;

  const colFromPx = (px) => {
    const track = getTrackInfo();
    if (!track || !gridRef?.current) return 0;

    const { colSizes } = track;
    const rect = gridRef.current.getBoundingClientRect();
    const rel = (px - rect.left) / rect.width;
    const total = colSizes.reduce((a, b) => a + b, 0);

    let acc = 0;
    for (let i = 0; i < colSizes.length; i++) {
      acc += colSizes[i];
      if (rel < acc / total) return i;
    }
    return colSizes.length - 1;
  };

  const rowFromPx = (py) => {
    const track = getTrackInfo();
    if (!track || !gridRef?.current) return 0;

    const { rowSizes } = track;
    const rect = gridRef.current.getBoundingClientRect();
    const rel = (py - rect.top) / rect.height;
    const total = rowSizes.reduce((a, b) => a + b, 0);

    let acc = 0;
    for (let i = 0; i < rowSizes.length; i++) {
      acc += rowSizes[i];
      if (rel < acc / total) return i;
    }
    return rowSizes.length - 1;
  };

  const beginResize = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const getX = (ev) => ev.clientX ?? ev.touches?.[0]?.clientX;
    const getY = (ev) => ev.clientY ?? ev.touches?.[0]?.clientY;

    const move = (ev) => {
      ev.preventDefault();
      const x = getX(ev);
      const y = getY(ev);

      const col = colFromPx(x);
      const row = rowFromPx(y);

      const newW = Math.max(1, col - panel.col + 1);
      const newH = Math.max(1, row - panel.row + 1);

      const next = {
        w: Math.min(newW, cols - panel.col),
        h: Math.min(newH, rows - panel.row),
      };

      resizeTransformRef.current = next;
      setLiveSize(next);
    };

    const stop = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", stop);

      const { w, h } = resizeTransformRef.current;
      resizeTransformRef.current = { w: null, h: null };
      setLiveSize({ w: null, h: null });

      updatePanelFinal({
        ...panel,
        width: w ?? panel.width,
        height: h ?? panel.height,
      });
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", stop);
  };

  const liveW = liveSize.w ?? panel.width;
  const liveH = liveSize.h ?? panel.height;

  const gridArea = collapsed
    ? `${panel.row + 1} / ${panel.col + 1} / ${panel.row + 2} / ${panel.col + 2}`
    : `${panel.row + 1} / ${panel.col + 1} /
       ${panel.row + liveH + 1} /
       ${panel.col + liveW + 1}`;

  const panelHandleProps = isChildDrag ? {} : { ...attributes, ...listeners };

  const outlineStyle = isResizing
    ? "2px solid rgba(50,150,255,0.6)"
    : highlightPanel
      ? "2px solid rgba(50,150,255,0.9)"
      : "none";

  const gapPresetFinal = gapPxToPreset(layout.gapPx);

  const hotId = isHotPanel ? hotTarget.containerId : null;
  const hotRole = isHotPanel ? hotTarget.role : "";

  const outerStyle = isFullscreen
    ? {
      position: "absolute",
      inset: 0,
      margin: 0,
      borderRadius: 12,
      display: "block",
      pointerEvents: "auto",
      zIndex: 1,
    }
    : {
      gridArea,
      borderRadius: 8,
      outline: outlineStyle,
      outlineOffset: "-2px",
      overflow: "hidden",
      position: "relative",
      boxSizing: "border-box",
      margin: 5,
      transition: isResizing ? "all 80ms linear" : "none",
      opacity: collapsed ? 0 : 1,
      visibility: collapsed ? "hidden" : "visible",
      zIndex: 50,
      display,
      pointerEvents: hidden || collapsed ? "none" : "auto",
    };

  // -----------------------------
  // ✅ stack UI (optional)
  // -----------------------------
  const stackList = Array.isArray(stackPanels) ? stackPanels : null;
  const showStackSelect =
    !isFullscreen &&
    !!stackList &&
    stackList.length > 1 &&
    typeof onSelectStackPanel === "function";

  const selectedPanelId = panel.id;
  const cycleStack = useCallback(
    (dir) => {
      if (!showStackSelect) return;
      onCycleStack?.({ panelId: panel.id, dir });
    },
    [showStackSelect, onCycleStack, panel.id]
  );

  const stackIndex = useMemo(() => {
    if (!showStackSelect) return -1;
    return stackList.findIndex((p) => p.id === selectedPanelId);
  }, [showStackSelect, stackList, selectedPanelId]);

  return (
    <div
      className="panel-card bg-background rounded-lg border border-border shadow-xl"
      data-panel-id={panel.id}
      ref={setPanelShellRef}
      style={outerStyle}
    >

      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* HEADER */}
        <div
          className="panel-header bg-overlay/60 border-b border-border flex items-center h-6"
          style={{
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            display: "flex",
            alignItems: "center",
            fontWeight: 600,
            color: "white",
            flex: "0 0 auto",
            position: "relative",
            zIndex: isFullscreen ? 999 : 1,
            height: 24,
            gap: 6,
          }}
        >
          <div
            className="drag-handle cursor-grab active:cursor-grabbing touch-none pl-2"
            style={{ touchAction: "none" }}
            {...panelHandleProps}
          >
            <GripVertical className="h-4 w-4 text-white" />
          </div>

          {/* ✅ stack selector + chevrons */}
          {showStackSelect ? (
            <div className="panel-selector" style={{ display: "flex", justifyContent: "start", alignItems: "center", maxWidth: 260 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  cycleStack(-1);
                }}
                disabled={stackList.length <= 1}
                aria-label="Previous panel"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>


              <FormInput
                value={{ activePanelId: selectedPanelId }}
                onChange={(next) => {
                  const id = next?.activePanelId;
                  if (id) onSelectStackPanel(panel.row, panel.col, id);
                }}
                schema={{
                  type: "select",
                  className: "panel-select",
                  key: "activePanelId",
                  placeholder: "Select panel…",
                  options: stackList.map((p, idx) => {
                    const name =
                      p?.layout?.name || p?.layout?.name === "" ? p.layout.name : "";
                    const label = name?.trim() ? name : `Panel ${idx + 1}`;
                    return { value: p.id, label };
                  }),
                }}
              />


              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  cycleStack(1);
                }}
                disabled={stackList.length <= 1}
                aria-label="Next panel"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              className="font-mono text-[10px] sm:text-xs"
              style={{ fontWeight: 500, paddingLeft: 3 }}
            >
              {panel?.layout?.name}
            </div>
          )}

          <div style={{ flex: 1, display: "flex", justifyContent: "end", gap: 6 }}>
            <ButtonPopover label={<Settings className="h-4 w-4" />}>
              <LayoutForm
                value={layout}
                onChange={setLayout}
                onCommit={(nextLayout) => commitPanelLayout(nextLayout)}
                onDeletePanel={deletePanelFinal}
                panelId={panel.id}
              />
            </ButtonPopover>

            <Button size="sm" onClick={() => addContainerToPanel(panel.id)}>
              <PlusSquare className="h-4 w-4 pr-[2px]" />
              <span className="button-span">Container</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                isFullscreen ? closeFullscreen() : openFullscreen();
              }}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>

          </div>
        </div>

        {/* BODY */}
        <div
          className="panel-body"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div className="listbuffer" style={{ height: 20, zIndex: 1 }} />

          <SortableContext
            items={panelContainerIds}
            strategy={rectSortingStrategy}
            disabled={isInstanceDrag}
          >
            <ListWrapper
              className="h-full w-full"
              display={layout.display}
              flow={layout.flow}
              wrap={layout.display === "flex" ? (layout.wrap ?? "wrap") : undefined}
              columns={layout.display === "grid" || layout.display === "columns" ? layout.columns : 0}
              rows={layout.display === "grid" ? layout.rows : 0}
              alignContent={layout.alignContent}
              alignItems={layout.alignItems}
              dense={layout.dense}
              gap={gapPresetFinal}
              insetX={layout.insetX}
              padding={layout.padding}
              variant={layout.variant}
              scrollType={layout.scrollType}
              scrollHideDelay={layout.scrollHideDelay}
              scrollX={layout.scrollX}
              scrollY={layout.scrollY}
              widthMode={layout.widthMode}
              fixedWidth={layout.fixedWidth}
              minWidthPx={layout.minWidthPx}
              maxWidthPx={layout.maxWidthPx}
              heightMode={layout.heightMode}
              fixedHeight={layout.fixedHeight}
              minHeightPx={layout.minHeightPx}
              maxHeightPx={layout.maxHeightPx}
              justify={layout.justify}
            >
              {panelContainers.map((c) => (
                <SortableContainer
                  key={c.id}
                  container={c}
                  panelId={panel.id}
                  instancesById={instancesById}
                  isHot={hotId === c.id}
                  hotRole={hotRole}
                  addInstanceToContainer={addInstanceToContainer}
                  isDraggingContainer={isContainerDrag}
                  isInstanceDrag={isInstanceDrag}
                  dispatch={dispatch}
                  socket={socket}
                />

              ))}

              {panelContainers.length === 0 && !isContainerDrag && (
                <div className="mt-3 opacity-70 text-[13px]">Create a container to start.</div>
              )}
            </ListWrapper>
          </SortableContext>

          <div style={{ height: 20, zIndex: 1 }} />
        </div>

        <ResizeHandle onMouseDown={beginResize} onTouchStart={beginResize} />
      </div>
    </div>
  );
}

export default React.memo(Panel, (prev, next) => {
  if (prev.panel?.id !== next.panel?.id) return false;
  const prevIsFullscreen = !!prev.forceFullscreen || prev.fullscreenPanelId === prev.panel?.id;
  const nextIsFullscreen = !!next.forceFullscreen || next.fullscreenPanelId === next.panel?.id;
  if (prevIsFullscreen !== nextIsFullscreen) return false;

  if (prev.panel?.row !== next.panel?.row) return false;
  if (prev.panel?.col !== next.panel?.col) return false;
  if (prev.panel?.width !== next.panel?.width) return false;
  if (prev.panel?.height !== next.panel?.height) return false;

  if (prev.panel?.layout !== next.panel?.layout) return false;

  if (!sameIdList(prev.panel?.containers, next.panel?.containers)) return false;

  if (prev.isContainerDrag !== next.isContainerDrag) return false;
  if (prev.isInstanceDrag !== next.isInstanceDrag) return false;

  const prevHotPanel = prev.hotTarget?.panelId ?? null;
  const nextHotPanel = next.hotTarget?.panelId ?? null;

  const prevWasAffected = prev.panel?.id === prevHotPanel;
  const nextIsAffected = next.panel?.id === nextHotPanel;

  // If this panel is neither the old hot panel nor the new hot panel,
  // ignore hotTarget changes to avoid re-rendering every panel.
  if (!prevWasAffected && !nextIsAffected) {
    // do nothing
  } else {
    // for affected panels, compare the hot container/role
    if (prev.hotTarget?.containerId !== next.hotTarget?.containerId) return false;
    if (prev.hotTarget?.role !== next.hotTarget?.role) return false;
  }

  if (prev.cols !== next.cols) return false;
  if (prev.rows !== next.rows) return false;

  if (prev.instancesById !== next.instancesById) return false;

  if (prev.onSelectStackPanel !== next.onSelectStackPanel) return false;
  if (prev.stackPanels !== next.stackPanels) return false;
  if (prev.onCycleStack !== next.onCycleStack) return false;
  if (prev.addContainerToPanel !== next.addContainerToPanel) return false;
  if (prev.addInstanceToContainer !== next.addInstanceToContainer) return false;
  if (prev.dispatch !== next.dispatch) return false;
  if (prev.socket !== next.socket) return false;
  if (prev.containersById !== next.containersById) return false;
  return true;
});
