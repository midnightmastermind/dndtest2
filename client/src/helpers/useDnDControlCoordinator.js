// helpers/useDnDControlCoordinator.js
//
// ✅ Unified Drag-and-Drop Control Coordinator (condensed + uniform)

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

// ============================================================
// PREVIEW MUTATION HELPERS (DRAFT ONLY)
// ============================================================
function previewMoveInstance({
  draftContainers,
  instanceId,
  fromContainerId,
  toContainerId,
  toIndex,
}) {
  if (!draftContainers) return;

  const from = draftContainers.find((c) => c.id === fromContainerId);
  const to = draftContainers.find((c) => c.id === toContainerId);
  if (!from || !to) return;

  from.items = from.items.filter((id) => id !== instanceId);

  if (toIndex == null || toIndex < 0) {
    to.items.push(instanceId);
  } else {
    to.items.splice(toIndex, 0, instanceId);
  }
}

function previewMoveContainer({
  draftPanels,
  containerId,
  fromPanelId,
  toPanelId,
  toIndex,
}) {
  if (!draftPanels) return;

  const from = draftPanels.find((p) => p.id === fromPanelId);
  const to = draftPanels.find((p) => p.id === toPanelId);
  if (!from || !to) return;

  from.containers = from.containers.filter((id) => id !== containerId);

  if (toIndex == null || toIndex < 0) {
    to.containers.push(containerId);
  } else {
    to.containers.splice(toIndex, 0, containerId);
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

  const sessionRef = useRef({
    dragging: false,
    startPanels: null,
    startContainers: null,
    draftPanels: null,
    draftContainers: null,
  });

  // ============================================================
  // base sources
  // ============================================================
  const basePanels = useMemo(
    () => (Array.isArray(visiblePanels) ? visiblePanels : []),
    [visiblePanels]
  );

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

  const getWorkingContainers = useCallback(() => {
    const s = sessionRef.current;
    return s.dragging && s.draftContainers
      ? s.draftContainers
      : baseContainers;
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

    const totalCols = colSizes.reduce((a, b) => a + b, 0) || 1;
    const totalRows = rowSizes.reduce((a, b) => a + b, 0) || 1;

    let acc = 0;
    let col = 0;
    for (let i = 0; i < colSizes.length; i++) {
      acc += colSizes[i];
      if (relX < acc / totalCols) break;
      col = i;
    }

    acc = 0;
    let row = 0;
    for (let i = 0; i < rowSizes.length; i++) {
      acc += rowSizes[i];
      if (relY < acc / totalRows) break;
      row = i;
    }

    return {
      row: clamp(row, 0, rows - 1),
      col: clamp(col, 0, cols - 1),
      cellId: `cell-${row}-${col}`,
    };
  }, [gridRef, rows, cols, rowSizes, colSizes]);

  // ============================================================
  // hover normalization
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
    scheduleSoftTick?.();
  }, [scheduleSoftTick]);

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
        (c) =>
          pickRole(c?.data?.droppableContainer?.data?.current) !==
          "panel:drop"
      );

      return filtered.length ? filtered : closestCenter(args);
    },
    [panelOverCellId]
  );

  // ============================================================
  // handlers
  // ============================================================
  const onDragStart = useCallback(
    (evt) => {
      const data = evt.active.data?.current ?? {};
      activeRef.current = {
        id: evt.active.id,
        role: pickRole(data),
        data,
      };

      setActiveId(evt.active.id);
      setActiveRole(activeRef.current.role);
      ensureDragSession();
      scheduleSoftTick?.();
    },
    [ensureDragSession, scheduleSoftTick]
  );

  const onDragOver = useCallback(
    (evt) => {
      setOverFromDndKit(evt.over);

      const a = activeRef.current;
      const o = overRef.current;
      const s = sessionRef.current;

      if (!a || !o) return;

      // INSTANCE PREVIEW SORT
      if (
        ENABLE_INSTANCE_PREVIEW_SORT &&
        a.role === "instance" &&
        o.containerId &&
        a.data?.containerId &&
        s.draftContainers
      ) {
        const to = s.draftContainers.find((c) => c.id === o.containerId);
        const idx =
          o.overInstanceId && to
            ? to.items.indexOf(o.overInstanceId)
            : null;

        previewMoveInstance({
          draftContainers: s.draftContainers,
          instanceId: a.id,
          fromContainerId: a.data.containerId,
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
          fromPanelId: a.data.panelId,
          toPanelId: o.panelId,
          toIndex: null,
        });
      }

      scheduleSoftTick?.();
    },
    [setOverFromDndKit, scheduleSoftTick]
  );

  const onDragEnd = useCallback(() => {
    const a = activeRef.current;
    const o = overRef.current;

    if (!a) return clearDragSession();

    if (a.role === "panel") {
      const cell = getCellFromPointer();
      if (cell) {
        const p = getWorkingPanels().find((x) => x.id === a.id);
        if (p) {
          CommitHelpers.updatePanel({
            dispatch,
            socket,
            panel: { ...p, row: cell.row, col: cell.col },
            emit: true,
          });
        }
      }
    }

    if (a.role === "container" && o?.panelId) {
      LayoutHelpers.moveContainerBetweenPanels({
        dispatch,
        socket,
        fromPanel: getWorkingPanels().find(
          (p) => p.id === a.data.panelId
        ),
        toPanel: getWorkingPanels().find((p) => p.id === o.panelId),
        containerId: a.id,
      });
    }

    if (a.role === "instance" && o?.containerId) {
      LayoutHelpers.moveInstanceBetweenContainers({
        dispatch,
        socket,
        fromContainer: getWorkingContainers().find(
          (c) => c.id === a.data.containerId
        ),
        toContainer: getWorkingContainers().find(
          (c) => c.id === o.containerId
        ),
        instanceId: a.id,
      });
    }

    clearDragSession();
    setActiveId(null);
    setActiveRole(null);
  }, [
    dispatch,
    socket,
    getCellFromPointer,
    getWorkingPanels,
    getWorkingContainers,
    clearDragSession,
  ]);

  // ============================================================
  // pointer tracking
  // ============================================================
  useEffect(() => {
    const onMove = (e) => {
      const x = e.clientX ?? e.touches?.[0]?.clientX;
      const y = e.clientY ?? e.touches?.[0]?.clientY;

      if (typeof x === "number" && typeof y === "number") {
        pointerRef.current = { x, y };

        if (activeRef.current?.role === "panel") {
          const cell = getCellFromPointer();
          setPanelOverCellId(cell?.cellId ?? null);
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
  // public api
  // ============================================================
  return {
    sensors,
    collisionDetection,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDragCancel: clearDragSession,

    activeId,
    activeRole,
    panelDragging,
    panelOverCellId,

    getWorkingPanels,
    getWorkingContainers,

    isContainerDrag,
    isInstanceDrag,

    activeRef,
    overRef,
    pointerRef,
  };
}
