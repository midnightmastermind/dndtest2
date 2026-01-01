// helpers/useDnDControlCoordinator.js
//
// ✅ Unified Drag-and-Drop Control Coordinator (condensed + uniform)
// Goals:
// - ONE active object ref: activeRef.current = { id, role, data }
// - ONE over object ref:   overRef.current   = { id, role, panelId, containerId, ... }
// - Draft-aware preview during drag (no backend commits until drop)
// - Panel stacking helpers live here (Grid is dumb)
// - Cross-window: keeps the messaging hooks in place (native drag is separate)
//
// NOTE: "true cursor drag across windows" still requires native drag events on handles.
// This coordinator keeps the payload + commit path centralized.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
} from "@dnd-kit/core";

import * as CommitHelpers from "./CommitHelpers";
import * as LayoutHelpers from "./LayoutHelpers";

// -----------------------------
// tiny utils
// -----------------------------
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function arrayMove(arr, from, to) {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function deepClonePanels(panels = []) {
  return (panels || []).map((p) => ({ ...p, layout: p.layout ? { ...p.layout } : p.layout }));
}

function deepCloneContainers(containers = []) {
  return (containers || []).map((c) => ({ ...c, items: [...(c.items || [])] }));
}

function pickRole(dataCurrent) {
  const role = dataCurrent?.role;
  return typeof role === "string" ? role : String(role ?? "");
}

function cellKeyFromPanel(p) {
  return `cell-${p.row}-${p.col}`;
}

// -----------------------------
// main hook
// -----------------------------
export function useDnDControlCoordinator({
  state,
  dispatch,
  socket,
  scheduleSoftTick,

  // geometry inputs
  gridRef,
  rows,
  cols,
  rowSizes,
  colSizes,

  visiblePanels,
}) {
  // ============================================================
  // ✅ ONLY render-driving state
  // ============================================================
  const [activeId, setActiveId] = useState(null);
  const [activeRole, setActiveRole] = useState(null); // "panel" | "container" | "instance"
  const [panelOverCellId, setPanelOverCellId] = useState(null); // only matters for panel drag

  const panelDragging = activeRole === "panel";
  const isContainerDrag = activeRole === "container";
  const isInstanceDrag = activeRole === "instance";

  // ============================================================
  // ✅ ONE active object ref + ONE over object ref (uniform)
  // ============================================================
  const activeRef = useRef(null); // { id, role, data }
  const overRef = useRef(null);   // { id, role, panelId, containerId, ... } (always normalized)

  // pointer ref (no rerenders)
  const pointerRef = useRef({ x: 0, y: 0 });

  // draft session ref (preview state while dragging)
  const sessionRef = useRef({
    dragging: false,
    // snapshots captured at drag start
    startPanels: null,
    startContainers: null,
    // draft versions we mutate during drag
    draftPanels: null,
    draftContainers: null,
  });

  // ============================================================
  // ✅ Panels / containers base sources
  // ============================================================
  const basePanels = useMemo(() => {
    // visiblePanels is already filtered by gridId in GridInner
    return Array.isArray(visiblePanels) ? visiblePanels : [];
  }, [visiblePanels]);

  const baseContainers = useMemo(() => {
    return Array.isArray(state?.containers) ? state.containers : [];
  }, [state?.containers]);

  // ============================================================
  // ✅ Working data getters (draft-aware)
  // ============================================================
  const getWorkingPanels = useCallback(() => {
    const s = sessionRef.current;
    return s.dragging && s.draftPanels ? s.draftPanels : basePanels;
  }, [basePanels]);

  const getWorkingContainers = useCallback(() => {
    const s = sessionRef.current;
    return s.dragging && s.draftContainers ? s.draftContainers : baseContainers;
  }, [baseContainers]);

  // ============================================================
  // ✅ Geometry: pointer -> cell
  // ============================================================
  const getCellFromPointer = useCallback(() => {
    const el = gridRef?.current;
    if (!el) return null;

    const { x, y } = pointerRef.current;
    const rect = el.getBoundingClientRect();
    const relX = (x - rect.left) / rect.width;
    const relY = (y - rect.top) / rect.height;

    const totalCols = (colSizes || []).reduce((a, b) => a + b, 0) || 1;
    const totalRows = (rowSizes || []).reduce((a, b) => a + b, 0) || 1;

    // walk fractional tracks
    let acc = 0;
    let col = 0;
    for (let i = 0; i < (colSizes || []).length; i++) {
      acc += colSizes[i];
      if (relX < acc / totalCols) { col = i; break; }
      col = i;
    }

    acc = 0;
    let row = 0;
    for (let i = 0; i < (rowSizes || []).length; i++) {
      acc += rowSizes[i];
      if (relY < acc / totalRows) { row = i; break; }
      row = i;
    }

    row = clamp(row, 0, rows - 1);
    col = clamp(col, 0, cols - 1);
    return { row, col, cellId: `cell-${row}-${col}` };
  }, [gridRef, rowSizes, colSizes, rows, cols]);

  // ============================================================
  // ✅ Normalize "over" into ONE uniform object
  // ============================================================
  const setOverFromDndKit = useCallback((overContainer) => {
    if (!overContainer) {
      overRef.current = null;
      return;
    }

    const data = overContainer?.data?.current || {};
    const role = pickRole(data);

    // Normalize into a compact, uniform shape that the whole app understands.
    // You can safely extend this once, globally, without making more refs.
    overRef.current = {
      id: overContainer.id,
      role,
      panelId: data.panelId ?? null,
      containerId: data.containerId ?? null,

      // optional extras for sorting scenarios
      overInstanceId: data.instanceId ?? data.overInstanceId ?? null,
      row: data.row ?? null,
      col: data.col ?? null,

      // keep raw for debugging if you want
      // raw: data,
    };
  }, []);

  // ============================================================
  // ✅ Hot target derived from ONE overRef (no extra refs)
  // ============================================================
  const getHotTarget = useCallback(() => {
    const o = overRef.current;
    if (!o) return null;

    // During instance drag, we usually want to highlight the container target.
    if (activeRef.current?.role === "instance") {
      if (o.role === "container:list" || o.role?.startsWith("instance:") || o.role?.startsWith("container:")) {
        return { role: o.role, panelId: o.panelId, containerId: o.containerId };
      }
    }

    // During container drag, highlight the panel dropzone or container sorting target.
    if (activeRef.current?.role === "container") {
      if (o.role === "panel:drop" || o.role?.startsWith("container:")) {
        return { role: o.role, panelId: o.panelId, containerId: o.containerId };
      }
    }

    return { role: o.role, panelId: o.panelId, containerId: o.containerId };
  }, []);

  const overPanelId = overRef.current?.panelId ?? null;

  // ============================================================
  // ✅ Draft mutation helpers (preview without commit)
  // ============================================================
  const ensureDragSession = useCallback(() => {
    const s = sessionRef.current;
    if (s.dragging) return;

    s.dragging = true;
    s.startPanels = deepClonePanels(basePanels);
    s.startContainers = deepCloneContainers(baseContainers);
    s.draftPanels = deepClonePanels(basePanels);
    s.draftContainers = deepCloneContainers(baseContainers);
  }, [basePanels, baseContainers]);

  const clearDragSession = useCallback(() => {
    const s = sessionRef.current;
    s.dragging = false;
    s.startPanels = null;
    s.startContainers = null;
    s.draftPanels = null;
    s.draftContainers = null;

    activeRef.current = null;
    overRef.current = null;

    setPanelOverCellId(null);
    scheduleSoftTick?.(); // let Grid recompute stacks etc
  }, [scheduleSoftTick]);

  // ============================================================
  // ✅ Stack helpers (draft-aware)
  // ============================================================
  const getStacksByCell = useCallback(() => {
    const panels = getWorkingPanels();
    const map = Object.create(null);

    for (const p of panels || []) {
      const key = cellKeyFromPanel(p);
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }

    // stable order: name or id (or keep insertion)
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => {
        const an = (a?.layout?.name || "").toLowerCase();
        const bn = (b?.layout?.name || "").toLowerCase();
        if (an && bn && an !== bn) return an.localeCompare(bn);
        return String(a.id).localeCompare(String(b.id));
      });
    }

    return map;
  }, [getWorkingPanels]);

  const getStackForPanel = useCallback(
    (panel) => {
      if (!panel) return null;
      const stacks = getStacksByCell();
      return stacks[cellKeyFromPanel(panel)] || null;
    },
    [getStacksByCell]
  );

  // Visible panel in a cell is the one with layout.style.display !== "none".
  // We commit stacking changes HARD because they are user-driven visibility state.
  const setActivePanelInCell = useCallback(
    (row, col, nextPanelId) => {
      const panels = getWorkingPanels();
      const cellPanels = (panels || []).filter((p) => p.row === row && p.col === col);
      if (cellPanels.length <= 1) return;

      for (const p of cellPanels) {
        const display = p.id === nextPanelId ? "block" : "none";
        LayoutHelpers.setPanelStackDisplay({
          dispatch,
          socket,
          panel: p,
          display,
        });
      }
      scheduleSoftTick?.();
    },
    [getWorkingPanels, dispatch, socket, scheduleSoftTick]
  );

  const cyclePanelStack = useCallback(
    ({ panelId, dir }) => {
      const panels = getWorkingPanels();
      const p = (panels || []).find((x) => x.id === panelId);
      if (!p) return;

      const stack = getStackForPanel(p) || [];
      if (stack.length <= 1) return;

      const idx = stack.findIndex((x) => x.id === panelId);
      const nextIdx = (idx + (dir > 0 ? 1 : -1) + stack.length) % stack.length;
      const next = stack[nextIdx];

      setActivePanelInCell(p.row, p.col, next.id);
    },
    [getWorkingPanels, getStackForPanel, setActivePanelInCell]
  );

  // ============================================================
  // ✅ Sensors (keep simple)
  // ============================================================
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 80, tolerance: 6 } })
  );

  // ============================================================
  // ✅ collisionDetection (role-aware, but no role-specific refs)
  // ============================================================
  const collisionDetection = useMemo(() => {
    return (args) => {
      const role = activeRef.current?.role;

      // Panels don't collide with container/instance droppables.
      // We drive panel drop with pointer->cell.
      if (role === "panel") {
        return panelOverCellId ? [{ id: panelOverCellId }] : [];
      }

      // Containers + instances: prefer pointerWithin
      const raw = pointerWithin(args);

      // Filter out panel:drop when dragging sortable items so closestCenter can work in gaps.
      const getMeta = (c) => c?.data?.droppableContainer?.data?.current || null;
      const shouldScope = role === "container" || role === "instance";

      const hits = shouldScope
        ? raw.filter((c) => pickRole(getMeta(c)) !== "panel:drop")
        : raw;

      if (hits.length) return hits;

      // fallback
      return closestCenter(args);
    };
  }, [panelOverCellId]);

  // ============================================================
  // ✅ DnD handlers
  // ============================================================
  const onDragStart = useCallback(
    (evt) => {
      const id = evt?.active?.id ?? null;
      const data = evt?.active?.data?.current ?? {};
      const role = pickRole(data);

      activeRef.current = { id, role, data };
      setActiveId(id);
      setActiveRole(role);

      ensureDragSession();

      // for panel drag, prime the cell highlight
      if (role === "panel") {
        const cell = getCellFromPointer();
        setPanelOverCellId(cell?.cellId ?? null);
      }

      scheduleSoftTick?.();
    },
    [ensureDragSession, getCellFromPointer, scheduleSoftTick]
  );

  const onDragMove = useCallback(
    (evt) => {
      // capture pointer
      const x = evt?.delta?.x;
      // dnd-kit doesn't give absolute pointer here; use window listener below instead.
      // We still keep this hook for panel cell updates if needed.
      if (activeRef.current?.role === "panel") {
        const cell = getCellFromPointer();
        const next = cell?.cellId ?? null;
        setPanelOverCellId((prev) => (prev === next ? prev : next));
      }
    },
    [getCellFromPointer]
  );

  const onDragOver = useCallback(
    (evt) => {
      // One place where hover updates are stored.
      setOverFromDndKit(evt?.over);

      // OPTIONAL: draft previews can be updated here if you want live reorder preview.
      // Keep it conservative: only do container reorder previews; instances already sortable inside container.
      const role = activeRef.current?.role;

      if (role === "container") {
        const o = overRef.current;
        if (!o) return;

        // If over a container sorting target, preview reorder within the panel.
        // Your SortableContext is in Panel; dnd-kit will animate visually anyway.
        // We only need drafts if you want "phantom insertion" before drop.
      }

      scheduleSoftTick?.();
    },
    [setOverFromDndKit, scheduleSoftTick]
  );

  const onDragCancel = useCallback(() => {
    clearDragSession();
    setActiveId(null);
    setActiveRole(null);
  }, [clearDragSession]);

  const onDragEnd = useCallback(
    (evt) => {
      const a = activeRef.current; // {id, role, data}
      const o = overRef.current;   // normalized over object
      if (!a?.id || !a?.role) {
        clearDragSession();
        setActiveId(null);
        setActiveRole(null);
        return;
      }

      // ========= PANEL DROP =========
      if (a.role === "panel") {
        const cell = getCellFromPointer();
        const row = cell?.row ?? null;
        const col = cell?.col ?? null;

        if (row != null && col != null) {
          const panels = getWorkingPanels();
          const panel = (panels || []).find((p) => p.id === a.id);
          if (panel) {
            // Commit panel position
            CommitHelpers.updatePanel({
              dispatch,
              socket,
              panel: { ...panel, row, col },
              emit: true,
            });
          }
        }

        clearDragSession();
        setActiveId(null);
        setActiveRole(null);
        return;
      }

      // ========= CONTAINER DROP =========
      if (a.role === "container") {
        // Typical cases:
        // - reorder within same panel (SortableContext handles array move)
        // - move container to a different panel (panel:drop)
        //
        // Your app likely stores container IDs in panel.containers.
        // We'll handle cross-panel move on "panel:drop".
        if (o?.role === "panel:drop" && o.panelId) {
          const containerId = a.id;
          const fromPanelId = a.data?.panelId ?? null;
          const toPanelId = o.panelId;

          if (fromPanelId && toPanelId && fromPanelId !== toPanelId) {
            const panels = getWorkingPanels();
            const fromPanel = (panels || []).find((p) => p.id === fromPanelId);
            const toPanel = (panels || []).find((p) => p.id === toPanelId);

            if (fromPanel && toPanel) {
              // Remove from old, add to new (hard commit)
              LayoutHelpers.moveContainerBetweenPanels({
                dispatch,
                socket,
                fromPanel,
                toPanel,
                containerId,
              });
            }
          }
        }

        clearDragSession();
        setActiveId(null);
        setActiveRole(null);
        return;
      }

      // ========= INSTANCE DROP =========
      if (a.role === "instance") {
        // Typical: dropping onto container:list
        if (o?.role === "container:list" && o.containerId) {
          const instanceId = a.id;
          const fromContainerId = a.data?.containerId ?? null;
          const toContainerId = o.containerId;

          if (fromContainerId && toContainerId && fromContainerId !== toContainerId) {
            const containers = getWorkingContainers();
            const fromC = (containers || []).find((c) => c.id === fromContainerId);
            const toC = (containers || []).find((c) => c.id === toContainerId);

            if (fromC && toC) {
              LayoutHelpers.moveInstanceBetweenContainers({
                dispatch,
                socket,
                fromContainer: fromC,
                toContainer: toC,
                instanceId,
              });
            }
          }
        }

        clearDragSession();
        setActiveId(null);
        setActiveRole(null);
        return;
      }

      clearDragSession();
      setActiveId(null);
      setActiveRole(null);
    },
    [
      dispatch,
      socket,
      getCellFromPointer,
      getWorkingPanels,
      getWorkingContainers,
      clearDragSession,
    ]
  );

  // ============================================================
  // ✅ Pointer tracking (absolute), used by getCellFromPointer
  // ============================================================
  useEffect(() => {
    const onMove = (e) => {
      const x = e?.clientX ?? e?.touches?.[0]?.clientX;
      const y = e?.clientY ?? e?.touches?.[0]?.clientY;
      if (typeof x === "number" && typeof y === "number") {
        pointerRef.current = { x, y };
        if (activeRef.current?.role === "panel") {
          const cell = getCellFromPointer();
          const next = cell?.cellId ?? null;
          setPanelOverCellId((prev) => (prev === next ? prev : next));
        }
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
    };
  }, [getCellFromPointer]);

  // ============================================================
  // ✅ Cross-window scaffolding (kept centralized, minimal)
  // ============================================================
  // This does NOT create native drags — it just provides the shared lane.
  // You still wire native dragstart/dragend on handles when you’re ready.
  const bcRef = useRef(null);
  const externalDragRef = useRef(null);

  useEffect(() => {
    try {
      bcRef.current = new BroadcastChannel("grid-dnd");
      bcRef.current.onmessage = (ev) => {
        externalDragRef.current = ev?.data ?? null;
      };
      return () => {
        bcRef.current?.close?.();
        bcRef.current = null;
      };
    } catch {
      // BroadcastChannel not available; noop
    }
  }, []);

  // ============================================================
  // ✅ Return API
  // ============================================================
  // NOTE: We only pass ONE over ref and derive everything else.
  const hotTarget = getHotTarget();

  return {
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

    getWorkingPanels,
    getWorkingContainers,

    // stacks (draft-aware)
    getStacksByCell,
    getStackForPanel,
    setActivePanelInCell,
    cyclePanelStack,

    // unified hover outputs
    overPanelId,
    overDataRef: overRef,
    hotTarget,

    isContainerDrag,
    isInstanceDrag,

    // unified refs for debugging / advanced integrations
    activeRef,
    overRef,
    pointerRef,

    // cross-window lane
    bcRef,
    externalDragRef,
  };
}