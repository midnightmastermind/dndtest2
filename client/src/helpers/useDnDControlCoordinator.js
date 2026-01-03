// helpers/useDnDControlCoordinator.js
//
// ✅ Unified Drag-and-Drop Control Coordinator (condensed + uniform)
// Adds:
// - DOM hit-testing: getHoveredPanelId + getHoveredContainerId
// - Centralized hover surface: hotTarget (single source of truth)
// - Stack helpers re-exposed: getStacksByCell, getStackForPanel, cyclePanelStack, setActivePanelInCell
// - Commit policy: preview is draft-only, hard commits explicit emit=true
// - Native/cross-window bridge: inbound dragover/drop -> commit router
//
// IMPORTANT:
// - Panel roots render:     data-panel-id={panel.id}
// - Container roots render: data-container-id={container.id}
//
// ✅ FIX MERGE:
// - If dnd-kit "over" becomes null (pointer in gaps / left droppables), preview now REVERTS
//   back to the start snapshot so you don't get "stuck preview" in the last container/panel.
//
// ✅ INSTANCE DRAG FIXES (this merge):
// - Preview sort now DE-DUPES the instance/container in the destination before inserting.
// - Collision detection prefers pointerWithin for instance/container drags, but falls back to
//   closestCenter only when needed (still filtered to avoid “panel:drop” masking).
//
// ✅ MOBILE CRASH FIXES (this merge):
// - Remove global window touchmove/mousemove tracking for dnd-kit (prevents rect-measure thrash).
// - Use dnd-kit onDragMove to track pointer/hover during internal drags.
// - RAF-throttle scheduleSoftTick (prevents runaway useRects measurement loops).
// - Keep window dragover tracking ONLY for native/cross-window bridge.

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

// ============================================================
// 🔧 PERFORMANCE FLAGS
// ============================================================
const ENABLE_INSTANCE_PREVIEW_SORT = true;
const ENABLE_CONTAINER_PREVIEW_SORT = true;

// ============================================================
// 🧩 Native / cross-window bridge flags
// ============================================================
const ENABLE_NATIVE_BRIDGE = true;
const NATIVE_DND_MIME = "application/x-daytracker-dnd"; // custom transfer type

// ============================================================
// tiny utils
// ============================================================
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function deepClonePanels(panels = []) {
  return panels.map((p) => ({
    ...p,
    layout: p.layout ? { ...p.layout } : p.layout,
    containers: [...(p.containers || [])],
  }));
}

function deepCloneContainers(containers = []) {
  return containers.map((c) => ({
    ...c,
    items: [...(c.items || [])],
  }));
}

function pickRole(data) {
  const r = data?.role;
  return typeof r === "string" ? r : String(r ?? "");
}

function cellKeyFromPanel(p) {
  return `cell-${p.row}-${p.col}`;
}

