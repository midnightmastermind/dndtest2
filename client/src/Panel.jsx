// Panel.jsx
import React, { useRef, useMemo, useState, useCallback } from "react";
import { useDraggable, useDndContext, useDroppable } from "@dnd-kit/core";
import ResizeHandle from "./ResizeHandle";
import { token } from "@atlaskit/tokens";
import MoreVerticalIcon from "@atlaskit/icon/glyph/more-vertical";
import { ActionTypes } from "./state/actions";
import { emit } from "./socket";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";

export default function Panel({
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
  containersSource,
}) {
  const resizeTransformRef = useRef({ w: null, h: null });

  const [liveSize, setLiveSize] = useState({ w: null, h: null });
  const isResizing = liveSize.w != null || liveSize.h != null;

  const [fullscreen, setFullscreen] = useState(false);
  const prev = useRef(null);

  const SortableContainer = components["SortableContainer"];

  const isChildDrag = isContainerDrag || isInstanceDrag;

  // ✅ IMPORTANT FIX #1:
  // Create the panel dropzone, BUT do NOT attach it to the scroll div.
  // Attach it to the PANEL SHELL (outer div), otherwise empty panel hover often fails.
  //
  // ✅ IMPORTANT FIX #2:
  // Disable dropzone during INSTANCE drag so instance drags don’t “hit” panelDrop.
  const {
    setNodeRef: setPanelDropRef,
    isOver: isOverPanelDrop,
  } = useDroppable({
    id: `panelDrop:${panel.id}`,
    data: { role: "panel:drop", panelId: panel.id },
    disabled: isInstanceDrag, // ✅ KEY: block instance drags from panel dropzone
  });

  const containerIdBelongsToPanel = (containerId) =>
    !!containerId && (panel.containers || []).includes(containerId);

  const isOverThisPanel = (() => {
    if (!overData) return false;

    if (overData.role === "panel:drop" && overData.panelId === panel.id) return true;
    if (overData.role === "container" && overData.panelId === panel.id) return true;

    const roleStr = typeof overData.role === "string" ? overData.role : "";
    const isContainerZone = roleStr.startsWith("container:");
    const isInstanceZone = roleStr === "instance" || roleStr.startsWith("instance:");

    if ((isContainerZone || isInstanceZone) && overData.containerId) {
      return containerIdBelongsToPanel(overData.containerId);
    }
    return false;
  })();

  const collapsed = activeId === panel.id;
  const highlightPanel = isContainerDrag && (isOverPanelDrop || isOverThisPanel) && !collapsed;

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

  const { setNodeRef: setPanelDragRef, attributes, listeners } = useDraggable({
    id: panel.id,
    data,
    disabled: fullscreen,
  });

const { active, measureDroppableContainers } = useDndContext();

  const scrollTimeoutRef = useRef(null);

  const onPanelScroll = useCallback(() => {
    const role = active?.data?.current?.role;
    if (role !== "instance") return;

    // Clear previous pending measure
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Measure AFTER scrolling pauses
    scrollTimeoutRef.current = setTimeout(() => {
      measureDroppableContainers();
      scrollTimeoutRef.current = null;
    }, 80); // 60–120ms works well on mobile
  }, [active, measureDroppableContainers]);

  // ✅ IMPORTANT FIX #3:
  // Merge draggable + droppable refs on the OUTER PANEL DIV (shell).
  // This is what makes “empty panel hover” work reliably.
  const setPanelShellRef = useCallback(
    (node) => {
      setPanelDragRef(node);
      setPanelDropRef(node);
    },
    [setPanelDragRef, setPanelDropRef]
  );

  const panelContainerIds = panel?.containers || [];

  const panelContainers = panelContainerIds
    .map((id) => (containersSource || []).find((c) => c.id === id))
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

  const panelHandleProps = isChildDrag ? {} : { ...attributes, ...listeners };

  return (
    <div
      data-panel-id={panel.id}
      ref={setPanelShellRef} // ✅ DROPPABLE + DRAGGABLE ON SHELL (fix)
      style={{
        gridArea,
        background: token("elevation.surface", "rgba(17,17,17,0.95)"),
        borderRadius: 8,
        border: highlightPanel ? "2px solid rgba(50,150,255,0.9)" : "1px solid #AAA",
        boxShadow: highlightPanel ? "0 0 0 3px rgba(50,150,255,0.35) inset" : "none",
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
            className="drag-handle"
            style={{ cursor: "grab", paddingLeft: 6, touchAction: "none" }}
          {...panelHandleProps}
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

        {/* BODY */}
        <div
          className="panel-body"
          style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}
        >
          <div style={{ height: 18 }} />

          {/* ✅ KEEP your scroll container — BUT it is NOT the droppable ref anymore */}
          <div
            data-panelid={panel.id}
            className="panel-scroll"
            style={{
              width: "100%",
              height: "100%",
              overflowY: "auto",
              overflowX: "hidden",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              touchAction: "pan-y",
              minHeight: 120,
              position: "relative",
            }}
          >
            <div style={{ padding: 14, boxSizing: "border-box" }}>
              <div className="containers-col">
                <SortableContext
                  items={panelContainerIds}
                  strategy={rectSortingStrategy}
                  disabled={isInstanceDrag}
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
                </SortableContext>

                {panelContainers.length === 0 && !isContainerDrag && (
                  <div style={{ marginTop: 12, opacity: 0.7, fontSize: 13 }}>
                    Create a container to start.
                  </div>
                )}

                {panel.containers.length === 0 && isContainerDrag && (
                  <div
                    style={{
                      height: 80,
                      margin: 12,
                      borderRadius: 10,
                      border: isOverPanelDrop
                        ? "2px solid rgba(50,150,255,0.9)"
                        : "2px dashed rgba(50,150,255,0.6)",
                      boxShadow: isOverPanelDrop
                        ? "0 0 0 3px rgba(50,150,255,0.25) inset"
                        : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgba(50,150,255,0.9)",
                      fontSize: 13,
                      pointerEvents: "none",
                    }}
                  >
                    Drop container here
                  </div>
                )}
              </div>
            </div>

           
          </div>
          <div style={{ height: 18 }} />
        </div>

        <ResizeHandle onMouseDown={beginResize} onTouchStart={beginResize} />
      </div>
    </div>
  );
}


