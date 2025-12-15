// Panel.jsx
import React, { useRef, useMemo, useContext, useState } from "react";
import {
  useDraggable,
  useDndContext,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import ResizeHandle from "./ResizeHandle";
import Button from "@atlaskit/button";
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
  // ⛔ no more fullscreenPanelId / setFullscreenPanelId needed
  activeSize,
  activeInstance,
}) {
  const resizeTransformRef = useRef({ w: null, h: null });

  // ✅ NEW: live resize state so the panel re-renders while resizing
  const [liveSize, setLiveSize] = useState({ w: null, h: null });
  const isResizing = liveSize.w != null || liveSize.h != null;

  // ✅ local fullscreen like old app
  const [fullscreen, setFullscreen] = useState(false);
  const prev = useRef(null);

  const { addContainerToPanel } = useContext(GridActionsContext);
  const { state, containersRender } = useContext(GridDataContext);

  const SortableContainer = components["SortableContainer"];

  // ✅ DnD context active/role
const { active, over } = useDndContext();
  const activeRole = active?.data?.current?.role ?? null;
  const activeDragId = active?.id ?? null;

  // ✅ NEW: panel dropzone (so panel can accept containers on empty space)
const { setNodeRef: setPanelDropRef } = useDroppable({
  id: `panelDrop:${panel.id}`,
  data: { role: "panel:drop", panelId: panel.id },
});

const overData = over?.data?.current || null;
const isContainerDrag = activeRole === "container";

// “Over this panel” if:
// - over is the panel dropzone, OR
// - over is a container or container:* droppable that belongs to this panel
const isOverThisPanel =
  (overData?.role === "panel:drop" && overData?.panelId === panel.id) ||
  (overData?.panelId === panel.id && (overData?.role === "container")) ||
  (typeof overData?.role === "string" &&
    overData.role.startsWith("container:") &&
    // container:* droppables usually carry containerId; map that to this panel
    (panel.containers || []).includes(overData.containerId));
  const collapsed = activeId === panel.id;

const highlightPanel = isContainerDrag && isOverThisPanel && !collapsed;

  // ✅ your draggable data (ok to be dynamic here)
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

  // ✅ disable panel drag while fullscreen (matches old UX; remove if you want)
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: panel.id,
    data,
    disabled: fullscreen,
  });

  const panelContainerIds = panel?.containers || [];

  // use the draft list during drag, otherwise fall back to state
  const containersSource = containersRender ?? state?.containers ?? [];

  const panelContainers = panelContainerIds
    .map((id) => containersSource.find((c) => c.id === id))
    .filter(Boolean);

  const updatePanelFinal = (updated) => {
    dispatch({ type: ActionTypes.UPDATE_PANEL, payload: updated });
    emit("update_panel", { panel: updated, gridId: panel.gridId });
  };

  // ✅ OLD fullscreen behavior (local state)
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

      // keep your ref (used on mouseup)
      resizeTransformRef.current = next;

      // ✅ NEW: live preview (forces re-render -> you see snapping)
      setLiveSize(next);
    };

    const stop = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", stop);

      const { w, h } = resizeTransformRef.current;
      resizeTransformRef.current = { w: null, h: null };

      // ✅ NEW: clear preview
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

  // ✅ live snapping values
  const liveW = liveSize.w ?? panel.width;
  const liveH = liveSize.h ?? panel.height;

  // ✅ OLD fix: collapse while dragging so it doesn't block hover / dropping

  const gridArea = collapsed
    ? `${panel.row + 1} / ${panel.col + 1} / ${panel.row + 2} / ${panel.col + 2}`
    : `${panel.row + 1} / ${panel.col + 1} /
       ${panel.row + liveH + 1} /
       ${panel.col + liveW + 1}`;

  return (
    <div
      data-panel-id={panel.id}
      ref={(el) => setNodeRef(el)}
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
        transform: undefined,

        // ✅ NEW: animate only while resizing (so it feels alive)
        transition: isResizing ? "all 80ms linear" : "none",

        // ✅ optional: obvious feedback
        outline: isResizing ? "2px solid rgba(50,150,255,0.6)" : "none",

        // ✅ OLD hide original while dragging
        opacity: collapsed ? 0 : 1,
        visibility: collapsed ? "hidden" : "visible",
        pointerEvents: collapsed ? "none" : "auto",

        // ✅ pop above others when fullscreen
        zIndex: fullscreen ? 999 : 50,
      }}
    >
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* HEADER (fixed) */}
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
          {/* drag handle */}
          <div
            style={{ cursor: "grab", paddingLeft: 6, touchAction: "none" }}
            {...attributes}
            {...listeners}
          >
            <MoreVerticalIcon size="small" primaryColor="#9AA0A6" />
          </div>

          {/* spacer */}
          <div style={{ flex: 1 }} />

          {/* add container */}
          <button
            onClick={() => addContainerToPanel(panel.id)}
            style={{ marginRight: 6 }}
          >
            + Container
          </button>

          {/* fullscreen */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <button spacing="compact" onClick={toggleFullscreen}>
              {fullscreen ? "Restore" : "Fullscreen"}
            </button>
          </div>
        </div>

        {/* ✅ SCROLL AREA (only this scrolls) + ✅ dropzone */}
        <div
          ref={setPanelDropRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            color: "white",
            margin: 10,
          }}
        >
          <div className="containers-col">
            <SortableContext
              items={panelContainerIds}
              strategy={rectSortingStrategy}
            >
              {panelContainers.map((c) => (
                <SortableContainer key={c.id} container={c} panelId={panel.id} />
              ))}
            </SortableContext>

            {panel?.containers?.length === 0 && (
              <div className="no-select" style={{ marginTop: 12, opacity: 0.7, fontSize: 13 }}>
                Create a container to start.
              </div>
            )}
          </div>
        </div>

        <ResizeHandle onMouseDown={beginResize} onTouchStart={beginResize} />
      </div>

    </div>
  );
}
