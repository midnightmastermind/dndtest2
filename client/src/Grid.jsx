// GridInner.jsx
import React, { useContext, useMemo, useRef, useState, useEffect } from "react";
import {
  useDroppable,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  TouchSensor,
  rectIntersection,
  DragOverlay,
} from "@dnd-kit/core";

import Panel from "./Panel";
import PanelClone from "./PanelClone";
import { GridDataContext } from "./GridDataContext";
import { GridActionsContext } from "./GridActionsContext";

const DEBUG_GRID_HIGHLIGHT = true;

/* ------------------------------------------------------------
   DROPPABLE GRID CELL
   ✅ Highlight driven by parent "highlightCellId"
------------------------------------------------------------ */
function CellDroppable({ r, c, dark, highlight }) {
  const { setNodeRef } = useDroppable({
    id: `cell-${r}-${c}`,
    data: { role: "grid:cell", row: r, col: c },
  });

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
      }}
    />
  );
}

/* ------------------------------------------------------------
   Grid canvas
------------------------------------------------------------ */
function GridCanvas({
  gridRef,
  rows,
  cols,
  colTemplate,
  rowTemplate,
  visiblePanels,
  activeId,
  panelDragging,
  components,
  dispatch,
  addContainer,
  startColResize,
  startRowResize,
  getColPosition,
  getRowPosition,
  highlightCellId,
}) {
  return (
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
          const cellId = `cell-${r}-${c}`;
          return (
            <CellDroppable
              key={`${r}-${c}`}
              r={r}
              c={c}
              dark={dark}
              highlight={cellId === highlightCellId}
            />
          );
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
          dispatch={dispatch}
          gridRef={gridRef}
          cols={cols}
          rows={rows}
          activeId={activeId}
          components={components}
          gridActive={panelDragging}
          addContainer={addContainer}
        />
      ))}
    </div>
  );
}

