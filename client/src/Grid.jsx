// Grid.jsx — DUMB COMPONENT
// ============================================================
// DRAG: None (grid itself is not draggable)
// DROP: GridCell accepts PANEL drops
// ============================================================

import React, {
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";

import Panel from "./Panel";
import FullscreenOverlay from "./ui/FullscreenOverlay";

import { GridDataContext } from "./GridDataContext";
import { GridActionsContext } from "./GridActionsContext";

import { DragProvider } from "./helpers/DragProvider";
import { useDragContext, useDroppable, DragType, DropAccepts } from "./helpers/dragSystem";
import * as CommitHelpers from "./helpers/CommitHelpers";

// ============================================================
// GRID CELL - Drop zone for panels
// ============================================================
const GridCell = React.memo(function GridCell({ r, c, dark, hasPanel }) {
  const dragCtx = useDragContext();
  const { isPanelDrag, panelOverCellId } = dragCtx;

  const cellId = `cell-${r}-${c}`;

  // DROP ZONE: Accepts panels
  const { ref, isOver } = useDroppable({
    type: "grid-cell",
    id: cellId,
    context: { row: r, col: c, cellId },
    accepts: DropAccepts.GRID_CELL,
    disabled: !isPanelDrag,
  });

  const highlight = isPanelDrag && (panelOverCellId === cellId || isOver);

  return (
    <div
      ref={ref}
      data-id={cellId}
      className={[
        "grid-cell",
        highlight ? "is-highlight" : "",
      ].join(" ")}
      style={{ gridRow: r + 1, gridColumn: c + 1 }}
    >
      {/* Show pocket effect when cell is empty */}
      {!hasPanel && (
        <div
          style={{
            position: "absolute",
            inset: "6px",
            borderRadius: "8px",
            background: "rgba(69, 72, 74, 0.4)",
            border: "1px solid rgba(0, 0, 0, 0.5)",
            boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.3)",
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="text-xs text-muted-foreground p-2 text-center"
            style={{ fontStyle: "italic", opacity: 0.6 }}
          >
            Drop panel here
          </div>
        </div>
      )}
    </div>
  );
});

// ============================================================
// GRID RENDER
// ============================================================
function GridRender({
  components,
  gridRef,
  rows,
  cols,
  colTemplate,
  rowTemplate,
  colSizes,
  rowSizes,
  panelsRender,
  containersById,
  dispatch,
  socket,
  fullscreenPanelId,
  setFullscreenPanelId,
  addContainerToPanel,
  addInstanceToContainer,
  instancesById,
  sizesRef,
  onStartColResize,
  onStartRowResize,
}) {
  const cellsData = useMemo(() => {
    const arr = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Check if any visible panel occupies this cell (as its primary cell)
        const hasPanel = panelsRender.some((p) => {
          const display = p?.layout?.style?.display ?? "block";
          return display !== "none" && p.row === r && p.col === c;
        });
        arr.push({ r, c, dark: (r + c) % 2 === 0, hasPanel });
      }
    }
    return arr;
  }, [rows, cols, panelsRender]);

  // Calculate positions for resize handles
  const getColPosition = useCallback((i) => {
    const total = colSizes.reduce((a, b) => a + b, 0);
    const before = colSizes.slice(0, i + 1).reduce((a, b) => a + b, 0);
    return (before / total) * 100;
  }, [colSizes]);

  const getRowPosition = useCallback((i) => {
    const total = rowSizes.reduce((a, b) => a + b, 0);
    const before = rowSizes.slice(0, i + 1).reduce((a, b) => a + b, 0);
    return (before / total) * 100;
  }, [rowSizes]);

  return (
    <div
      ref={gridRef}
      className={[
        "bg-background2 rounded-xl border border-border shadow-inner ring-1 ring-black/30",
        fullscreenPanelId !== null ? "pointer-events-none opacity-0" : "",
      ].join(" ")}
      style={{
        display: "grid",
        gridTemplateColumns: colTemplate,
        gridTemplateRows: rowTemplate,
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        borderRadius: 12,
        transition: "opacity 0.15s ease",
      }}
    >
      {cellsData.map(({ r, c, dark, hasPanel }) => (
        <GridCell key={`cell-${r}-${c}`} r={r} c={c} dark={dark} hasPanel={hasPanel} />
      ))}

      {/* Vertical resize handles (between columns) */}
      {[...Array(cols - 1)].map((_, i) => (
        <div
          key={`col-resize-${i}`}
          onMouseDown={(e) => onStartColResize(e, i)}
          onTouchStart={(e) => onStartColResize(e, i)}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${getColPosition(i)}%`,
            width: 6,
            transform: 'translateX(-50%)',
            cursor: "col-resize",
            zIndex: 50,
            background: "#8f969eff",
            borderRadius: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="4" height="16" viewBox="0 0 4 16" style={{ opacity: 0.6 }}>
            <circle cx="2" cy="4" r="1" fill="white" />
            <circle cx="2" cy="8" r="1" fill="white" />
            <circle cx="2" cy="12" r="1" fill="white" />
          </svg>
        </div>
      ))}

      {/* Horizontal resize handles (between rows) */}
      {[...Array(rows - 1)].map((_, i) => (
        <div
          key={`row-resize-${i}`}
          onMouseDown={(e) => onStartRowResize(e, i)}
          onTouchStart={(e) => onStartRowResize(e, i)}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${getRowPosition(i)}%`,
            height: 6,
            transform: 'translateY(-50%)',
            cursor: "row-resize",
            zIndex: 50,
            background: "#8f969eff",
            borderRadius: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="16" height="4" viewBox="0 0 16 4" style={{ opacity: 0.6 }}>
            <circle cx="4" cy="2" r="1" fill="white" />
            <circle cx="8" cy="2" r="1" fill="white" />
            <circle cx="12" cy="2" r="1" fill="white" />
          </svg>
        </div>
      ))}

      {panelsRender.map((p) => {
        const display = p?.layout?.style?.display ?? "block";
        if (display === "none") return null;

        return (
          <Panel
            key={p.id}
            panel={p}
            dispatch={dispatch}
            socket={socket}
            cols={cols}
            rows={rows}
            components={components}
            containersById={containersById}
            addContainerToPanel={addContainerToPanel}
            addInstanceToContainer={addInstanceToContainer}
            instancesById={instancesById}
            sizesRef={sizesRef}
            fullscreenPanelId={fullscreenPanelId}
            setFullscreenPanelId={setFullscreenPanelId}
          />
        );
      })}
    </div>
  );
}

