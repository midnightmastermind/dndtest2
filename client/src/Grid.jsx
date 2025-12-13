import React, { useContext, useMemo, useRef, useState, useEffect } from "react";
import {
  useDndContext,
  useDroppable,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  TouchSensor
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, verticalListSortingStrategy } from "@dnd-kit/sortable";
import Panel from "./Panel";
import PanelClone from "./PanelClone";
import { GridDataContext } from "./GridDataContext";
import { GridActionsContext } from "./GridActionsContext";
/* ------------------------------------------------------------
   DROPPABLE GRID CELL
------------------------------------------------------------ */
function CellDroppable({ r, c, dark }) {
  const { active } = useDndContext();
  const isPanelDrag = active?.data?.current?.role === "panel";

  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${r}-${c}`,
    data: { role: "grid:cell", row: r, col: c }
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
function GridInner({components}) {
  const { state, containersRender, instances, activeId: globalActiveId, activeSize } =
    useContext(GridDataContext);

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
    socket
  } = useContext(GridActionsContext);

  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 500, tolerance: 8 }
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

  /* ------------------------------------------------------------
      🔥 NEW: Track transform during panel drag
  ------------------------------------------------------------ */
  const panelDragLiveRef = useRef({ id: null, dx: 0, dy: 0 });

  /* ------------------------------------------------------------
      GRID SIZE STATE
  ------------------------------------------------------------ */
 const ensureSizes = (arr, count) => {
  // If no sizes yet, create a fresh array
  if (!Array.isArray(arr) || arr.length === 0) {
    return Array(count).fill(1);
  }

  // If already the right length, keep as-is
  if (arr.length === count) {
    return arr;
  }

  // If fewer entries than count, pad with 1s
  if (arr.length < count) {
    return [...arr, ...Array(count - arr.length).fill(1)];
  }

  // If more entries than count, truncate
  return arr.slice(0, count);
};


  const [colSizes, setColSizes] = useState(() =>
    ensureSizes(grid.colSizes, cols)
  );
  const [rowSizes, setRowSizes] = useState(() =>
    ensureSizes(grid.rowSizes, rows)
  );

  useEffect(() => setColSizes(ensureSizes(grid.colSizes, cols)), [
    grid.colSizes,
    cols
  ]);
  useEffect(() => setRowSizes(ensureSizes(grid.rowSizes, rows)), [
    grid.rowSizes,
    rows
  ]);

  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.dataset.sizes = JSON.stringify({ colSizes, rowSizes });
    }
  }, [colSizes, rowSizes]);

  const colTemplate = colSizes.map((s) => `${s}fr`).join(" ");
  const rowTemplate = rowSizes.map((s) => `${s}fr`).join(" ");



  const getPanel = (id) => visiblePanels.find((p) => p.id === id);

  /* ------------------------------------------------------------
      POINTER → CELL
  ------------------------------------------------------------ */
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
      if (relX < acc / totalCols) { col = i; break; }
    }

    const totalRows = rowSizes.reduce((a, b) => a + b, 0);
    acc = 0;
    for (let i = 0; i < rowSizes.length; i++) {
      acc += rowSizes[i];
      if (relY < acc / totalRows) { row = i; break; }
    }

    return { row, col };
  };

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

  /* ------------------------------------------------------------
      DRAG START
  ------------------------------------------------------------ */
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
    setActiveData(event.active.data.current);

    const data = event.active.data.current;

    if (data?.role === "panel") {
      panelDragLiveRef.current = { id: data.panelId, dx: 0, dy: 0 };
      setPanelDragging(true);
    } else {
      handleDragStartProp(event);
    }
  };

  /* ------------------------------------------------------------
      🔥 DRAG MOVE — Smooth panel transform
  ------------------------------------------------------------ */
const handleDragMove = (event) => {
  const data = event.active.data.current;

  // 👇 Tasks: do nothing here, let onDragOver drive preview/sorting
  if (!data || data.role !== "panel") return;

  // Panels: smooth transform while dragging
  const p = document.querySelector(`[data-panel-id='${data.panelId}']`);
  if (p) {
    p.style.transition = "none";
    p.style.transform = `translate(${event.delta.x}px, ${event.delta.y}px)`;
  }

  panelDragLiveRef.current.dx = event.delta.x;
  panelDragLiveRef.current.dy = event.delta.y;
};

  /* ------------------------------------------------------------
      SANITIZE PLACEMENT
  ------------------------------------------------------------ */
  const sanitizePanelPlacement = (panel, rows, cols) => ({
    ...panel,
    row: Math.max(0, Math.min(panel.row, rows - 1)),
    col: Math.max(0, Math.min(panel.col, cols - 1)),
    width: panel.width,
    height: panel.height
  });

  /* ------------------------------------------------------------
      🔥 DRAG END — Commit final placement ONCE
  ------------------------------------------------------------ */
  const handleDragEnd = (event) => {
    const { active } = event;

    setActiveId(null);
    setPanelDragging(false);

    const data = active?.data?.current;
    if (!data) return;

    if (data.role !== "panel") {
      handleDragEndProp(event);
      return;
    }

    const panel = getPanel(active.id);
    if (!panel) return;

    const pointerX = event.activatorEvent.clientX + panelDragLiveRef.current.dx;
    const pointerY = event.activatorEvent.clientY + panelDragLiveRef.current.dy;

    const { col, row } = getCellFromPointer(pointerX, pointerY);

    let updated = sanitizePanelPlacement(
      { ...panel, col, row },
      rows,
      cols
    );

    dispatch(updatePanel(updated));
    socket.emit("update_panel", { panel: updated, gridId });

    /* 🔥 Reset transform after drop */
    const p = document.querySelector(`[data-panel-id='${panel.id}']`);
    if (p) {
      p.style.transition = "transform 150ms ease";
      p.style.transform = "translate(0,0)";
    }

    panelDragLiveRef.current = { id: null, dx: 0, dy: 0 };
  };

  /* ------------------------------------------------------------
      GRID RESIZING (unchanged)
  ------------------------------------------------------------ */
  const resizePendingRef = useRef({
    rowSizes: null,
    colSizes: null
  });

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
        colSizes: pending.colSizes ?? colSizes
      })
    );

    socket.emit("update_grid", {
      gridId: state.grid._id,
      grid: {
        _id: state.grid._id,
        rows: state.grid.rows,
        cols: state.grid.cols,
        rowSizes: pending.rowSizes ?? rowSizes,
        colSizes: pending.colSizes ?? colSizes
      }
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

  if (!grid?._id) return <div>Loading grid…</div>;
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOverProp}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancelProp}
    >
  <div style={{ position: "absolute", inset: 0, background: "#1D2125", overflow: "hidden" }}>
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
            overscrollBehaviorY: "none"
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
                background: "transparent"
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
                background: "transparent"
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
      </div>

      <DragOverlay dropAnimation={null} zIndex={100000}>
        {activeId && getPanel(activeId) ? (
          <PanelClone panel={getPanel(activeId)} />
        ) : null}


      </DragOverlay>
    </DndContext>
  );
}
       /* {!getPanel(activeId) && activeData
          ? renderDragOverlay({
            active: { id: activeId, data: { current: activeData } }
          })
          : null} */
export default React.memo(GridInner);