function GridInner({ components }) {
  const { state } = useContext(GridDataContext);

  const {
    handleDragStart: handleDragStartProp,
    handleDragOver: handleDragOverProp,
    handleDragEnd: handleDragEndProp,
    handleDragCancel: handleDragCancelProp,
    useRenderCount,
    dispatch,
    updatePanel,
    updateGrid,
    addContainer,
    socket,
  } = useContext(GridActionsContext);

  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 500, tolerance: 8 },
    }),
    useSensor(PointerSensor)
  );

  useRenderCount("Grid");

  const grid = state.grid;
  const gridId = grid?._id;
  const rows = grid?.rows ?? 1;
  const cols = grid?.cols ?? 1;

  const visiblePanels = state.panels.filter((p) => p.gridId === gridId);

  const gridRef = useRef(null);
  const [activeId, setActiveId] = useState(state.activeId);
  const [activeData, setActiveData] = useState(null);
  const [panelDragging, setPanelDragging] = useState(false);

  // ✅ highlight target cell based on ONE source of truth
  const [panelOverCellId, setPanelOverCellId] = useState(null);

  // ✅ offset inside the panel (used only if initialRect exists; otherwise harmless)
  const panelPointerRef = useRef({ offsetX: 0, offsetY: 0 });

  // ✅ REAL cursor/touch pointer (single truth)
  const livePointerRef = useRef({ x: null, y: null });

  // ✅ attach global move listeners only while dragging a panel
  useEffect(() => {
    if (!panelDragging) return;

    const onMove = (e) => {
      if (e.touches?.[0]) {
        livePointerRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      } else {
        livePointerRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
    };
  }, [panelDragging]);

  // ------------------------
  // sizes
  // ------------------------
  const ensureSizes = (arr, count) => {
    if (!Array.isArray(arr) || arr.length === 0) return Array(count).fill(1);
    if (arr.length === count) return arr;
    if (arr.length < count) return [...arr, ...Array(count - arr.length).fill(1)];
    return arr.slice(0, count);
  };

  const [colSizes, setColSizes] = useState(() => ensureSizes(grid.colSizes, cols));
  const [rowSizes, setRowSizes] = useState(() => ensureSizes(grid.rowSizes, rows));

  useEffect(() => setColSizes(ensureSizes(grid.colSizes, cols)), [grid.colSizes, cols]);
  useEffect(() => setRowSizes(ensureSizes(grid.rowSizes, rows)), [grid.rowSizes, rows]);

  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.dataset.sizes = JSON.stringify({ colSizes, rowSizes });
    }
  }, [colSizes, rowSizes]);

  const colTemplate = colSizes.map((s) => `${s}fr`).join(" ");
  const rowTemplate = rowSizes.map((s) => `${s}fr`).join(" ");

  const getPanel = (id) => visiblePanels.find((p) => p.id === id);

  const clamp = (n, min, max) => Math.max(min, Math.min(n, max));

  const getCellFromPointer = (clientX, clientY) => {
    const gridEl = gridRef.current;
    if (!gridEl) return null;

    const rect = gridEl.getBoundingClientRect();

    const inside =
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom;

    if (!inside) {
      if (DEBUG_GRID_HIGHLIGHT) {
        console.log("[GRID] pointer outside grid", { clientX, clientY, rect });
      }
      return null;
    }

    const x = clamp(clientX - rect.left, 0, rect.width - 1);
    const y = clamp(clientY - rect.top, 0, rect.height - 1);

    const totalCols = colSizes.reduce((a, b) => a + b, 0);
    const totalRows = rowSizes.reduce((a, b) => a + b, 0);

    let col = colSizes.length - 1;
    let accX = 0;
    for (let i = 0; i < colSizes.length; i++) {
      accX += (colSizes[i] / totalCols) * rect.width;
      if (x < accX) {
        col = i;
        break;
      }
    }

    let row = rowSizes.length - 1;
    let accY = 0;
    for (let i = 0; i < rowSizes.length; i++) {
      accY += (rowSizes[i] / totalRows) * rect.height;
      if (y < accY) {
        row = i;
        break;
      }
    }

    if (DEBUG_GRID_HIGHLIGHT) {
      console.log("[GRID CELL CALC]", {
        clientX,
        clientY,
        gridLeft: rect.left,
        gridTop: rect.top,
        localX: x,
        localY: y,
        colSizes,
        rowSizes,
        row,
        col,
      });
    }

    return { row, col };
  };

  // pointer on drag start
  const getStartClientX = (event) =>
    event?.activatorEvent?.clientX ?? event?.activatorEvent?.touches?.[0]?.clientX;

  const getStartClientY = (event) =>
    event?.activatorEvent?.clientY ?? event?.activatorEvent?.touches?.[0]?.clientY;

  // ✅ DOM rect fallback for initialRect
  const getPanelDomRect = (panelId) => {
    const el = document.querySelector(`[data-panel-id="${panelId}"]`);
    return el ? el.getBoundingClientRect() : null;
  };

  // ✅ collisionDetection uses highlight cell (same truth as UI)
  const collisionDetection = useMemo(() => {
    return (args) => {
      const activeRole = args.active?.data?.current?.role;
      if (activeRole === "panel") {
        return panelOverCellId ? [{ id: panelOverCellId }] : [];
      }
      return rectIntersection(args);
    };
  }, [panelOverCellId]);

  const sanitizePanelPlacement = (panel, rows, cols) => ({
    ...panel,
    row: Math.max(0, Math.min(panel.row, rows - 1)),
    col: Math.max(0, Math.min(panel.col, cols - 1)),
    width: panel.width,
    height: panel.height,
  });

  // DEBUG helper only
  const getPointerFromActiveRect = (event) => {
    const translated = event.active?.rect?.current?.translated;
    const initial = event.active?.rect?.current?.initial;
    const rect = translated || initial;
    if (!rect) return null;

    const x = rect.left + panelPointerRef.current.offsetX;
    const y = rect.top + panelPointerRef.current.offsetY;

    if (DEBUG_GRID_HIGHLIGHT) {
      console.log("[POINTER FROM RECT]", {
        rectLeft: rect.left,
        rectTop: rect.top,
        offsetX: panelPointerRef.current.offsetX,
        offsetY: panelPointerRef.current.offsetY,
        computedX: x,
        computedY: y,
      });
    }

    return { x, y };
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
    setActiveData(event.active.data.current);

    const data = event.active.data.current;

    if (data?.role === "panel") {
      setPanelDragging(true);

      const startX = getStartClientX(event);
      const startY = getStartClientY(event);

      // dnd-kit sometimes gives null initial rect -> DOM fallback
      const initialRect =
        event.active?.rect?.current?.initial || getPanelDomRect(event.active.id);

      if (DEBUG_GRID_HIGHLIGHT) {
        console.log("[DRAG START]", {
          startX,
          startY,
          hasInitialRect: !!initialRect,
          initialRect: initialRect
            ? { left: initialRect.left, top: initialRect.top, w: initialRect.width, h: initialRect.height }
            : null,
        });
      }

      if (
        typeof startX === "number" &&
        typeof startY === "number" &&
        initialRect
      ) {
        panelPointerRef.current.offsetX = startX - initialRect.left;
        panelPointerRef.current.offsetY = startY - initialRect.top;
      } else {
        panelPointerRef.current.offsetX = 0;
        panelPointerRef.current.offsetY = 0;
      }

      // seed live pointer so first move tick isn't null
      livePointerRef.current = { x: startX ?? null, y: startY ?? null };

      // highlight pickup cell immediately (REAL pointer)
      if (typeof startX === "number" && typeof startY === "number") {
        const rc = getCellFromPointer(startX, startY);
        setPanelOverCellId(rc ? `cell-${rc.row}-${rc.col}` : null);
      } else {
        setPanelOverCellId(null);
      }

      return;
    }

    handleDragStartProp?.(event);
  };

  const handleDragMove = (event) => {
    const data = event.active?.data?.current;
    if (!data || data.role !== "panel") return;

    const live = livePointerRef.current; // ✅ real cursor
    const rectPtr = getPointerFromActiveRect(event); // debug comparison

    if (DEBUG_GRID_HIGHLIGHT) {
      console.log("[DRAG MOVE]", {
        livePointer: live,
        rectPointer: rectPtr,
        delta: event.delta,
      });
    }

    if (typeof live?.x !== "number" || typeof live?.y !== "number") return;

    const rc = getCellFromPointer(live.x, live.y); // ✅ REAL pointer only
    setPanelOverCellId(rc ? `cell-${rc.row}-${rc.col}` : null);
  };

  const handleDragOver = (event) => {
    const role = event.active?.data?.current?.role;
    if (role === "panel") return;
    handleDragOverProp?.(event);
  };

  const handleDragEnd = (event) => {
    const { active } = event;
    const data = active?.data?.current;

    setActiveId(null);

    if (!data) return;

    if (data.role !== "panel") {
      handleDragEndProp?.(event);
      return;
    }

    const panel = getPanel(active.id);
    if (!panel) {
      requestAnimationFrame(() => setPanelDragging(false));
      setPanelOverCellId(null);
      return;
    }

    // ✅ finalize using REAL pointer
    const live = livePointerRef.current;
    const rc =
      typeof live?.x === "number" && typeof live?.y === "number"
        ? getCellFromPointer(live.x, live.y)
        : null;

    if (!rc) {
      requestAnimationFrame(() => setPanelDragging(false));
      setPanelOverCellId(null);
      return;
    }

    const updated = sanitizePanelPlacement(
      { ...panel, row: rc.row, col: rc.col },
      rows,
      cols
    );

    dispatch(updatePanel(updated));
    socket.emit("update_panel", { panel: updated, gridId });

    // cleanup
    panelPointerRef.current = { offsetX: 0, offsetY: 0 };
    livePointerRef.current = { x: null, y: null };
    setPanelOverCellId(null);

    requestAnimationFrame(() => setPanelDragging(false));
  };

  const handleDragCancel = (event) => {
    setActiveId(null);

    panelPointerRef.current = { offsetX: 0, offsetY: 0 };
    livePointerRef.current = { x: null, y: null };

    setPanelOverCellId(null);
    requestAnimationFrame(() => setPanelDragging(false));

    const role = event.active?.data?.current?.role;
    if (role !== "panel") handleDragCancelProp?.(event);
  };

  // ---- Grid resizing (unchanged except one bugfix) ----
  const resizePendingRef = useRef({ rowSizes: null, colSizes: null });

  const finalizeResize = () => {
    const pending = resizePendingRef.current;
    if (!pending.rowSizes && !pending.colSizes) return;
    if (!state.grid?._id) return;

    dispatch(
      updateGrid({
        _id: state.grid._id,
        rows: state.grid.rows,
        cols: state.grid.cols,
        rowSizes: pending.rowSizes ?? rowSizes,
        colSizes: pending.colSizes ?? colSizes,
      })
    );

    socket.emit("update_grid", {
      gridId: state.grid._id,
      grid: {
        _id: state.grid._id,
        rows: state.grid.rows,
        cols: state.grid.cols,
        rowSizes: pending.rowSizes ?? rowSizes,
        colSizes: pending.colSizes ?? colSizes,
      },
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
    window.addEventListener("mouseup", stop); // ✅ FIXED (was removeEventListener)
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", stop);
  };

  if (!grid?._id) return <div>Loading grid…</div>;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragCancel={handleDragCancel}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#1D2125",
          overflow: "hidden",
        }}
      >
        <GridCanvas
          gridRef={gridRef}
          rows={rows}
          cols={cols}
          colTemplate={colTemplate}
          rowTemplate={rowTemplate}
          visiblePanels={visiblePanels}
          activeId={activeId}
          panelDragging={panelDragging}
          components={components}
          dispatch={dispatch}
          addContainer={addContainer}
          startColResize={startColResize}
          startRowResize={startRowResize}
          getColPosition={getColPosition}
          getRowPosition={getRowPosition}
          highlightCellId={panelOverCellId}
        />
      </div>

      <DragOverlay dropAnimation={null} zIndex={100000}>
        {activeId && getPanel(activeId) ? <PanelClone panel={getPanel(activeId)} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

export default React.memo(GridInner);