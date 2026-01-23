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

// ============================================================
// GRID CELL - Drop zone for panels
// ============================================================
const GridCell = React.memo(function GridCell({ r, c, dark }) {
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
        dark ? "is-dark" : "is-light",
        highlight ? "is-highlight" : "",
      ].join(" ")}
      style={{ gridRow: r + 1, gridColumn: c + 1 }}
    />
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
}) {
  const cellsData = useMemo(() => {
    const arr = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        arr.push({ r, c, dark: (r + c) % 2 === 0 });
      }
    }
    return arr;
  }, [rows, cols]);

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
      {cellsData.map(({ r, c, dark }) => (
        <GridCell key={`cell-${r}-${c}`} r={r} c={c} dark={dark} />
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
