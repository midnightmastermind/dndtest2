// GridInner.jsx
import React, { useContext, useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  MeasuringStrategy
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { useDndContext } from "@dnd-kit/core";



import Panel from "./Panel";
import PanelClone from "./PanelClone";
import { GridDataContext } from "./GridDataContext";
import { GridActionsContext } from "./GridActionsContext";
import MoreVerticalIcon from "@atlaskit/icon/glyph/more-vertical";
import Instance from "./Instance";

const DEBUG_GRID_HIGHLIGHT = false;

/* -------------------------------------------
   Overlay clone for CONTAINER drags
------------------------------------------- */
function ContainerClone({ container }) {
  if (!container) return null;

  return (
    <div
      className="container-shell"
      style={{ pointerEvents: "none", opacity: 0.95 }}
    >
      <div className="container-header">
        <div style={{ paddingLeft: 6 }}>
          <MoreVerticalIcon size="small" primaryColor="#9AA0A6" />
        </div>

        <div style={{ fontWeight: 600, padding: "0px 10px" }}>
          {container.label ?? "Container"}
        </div>
      </div>

      <div className="container-list" style={{ minHeight: 60 }}>
        <div
          style={{
            fontSize: 12,
            opacity: 0.6,
            fontStyle: "italic",
            padding: 8,
          }}
        >
          Dragging…
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   DROPPABLE GRID CELL
   Highlight driven by parent "highlightCellId"
------------------------------------------------------------ */
function CellDroppable({ r, c, dark, highlight }) {
  const { setNodeRef } = useDroppable({
    id: `cell-${r}-${c}`,
    data: { role: "grid:cell", row: r, col: c },
  });

  return (
    <div
      data-id={`cell-${r}-${c}`}
      ref={setNodeRef}
      style={{
        gridRow: r + 1,
        gridColumn: c + 1,
        minWidth: 0,
        minHeight: 0,
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
  startColResize,
  startRowResize,
  getColPosition,
  getRowPosition,
  highlightCellId,

  addContainerToPanel,
  addInstanceToContainer,
  instancesById,
  containersSource,
  useRenderCount,
  isContainerDrag,
  isInstanceDrag,
  overData,
}) {
  return (
    <div
      className="grid-canvas"
      ref={gridRef}
      style={{
        position: "absolute",
        inset: 0,
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
          addContainerToPanel={addContainerToPanel}
          addInstanceToContainer={addInstanceToContainer}
          instancesById={instancesById}
          containersSource={containersSource}
          useRenderCount={useRenderCount}
          isContainerDrag={isContainerDrag}
          isInstanceDrag={isInstanceDrag}
          overData={overData}
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
    useRenderCount,
    dispatch,
    updatePanel,
    updateGrid,
    socket,

    addContainerToPanel,
    addInstanceToContainer,
    instancesById,
  } = useContext(GridActionsContext);

  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 0, tolerance: 0 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useRenderCount("Grid");

  const grid = state.grid;

  // ✅ gridId fallback so panel updates persist correctly
  const gridId = state.gridId ?? grid?._id ?? grid?.id;

  const rows = grid?.rows ?? 1;
  const cols = grid?.cols ?? 1;

  const visiblePanels = (state.panels || []).filter((p) => p.gridId === gridId);
  const gridRef = useRef(null);

  const [activeId, setActiveId] = useState(null);
  const [activeRole, setActiveRole] = useState(null);
  const [panelDragging, setPanelDragging] = useState(false);

  // ✅ real overData (don’t rely on reducer having it)
  const [overData, setOverData] = useState(null);

  const isContainerDrag = activeRole === "container";
  const isInstanceDrag = activeRole === "instance";
  // ✅ FIX: prefer live state first; containersRender can be stale
  const containersSource = isInstanceDrag
    ? (containersRender ?? state.containers ?? [])
    : (state.containers ?? containersRender ?? []);

  // highlight target cell based on ONE source of truth
  const [panelOverCellId, setPanelOverCellId] = useState(null);

  // REAL cursor/touch pointer (single truth)
  const livePointerRef = useRef({ x: null, y: null });
  const lastOverIdRef = useRef(null);
  const lastPanelDropRef = useRef(null);
  const lastContainerZoneRef = useRef(null);

  // attach global move listeners only while dragging a panel
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

  const activeInstance = useMemo(() => {
    if (activeRole !== "instance" || !activeId) return null;
    return (state.instances || []).find((x) => x.id === activeId) || null;
  }, [activeRole, activeId, state.instances]);

  // ------------------------
  // sizes
  // ------------------------
  const ensureSizes = (arr, count) => {
    if (!Array.isArray(arr) || arr.length === 0) return Array(count).fill(1);
    if (arr.length === count) return arr;
    if (arr.length < count) return [...arr, ...Array(count - arr.length).fill(1)];
    return arr.slice(0, count);
  };

  const [colSizes, setColSizes] = useState(() => ensureSizes(grid?.colSizes, cols));
  const [rowSizes, setRowSizes] = useState(() => ensureSizes(grid?.rowSizes, rows));

  function sameArray(a = [], b = []) {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  useEffect(() => {
    const next = ensureSizes(grid?.colSizes, cols);
    setColSizes((prev) => (sameArray(prev, next) ? prev : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, grid?._id, grid?.id]);

  useEffect(() => {
    const next = ensureSizes(grid?.rowSizes, rows);
    setRowSizes((prev) => (sameArray(prev, next) ? prev : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, grid?._id, grid?.id]);

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

    return { row, col };
  };

  function sanitizePanelPlacement(panel, rows, cols) {
    return {
      ...panel,
      row: Math.max(0, Math.min(panel.row, rows - 1)),
      col: Math.max(0, Math.min(panel.col, cols - 1)),
      width: panel.width,
      height: panel.height,
    };
  }

  const getStartClientX = (event) =>
    event?.activatorEvent?.clientX ?? event?.activatorEvent?.touches?.[0]?.clientX;

  const getStartClientY = (event) =>
    event?.activatorEvent?.clientY ?? event?.activatorEvent?.touches?.[0]?.clientY;

  // ✅ only block panel:drop when dragging an INSTANCE (not containers)
  const collisionDetection = useMemo(() => {
    return (args) => {
      const role = args.active?.data?.current?.role;

      // get live pointer from activatorEvent if available
      const evt = args?.pointerCoordinates;
      const x = evt?.x;
      const y = evt?.y;

      // 👇 figure out which panel scroll we are physically over
      let panelIdFromDOM = null;
      if (typeof x === "number" && typeof y === "number") {
        const el = document.elementFromPoint(x, y);
        const panelEl = el?.closest?.("[data-panel-id]");
        panelIdFromDOM = panelEl?.dataset?.panelid ?? null;
      }

      const hits = pointerWithin(args);
      const getRole = (h) => h?.data?.droppableContainer?.data?.current?.role;
      const getPanelId = (h) => h?.data?.droppableContainer?.data?.current?.panelId;

      // ✅ If we know which panel we're actually over, only allow droppables from that panel.
      if (panelIdFromDOM) {
        const filteredByPanel = hits.filter((h) => getPanelId(h) === panelIdFromDOM);
        if (filteredByPanel.length) {
          // (then apply your normal per-role filtering rules)
          // e.g. instance: remove panel:drop, etc.
          // return filteredByPanel (or your role-specific preferences)
          return filteredByPanel;
        }
      }

      // Panels use the manual cell highlight id
      if (role === "panel") {
        return panelOverCellId ? [{ id: panelOverCellId }] : [];
      }


      // ✅ INSTANCE: never allow "panel:drop"
      if (role === "instance") {
        const filtered = hits.filter((h) => getRole(h) !== "panel:drop");
        if (filtered.length) {
          const overInstances = filtered.filter((h) => getRole(h) === "instance");
          if (overInstances.length) return overInstances; // ✅ prioritize real items

          const overZones = filtered.filter((h) => (getRole(h) || "").startsWith("container:"));
          if (overZones.length) return overZones;

          return filtered;
        }
        if (hits.length) return hits;

        // ✅ keep container highlight stable in list gaps
        if (lastContainerZoneRef.current) return [{ id: lastContainerZoneRef.current }];
        // If pointer is in gaps between containers, keep panel drop "sticky"
        if (lastPanelDropRef.current) return [{ id: lastPanelDropRef.current }];

        if (lastOverIdRef.current) return [{ id: lastOverIdRef.current }];
        return closestCenter(args);

      }

      // ✅ CONTAINER: prefer container tiles / container-sort zones first,
      // and only fall back to panel:drop if nothing else is hit.
      if (role === "container") {
        const isGoodForContainer = (h) => {
          const r = getRole(h);
          if (r === "panel:drop") return true;
          if (r === "container") return true;
          if (typeof r === "string" && r.startsWith("container:")) return true; // ✅ allow
          return false;
        };

        const filtered = hits.filter(isGoodForContainer);

        // prefer container tiles first
        const overContainer = filtered.filter((h) => getRole(h) === "container");
        if (overContainer.length) return overContainer;

        // then container:* zones (so “being in a list” counts)
        const overZones = filtered.filter((h) => (getRole(h) || "").startsWith("container:"));
        if (overZones.length) return overZones;

        // then empty panel drop
        const panelDrop = filtered.filter((h) => getRole(h) === "panel:drop");
        if (panelDrop.length) return panelDrop;

        if (lastPanelDropRef.current) return [{ id: lastPanelDropRef.current }];
        if (lastOverIdRef.current) return [{ id: lastOverIdRef.current }];
        return closestCenter(args);
      }



      // default
      if (hits.length) return hits;
      if (lastOverIdRef.current) return [{ id: lastOverIdRef.current }];
      return closestCenter(args);
    };
  }, [panelOverCellId]);

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
    const role = event.active?.data?.current?.role ?? null;
    setActiveRole(role);
    lastOverIdRef.current = null;

    const data = event.active.data.current;

    if (data?.role === "panel") {
      setPanelDragging(true);

      const startX = getStartClientX(event);
      const startY = getStartClientY(event);

      livePointerRef.current = { x: startX ?? null, y: startY ?? null };

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

    const live = livePointerRef.current;
    if (typeof live?.x !== "number" || typeof live?.y !== "number") return;

    const rc = getCellFromPointer(live.x, live.y);
    setPanelOverCellId(rc ? `cell-${rc.row}-${rc.col}` : null);
  };

  const handleDragOver = (event) => {
    const role = event.active?.data?.current?.role;
    if (role === "panel") return;

    if (event.over?.id) {
      lastOverIdRef.current = event.over.id;
    }
    // ✅ remember last panel drop so container drag doesn't flicker in gaps
    const overRole = event.over?.data?.current?.role;
    if (overRole === "panel:drop") {
      lastPanelDropRef.current = event.over.id;
    }
    if (typeof overRole === "string" && overRole.startsWith("container:")) {
      lastContainerZoneRef.current = event.over.id;
    }
    if (overRole === "instance") {
      // instance implies we’re “in” a container; keep it sticky too
      const cid = event.over?.data?.current?.containerId;
      if (cid) lastContainerZoneRef.current = `list:${cid}`; // ✅ stable zone, not item
    }
    // ✅ feed Panel highlight logic
    setOverData(event.over?.data?.current ?? null);

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

    const panel = getPanel(active.id);
    if (!panel) {
      requestAnimationFrame(() => setPanelDragging(false));
      setPanelOverCellId(null);
      return;
    }

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

    livePointerRef.current = { x: null, y: null };
    setPanelOverCellId(null);

    requestAnimationFrame(() => setPanelDragging(false));
  };

  const handleDragCancel = (event) => {
    setActiveId(null);
    setActiveRole(null);
    setOverData(null);

    livePointerRef.current = { x: null, y: null };
    setPanelOverCellId(null);
    requestAnimationFrame(() => setPanelDragging(false));

    const role = event.active?.data?.current?.role;
    lastOverIdRef.current = null;

    if (role !== "panel") handleDragCancelProp?.(event);
  };

  // ---- Grid resizing ----
  const resizePendingRef = useRef({ rowSizes: null, colSizes: null });

  const finalizeResize = () => {
    const pending = resizePendingRef.current;
    if (!pending.rowSizes && !pending.colSizes) return;
    if (!gridId) return;

    dispatch(
      updateGrid({
        _id: gridId,
        rows,
        cols,
        rowSizes: pending.rowSizes ?? rowSizes,
        colSizes: pending.colSizes ?? colSizes,
      })
    );

    socket.emit("update_grid", {
      gridId,
      grid: {
        _id: gridId,
        rows,
        cols,
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
    return containersSource.find((c) => c.id === activeId) || null;
  }, [activeRole, activeId, containersSource]);

  if (!gridId) return <div>Loading grid…</div>;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}

      autoScroll={{
        enabled: true,
        threshold: { x: 0.15, y: 0.15 },
        acceleration: 40,
      }}
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
          top: "45px",
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
          addContainerToPanel={addContainerToPanel}
          addInstanceToContainer={addInstanceToContainer}
          instancesById={instancesById}
          containersSource={containersSource}
          useRenderCount={useRenderCount}
          isContainerDrag={isContainerDrag}
          isInstanceDrag={isInstanceDrag}
          overData={overData}
        />
      </div>

      {/* ✅ FIX: portal overlay to body + snap-to-cursor */}
      {createPortal(
        <>
          {/* Panels: no snap-to-cursor */}
          <DragOverlay dropAnimation={null} style={{ zIndex: 100000 }}>
            {activeRole === "panel" && activeId && getPanel(activeId) ? (
              <PanelClone panel={getPanel(activeId)} />
            ) : null}
          </DragOverlay>

          {/* Container/Instance: snap-to-cursor */}
          <DragOverlay
            dropAnimation={null}
            style={{ zIndex: 100000 }}
            adjustScale={false}
            modifiers={[snapCenterToCursor]}
          >
            {activeRole === "container" ? (
              <div style={{ width: state?.activeSize?.width, height: state?.activeSize?.height }}>
                <ContainerClone container={activeContainer} />
              </div>
            ) : null}

            {activeRole === "instance" && activeInstance ? (
              <div style={{ pointerEvents: "none", opacity: 0.95 }}>
                <Instance id={`overlay-${activeInstance.id}`} label={activeInstance.label} overlay />
              </div>
            ) : null}
          </DragOverlay>
        </>,
        document.body
      )}

    </DndContext>
  );
}

export default React.memo(GridInner);
