// Panel.jsx
import React, { useRef, useMemo } from "react";
import { useDraggable } from "@dnd-kit/core";
import ResizeHandle from "./ResizeHandle";
import Button from "@atlaskit/button";
import { token } from "@atlaskit/tokens";
import MoreVerticalIcon from "@atlaskit/icon/glyph/more-vertical";
import { ActionTypes } from "./state/actions";
import { emit } from "./socket";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";

export default function Panel({
  panel,
  components,
  addContainer,
  dispatch,
  gridRef,
  cols,
  rows,
  activeId,
  gridActive,
  fullscreenPanelId,
  setFullscreenPanelId,
  state,
  activeSize,
  activeInstance,
}) {

  const resizeTransformRef = useRef({ w: null, h: null });
  const isDraggingPanel = activeId === panel.id;

  const SortableContainer = components["SortableContainer"];
  const Instance = components["Instance"];

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

  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: panel.id,
    data,
    disabled: isDraggingPanel,
  });

  const updatePanelFinal = (updated) => {
    dispatch({ type: ActionTypes.UPDATE_PANEL, payload: updated });
    emit("update_panel", { panel: updated, gridId: panel.gridId });
  };

  const prev = useRef(null);
  const toggleFullscreen = () => {
    if (!fullscreenPanelId) {
      prev.current = { ...panel };

      updatePanelFinal({
        ...panel,
        row: 0,
        col: 0,
        width: cols,
        height: rows,
      });

      setFullscreenPanelId(panel.id);
    } else {
      updatePanelFinal({
        ...panel,
        ...prev.current,
      });

      setFullscreenPanelId(null);
    }
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

      resizeTransformRef.current = {
        w: Math.min(newW, cols - panel.col),
        h: Math.min(newH, rows - panel.row),
      };


    };

    const stop = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", stop);

      const { w, h } = resizeTransformRef.current;
      resizeTransformRef.current = { w: null, h: null };

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

  const liveW = resizeTransformRef.current.w ?? panel.width;
  const liveH = resizeTransformRef.current.h ?? panel.height;

  const gridArea = `${panel.row + 1} / ${panel.col + 1} /
                    ${panel.row + liveH + 1} /
                    ${panel.col + liveW + 1}`;

  return (
    <div
      data-panel-id={panel.id}
      ref={(el) => {
        setNodeRef(el);
      }}
      {...attributes}
      {...listeners}
      style={{
        gridArea,
        background: token("elevation.surface", "rgba(17,17,17,0.95)"),
        borderRadius: 8,
        border: "1px solid #AAA",
        overflow: "hidden",
        position: "relative",
        margin: "3px",

        // ✅ Option A: DO NOT apply dnd-kit transform to the real panel.
        // The overlay clone moves instead.
        transform: undefined,
        transition: "none",

        // Make the original look like a “placeholder” while dragging
        opacity: isDragging ? 0 : 1,
        pointerEvents:isDragging ? "none" : "auto",
        zIndex: 50,
      }}
    >
      <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div
          style={{
            background: "#2F343A",
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: 600,
            color: "white",
          }}
        >
          <div style={{ paddingLeft: 6, touchAction: "none" }} {...listeners}>
            <MoreVerticalIcon size="small" primaryColor="#9AA0A6" />
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <Button spacing="compact" onClick={toggleFullscreen}>
              {fullscreenPanelId === panel.id ? "R" : "F"}
            </Button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, color: "white", margin: 5 }}>
          <button onClick={addContainer}>+ Container</button>
          <div className="containers-col">
            <SortableContext items={panel?.containers || []} strategy={rectSortingStrategy}>
              {panel?.containers &&
                panel?.containers.map((c) => <SortableContainer key={c.id} container={c} />)}
            </SortableContext>

            {panel?.containers?.length === 0 && (
              <div style={{ marginTop: 12, opacity: 0.7, fontSize: 13 }}>
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