// ============================================================
// GRID INNER (wraps with DragProvider)
// ============================================================
function GridInner({ components }) {
  const { state } = useContext(GridDataContext);

  const [dragTick, setDragTick] = useState(0);
  const onTick = useCallback(() => setDragTick((x) => x + 1), []);

  const {
    dispatch,
    socket,
    addContainerToPanel,
    addInstanceToContainer,
    instancesById,
  } = useContext(GridActionsContext);

  const grid = state.grid;
  const gridId = grid?._id;
  const rows = grid?.rows ?? 1;
  const cols = grid?.cols ?? 1;

  const gridRef = useRef(null);

  const visiblePanels = useMemo(() => {
    return (state.panels || []).filter((p) => p.gridId === gridId);
  }, [state.panels, gridId]);

  const [fullscreenPanelId, setFullscreenPanelId] = useState(null);

  // Grid sizing
  const ensureSizes = (arr, count) => {
    if (!Array.isArray(arr) || arr.length === 0) return Array(count).fill(1);
    if (arr.length === count) return arr;
    if (arr.length < count) return [...arr, ...Array(count - arr.length).fill(1)];
    return arr.slice(0, count);
  };

  const sameArray = (a = [], b = []) => {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  };

  const [colSizes, setColSizes] = useState(() => ensureSizes(grid?.colSizes, cols));
  const [rowSizes, setRowSizes] = useState(() => ensureSizes(grid?.rowSizes, rows));
  const sizesRef = useRef({ colSizes: [], rowSizes: [] });

  useEffect(() => { sizesRef.current = { colSizes, rowSizes }; }, [colSizes, rowSizes]);
  useEffect(() => {
    const next = ensureSizes(grid?.colSizes, cols);
    setColSizes((prev) => (sameArray(prev, next) ? prev : next));
  }, [cols, grid?._id]);
  useEffect(() => {
    const next = ensureSizes(grid?.rowSizes, rows);
    setRowSizes((prev) => (sameArray(prev, next) ? prev : next));
  }, [rows, grid?._id]);

  const colTemplate = colSizes.map((s) => `${s}fr`).join(" ");
  const rowTemplate = rowSizes.map((s) => `${s}fr`).join(" ");

  const containersById = useMemo(() => {
    const m = Object.create(null);
    for (const c of state.containers || []) m[c.id] = c;
    return m;
  }, [state.containers]);

  const panelsById = useMemo(() => {
    const m = Object.create(null);
    for (const p of state.panels || []) m[p.id] = p;
    return m;
  }, [state.panels]);

  // Grid resize functionality
  const resizePendingRef = useRef({ rowSizes: null, colSizes: null });

  const finalizeResize = useCallback(() => {
    const pending = resizePendingRef.current;
    if (!pending.rowSizes && !pending.colSizes) return;
    if (!gridId) return;

    const nextRowSizes = pending.rowSizes ?? rowSizes;
    const nextColSizes = pending.colSizes ?? colSizes;

    CommitHelpers.updateGrid({
      dispatch,
      socket,
      gridId,
      grid: { rowSizes: nextRowSizes, colSizes: nextColSizes },
      emit: true,
    });

    resizePendingRef.current = { rowSizes: null, colSizes: null };
  }, [gridId, rowSizes, colSizes, dispatch, socket]);

  const getGridWidth = () => gridRef.current?.clientWidth || 1;
  const getGridHeight = () => gridRef.current?.clientHeight || 1;

  const resizeColumn = useCallback((i, pixelDelta) => {
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
  }, []);

  const resizeRow = useCallback((i, pixelDelta) => {
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
  }, []);

  const getClientX = (e) => (e.touches ? e.touches[0].clientX : e.clientX);
  const getClientY = (e) => (e.touches ? e.touches[0].clientY : e.clientY);

  const startColResize = useCallback((e, i) => {
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
  }, [resizeColumn, finalizeResize]);

  const startRowResize = useCallback((e, i) => {
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
  }, [resizeRow, finalizeResize]);

  return (
    <DragProvider
      state={state}
      dispatch={dispatch}
      socket={socket}
      gridRef={gridRef}
      rows={rows}
      cols={cols}
      rowSizes={rowSizes}
      colSizes={colSizes}
      visiblePanels={visiblePanels}
      onTick={onTick}
    >
      <GridRender
        components={components}
        gridRef={gridRef}
        rows={rows}
        cols={cols}
        colTemplate={colTemplate}
        rowTemplate={rowTemplate}
        colSizes={colSizes}
        rowSizes={rowSizes}
        panelsRender={visiblePanels}
        containersById={containersById}
        dispatch={dispatch}
        socket={socket}
        fullscreenPanelId={fullscreenPanelId}
        setFullscreenPanelId={setFullscreenPanelId}
        addContainerToPanel={addContainerToPanel}
        addInstanceToContainer={addInstanceToContainer}
        instancesById={instancesById}
        sizesRef={sizesRef}
        onStartColResize={startColResize}
        onStartRowResize={startRowResize}
      />

      <FullscreenOverlay
        fullscreenPanelId={fullscreenPanelId}
        setFullscreenPanelId={setFullscreenPanelId}
        panelsById={panelsById}
        components={components}
        cols={cols}
        rows={rows}
      />
    </DragProvider>
  );
}

export default GridInner;
