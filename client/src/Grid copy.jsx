import React, { useContext, useEffect, useRef, useState, useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDndContext,
  useDroppable,
  pointerWithin,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";

import { GridDataContext } from "./GridDataContext";
import { GridActionsContext } from "./GridActionsContext";
import { ActionTypes } from "./state/actions";

import Panel from "./Panel";
import PanelClone from "./PanelClone";

// -----------------------------
// Cell droppable (panels only)
// -----------------------------
function CellDroppable({ r, c, dark }) {
  const { active } = useDndContext();
  const isPanelDrag = active?.data?.current?.role === "panel";

  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${r}-${c}`,
    data: { role: "grid:cell", row: r, col: c },
  });

  const highlight = isPanelDrag && isOver;

  return (
    <div
      ref={setNodeRef}
      style={{
        background: highlight
          ? "rgba(50,150,255,0.45)"
          : dark
          ? "#22272B"
          : "#2C333A",
        border: "1px solid #3F444A",
        transition: "background 80ms",
        pointerEvents: "auto",
      }}
    />
  );
}

// -----------------------------
// Collision: panels can only hit cells
// -----------------------------
function panelOnlyCollision(args) {
  const { active } = args;
  if (active?.data?.current?.role !== "panel") return [];
  const hits = pointerWithin(args);
  return hits.filter((h) => h?.data?.droppableContainer?.data?.current?.role === "grid:cell");
}

const ensureSizes = (arr, count) => {
  if (!Array.isArray(arr) || arr.length === 0) return Array(count).fill(1);
  if (arr.length === count) return arr;
  if (arr.length < count) return [...arr, ...Array(count - arr.length).fill(1)];
  return arr.slice(0, count);
};

export default function Grid() {
  const { gridId, grid, panels } = useContext(GridDataContext);
  const { toggleToolbar, addContainer, dispatch } = useContext(GridActionsContext);

  // NOTE: you already have dispatch in reducer hooks, so we just import ActionTypes and use
  // dispatch via React context? If you don’t provide dispatch in GridActionsContext, we’ll use window.dispatch fallback:
  // Better: just use your reducer dispatch directly by adding it to GridActionsContext (recommended).
  // For now, we’ll grab it from a global fallback if missing:

  const rows = grid?.rows ?? 1;
  const cols = grid?.cols ?? 1;

  const visiblePanels = (panels || []).filter((p) => p.gridId === gridId);

  const gridRef = useRef(null);
  const [activeId, setActiveId] = useState(null);
  const [panelDragging, setPanelDragging] = useState(false);

  const panelDragLiveRef = useRef({ id: null, dx: 0, dy: 0 });

  const [colSizes, setColSizes] = useState(() => ensureSizes(grid?.colSizes, cols));
  const [rowSizes, setRowSizes] = useState(() => ensureSizes(grid?.rowSizes, rows));

  useEffect(() => setColSizes(ensureSizes(grid?.colSizes, cols)), [grid?.colSizes, cols]);
  useEffect(() => setRowSizes(ensureSizes(grid?.rowSizes, rows)), [grid?.rowSizes, rows]);

  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.dataset.sizes = JSON.stringify({ colSizes, rowSizes });
    }
  }, [colSizes, rowSizes]);

  const colTemplate = colSizes.map((s) => `${s}fr`).join(" ");
  const rowTemplate = rowSizes.map((s) => `${s}fr`).join(" ");

  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 8 } }),
    useSensor(PointerSensor)
  );

  const getPanel = (id) => visiblePanels.find((p) => p.id === id);

  // pointer → cell (uses rowSizes/colSizes)
  const getCellFromPointer = (clientX, clientY) => {
    const rect = gridRef.current.getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;

    let col = 0;
    let row = 0;

    const totalCols = colSizes.reduce((a, b) => a + b, 0);
    let acc = 0;
    for (let i = 0; i < colSizes.length; i++) {
      acc += colSizes[i];
      if (relX < acc / totalCols) {
        col = i;
        break;
      }
    }

    const totalRows = rowSizes.reduce((a, b) => a + b, 0);
    acc = 0;
    for (let i = 0; i < rowSizes.length; i++) {
      acc += rowSizes[i];
      if (relY < acc / totalRows) {
        row = i;
        break;
      }
    }

    return { row, col };
  };

  // percent positions for resizer bars
  const getColPosition = (i) => {
    const total = colSizes.reduce((a, b) => a + b, 0);
    const before = colSizes.slice(0, i + 1).reduce((a, b) => a + b, 0);
    return (before / total) * 100;
  };
  const getRowPosition = (i) => {
    const total = rowSizes.reduce((a, b) => a + b, 0);
    const before = rowSizes.slice(0, i + 1).reduce((a, b) => a + b, 0);
    return (before / total) * 100;
  };

  // ---- drag start/move/end (panels only)
  const handleDragStart = (event) => {
    setActiveId(event.active.id);

    const data = event.active.data.current;
    if (data?.role === "panel") {
      panelDragLiveRef.current = { id: data.panelId, dx: 0, dy: 0 };
      setPanelDragging(true);
    }
  };

  const handleDragMove = (event) => {
    const data = event.active.data.current;
    if (!data || data.role !== "panel") return;

    const p = document.querySelector(`[data-panel-id='${data.panelId}']`);
    if (p) {
      p.style.transition = "none";
      p.style.transform = `translate(${event.delta.x}px, ${event.delta.y}px)`;
    }

    panelDragLiveRef.current.dx = event.delta.x;
    panelDragLiveRef.current.dy = event.delta.y;
  };

  const sanitizePanelPlacement = (panel) => ({
    ...panel,
    row: Math.max(0, Math.min(panel.row, rows - 1)),
    col: Math.max(0, Math.min(panel.col, cols - 1)),
    width: panel.width,
    height: panel.height,
  });

  const handleDragEnd = (event) => {
    const { active } = event;

    setActiveId(null);
    setPanelDragging(false);

    const data = active?.data?.current;
    if (!data || data.role !== "panel") return;

    const panel = getPanel(active.id);
    if (!panel) return;

    const pointerX = event.activatorEvent.clientX + panelDragLiveRef.current.dx;
    const pointerY = event.activatorEvent.clientY + panelDragLiveRef.current.dy;

    const { col, row } = getCellFromPointer(pointerX, pointerY);

    const updated = sanitizePanelPlacement({ ...panel, col, row });

    // optimistic local
    dispatch({ type: ActionTypes.PATCH_PANEL, payload: { panel: updated } });

    // server
    // IMPORTANT: your server expects socket.emit("update_panel", { panel })
    // We can’t import socket here cleanly unless you want to — easiest:
    window.__moduliSocket?.emit?.("update_panel", { panel: updated });

    // reset transform
    const p = document.querySelector(`[data-panel-id='${panel.id}']`);
    if (p) {
      p.style.transition = "transform 150ms ease";
      p.style.transform = "translate(0,0)";
    }

    panelDragLiveRef.current = { id: null, dx: 0, dy: 0 };
  };

  // ---- grid resizing: commit once on stop
  const resizePendingRef = useRef({ rowSizes: null, colSizes: null });

  const finalizeResize = () => {
    const pending = resizePendingRef.current;
    if (!pending.rowSizes && !pending.colSizes) return;
    if (!gridId) return;

    const nextRowSizes = pending.rowSizes ?? rowSizes;
    const nextColSizes = pending.colSizes ?? colSizes;

    dispatch({
      type: ActionTypes.PATCH_GRID,
      payload: { grid: { rowSizes: nextRowSizes, colSizes: nextColSizes } },
    });

    window.__moduliSocket?.emit?.("update_grid", {
      gridId,
      rowSizes: nextRowSizes,
      colSizes: nextColSizes,
    });

    resizePendingRef.current = { rowSizes: null, colSizes: null };
  };

  const getGridWidth = () => gridRef.current?.clientWidth || 1;
  const getGridHeight = () => gridRef.current?.clientHeight || 1;

  const resizeColumn = (i, pixelDelta) => {
    const gridWidth = getGridWidth();
    setColSizes((sizes) => {
      const next = i + 1;
      if (next >= sizes.length) return sizes;

      const total = sizes.reduce((a, b) => a + b, 0);
      const frDelta = (pixelDelta / gridWidth) * total;

      const copy = [...sizes];
      copy[i] = Math.max(0.3, copy[i] + frDelta);
      copy[next] = Math.max(0.3, copy[next] - frDelta);

      resizePendingRef.current.colSizes = copy;
      return copy;
    });
  };

  const resizeRow = (i, pixelDelta) => {
    const gridHeight = getGridHeight();
    setRowSizes((sizes) => {
      const next = i + 1;
      if (next >= sizes.length) return sizes;

      const total = sizes.reduce((a, b) => a + b, 0);
      const frDelta = (pixelDelta / gridHeight) * total;

      const copy = [...sizes];
      copy[i] = Math.max(0.3, copy[i] + frDelta);
      copy[next] = Math.max(0.3, copy[next] - frDelta);

      resizePendingRef.current.rowSizes = copy;
      return copy;
    });
  };

  const getClientX = (e) => (e.touches ? e.touches[0].clientX : e.clientX);
  const getClientY = (e) => (e.touches ? e.touches[0].clientY : e.clientY);

  const startColResize = (e, i) => {
    e.preventDefault();
    let startX = getClientX(e);

    const move = (ev) => {
      ev.preventDefault();
      const currentX = getClientX(ev);
      const delta = currentX - startX;
      startX = currentX;
      resizeColumn(i, delta);
    };

    const stop = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", stop);
      finalizeResize();
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", stop);
  };

  const startRowResize = (e, i) => {
    e.preventDefault();
    let startY = getClientY(e);

    const move = (ev) => {
      ev.preventDefault();
      const currentY = getClientY(ev);
      const delta = currentY - startY;
      startY = currentY;
      resizeRow(i, delta);
    };

    const stop = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", stop);
      finalizeResize();
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", stop);
  };

  // --- IMPORTANT: give Grid access to socket+dispatch without threading props everywhere
  // Set these once (App should set them too, but this is safe)
  useEffect(() => {
    window.__moduliSocket = window.__moduliSocket || null;
    window.__moduliDispatch = window.__moduliDispatch || null;
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={panelOnlyCollision}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      modifiers={[snapCenterToCursor]}
      autoScroll={{ threshold: { x: 0, y: 0.2 } }}
    >
      <div style={{ position: "absolute", inset: 0, background: "#1D2125", overflow: "hidden" }}>
        <div
          onClick={toggleToolbar}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 42,
            height: 42,
            background: "#2C313A",
            border: "1px solid #444",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            cursor: "pointer",
            zIndex: 4000,
          }}
        >
          🔧
        </div>

        <div
          ref={gridRef}
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            gridTemplateColumns: colTemplate,
            gridTemplateRows: rowTemplate,
            width: "100%",
            height: "93vh",
            overflow: "hidden",
            touchAction: "none",
            overscrollBehaviorY: "none",
          }}
        >
          {[...Array(rows)].map((_, r) =>
            [...Array(cols)].map((_, c) => {
              const dark = (r + c) % 2 === 0;
              return <CellDroppable key={`${r}-${c}`} r={r} c={c} dark={dark} />;
            })
          )}

          {/* Vertical resizers */}
          {[...Array(cols - 1)].map((_, i) => (
            <div
              key={`col-resize-${i}`}
              onMouseDown={(e) => startColResize(e, i)}
              onTouchStart={(e) => startColResize(e, i)}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${getColPosition(i)}%`,
                width: 6,
                marginLeft: -3,
                cursor: "col-resize",
                zIndex: 50,
                background: "transparent",
              }}
            />
          ))}

          {/* Row resizers */}
          {[...Array(rows - 1)].map((_, i) => (
            <div
              key={`row-resize-${i}`}
              onMouseDown={(e) => startRowResize(e, i)}
              onTouchStart={(e) => startRowResize(e, i)}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${getRowPosition(i)}%`,
                height: 6,
                marginTop: -3,
                cursor: "row-resize",
                zIndex: 50,
                background: "transparent",
              }}
            />
          ))}

          {/* Panels */}
          {visiblePanels.map((p) => (
            <Panel
              key={p.id}
              panel={p}
              gridRef={gridRef}
              cols={cols}
              rows={rows}
              activeId={activeId}
              gridActive={panelDragging}
              onAddContainer={() => addContainer?.({ panelId: p.id })}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null} zIndex={100000}>
        {activeId && getPanel(activeId) ? <PanelClone panel={getPanel(activeId)} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
