// GridInner.jsx — MERGED (Grid is dumb: render + resize + wire DnDContext)
// ✅ DnDKit + native/cross-window drag logic lives in useDnDControlCoordinator
// ✅ Grid only wires DndContext to coordinator outputs + renders overlays/canvas
// ✅ Stacks are draft-aware and owned by coordinator (no Grid commits / repairs)

import React, {
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useDroppable, DndContext, DragOverlay } from "@dnd-kit/core";
import { MeasuringStrategy } from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";

import Panel from "./Panel";
import PanelClone from "./PanelClone";
import FullscreenOverlay from "./ui/FullscreenOverlay";

import { GridDataContext } from "./GridDataContext";
import { GridActionsContext } from "./GridActionsContext";
import { GripVertical } from "lucide-react";

import { useDnDControlCoordinator } from "./helpers/useDnDControlCoordinator";
import * as CommitHelpers from "./helpers/CommitHelpers";

/* -------------------------------------------
   ✅ Overlay clone for CONTAINER drags
------------------------------------------- */
function ContainerClone({ container }) {
  if (!container) return null;

  return (
    <div className="container-shell" style={{ pointerEvents: "none", opacity: 0.95 }}>
      <div className="container-header">
        <div style={{ paddingLeft: 6 }}>
          <GripVertical className="h-4 w-4 text-white" />
        </div>
        <div style={{ fontWeight: 600, padding: "0px 10px" }}>
          {container.label ?? "Container"}
        </div>
      </div>

      <div className="container-list" style={{ minHeight: 60 }}>
        <div style={{ fontSize: 12, opacity: 0.6, fontStyle: "italic", padding: 8 }}>
          Dragging…
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   DROPPABLE GRID CELL
------------------------------------------------------------ */
const CellDroppable = React.memo(function CellDroppable({
  r,
  c,
  dark,
  highlight,
  disabled,
}) {
  const { setNodeRef } = useDroppable({
    id: `cell-${r}-${c}`,
    disabled,
    data: { role: "grid:cell", row: r, col: c },
  });

  return (
    <div
      ref={setNodeRef}
      data-id={`cell-${r}-${c}`}
      className={[
        "grid-cell",
        dark ? "is-dark" : "is-light",
        highlight ? "is-highlight" : "",
      ].join(" ")}
      style={{ gridRow: r + 1, gridColumn: c + 1 }}
    />
  );
});

/* ------------------------------------------------------------
   NON-DROPPABLE GRID CELL
------------------------------------------------------------ */
const CellStatic = React.memo(function CellStatic({ r, c, dark, highlight }) {
  return (
    <div
      data-id={`cell-${r}-${c}`}
      className={[
        "grid-cell",
        "is-static",
        dark ? "is-dark" : "is-light",
        highlight ? "is-highlight" : "",
      ].join(" ")}
      style={{ gridRow: r + 1, gridColumn: c + 1 }}
    />
  );
});

/* ------------------------------------------------------------
   Grid canvas (dumb)
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
  socket,
  startColResize,
  startRowResize,
  getColPosition,
  getRowPosition,
  highlightCellId,
  panelProps,
  activeRole,
  getStackForPanel,
  fullscreenPanelId,
  setFullscreenPanelId,
}) {
  const cells = useMemo(() => {
    const out = [];
    const isPanelDrag = activeRole === "panel";

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dark = (r + c) % 2 === 0;
        const cellId = `cell-${r}-${c}`;
        const highlight = cellId === highlightCellId;

        out.push(
          isPanelDrag ? (
            <CellDroppable
              key={cellId}
              r={r}
              c={c}
              dark={dark}
              highlight={highlight}
              disabled={false}
            />
          ) : (
            <CellStatic key={cellId} r={r} c={c} dark={dark} highlight={highlight} />
          )
        );
      }
    }

    return out;
  }, [rows, cols, highlightCellId, activeRole]);

  return (
    <div
      className="grid-wrapper"
      ref={gridRef}
      style={{
        position: "absolute",
        inset: -5,
        display: "grid",
        gridTemplateColumns: colTemplate,
        gridTemplateRows: rowTemplate,
        width: "100%",
        height: "99vh",
        overflow: "hidden",
        touchAction: "none",
        overscrollBehaviorY: "none",
        margin: 3,
        marginTop: 5,
      }}
    >
      {cells}

      {/* Vertical resizers */}
      {[...Array(cols - 1)].map((_, i) => (
        <div
          className="bg-background border border-border rounded-sm shadow-md hover:shadow-lg"
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
            background: "#8f969eff",
          }}
        />
      ))}

      {/* Row resizers */}
      {[...Array(rows - 1)].map((_, i) => (
        <div
          className="bg-background border border-border rounded-sm shadow-md hover:shadow-lg"
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
            background: "#8f969eff",
          }}
        />
      ))}

      {/* Panels */}
      {visiblePanels.map((p) => {
        if (fullscreenPanelId !== null) return null;

        const display = p?.layout?.style?.display ?? "block";
        if (display === "none") return null;

        return (
          <Panel
            key={p.id}
            panel={p}
            dispatch={dispatch}
            socket={socket}
            gridRef={gridRef}
            cols={cols}
            rows={rows}
            activeId={activeId}
            components={components}
            gridActive={panelDragging}
            stackPanels={getStackForPanel?.(p) ?? null}
            {...panelProps}
            fullscreenPanelId={fullscreenPanelId}
            setFullscreenPanelId={setFullscreenPanelId}
          />
        );
      })}
    </div>
  );
}

