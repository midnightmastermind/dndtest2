// Panel.jsx
import React, { useRef, useMemo, useContext, useState } from "react";
import { useDraggable, useDndContext, useDroppable } from "@dnd-kit/core";
import ResizeHandle from "./ResizeHandle";
import { token } from "@atlaskit/tokens";
import MoreVerticalIcon from "@atlaskit/icon/glyph/more-vertical";
import { ActionTypes } from "./state/actions";
import { emit } from "./socket";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { GridActionsContext } from "./GridActionsContext";
import { GridDataContext } from "./GridDataContext";

export default function Panel({
  panel,
  components,
  dispatch,
  gridRef,
  cols,
  rows,
  activeId,
  gridActive,
  activeSize,
  activeInstance,
}) {
  const resizeTransformRef = useRef({ w: null, h: null });

  const [liveSize, setLiveSize] = useState({ w: null, h: null });
  const isResizing = liveSize.w != null || liveSize.h != null;

  const [fullscreen, setFullscreen] = useState(false);
  const prev = useRef(null);

  const { addContainerToPanel } = useContext(GridActionsContext);
  const { state, containersRender } = useContext(GridDataContext);

  const SortableContainer = components["SortableContainer"];

  // ✅ DnD context active/role
  const { active, over } = useDndContext();
  const activeRole = active?.data?.current?.role ?? null;

  const isContainerDrag = activeRole === "container";
  const isInstanceDrag = activeRole === "instance";
  const isChildDrag = isContainerDrag || isInstanceDrag;

  // ✅ IMPORTANT: disable panel dropzone during INSTANCE drag
  // (instances must hit container droppables, not panel empty space)
  const { setNodeRef: setPanelDropRef } = useDroppable({
    id: `panelDrop:${panel.id}`,
    data: { role: "panel:drop", panelId: panel.id },
    disabled: isInstanceDrag,
  });

  const overData = over?.data?.current || null;

  // ---------------------------
  // ✅ Helper: does "over" belong to THIS panel?
  // Works for container drag AND instance drag
  // ---------------------------
  const containerIdBelongsToPanel = (containerId) =>
    !!containerId && (panel.containers || []).includes(containerId);

  const isOverThisPanel = (() => {
    if (!overData) return false;

    // panel empty-space dropzone (only relevant for container drag; we disabled it for instances)
    if (overData.role === "panel:drop" && overData.panelId === panel.id) {
      return true;
    }

    // container tiles (often carry panelId)
    if (overData.role === "container" && overData.panelId === panel.id) {
      return true;
    }

    // container:* droppables or instance/instance:* droppables should carry containerId
    // If that containerId is in this panel, we treat it as "over this panel"
    const roleStr = typeof overData.role === "string" ? overData.role : "";
    const isContainerZone = roleStr.startsWith("container:");
    const isInstanceZone = roleStr === "instance" || roleStr.startsWith("instance:");

    if ((isContainerZone || isInstanceZone) && overData.containerId) {
      return containerIdBelongsToPanel(overData.containerId);
    }

    return false;
  })();

  const collapsed = activeId === panel.id;

  // ✅ highlight for container OR instance drags
  const highlightPanel = isChildDrag && isOverThisPanel && !collapsed;

  // ✅ draggable data
  const data = useMemo(
    () => ({
      role: "panel",
      panelId: panel.id,
      fromCol: panel.col,
      fromRow: panel.row,
      width: panel.width,
      height: panel.height,
    }),
    [panel]
  );

  const { setNodeRef, attributes, listeners } = useDraggable({
    id: panel.id,
    data,
    disabled: fullscreen,
  });

  const panelContainerIds = panel?.containers || [];
  const containersSource = containersRender ?? state?.containers ?? [];

  const panelContainers = panelContainerIds
    .map((id) => containersSource.find((c) => c.id === id))
    .filter(Boolean);

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

  const getTrackInfo = () => {
    const data = gridRef.current?.dataset.sizes;
    return data ? JSON.parse(data) : null;
  };

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

  return (
    <div
      data-panel-id={panel.id}
      ref={setNodeRef}
      style={{
        gridArea,
        background: token("elevation.surface", "rgba(17,17,17,0.95)"),
        borderRadius: 8,

        border: highlightPanel
          ? "2px solid rgba(50,150,255,0.9)"
          : "1px solid #AAA",

        boxShadow: highlightPanel
          ? "0 0 0 3px rgba(50,150,255,0.35) inset"
          : "none",

        overflow: "hidden",
        position: "relative",
        margin: "3px",

        transition: isResizing ? "all 80ms linear" : "none",
        outline: isResizing ? "2px solid rgba(50,150,255,0.6)" : "none",

        opacity: collapsed ? 0 : 1,
        visibility: collapsed ? "hidden" : "visible",
        pointerEvents: collapsed ? "none" : "auto",

        zIndex: fullscreen ? 999 : 50,
      }}
    >
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* HEADER */}
        <div
          style={{
            background: "#2F343A",
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            display: "flex",
            alignItems: "center",
            fontWeight: 600,
            color: "white",
            flex: "0 0 auto",
            position: "relative",
            zIndex: fullscreen ? 999 : 1,
          }}
        >
          <div
            style={{ cursor: "grab", paddingLeft: 6, touchAction: "none" }}
            {...attributes}
            {...listeners}
          >
            <MoreVerticalIcon size="small" primaryColor="#9AA0A6" />
          </div>

          <div style={{ flex: 1 }} />

          <button onClick={() => addContainerToPanel(panel.id)} style={{ marginRight: 6 }}>
            + Container
          </button>

          <button onClick={toggleFullscreen} style={{ marginRight: 6 }}>
            {fullscreen ? "Restore" : "Fullscreen"}
          </button>
        </div>

        {/* ✅ BODY: 3-layer (clip shell -> padded dropzone -> scroller) */}
{/* ✅ BODY: scroller is the dropzone (single scroll surface) */}
<div
  className="panel-body"
  style={{
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  }}
>
  <div
  ref={setPanelDropRef}
  className="panel-scroll"
  style={{
    width: "100%",
    height: "100%",
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
    overscrollBehavior: "contain",

    // ✅ NEVER disable scroll gestures
    touchAction: "pan-y",
  }}
>
  {/* ✅ scroll buffer at top */}
  <div style={{ height: 18 }} />

  {/* ✅ actual padded content */}
  <div style={{ padding: 14, boxSizing: "border-box" }}>
    <div className="containers-col">
      <SortableContext items={panelContainerIds} strategy={rectSortingStrategy}>
        {panelContainers.map((c) => (
          <SortableContainer key={c.id} container={c} panelId={panel.id} />
        ))}
      </SortableContext>

      {panelContainers.length === 0 && (
        <div style={{ marginTop: 12, opacity: 0.7, fontSize: 13 }}>
          Create a container to start.
        </div>
      )}
    </div>
  </div>

  {/* ✅ scroll buffer at bottom */}
  <div style={{ height: 28 }} />
</div>
</div>

        <ResizeHandle onMouseDown={beginResize} onTouchStart={beginResize} />
      </div>
    </div>
  );
}