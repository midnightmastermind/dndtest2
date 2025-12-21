// GridInner.jsx
import React, { useContext, useMemo, useRef, useState, useEffect } from "react";
import {
  useDroppable,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  TouchSensor,
  DragOverlay,
  pointerWithin,
  closestCenter,
} from "@dnd-kit/core";
import { MeasuringStrategy } from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import Panel from "./Panel";
import PanelClone from "./PanelClone";
import { GridDataContext } from "./GridDataContext";
import { GridActionsContext } from "./GridActionsContext";
import { GripVertical } from "lucide-react";

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
  startColResize,
  startRowResize,
  getColPosition,
  getRowPosition,
  highlightCellId,
  panelProps,
  activeRole,
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
        height: "95vh",
        overflow: "hidden",
        touchAction: "none",
        overscrollBehaviorY: "none",

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
            width: 10,
            marginLeft: -5,
            cursor: "col-resize",
            zIndex: 50,
            background: "#8f969eff"
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
            height: 10,
            marginTop: -5,
            cursor: "row-resize",
            zIndex: 50,
            background: "#8f969eff"
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
          {...panelProps}
        />
      ))}
    </div>
  );
}

function GridInner({ components }) {
  const { state, containersRender } = useContext(GridDataContext);

  const {
    handleDragStart: handleDragStartProp,
    handleDragOver: handleDragOverProp,
    handleDragEnd: handleDragEndProp,
    handleDragCancel: handleDragCancelProp,
    dispatch,
    updatePanel,
    updateGrid,
    socket,
    addContainerToPanel,
    addInstanceToContainer,
    instancesById,
    pointerRef, // ✅ shared ref from App.jsx
  } = useContext(GridActionsContext);

  const DEBUG_DND = false;
  const debugRafRef = useRef({ t: 0 });

  // ✅ Cache hovered panel id (so collisionDetection doesn't call elementsFromPoint every call)
  const hoveredPanelIdRef = useRef(null);

  // PERF FIX: throttle elementsFromPoint
  const lastHoverUpdateRef = useRef(0);
  const lastHoverPtRef = useRef({ x: null, y: null });

  function dlog(label, payload) {
    if (!DEBUG_DND) return;
    const now = performance.now();
    if (now - debugRafRef.current.t < 100) return;
    debugRafRef.current.t = now;
    console.groupCollapsed(label);
    console.log(payload);
    console.groupEnd();
  }

  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
      eventOptions: { passive: false },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const grid = state.grid;
  const gridId = grid?._id;
  const rows = grid?.rows ?? 1;
  const cols = grid?.cols ?? 1;

  const visiblePanels = useMemo(() => {
    const arr = state.panels || [];
    return arr.filter((p) => p.gridId === gridId);
  }, [state.panels, gridId]);

  const gridRef = useRef(null);

  const [activeId, setActiveId] = useState(null);
  const [activeRole, setActiveRole] = useState(null);
  const [panelDragging, setPanelDragging] = useState(false);
  const [overData, setOverData] = useState(null);

  const isContainerDrag = activeRole === "container";
  const isInstanceDrag = activeRole === "instance";

  const [panelOverCellId, setPanelOverCellId] = useState(null);

  // ✅ sizes
  const ensureSizes = (arr, count) => {
    if (!Array.isArray(arr) || arr.length === 0) return Array(count).fill(1);
    if (arr.length === count) return arr;
    if (arr.length < count) return [...arr, ...Array(count - arr.length).fill(1)];
    return arr.slice(0, count);
  };

  const [colSizes, setColSizes] = useState(() => ensureSizes(grid?.colSizes, cols));
  const [rowSizes, setRowSizes] = useState(() => ensureSizes(grid?.rowSizes, rows));
  const sizesRef = useRef({ colSizes: [], rowSizes: [] });

  useEffect(() => {
    sizesRef.current = { colSizes, rowSizes };
  }, [colSizes, rowSizes]);

  function sameArray(a = [], b = []) {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  useEffect(() => {
    const next = ensureSizes(grid?.colSizes, cols);
    setColSizes((prev) => (sameArray(prev, next) ? prev : next));
  }, [cols, grid?._id]);

  useEffect(() => {
    const next = ensureSizes(grid?.rowSizes, rows);
    setRowSizes((prev) => (sameArray(prev, next) ? prev : next));
  }, [rows, grid?._id]);

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

    if (!inside) return null;

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

    return { row, col };
  };

  function sanitizePanelPlacement(panel, rCount, cCount) {
    return {
      ...panel,
      row: Math.max(0, Math.min(panel.row, rCount - 1)),
      col: Math.max(0, Math.min(panel.col, cCount - 1)),
      width: panel.width,
      height: panel.height,
    };
  }

  const getStartClientX = (event) =>
    event?.activatorEvent?.clientX ?? event?.activatorEvent?.touches?.[0]?.clientX;

  const getStartClientY = (event) =>
    event?.activatorEvent?.clientY ?? event?.activatorEvent?.touches?.[0]?.clientY;


  function getHoveredPanelId(pt) {
    if (!pt) return null;

    const stack = document.elementsFromPoint(pt.x, pt.y);

    if (DEBUG_DND) {
      const top10 = stack.slice(0, 10).map((el) => ({
        tag: el.tagName,
        cls: el.className,
        panel: el.closest?.("[data-panel-id]")?.getAttribute("data-panel-id") || null,
        droppable: el.getAttribute?.("data-dndkit-droppable-id") || null,
        draggable: el.getAttribute?.("data-dndkit-draggable-id") || null,
      }));
      dlog("[DOM stack]", { pt, top10 });
    }

    for (const el of stack) {
      if (el.closest?.(".panel-overlay, .container-overlay, .instance-overlay")) continue;
      const panelEl = el.closest?.("[data-panel-id]");
      if (panelEl) {
        return (
          panelEl.getAttribute("data-panel-id") ||
          panelEl.dataset.panelId ||
          null
        );
      }
    }
    return null;
  }

  function logReturn(label, arr, role, args) {
    if (!DEBUG_DND) return arr;
    console.log(label, {
      role,
      pointer: args.pointerCoordinates,
      returning: Array.isArray(arr) ? arr.map((x) => x.id) : arr,
    });
    return arr;
  }

  // ✅ Track pointer ONLY while dragging (and throttle to RAF)
  useEffect(() => {
    if (!activeRole) return;

    let raf = 0;

    const write = (x, y) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        pointerRef.current = { x, y };
      });
    };

    const onMove = (e) => {
      if (e.touches?.[0]) write(e.touches[0].clientX, e.touches[0].clientY);
      else write(e.clientX, e.clientY);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
    };
  }, [activeRole, pointerRef]);

  // ✅ collision detection
  const collisionDetection = useMemo(() => {
    return (args) => {
      const role = args.active?.data?.current?.role;

      if (DEBUG_DND) {
        dlog("[CD entry]", {
          role,
          pointer: args.pointerCoordinates,
          activeId: args.active?.id,
          overCell: panelOverCellId ?? null,
          droppablesCount: args.droppableContainers?.length,
        });
      }

      if (role === "panel") {
        return logReturn(
          "[CD return panel]",
          panelOverCellId ? [{ id: panelOverCellId }] : [],
          role,
          args
        );
      }

      // PERF FIX: avoid computing closestCenter unless needed
      const hits = pointerWithin(args);
      const shouldScope = role === "instance" || role === "container";

      // Non-scoped roles: only do closestCenter if pointerWithin had no hits
      if (!shouldScope) {
        if (hits.length) return logReturn("[CD return no scope hits]", hits, role, args);
        const cc = closestCenter(args);
        return logReturn("[CD return no scope cc]", cc, role, args);
      }

      const getMeta = (c) => c?.data?.droppableContainer?.data?.current ?? null;

      const pickPanelIdFromHits = () => {
        const preferred = hits.find((c) => {
          const d = getMeta(c);
          const r = d?.role;
          return (
            d?.panelId &&
            (r === "instance" || (typeof r === "string" && r.startsWith("container:")))
          );
        });
        if (preferred) return getMeta(preferred)?.panelId;

        const panelDrop = hits.find(
          (c) => getMeta(c)?.role === "panel:drop" && getMeta(c)?.panelId
        );
        if (panelDrop) return getMeta(panelDrop)?.panelId;

        const any = hits.find((c) => !!getMeta(c)?.panelId);
        return any ? getMeta(any)?.panelId : null;
      };

      const domPanel = hoveredPanelIdRef.current;
      const hoveredPanelId = domPanel || pickPanelIdFromHits();

      if (DEBUG_DND) {
        dlog("[CD hoveredPanelId]", {
          role,
          pointer: args.pointerCoordinates,
          domPanel,
          hitsPanel: hoveredPanelId,
        });
      }

      // If we can't determine a hovered panel, fall back safely
      if (!hoveredPanelId) {
        if (hits.length) return logReturn("[CD return no hoveredPanelId hits]", hits, role, args);
        const cc = closestCenter(args);
        return logReturn("[CD return no hoveredPanelId cc]", cc, role, args);
      }

      const scopedHits = hits.filter((c) => getMeta(c)?.panelId === hoveredPanelId);
      const workingHits = scopedHits.length ? scopedHits : hits;

      if (role === "instance") {
        const instanceHits = workingHits.filter((c) => getMeta(c)?.role === "instance");
        if (instanceHits.length) {
          return logReturn("[CD return instanceHits]", instanceHits, role, args);
        }

        const containerZoneHits = workingHits.filter((c) =>
          String(getMeta(c)?.role || "").startsWith("container:")
        );
        if (containerZoneHits.length) {
          return logReturn("[CD return containerZoneHits]", containerZoneHits, role, args);
        }

        const panelTargets = workingHits.filter((c) => getMeta(c)?.role === "panel:drop");
        if (panelTargets.length) {
          return logReturn("[CD return panelTargets]", panelTargets, role, args);
        }

        // final fallback
        if (hits.length) return logReturn("[CD return hits fallback]", hits, role, args);
        const cc = closestCenter(args);
        return logReturn("[CD return cc fallback]", cc, role, args);
      }

      // container role
      if (workingHits.length) return logReturn("[CD return workingHits]", workingHits, role, args);
      if (hits.length) return logReturn("[CD return hits fallback]", hits, role, args);
      const cc = closestCenter(args);
      return logReturn("[CD return cc fallback]", cc, role, args);
    };
  }, [panelOverCellId]);

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
    const role = event.active?.data?.current?.role ?? null;
    setActiveRole(role);

    const data = event.active?.data?.current;

    if (data?.role === "panel") {
      setPanelDragging(true);

      const startX = getStartClientX(event);
      const startY = getStartClientY(event);

      pointerRef.current = { x: startX ?? null, y: startY ?? null };

      if (typeof startX === "number" && typeof startY === "number") {
        const rc = getCellFromPointer(startX, startY);
        const next = rc ? `cell-${rc.row}-${rc.col}` : null;
        setPanelOverCellId(next);
      } else {
        setPanelOverCellId(null);
      }
      return;
    }

    handleDragStartProp?.(event);
  };

  const rafRef = useRef(null);
  const lastCellRef = useRef(null);

  const handleDragMove = () => {
    if (!activeRole) return;

    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;

        // PERF FIX: throttle expensive DOM hit-testing
        if (activeRole === "instance" || activeRole === "container") {
          const pt = pointerRef.current;
          if (pt?.x != null && pt?.y != null) {
            const now = performance.now();
            const last = lastHoverPtRef.current;
            const moved = pt.x !== last.x || pt.y !== last.y;

            // ~12.5fps throttle (80ms)
            if (moved && now - lastHoverUpdateRef.current > 80) {
              lastHoverUpdateRef.current = now;
              lastHoverPtRef.current = { x: pt.x, y: pt.y };
              hoveredPanelIdRef.current = getHoveredPanelId(pt);
            }
          }
        }

        if (!panelDragging) return;

        const live = pointerRef.current;
        if (typeof live?.x !== "number" || typeof live?.y !== "number") return;

        const rc = getCellFromPointer(live.x, live.y);
        const next = rc ? `cell-${rc.row}-${rc.col}` : null;

        if (next !== lastCellRef.current) {
          lastCellRef.current = next;
          setPanelOverCellId(next);
        }
      });
    }
  };

  const lastOverKeyRef = useRef("");

  const handleDragOver = (event) => {
    const activeRoleNow = event.active?.data?.current?.role;
    const d = event.over?.data?.current ?? null;

    if (DEBUG_DND && activeRoleNow === "instance") {
      dlog("[OVER raw]", {
        overId: event.over?.id ?? null,
        overRole: d?.role ?? null,
        overContainerId: d?.containerId ?? null,
        overPanelId: d?.panelId ?? null,
        pointer: pointerRef.current,
      });
    }

    let safe = d;
    if (activeRoleNow === "instance") {
      const r = safe?.role;
      const ok =
        r === "instance" ||
        (typeof r === "string" && r.startsWith("container:")) ||
        r === "panel:drop";
      safe = ok ? safe : null;
    }

    const key = safe
      ? `${safe.role}|${safe.containerId ?? ""}|${safe.panelId ?? ""}`
      : "";

    if (key !== lastOverKeyRef.current) {
      lastOverKeyRef.current = key;
      setOverData(safe);
    }

    if (activeRoleNow === "panel") return;
    handleDragOverProp?.(event);
  };

  const handleDragEnd = (event) => {
    const { active } = event;
    const data = active?.data?.current;

    setActiveId(null);
    setActiveRole(null);
    setOverData(null);

    if (!data) return;

    if (data.role !== "panel") {
      handleDragEndProp?.(event);
      return;
    }

    const panel = visiblePanels.find((p) => p.id === active.id);
    if (!panel) {
      requestAnimationFrame(() => setPanelDragging(false));
      setPanelOverCellId(null);
      lastCellRef.current = null;
      return;
    }

    const live = pointerRef.current;
    const rc =
      typeof live?.x === "number" && typeof live?.y === "number"
        ? getCellFromPointer(live.x, live.y)
        : null;

    if (!rc) {
      requestAnimationFrame(() => setPanelDragging(false));
      setPanelOverCellId(null);
      lastCellRef.current = null;
      return;
    }

    const updated = sanitizePanelPlacement({ ...panel, row: rc.row, col: rc.col }, rows, cols);

    dispatch(updatePanel(updated));
    socket.emit("update_panel", { panel: updated, gridId });

    pointerRef.current = { x: null, y: null };
    setPanelOverCellId(null);
    lastCellRef.current = null;
    hoveredPanelIdRef.current = null;
    requestAnimationFrame(() => setPanelDragging(false));
  };

  const handleDragCancel = (event) => {
    setActiveId(null);
    setActiveRole(null);
    setOverData(null);

    pointerRef.current = { x: null, y: null };

    setPanelOverCellId(null);
    hoveredPanelIdRef.current = null;
    requestAnimationFrame(() => setPanelDragging(false));

    const role = event.active?.data?.current?.role;
    if (role !== "panel") handleDragCancelProp?.(event);
  };

  // ---- Grid resizing (unchanged) ----
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
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", stop);
  };

  const activeContainer = useMemo(() => {
    if (activeRole !== "container" || !activeId) return null;
    const src = containersRender ?? state?.containers ?? [];
    const m = Object.create(null);
    for (const c of src) m[c.id] = c;
    return m?.[activeId] || null;
  }, [activeRole, activeId, containersRender, state?.containers]);

  const InstanceComp = components["Instance"];

  const activeInstance = useMemo(() => {
    if (activeRole !== "instance" || !activeId) return null;
    return instancesById?.[activeId] || null;
  }, [activeRole, activeId, instancesById]);
  const containersById = useMemo(() => {
    const m = Object.create(null);
    const src = containersRender ?? state?.containers ?? [];
    for (const c of src) m[c.id] = c;
    return m;
  }, [containersRender, state?.containers]);
  const panelProps = useMemo(
    () => ({
      overData,
      isContainerDrag,
      isInstanceDrag,
      addContainerToPanel,
      addInstanceToContainer,
      instancesById,
      // containersById is local in your snippet above; keep your existing wiring if different
      sizesRef,
      containersById
    }),
    [
      overData,
      isContainerDrag,
      isInstanceDrag,
      addContainerToPanel,
      addInstanceToContainer,
      instancesById,
      containersById
    ]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{
        droppable: {
          strategy:
            isContainerDrag || isInstanceDrag
              ? MeasuringStrategy.WhileDragging
              : MeasuringStrategy.BeforeDragging,
        },
      }}
      autoScroll={{
        enabled: true,
        threshold: { x: 0.15, y: 0.15 },
        acceleration: 25,
      }}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragCancel={handleDragCancel}
    >
      <div
        className="bg-background2 rounded-xl border border-border shadow-inner ring-1 ring-black/30"
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
          visiblePanels={visiblePanels}
          activeId={activeId}
          panelDragging={panelDragging}
          components={components}
          dispatch={dispatch}
          startColResize={startColResize}
          startRowResize={startRowResize}
          getColPosition={getColPosition}
          getRowPosition={getRowPosition}
          highlightCellId={panelOverCellId}
          panelProps={panelProps}
          activeRole={activeRole}
        />
      </div>

      <DragOverlay
        modifiers={activeRole === "instance" ? [snapCenterToCursor] : []}
        dropAnimation={null}
        zIndex={100000}
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
              width: state?.activeSize?.width,
              height: state?.activeSize?.height,
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
    </DndContext>
  );
}

export default React.memo(GridInner);
