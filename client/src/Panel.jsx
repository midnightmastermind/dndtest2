// Panel.jsx
import React, { useRef, useMemo, useState, useCallback } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import ResizeHandle from "./ResizeHandle";
import { ActionTypes } from "./state/actions";
import { emit } from "./socket";
import { SortableContext, rectSortingStrategy, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "./components/ui/button"
import ButtonPopover from "./ui/ButtonPopover";
import LayoutForm from "./ui/LayoutForm";
import { ListWrapper } from "@/components/ui/list-wrapper"

import { Settings, Maximize, Minimize, PlusSquare, GripVertical } from "lucide-react";
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

function pickOverKey(overData) {
  if (!overData) return "";
  const role =
    typeof overData.role === "string"
      ? overData.role
      : String(overData.role ?? "");
  return `${role}|${overData.panelId ?? ""}|${overData.containerId ?? ""}`;
}

function Panel({
  panel,
  components,
  dispatch,
  gridRef,
  cols,
  rows,
  activeId,
  gridActive,

  // ✅ injected (no context subscriptions)
  overData,
  isContainerDrag,
  isInstanceDrag,
  addContainerToPanel,
  addInstanceToContainer,
  instancesById,
  containersById,
  sizesRef
}) {
  const resizeTransformRef = useRef({ w: null, h: null });

  const [liveSize, setLiveSize] = useState({ w: null, h: null });
  const isResizing = liveSize.w != null || liveSize.h != null;

  const [fullscreen, setFullscreen] = useState(false);
  const prev = useRef(null);

  const SortableContainer = components["SortableContainer"];

  const isChildDrag = isContainerDrag || isInstanceDrag;

  function gapPxToPreset(px) {
    const n = Number(px) || 0;
    if (n <= 0) return "none";
    if (n <= 8) return "sm";
    if (n <= 16) return "md";
    return "lg";
  }

  const [layout, setLayout] = useState({
    name: "",
    display: "grid",
    flow: "row",
    wrap: "wrap",
    columns: 0,
    rows: 0,

    gapPx: 12,
    gapPreset: "md",

    align: "start",
    dense: false,
    insetX: "panel",
    padding: "none",
    variant: "default",

    scrollType: "auto",
    scrollHideDelay: 600,

    // ✅ NEW
    scrollX: "none",   // "none" | "auto" | "always"
    scrollY: "auto",   // "none" | "auto" | "always"
    widthMode: "auto",
    fixedWidth: 340,
    minWidthPx: 0,
    maxWidthPx: 0,
    justify: "start",
    heightMode: "auto",
    fixedHeight: 0,
    minHeightPx: 0,
    maxHeightPx: 0,

  });




  // ✅ panel dropzone on shell (NOT scroll)
  const {
    setNodeRef: setPanelDropRef,
    isOver: isOverPanelDrop,
  } = useDroppable({
    id: `panelDrop:${panel.id}`,
    data: { role: "panel:drop", panelId: panel.id },
  });

  const containerIdBelongsToPanel = (containerId) =>
    !!containerId && (panel.containers || []).includes(containerId);

  const isOverThisPanel = (() => {
    if (!overData) return false;

    if (overData.role?.includes?.("instance") && overData.panelId === panel.id)
      return true;
    if (overData.role?.includes?.("panel") && overData.panelId === panel.id)
      return true;
    if (overData.role?.includes?.("container") && overData.panelId === panel.id)
      return true;

    const roleStr = typeof overData.role === "string" ? overData.role : "";
    const isContainerZone = roleStr.startsWith("container:");
    const isInstanceZone = roleStr === "instance" || roleStr.startsWith("instance:");

    if ((isContainerZone || isInstanceZone) && overData.containerId) {
      return containerIdBelongsToPanel(overData.containerId);
    }
    return false;
  })();

  const collapsed = false;
  const highlightPanel =
    isContainerDrag && (isOverPanelDrop || isOverThisPanel) && !collapsed;

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

  const { setNodeRef: setPanelDragRef, attributes, listeners, setActivatorNodeRef } = useDraggable({
    id: panel.id,
    data,
    disabled: fullscreen,
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
    const ids = panel?.containers || [];
    const out = [];
    for (const id of ids) {
      const c = containersById?.[id];
      if (c) out.push(c);
    }
    return out;
  }, [panel?.containers, containersById]);


  const updatePanelFinal = (updated) => {
    dispatch({ type: ActionTypes.UPDATE_PANEL, payload: updated });
    emit("update_panel", { panel: updated, gridId: panel.gridId });
  };

  const toggleFullscreen = () => {
    if (!fullscreen) {
      prev.current = {
        row: panel.row,
        col: panel.col,
        width: panel.width,
        height: panel.height,
      };
      updatePanelFinal({ ...panel, row: 0, col: 0, width: cols, height: rows });
    } else {
      const restore = prev.current ? { ...panel, ...prev.current } : panel;
      updatePanelFinal(restore);
    }
    setFullscreen((f) => !f);
  };

  const getTrackInfo = () => sizesRef?.current ?? null;


  const colFromPx = (px) => {
    const track = getTrackInfo();
    if (!track) return 0;

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
    if (!track) return 0;

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

  // ✅ fix: single outline value (don't overwrite highlight with resize)
  const outlineStyle = isResizing
    ? "2px solid rgba(50,150,255,0.6)"
    : highlightPanel
      ? "2px solid rgba(50,150,255,0.9)"
      : "none";

  const gapPresetFinal = gapPxToPreset(layout.gapPx);

  return (
    <div
      className="panel-card bg-background rounded-lg border border-border shadow-xl"

      data-panel-id={panel.id}
      ref={setPanelShellRef}
      style={{
        gridArea,
        borderRadius: 8,
        outline: outlineStyle,
        outlineOffset: "-2px",
        overflow: "hidden",
        position: "relative",
        margin: "3px",
        transition: isResizing ? "all 80ms linear" : "none",
        opacity: collapsed ? 0 : 1,
        visibility: collapsed ? "hidden" : "visible",
        pointerEvents: collapsed ? "none" : "auto",
        zIndex: fullscreen ? 999 : 50,
      }}
    >
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* HEADER */}
        <div className="panel-header bg-overlay/60 border-b border-border flex items-center h-6"
          style={{
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            display: "flex",
            alignItems: "center",
            fontWeight: 600,
            color: "white",
            flex: "0 0 auto",
            position: "relative",
            zIndex: fullscreen ? 999 : 1,
            height: 24,
          }}
        >
          <div
            className="drag-handle cursor-grab active:cursor-grabbing touch-none pl-2"
            {...panelHandleProps}
          >
            <GripVertical className="h-4 w-4 text-white" />
          </div>




          <div style={{ flex: 1, display: "flex", justifyContent: "end" }}>
            <ButtonPopover label={<Settings className="h-4 w-4" />}>
              <LayoutForm value={layout} onChange={setLayout} />
            </ButtonPopover>
            <Button
              size="sm"
              onClick={() => addContainerToPanel(panel.id)}
            >

              <PlusSquare className="h-4 w-4 pt-[2px]" /> Container
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
            >

              {fullscreen ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
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

  columns={layout.display === "grid" ? layout.columns : 0}

  align={layout.align}
  dense={layout.dense}
  gap={gapPresetFinal}
  insetX={layout.insetX}
  padding={layout.padding}
  variant={layout.variant}
  scrollType={layout.scrollType}
  scrollHideDelay={layout.scrollHideDelay}
  scrollX={layout.scrollX}
  scrollY={layout.scrollY}

  // ✅ single width/height system used for grid tracks + flex children
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
        addInstanceToContainer={addInstanceToContainer}
        isDraggingContainer={isContainerDrag}
        isInstanceDrag={isInstanceDrag}
        overData={overData}
      />
    ))}

    {panelContainers.length === 0 && !isContainerDrag && (
      <div className="mt-3 opacity-70 text-[13px]">
        Create a container to start.
      </div>
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
  // Panel identity
  if (prev.panel?.id !== next.panel?.id) return false;

  // Position/size changes must re-render
  if (prev.panel?.row !== next.panel?.row) return false;
  if (prev.panel?.col !== next.panel?.col) return false;
  if (prev.panel?.width !== next.panel?.width) return false;
  if (prev.panel?.height !== next.panel?.height) return false;

  // Container ordering in this panel must re-render (SortableContext depends on it)
  if (!sameIdList(prev.panel?.containers, next.panel?.containers)) return false;

  // Drag state that affects header + highlight
  if (prev.activeId !== next.activeId) return false;
  if (prev.isContainerDrag !== next.isContainerDrag) return false;
  if (prev.isInstanceDrag !== next.isInstanceDrag) return false;

  // Hover/highlight routing (minimal key)
  if (pickOverKey(prev.overData) !== pickOverKey(next.overData)) return false;

  // These affect render output
  if (prev.cols !== next.cols) return false;
  if (prev.rows !== next.rows) return false;
  // Instances map changes must re-render so lists show new items immediately
  if (prev.instancesById !== next.instancesById) return false;

  return true;
});