function GridInner({ components }) {
  const { state } = useContext(GridDataContext);

  const [dragTick, setDragTick] = useState(0);
  const scheduleSoftTick = useCallback(() => setDragTick((x) => x + 1), []);

  const { dispatch, socket, addContainerToPanel, addInstanceToContainer, instancesById } =
    useContext(GridActionsContext);

  const grid = state.grid;
  const gridId = grid?._id;
  const rows = grid?.rows ?? 1;
  const cols = grid?.cols ?? 1;

  const gridRef = useRef(null);

  const visiblePanels = useMemo(() => {
    const arr = state.panels || [];
    return arr.filter((p) => p.gridId === gridId);
  }, [state.panels, gridId]);


  // ✅ Fullscreen is overlay-only
  const [fullscreenPanelId, setFullscreenPanelId] = useState(null);

  // -----------------------------
  // ✅ Grid sizing (NOT DnD; stays here)
  // -----------------------------
  const ensureSizes = (arr, count) => {
    if (!Array.isArray(arr) || arr.length === 0) return Array(count).fill(1);
    if (arr.length === count) return arr;
    if (arr.length < count) return [...arr, ...Array(count - arr.length).fill(1)];
    return arr.slice(0, count);
  };

  function sameArray(a = [], b = []) {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  const [colSizes, setColSizes] = useState(() => ensureSizes(grid?.colSizes, cols));
  const [rowSizes, setRowSizes] = useState(() => ensureSizes(grid?.rowSizes, rows));
  const sizesRef = useRef({ colSizes: [], rowSizes: [] });

  useEffect(() => {
    sizesRef.current = { colSizes, rowSizes };
  }, [colSizes, rowSizes]);

  useEffect(() => {
    const next = ensureSizes(grid?.colSizes, cols);
    setColSizes((prev) => (sameArray(prev, next) ? prev : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, grid?._id]);

  useEffect(() => {
    const next = ensureSizes(grid?.rowSizes, rows);
    setRowSizes((prev) => (sameArray(prev, next) ? prev : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, grid?._id]);

  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.dataset.sizes = JSON.stringify({ colSizes, rowSizes });
    }
  }, [colSizes, rowSizes]);

  const colTemplate = colSizes.map((s) => `${s}fr`).join(" ");
  const rowTemplate = rowSizes.map((s) => `${s}fr`).join(" ");

  // -----------------------------
  // ✅ Coordinator owns: sensors, collisionDetection, pointer listeners, panel placement, drafts,
  //    stack visibility + stack commits, native/cross-window logic, etc.
  // -----------------------------
  const {
    sensors,
    collisionDetection,
    onDragStart,
    onDragMove,
    onDragOver,
    onDragEnd,
    onDragCancel,

    activeId,
    activeRole,
    panelDragging,
    panelOverCellId,

    getWorkingContainers,
    getWorkingPanels,

    // ✅ stacks from coordinator (draft-aware)
    getStacksByCell,
    getStackForPanel,
    setActivePanelInCell,
    cyclePanelStack,

    overPanelId,
    overDataRef,
    hotTarget,
    isContainerDrag,
    isInstanceDrag,
  } = useDnDControlCoordinator({
    state,
    dispatch,
    socket,
    scheduleSoftTick,

    // allow coordinator to compute cell math for panel placement
    gridRef,
    rows,
    cols,
    rowSizes,
    colSizes,

    visiblePanels,
    // ✅ do NOT pass Grid-owned stacksByCell anymore
  });

  const containersRender = getWorkingContainers?.() ?? state?.containers ?? [];
  const panelsRender = getWorkingPanels?.() ?? visiblePanels;

  const panelsById = useMemo(() => {
    const m = Object.create(null);
    for (const p of panelsRender || []) m[p.id] = p;
    return m;
  }, [panelsRender]);

  const getPanel = useCallback((id) => panelsRender.find((p) => p.id === id), [panelsRender]);

  // ✅ stacksByCell for fullscreen/dropdowns (draft-aware)
  const stacksByCell = useMemo(() => getStacksByCell?.() || {}, [getStacksByCell, dragTick]);

  // -----------------------------
  // ✅ Grid resizing commit
  // -----------------------------
  const resizePendingRef = useRef({ rowSizes: null, colSizes: null });

  const finalizeResize = () => {
    const pending = resizePendingRef.current;
    if (!pending.rowSizes && !pending.colSizes) return;
    if (!state.grid?._id) return;

    const nextRowSizes = pending.rowSizes ?? rowSizes;
    const nextColSizes = pending.colSizes ?? colSizes;

    CommitHelpers.updateGrid({
      dispatch,
      socket,
      gridId: state.grid._id,
      grid: { rowSizes: nextRowSizes, colSizes: nextColSizes },
      emit: true,
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

  const containersById = useMemo(() => {
    const m = Object.create(null);
    for (const c of containersRender || []) m[c.id] = c;
    return m;
  }, [containersRender]);

  const activeContainer = useMemo(() => {
    if (activeRole !== "container" || !activeId) return null;
    return containersById?.[activeId] || null;
  }, [activeRole, activeId, containersById]);

  const InstanceComp = components["Instance"];

  const activeInstance = useMemo(() => {
    if (activeRole !== "instance" || !activeId) return null;
    return instancesById?.[activeId] || null;
  }, [activeRole, activeId, instancesById]);

  const panelProps = useMemo(
    () => ({
      addContainerToPanel,
      addInstanceToContainer,
      instancesById,
      sizesRef,
      containersById,

      // ✅ injected (no context subscriptions) — Option B
      overPanelId,
      overDataRef,
      hotTarget,
      isContainerDrag,
      isInstanceDrag,

      // ✅ stack actions from coordinator
      onSelectStackPanel: setActivePanelInCell,
      onCycleStack: cyclePanelStack,

      dispatch,
      gridRef,
    }),
    [
      addContainerToPanel,
      addInstanceToContainer,
      instancesById,
      sizesRef,
      containersById,

      // ✅ injected deps
      overPanelId,
      overDataRef,
      hotTarget,
      isContainerDrag,
      isInstanceDrag,

      setActivePanelInCell,
      cyclePanelStack,
      dispatch,
    ]
  );


  // If you want to hard-reset dnd when exiting fullscreen,
  // let the coordinator decide; Grid no longer forces key resets.
  const dndKey = 0;
  const activeSize = state.activeSize;

  return (
    <>
      <DndContext
        key={dndKey}
        sensors={sensors}
        collisionDetection={collisionDetection}
        measuring={{
          droppable: {
            strategy:
              activeRole === "container" || activeRole === "instance"
                ? MeasuringStrategy.Always
                : MeasuringStrategy.BeforeDragging,
          },
        }}
        autoScroll={{
          enabled: true,
          threshold: { x: 0.15, y: 0.15 },
          acceleration: 25,
        }}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div
          className={[
            "bg-background2 rounded-xl border border-border shadow-inner ring-1 ring-black/30",
            fullscreenPanelId ? "grid-muted" : "",
          ].join(" ")}
          style={{
            position: "absolute",
            inset: 0,
            background: "#1D2125",
            overflow: "hidden",
            top: "20px",
          }}
        >
          <GridCanvas
            gridRef={gridRef}
            rows={rows}
            cols={cols}
            colTemplate={colTemplate}
            rowTemplate={rowTemplate}
            visiblePanels={panelsRender}
            activeId={activeId}
            panelDragging={panelDragging}
            components={components}
            dispatch={dispatch}
            socket={socket}
            startColResize={startColResize}
            startRowResize={startRowResize}
            getColPosition={getColPosition}
            getRowPosition={getRowPosition}
            highlightCellId={panelOverCellId}
            panelProps={panelProps}
            activeRole={activeRole}
            getStackForPanel={getStackForPanel}
            fullscreenPanelId={fullscreenPanelId}
            setFullscreenPanelId={setFullscreenPanelId}
          />
        </div>

        <DragOverlay
          modifiers={activeRole === "instance" ? [snapCenterToCursor] : []}
          dropAnimation={null}
          zIndex={1000005}
          adjustScale={false}
        >
          {activeId && activeRole === "panel" && getPanel(activeId) ? (
            <div className="panel-overlay" style={{ pointerEvents: "none" }}>
              <PanelClone panel={getPanel(activeId)} />
            </div>
          ) : null}

          {activeId && activeRole === "container" ? (
            <div
              className="container-overlay"
              style={{
                pointerEvents: "none",
                width: activeSize?.width,
                height: activeSize?.height,
              }}
            >
              <ContainerClone container={activeContainer} />
            </div>
          ) : null}

          {activeId && activeRole === "instance" && activeInstance ? (
            <div className="instance-overlay" style={{ pointerEvents: "none" }}>
              <InstanceComp id={activeInstance.id} label={activeInstance.label} overlay />
            </div>
          ) : null}
        </DragOverlay>

        {/* ✅ Fullscreen overlay is OUTSIDE the grid DOM + DnD overlays */}
        <FullscreenOverlay
          fullscreenPanelId={fullscreenPanelId}
          setFullscreenPanelId={setFullscreenPanelId}
          panelsById={panelsById}
          components={components}
          panelProps={panelProps}
          cols={cols}
          rows={rows}
        />
      </DndContext>
    </>
  );
}

export default React.memo(GridInner);