function panelDisplay(p) {
  const d = p?.layout?.style?.display;
  return typeof d === "string" ? d : "block";
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// ============================================================
// PREVIEW MUTATION HELPERS (DRAFT ONLY)
// ============================================================
function previewMoveInstance({ draftContainers, instanceId, toContainerId, toIndex }) {
  if (!draftContainers) return;

  const to = draftContainers.find((c) => c.id === toContainerId);
  if (!to) return;

  // ✅ remove from ALL containers first (prevents ballooning + duplicates)
  for (const c of draftContainers) {
    if (!c?.items) continue;
    c.items = c.items.filter((id) => id !== instanceId);
  }

  const base = to.items || [];

  if (toIndex == null || toIndex < 0) {
    to.items = [...base, instanceId];
  } else {
    const next = [...base];
    next.splice(toIndex, 0, instanceId);
    to.items = next;
  }
}

function previewMoveContainer({ draftPanels, containerId, toPanelId, toIndex }) {
  if (!draftPanels) return;

  const to = draftPanels.find((p) => p.id === toPanelId);
  if (!to) return;

  // ✅ remove from ALL panels first
  for (const p of draftPanels) {
    if (!p?.containers) continue;
    p.containers = p.containers.filter((id) => id !== containerId);
  }

  const base = to.containers || [];

  if (toIndex == null || toIndex < 0) {
    to.containers = [...base, containerId];
  } else {
    const next = [...base];
    next.splice(toIndex, 0, containerId);
    to.containers = next;
  }
}

// ============================================================
// MAIN HOOK
// ============================================================
export function useDnDControlCoordinator({
  state,
  dispatch,
  socket,
  scheduleSoftTick,

  gridRef,
  rows,
  cols,
  rowSizes,
  colSizes,

  visiblePanels,
}) {
  // ============================================================
  // render-driving state
  // ============================================================
  const [activeId, setActiveId] = useState(null);
  const [activeRole, setActiveRole] = useState(null);
  const [panelOverCellId, setPanelOverCellId] = useState(null);

  const panelDragging = activeRole === "panel";
  const isContainerDrag = activeRole === "container";
  const isInstanceDrag = activeRole === "instance";

  // ============================================================
  // refs
  // ============================================================
  const activeRef = useRef(null);
  const overRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  // DOM hit-testing refs
  const hoveredPanelIdRef = useRef(null);
  const hoveredContainerIdRef = useRef(null);

  // ✅ Centralized hover output (single source of truth)
  const hotTargetRef = useRef(null);

  // Native-mode session flag
  const nativeActiveRef = useRef(false);

  const sessionRef = useRef({
    dragging: false,
    startPanels: null,
    startContainers: null,
    draftPanels: null,
    draftContainers: null,
  });

  // ============================================================
  // RAF-throttled tick (prevents mobile useRects thrash)
  // ============================================================
  const tickRafRef = useRef(0);
  const requestSoftTick = useCallback(() => {
    if (!scheduleSoftTick) return;
    if (tickRafRef.current) return;

    tickRafRef.current = requestAnimationFrame(() => {
      tickRafRef.current = 0;
      scheduleSoftTick();
    });
  }, [scheduleSoftTick]);

  // ============================================================
  // base sources
  // ============================================================
  const basePanels = useMemo(
    () => (Array.isArray(visiblePanels) ? visiblePanels : []),
    [visiblePanels]
  );

  const baseAllPanels = useMemo(() => {
    const p = Array.isArray(state?.panels) ? state.panels : [];
    return p.length ? p : basePanels;
  }, [state?.panels, basePanels]);

  const baseContainers = useMemo(
    () => (Array.isArray(state?.containers) ? state.containers : []),
    [state?.containers]
  );

  // ============================================================
  // draft-aware getters
  // ============================================================
  const getWorkingPanels = useCallback(() => {
    const s = sessionRef.current;
    return s.dragging && s.draftPanels ? s.draftPanels : basePanels;
  }, [basePanels]);

  const getWorkingAllPanels = useCallback(() => {
    const s = sessionRef.current;
    return s.dragging && s.draftPanels ? s.draftPanels : baseAllPanels;
  }, [baseAllPanels]);

  const getWorkingContainers = useCallback(() => {
    const s = sessionRef.current;
    return s.dragging && s.draftContainers ? s.draftContainers : baseContainers;
  }, [baseContainers]);

  // ============================================================
  // geometry
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

    // ✅ FIX: correct binning so we don't "stick" in col 0/row 0
    let acc = 0;
    let col = 0;
    for (let i = 0; i < (colSizes || []).length; i++) {
      acc += colSizes[i];
      if (relX <= acc / totalCols) {
        col = i;
        break;
      }
    }

    acc = 0;
    let row = 0;
    for (let i = 0; i < (rowSizes || []).length; i++) {
      acc += rowSizes[i];
      if (relY <= acc / totalRows) {
        row = i;
        break;
      }
    }

    const rr = clamp(row, 0, rows - 1);
    const cc = clamp(col, 0, cols - 1);

    return { row: rr, col: cc, cellId: `cell-${rr}-${cc}` };
  }, [gridRef, rows, cols, rowSizes, colSizes]);

  // ============================================================
  // DOM hit-testing (hovered panel/container under pointer)
  // ============================================================
  const getHoveredPanelId = useCallback(() => {
    const { x, y } = pointerRef.current;
    if (typeof x !== "number" || typeof y !== "number") return null;

    const el = document.elementFromPoint(x, y);
    if (!el) return null;

    const panelEl = el.closest?.("[data-panel-id]");
    return panelEl?.getAttribute?.("data-panel-id") ?? null;
  }, []);

  const getHoveredContainerId = useCallback(() => {
    const { x, y } = pointerRef.current;
    if (typeof x !== "number" || typeof y !== "number") return null;

    const el = document.elementFromPoint(x, y);
    if (!el) return null;

    const containerEl = el.closest?.("[data-container-id]");
    return containerEl?.getAttribute?.("data-container-id") ?? null;
  }, []);

  // ============================================================
  // Centralized hover surface (hotTarget)
  // ============================================================
  const setHotTarget = useCallback(({ role, panelId, containerId, overInstanceId } = {}) => {
    const next = {
      role: role || "",
      panelId: panelId ?? null,
      containerId: containerId ?? null,
      overInstanceId: overInstanceId ?? null,
    };

    const prev = hotTargetRef.current;
    const same =
      prev &&
      prev.role === next.role &&
      prev.panelId === next.panelId &&
      prev.containerId === next.containerId &&
      prev.overInstanceId === next.overInstanceId;

    if (!same) hotTargetRef.current = next;
  }, []);

  const refreshHotTarget = useCallback(() => {
    const a = activeRef.current;
    const o = overRef.current;

    if (o) {
      if (a?.role === "instance") {
        setHotTarget({
          role: o.role || "instance",
          panelId: o.panelId ?? hoveredPanelIdRef.current,
          containerId: o.containerId ?? hoveredContainerIdRef.current,
          overInstanceId: o.overInstanceId ?? null,
        });
        return;
      }

      if (a?.role === "container") {
        setHotTarget({
          role: o.role || "container",
          panelId: o.panelId ?? hoveredPanelIdRef.current,
          containerId: null,
          overInstanceId: null,
        });
        return;
      }

      if (a?.role === "panel") {
        setHotTarget({
          role: "panel",
          panelId: hoveredPanelIdRef.current,
          containerId: null,
          overInstanceId: null,
        });
        return;
      }

      setHotTarget({
        role: o.role || "",
        panelId: o.panelId ?? hoveredPanelIdRef.current,
        containerId: o.containerId ?? hoveredContainerIdRef.current,
        overInstanceId: o.overInstanceId ?? null,
      });
      return;
    }

    if (a?.role === "instance" || a?.role === "external") {
      setHotTarget({
        role: a?.role || "external",
        panelId: hoveredPanelIdRef.current,
        containerId: hoveredContainerIdRef.current,
        overInstanceId: null,
      });
      return;
    }

    if (a?.role === "container") {
      setHotTarget({
        role: "container",
        panelId: hoveredPanelIdRef.current,
        containerId: null,
        overInstanceId: null,
      });
      return;
    }

    setHotTarget({
      role: a?.role || "",
      panelId: hoveredPanelIdRef.current,
      containerId: hoveredContainerIdRef.current,
      overInstanceId: null,
    });
  }, [setHotTarget]);

  // ============================================================
  // hover normalization (dnd-kit over -> internal normalized overRef)
  // ============================================================
  const setOverFromDndKit = useCallback((over) => {
    if (!over) {
      overRef.current = null;
      return;
    }

    const data = over.data?.current || {};
    overRef.current = {
      id: over.id,
      role: pickRole(data),
      panelId: data.panelId ?? null,
      containerId: data.containerId ?? null,
      overInstanceId: data.instanceId ?? data.overInstanceId ?? null,
    };
  }, []);

  // ============================================================
  // drag session
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

  // ✅ FIX: helper to revert preview back to the "start" snapshot
  const resetDraftToStart = useCallback(() => {
    const s = sessionRef.current;
    if (!s.dragging) return;
    if (s.startPanels) s.draftPanels = deepClonePanels(s.startPanels);
    if (s.startContainers) s.draftContainers = deepCloneContainers(s.startContainers);
  }, []);

  const clearDragSession = useCallback(() => {
    const s = sessionRef.current;
    s.dragging = false;
    s.startPanels = null;
    s.startContainers = null;
    s.draftPanels = null;
    s.draftContainers = null;

    activeRef.current = null;
    overRef.current = null;

    hoveredPanelIdRef.current = null;
    hoveredContainerIdRef.current = null;
    hotTargetRef.current = null;

    nativeActiveRef.current = false;

    setPanelOverCellId(null);
    requestSoftTick();
  }, [requestSoftTick]);

  // ============================================================
  // sensors
  // ============================================================
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 80, tolerance: 6 } })
  );

  // ============================================================
  // collision detection
  // ============================================================
  const collisionDetection = useMemo(
    () => (args) => {
      if (activeRef.current?.role === "panel") {
        return panelOverCellId ? [{ id: panelOverCellId }] : [];
      }

      const raw = pointerWithin(args);
      const filtered = raw.filter(
        (c) => pickRole(c?.data?.droppableContainer?.data?.current) !== "panel:drop"
      );

      // ✅ For instance/container drags:
      // - prefer pointerWithin (filtered)
      // - but if you're in gaps, fall back to closestCenter (still filtered to avoid panel:drop)
      const role = activeRef.current?.role;
      if (role === "instance" || role === "container") {
        return filtered.length ? filtered : closestCenter(args);
      }

      return filtered.length ? filtered : closestCenter(args);
    },
    [panelOverCellId]
  );

  // ============================================================
  // handlers (dnd-kit)
  // ============================================================
  const onDragStart = useCallback(
    (evt) => {
      const data = evt.active.data?.current ?? {};
      activeRef.current = { id: evt.active.id, role: pickRole(data), data };

      setActiveId(evt.active.id);
      setActiveRole(activeRef.current.role);

      ensureDragSession();

      hoveredPanelIdRef.current = getHoveredPanelId();
      hoveredContainerIdRef.current = getHoveredContainerId();
      refreshHotTarget();

      if (activeRef.current.role === "panel") {
        const cell = getCellFromPointer();
        setPanelOverCellId(cell?.cellId ?? null);
      }

      requestSoftTick();
    },
    [
      ensureDragSession,
      getHoveredPanelId,
      getHoveredContainerId,
      refreshHotTarget,
      getCellFromPointer,
      requestSoftTick,
    ]
  );

  const onDragOver = useCallback(
    (evt) => {
      setOverFromDndKit(evt.over);

      const a = activeRef.current;
      const o = overRef.current;
      const s = sessionRef.current;

      if (!a) return;

      hoveredPanelIdRef.current = getHoveredPanelId();
      hoveredContainerIdRef.current = getHoveredContainerId();
      refreshHotTarget();

      // ✅ FIX: leaving droppables => revert preview
      if (!o) {
        if (s.dragging) resetDraftToStart();
        requestSoftTick();
        return;
      }

      // Keep panelOverCellId synced during panel drags (prefer over id!)
      if (a.role === "panel") {
        if (typeof evt.over?.id === "string" && String(evt.over.id).startsWith("cell-")) {
          setPanelOverCellId(String(evt.over.id));
        } else {
          const cell = getCellFromPointer();
          setPanelOverCellId(cell?.cellId ?? null);
        }
      }

      // INSTANCE PREVIEW SORT
      if (
        ENABLE_INSTANCE_PREVIEW_SORT &&
        a.role === "instance" &&
        o.containerId &&
        a.data?.containerId &&
        s.draftContainers
      ) {
        const to = s.draftContainers.find((c) => c.id === o.containerId);

        // optional safety: if overInstanceId isn't in the list, treat as append
        let idx =
          o.overInstanceId && to ? (to.items || []).indexOf(o.overInstanceId) : null;
        if (idx != null && idx < 0) idx = null;

        previewMoveInstance({
          draftContainers: s.draftContainers,
          instanceId: a.id,
          toContainerId: o.containerId,
          toIndex: idx,
        });
      }

      // CONTAINER PREVIEW SORT
      if (
        ENABLE_CONTAINER_PREVIEW_SORT &&
        a.role === "container" &&
        o.panelId &&
        a.data?.panelId &&
        s.draftPanels
      ) {
        previewMoveContainer({
          draftPanels: s.draftPanels,
          containerId: a.id,
          toPanelId: o.panelId,
          toIndex: null,
        });
      }

      requestSoftTick();
    },
    [
      setOverFromDndKit,
      getHoveredPanelId,
      getHoveredContainerId,
      refreshHotTarget,
      resetDraftToStart,
      getCellFromPointer,
      requestSoftTick,
    ]
  );

  // ✅ NEW: internal pointer/hover tracking during dnd-kit drags
  const onDragMove = useCallback(
    (evt) => {
      const e = evt.activatorEvent;
      const x = e?.clientX ?? e?.touches?.[0]?.clientX;
      const y = e?.clientY ?? e?.touches?.[0]?.clientY;

      if (typeof x === "number" && typeof y === "number") {
        pointerRef.current = { x, y };

        hoveredPanelIdRef.current = getHoveredPanelId();
        hoveredContainerIdRef.current = getHoveredContainerId();
        refreshHotTarget();

        if (activeRef.current?.role === "panel") {
          const cell = getCellFromPointer();
          setPanelOverCellId(cell?.cellId ?? null);
        }
      }
    },
    [getHoveredPanelId, getHoveredContainerId, refreshHotTarget, getCellFromPointer]
  );

  const onDragEnd = useCallback(() => {
    const a = activeRef.current;
    const o = overRef.current;

    if (!a) return clearDragSession();

    // HARD COMMIT: panel -> cell (+ stack repair source + dest)
    if (a.role === "panel") {
      const cell = getCellFromPointer();
      if (cell) {
        const all = getWorkingAllPanels();
        const p0 = all.find((x) => x.id === a.id);

        if (p0) {
          const fromRow = p0.row;
          const fromCol = p0.col;
          const toRow = cell.row;
          const toCol = cell.col;

          const movedCells = fromRow !== toRow || fromCol !== toCol;

          const nextPanel = {
            ...p0,
            row: toRow,
            col: toCol,
            layout: {
              ...(p0.layout || {}),
              style: {
                ...((p0.layout && p0.layout.style) || {}),
                display: "block",
              },
            },
          };

          CommitHelpers.updatePanel({
            dispatch,
            socket,
            panel: nextPanel,
            emit: true,
          });

          if (movedCells) {
            const post = all.map((x) => (x.id === a.id ? nextPanel : x));

            const sourceCellKey = `cell-${fromRow}-${fromCol}`;
            const destCellKey = `cell-${toRow}-${toCol}`;

            const inCell = (panel, key) => `cell-${panel.row}-${panel.col}` === key;

            const sourceStack = post.filter((x) => x.id !== a.id && inCell(x, sourceCellKey));
            const destStack = post.filter((x) => x.id !== a.id && inCell(x, destCellKey));

            if (sourceStack.length) {
              const makeVisible = sourceStack[0];

              LayoutHelpers.setPanelStackDisplay({
                dispatch,
                socket,
                panel: makeVisible,
                display: "block",
                emit: true,
              });

              for (const other of sourceStack) {
                if (other.id === makeVisible.id) continue;
                LayoutHelpers.setPanelStackDisplay({
                  dispatch,
                  socket,
                  panel: other,
                  display: "none",
                  emit: true,
                });
              }
            }

            for (const other of destStack) {
              LayoutHelpers.setPanelStackDisplay({
                dispatch,
                socket,
                panel: other,
                display: "none",
                emit: true,
              });
            }
          }
        }
      }
    }

    // ✅ HARD COMMIT: container -> panel
    if (a.role === "container" && o?.panelId) {
      LayoutHelpers.moveContainerBetweenPanels({
        dispatch,
        socket,
        fromPanel: getWorkingAllPanels().find((p) => p.id === a.data.panelId),
        toPanel: getWorkingAllPanels().find((p) => p.id === o.panelId),
        containerId: a.id,
        emit: true,
      });
    }

    // ✅ HARD COMMIT: instance -> container (with optional index)
    if (a.role === "instance" && o?.containerId) {
      const fromC = getWorkingContainers().find((c) => c.id === a.data.containerId);
      const toC = getWorkingContainers().find((c) => c.id === o.containerId);

      const toIndex =
        o?.overInstanceId && toC ? (toC.items || []).indexOf(o.overInstanceId) : null;

      LayoutHelpers.moveInstanceBetweenContainers({
        dispatch,
        socket,
        fromContainer: fromC,
        toContainer: toC,
        instanceId: a.id,
        toIndex, // ✅ only works if your helper accepts it
        emit: true,
      });
    }

    clearDragSession();
    setActiveId(null);
    setActiveRole(null);
    setPanelOverCellId(null);
  }, [
    dispatch,
    socket,
    getCellFromPointer,
    getWorkingAllPanels,
    getWorkingContainers,
    clearDragSession,
  ]);

  const onDragCancel = useCallback(() => {
    clearDragSession();
    setActiveId(null);
    setActiveRole(null);
    setPanelOverCellId(null);
  }, [clearDragSession]);

  // ============================================================
  // Native / cross-window bridge pointer tracking ONLY
  // (keep window listeners, but only active during native drag mode)
  // ============================================================
  useEffect(() => {
    // We still want hover updates while an external/native drag is in progress.
    const onMoveNative = (e) => {
      if (!nativeActiveRef.current) return;

      const x = e.clientX ?? e.touches?.[0]?.clientX;
      const y = e.clientY ?? e.touches?.[0]?.clientY;

      if (typeof x === "number" && typeof y === "number") {
        pointerRef.current = { x, y };

        hoveredPanelIdRef.current = getHoveredPanelId();
        hoveredContainerIdRef.current = getHoveredContainerId();
        refreshHotTarget();

        const cell = getCellFromPointer();
        setPanelOverCellId(cell?.cellId ?? null);

        requestSoftTick();
      }
    };

    window.addEventListener("mousemove", onMoveNative, { passive: true });
    window.addEventListener("touchmove", onMoveNative, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMoveNative);
      window.removeEventListener("touchmove", onMoveNative);
    };
  }, [
    getCellFromPointer,
    getHoveredPanelId,
    getHoveredContainerId,
    refreshHotTarget,
    requestSoftTick,
  ]);

  // ============================================================
  // STACK HELPERS (draft-aware)
  // ============================================================
  const getStacksByCell = useCallback(() => {
    const panels = getWorkingPanels();
    const map = new Map(); // cellId -> panel[]

    for (const p of panels) {
      const key = cellKeyFromPanel(p);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }

    // ✅ IMPORTANT: keep original order (do NOT reorder by display)
    return map;
  }, [getWorkingPanels]);

  const getStackForPanel = useCallback(
    (panel) => {
      if (!panel) return [];
      const key = cellKeyFromPanel(panel);
      const map = getStacksByCell();
      return map.get(key) || [];
    },
    [getStacksByCell]
  );

  const setActivePanelInCell = useCallback(
    (row, col, nextPanelId) => {
      const panels = getWorkingPanels();
      const key = `cell-${row}-${col}`;
      const stack = panels.filter((p) => cellKeyFromPanel(p) === key);
      if (stack.length <= 1) return;

      stack.forEach((p) => {
        LayoutHelpers.setPanelStackDisplay({
          dispatch,
          socket,
          panel: p,
          display: p.id === nextPanelId ? "block" : "none",
          emit: true,
        });
      });
    },
    [dispatch, socket, getWorkingPanels]
  );

  const cyclePanelStack = useCallback(
    ({ panelId, dir = 1 }) => {
      const panels = getWorkingPanels();
      const anchor = panels.find((p) => p.id === panelId);
      if (!anchor) return;

      const stack = getStackForPanel(anchor);
      if (stack.length <= 1) return;

      const visibleIdx = stack.findIndex((p) => panelDisplay(p) !== "none");
      const currIdx = visibleIdx >= 0 ? visibleIdx : 0;
      const nextIdx = (currIdx + (dir >= 0 ? 1 : -1) + stack.length) % stack.length;

      stack.forEach((p, idx) => {
        LayoutHelpers.setPanelStackDisplay({
          dispatch,
          socket,
          panel: p,
          display: idx === nextIdx ? "block" : "none",
          emit: true,
        });
      });
    },
    [dispatch, socket, getWorkingPanels, getStackForPanel]
  );

  // ============================================================
  // NATIVE / CROSS-WINDOW BRIDGE (inbound)
  // ============================================================
  const commitExternalCreate = useCallback(
    ({ containerId, label }) => {
      if (!containerId) return;

      const id = crypto.randomUUID();
      const instance = { id, label: label || "Untitled" };

      LayoutHelpers.createInstanceInContainer({
        dispatch,
        socket,
        containerId,
        instance,
        emit: true,
      });
    },
    [dispatch, socket]
  );

  useEffect(() => {
    if (!ENABLE_NATIVE_BRIDGE) return;

    const el = gridRef?.current;
    if (!el) return;

    const isInsideGrid = (x, y) => {
      const rect = el.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    };

    const onDragOverNative = (e) => {
      e.preventDefault?.();

      const types = Array.from(e.dataTransfer?.types || []);
      const hasOurMime = types.includes(NATIVE_DND_MIME);
      const hasFiles = (e.dataTransfer?.files?.length || 0) > 0;
      const hasText = types.includes("text/plain") || types.includes("text/uri-list");

      nativeActiveRef.current = hasOurMime || hasFiles || hasText;

      // NOTE: ensure dnd-kit session doesn't fight us
      if (!activeRef.current) {
        activeRef.current = { id: "__native__", role: "external", data: {} };
        setActiveRole("external");
      }

      pointerRef.current = { x: e.clientX, y: e.clientY };
      hoveredPanelIdRef.current = getHoveredPanelId();
      hoveredContainerIdRef.current = getHoveredContainerId();
      refreshHotTarget();

      const cell = getCellFromPointer();
      setPanelOverCellId(cell?.cellId ?? null);

      requestSoftTick();
    };

    const onDropNative = (e) => {
      e.preventDefault?.();

      pointerRef.current = { x: e.clientX, y: e.clientY };
      const hoveredPanelId = getHoveredPanelId();
      const hoveredContainerId = getHoveredContainerId();
      const cell = getCellFromPointer();

      const raw = e.dataTransfer?.getData?.(NATIVE_DND_MIME);
      const payload = raw ? safeJsonParse(raw) : null;

      const allPanels = getWorkingAllPanels();
      const containers = getWorkingContainers();

      const resolveTargetContainerId = () => {
        if (hoveredContainerId) return hoveredContainerId;
        if (!hoveredPanelId) return null;
        const p = allPanels.find((x) => x.id === hoveredPanelId);
        return p?.containers?.[0] ?? null;
      };

      if (payload?.v === 1 && payload?.type) {
        const type = payload.type;

        if (type === "panel") {
          const p = allPanels.find((x) => x.id === payload.id);
          if (p && cell) {
            CommitHelpers.updatePanel({
              dispatch,
              socket,
              panel: { ...p, row: cell.row, col: cell.col },
              emit: true,
            });
          }
        }

        if (type === "container") {
          const fromPanelId = payload.from?.panelId;
          const toPanelId = hoveredPanelId;

          const fromPanel = allPanels.find((p) => p.id === fromPanelId);
          const toPanel = allPanels.find((p) => p.id === toPanelId);

          if (fromPanel && toPanel && payload.id) {
            LayoutHelpers.moveContainerBetweenPanels({
              dispatch,
              socket,
              fromPanel,
              toPanel,
              containerId: payload.id,
              emit: true,
            });
          }
        }

        if (type === "instance") {
          const fromContainerId = payload.from?.containerId;
          const toContainerId = resolveTargetContainerId();

          const fromC = containers.find((c) => c.id === fromContainerId);
          const toC = containers.find((c) => c.id === toContainerId);

          if (fromC && toC && payload.id) {
            LayoutHelpers.moveInstanceBetweenContainers({
              dispatch,
              socket,
              fromContainer: fromC,
              toContainer: toC,
              instanceId: payload.id,
              emit: true,
            });
          }
        }

        if (type === "external") {
          const toContainerId = resolveTargetContainerId();
          if (toContainerId) {
            commitExternalCreate({
              containerId: toContainerId,
              label: payload.meta?.label || "Untitled",
            });
          }
        }
      } else {
        const toContainerId = resolveTargetContainerId();
        if (toContainerId) {
          const files = Array.from(e.dataTransfer?.files || []);
          if (files.length) {
            commitExternalCreate({
              containerId: toContainerId,
              label: files[0]?.name || "File",
            });
          } else {
            const text =
              e.dataTransfer?.getData?.("text/plain") ||
              e.dataTransfer?.getData?.("text/uri-list") ||
              "";
            const label = String(text || "").trim().slice(0, 80);
            if (label) commitExternalCreate({ containerId: toContainerId, label });
          }
        }
      }

      nativeActiveRef.current = false;
      activeRef.current = null;

      clearDragSession();
      setActiveId(null);
      setActiveRole(null);
      setPanelOverCellId(null);
    };

    // ✅ FIX: dragleave is unreliable. Instead: during dragover, if pointer leaves grid rect, cancel.
    const onDragOverWindow = (e) => {
      if (!nativeActiveRef.current) return;
      const x = e.clientX;
      const y = e.clientY;
      if (!isInsideGrid(x, y)) {
        nativeActiveRef.current = false;
        activeRef.current = null;
        setActiveRole(null);
        setPanelOverCellId(null);
        requestSoftTick();
      }
    };

    el.addEventListener("dragover", onDragOverNative);
    el.addEventListener("drop", onDropNative);
    window.addEventListener("dragover", onDragOverWindow);

    return () => {
      el.removeEventListener("dragover", onDragOverNative);
      el.removeEventListener("drop", onDropNative);
      window.removeEventListener("dragover", onDragOverWindow);
    };
  }, [
    gridRef,
    dispatch,
    socket,
    getCellFromPointer,
    getHoveredPanelId,
    getHoveredContainerId,
    getWorkingAllPanels,
    getWorkingContainers,
    commitExternalCreate,
    clearDragSession,
    refreshHotTarget,
    requestSoftTick,
  ]);

  // ============================================================
  // public api
  // ============================================================
  return {
    sensors,
    collisionDetection,
    onDragStart,
    onDragOver,
    onDragMove, // ✅ NEW: wire this in GridInner's DndContext
    onDragEnd,
    onDragCancel,

    activeId,
    activeRole,
    panelDragging,
    panelOverCellId,

    getWorkingPanels,
    getWorkingAllPanels,
    getWorkingContainers,

    // ✅ centralized hover surface
    hotTarget: hotTargetRef.current,

    // ✅ re-exposed stack helpers
    getStacksByCell,
    getStackForPanel,
    setActivePanelInCell,
    cyclePanelStack,

    // ✅ hit testing (kept for debug / internal; don’t use in components)
    getHoveredPanelId,
    getHoveredContainerId,

    isContainerDrag,
    isInstanceDrag,

    // refs (debug / advanced overlays)
    activeRef,
    overRef,
    pointerRef,

    nativeActiveRef,
  };
}