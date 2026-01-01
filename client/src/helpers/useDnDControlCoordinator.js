// helpers/useDnDControlCoordinator.js
//
// ✅ Unified Drag-and-Drop Control Coordinator
// Owns:
// - pointer tracking (pointerRef)
// - geometry (getCellFromPointer)
// - DOM hit-testing (getHoveredPanelId)
// - collisionDetection (dnd-kit)
// - panel drag preview + drop + stack visibility commits
// - container -> panel + instance -> container drafts + commit policy
//
// ✅ RE-EXPOSED TO PANEL (via Grid props):
// - getStacksByCell(): compute stacks from *working* panels (draft-aware)
// - getStackForPanel(panel): stack panels for that cell (draft-aware)
// - cyclePanelStack({ panelId, dir }): stack cycling w/ hard commit
//
// Grid becomes dumb: it wires DndContext to the returned handlers/sensors/collisionDetection,
// and renders highlightCellId={panelOverCellId} and panels/containers from getWorking*.
//

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
} from "@dnd-kit/core";

import {
  setActiveIdAction,
  setActiveSizeAction,
  softTickAction,
} from "../state/actions";

import * as CommitHelpers from "./CommitHelpers";

// ---------- utilities ----------
function arrayMove(arr, from, to) {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function deepCloneContainers(containers) {
  return (containers || []).map((c) => ({ ...c, items: [...(c.items || [])] }));
}

function deepClonePanels(panels) {
  return (panels || []).map((p) => ({
    ...p,
    containers: [...(p.containers || [])],
  }));
}

function itemsEqual(a = [], b = []) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ---------- generic list move helpers ----------
function insertAt(list = [], id, index) {
  const next = [...list];
  const clamped = Math.max(0, Math.min(next.length, index));
  next.splice(clamped, 0, id);
  return next;
}

function moveChildAcrossParents({
  childId,
  fromParent,
  toParent,
  childKey,
  toIndex = null,
}) {
  if (!fromParent || !toParent) return null;

  const rawFrom = fromParent[childKey] || [];
  const rawTo = toParent[childKey] || [];

  const fromHad = rawFrom.includes(childId);

  const fromList = rawFrom.filter((x) => x !== childId);
  const toList = rawTo.filter((x) => x !== childId);

  if (fromParent.id !== toParent.id && !fromHad) return null;

  const insertIndex = toIndex == null ? toList.length : toIndex;
  const toNext = insertAt(toList, childId, insertIndex);

  return {
    nextFromParent: { ...fromParent, [childKey]: fromList },
    nextToParent: { ...toParent, [childKey]: toNext },
  };
}

// ---------- parent finders ----------
function findContainerByInstanceId(instanceId, list = []) {
  return (list || []).find((c) => (c.items || []).includes(instanceId)) || null;
}
function findContainerById(containerId, list = []) {
  return (list || []).find((c) => c.id === containerId) || null;
}

// ✅ panels
function findPanelByContainerId(containerId, panels = []) {
  return (
    (panels || []).find((p) => (p.containers || []).includes(containerId)) ||
    null
  );
}
function findPanelById(panelId, panels = []) {
  return (panels || []).find((p) => p.id === panelId) || null;
}

/**
 * Normalizes over into:
 *   { parentRole: "panel"|"container", parentId, overChildId? }
 */
function getOverParent(over, activeRole) {
  if (!over) return null;
  const d = over.data?.current || {};

  // ======================================================
  // ✅ CONTAINER drag targets (container -> panel)
  // ======================================================
  if (activeRole === "container") {
    // Dropping onto panel root droppable
    if (d?.role === "panel:drop" && d?.panelId) {
      return { parentRole: "panel", parentId: d.panelId };
    }

    // Hovering another container sortable (reorder / insert)
    if (d?.role === "container" && d?.panelId) {
      return {
        parentRole: "panel",
        parentId: d.panelId,
        overChildId: over.id, // container id
      };
    }

    return null;
  }

  // ======================================================
  // ✅ INSTANCE drag targets (instance -> container)
  // ======================================================
  if (d?.containerId && typeof d?.role === "string") {
    // ✅ list dropzone
    if (d.role === "container:list") {
      return { parentRole: "container", parentId: d.containerId };
    }

    // existing container zones (if you still have any)
    if (d.role.startsWith("container")) {
      return { parentRole: "container", parentId: d.containerId };
    }
  }

  if (d?.role === "instance" && d?.containerId) {
    return {
      parentRole: "container",
      parentId: d.containerId,
      overChildId: over.id,
    };
  }

  return null;
}

// -----------------------------
// ✅ panel stack helpers
// -----------------------------
function getDisplay(p) {
  return p?.layout?.style?.display ?? "block";
}
function setDisplay(p, display) {
  const layout = p?.layout && typeof p.layout === "object" ? p.layout : {};
  const style =
    layout?.style && typeof layout.style === "object" ? layout.style : {};
  return {
    ...p,
    layout: {
      ...layout,
      style: {
        ...style,
        display,
      },
    },
  };
}
function cellKey(row, col) {
  return `${row}-${col}`;
}
function sanitizePanelPlacement(panel, rCount, cCount) {
  return {
    ...panel,
    row: Math.max(0, Math.min(panel.row, rCount - 1)),
    col: Math.max(0, Math.min(panel.col, cCount - 1)),
    width: panel.width,
    height: panel.height,
  };
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(n, max));
}

// ---------- hook ----------
export function useDnDControlCoordinator({
  // redux-ish
  state,
  dispatch,
  socket,

  // tick
  scheduleSoftTick: scheduleSoftTickExternal,

  // grid geometry + hit-test
  gridRef,
  rows,
  cols,
  rowSizes,
  colSizes,

  // panel context for stacking + commit
  visiblePanels, // array of panels in this grid (pass from Grid)
}) {
  // -----------------------------
  // ✅ public UI state
  // -----------------------------
  const [activeId, setActiveId] = useState(null);
  const [activeRole, setActiveRole] = useState(null);
  const [panelDragging, setPanelDragging] = useState(false);
  const [panelOverCellId, setPanelOverCellId] = useState(null);

  // -----------------------------
  // ✅ injected hover/hot state for Panels (Option B)
  // -----------------------------
  const overDataRef = useRef(null); // raw over.data.current
  const [overPanelId, setOverPanelId] = useState(null); // cheap state for memo/props
  const [hotTarget, setHotTarget] = useState(null); // { panelId, containerId, role }

  // -----------------------------
  // ✅ pointer tracking
  // -----------------------------
  const pointerRef = useRef({ x: null, y: null });

  // throttle hover updates (dom hit-test)
  const hoveredPanelIdRef = useRef(null);
  const lastHoverUpdateRef = useRef(0);
  const lastHoverPtRef = useRef({ x: null, y: null });

  // panel cell tracking
  const rafMoveRef = useRef(null);
  const lastCellRef = useRef(null);

  // -----------------------------
  // ✅ drafts
  // -----------------------------
  const containersDraftRef = useRef(null);

  // container->panel drafts
  const panelsDraftRef = useRef(null);
  const panelsStartRef = useRef(null);
  const lastContainerMoveRef = useRef(null);

  // instance moves
  const lastInstanceMoveRef = useRef(null);

  // cache rects once per frame
  const frameRectsRef = useRef(null);

  // -----------------------------
  // ✅ sensors (optional: centralized)
  // -----------------------------
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
      eventOptions: { passive: false },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  // -----------------------------
  // ✅ soft tick scheduler
  // -----------------------------
  const softTickRafRef = useRef(0);

  const scheduleSoftTick = useCallback(() => {
    if (typeof scheduleSoftTickExternal === "function") {
      if (softTickRafRef.current) return;
      softTickRafRef.current = requestAnimationFrame(() => {
        softTickRafRef.current = 0;
        scheduleSoftTickExternal();
      });
      return;
    }

    if (softTickRafRef.current) return;
    softTickRafRef.current = requestAnimationFrame(() => {
      softTickRafRef.current = 0;
      dispatch(softTickAction());
    });
  }, [dispatch, scheduleSoftTickExternal]);

  useEffect(() => {
    return () => {
      if (softTickRafRef.current) cancelAnimationFrame(softTickRafRef.current);
    };
  }, []);

  // -----------------------------
  // ✅ getters
  // -----------------------------
  const getWorkingContainers = useCallback(() => {
    return containersDraftRef.current ?? state.containers;
  }, [state.containers]);

  const getWorkingPanels = useCallback(() => {
    // Use draft if present, else "visiblePanels" (already filtered) if provided, else state.panels
    return panelsDraftRef.current ?? visiblePanels ?? state.panels;
  }, [state.panels, visiblePanels]);

  // -----------------------------
  // ✅ stack exposure (draft-aware)
  // -----------------------------
  const getStacksByCell = useCallback(() => {
    const panels = getWorkingPanels() || [];
    const map = {};

    for (const p of panels) {
      const key = cellKey(p.row, p.col);
      (map[key] ||= []).push(p);
    }

    // ✅ stable order
    for (const key of Object.keys(map)) {
      map[key] = [...map[key]].sort((a, b) =>
        String(a.id).localeCompare(String(b.id))
      );
    }

    return map;
  }, [getWorkingPanels]);

  const getStackForPanel = useCallback(
    (panel) => {
      if (!panel) return [];
      const map = getStacksByCell();
      return map[cellKey(panel.row, panel.col)] || [];
    },
    [getStacksByCell]
  );

  const setActivePanelInCell = useCallback(
    (row, col, nextPanelId) => {
      if (row == null || col == null || !nextPanelId) return;

      const panels = getWorkingPanels() || [];
      const key = cellKey(row, col);

      const stack = panels.filter((p) => cellKey(p.row, p.col) === key);
      if (stack.length <= 1) {
        // still allow "force visible"
        const only = stack[0];
        if (only && getDisplay(only) === "none") {
          const next = setDisplay(only, "block");
          if (panelsDraftRef.current) {
            panelsDraftRef.current = panelsDraftRef.current.map((p) =>
              p.id === next.id ? next : p
            );
          }
          CommitHelpers.updatePanel({ dispatch, socket, panel: next, emit: true });
          scheduleSoftTick();
        }
        return;
      }

      const exists = stack.some((p) => p.id === nextPanelId);
      if (!exists) return;

      const updates = stack.map((p) =>
        p.id === nextPanelId ? setDisplay(p, "block") : setDisplay(p, "none")
      );

      // ✅ update draft immediately (if dragging / draft mode exists)
      if (panelsDraftRef.current) {
        const ids = new Set(updates.map((p) => p.id));
        panelsDraftRef.current = panelsDraftRef.current.map((p) =>
          ids.has(p.id) ? updates.find((u) => u.id === p.id) : p
        );
      }

      // ✅ hard commit
      for (const p of updates) {
        CommitHelpers.updatePanel({ dispatch, socket, panel: p, emit: true });
      }

      scheduleSoftTick();
    },
    [dispatch, socket, getWorkingPanels, scheduleSoftTick]
  );

  const cyclePanelStack = useCallback(
    ({ panelId, dir }) => {
      if (!panelId || (!dir && dir !== 0)) return;

      const panels = getWorkingPanels() || [];
      const panel = panels.find((p) => p.id === panelId) || null;
      if (!panel) return;

      const map = getStacksByCell();
      const key = cellKey(panel.row, panel.col);
      const stack = map[key] || [];
      if (stack.length <= 1) return;

      const visibleIdx = stack.findIndex((p) => getDisplay(p) !== "none");
      const cur = visibleIdx === -1 ? 0 : visibleIdx;

      const step = dir < 0 ? -1 : 1;
      const nextIdx = (cur + step + stack.length) % stack.length;
      const nextId = stack[nextIdx]?.id;

      if (nextId) {
        setActivePanelInCell(panel.row, panel.col, nextId);
      }
    },
    [getWorkingPanels, getStacksByCell, setActivePanelInCell]
  );

  // -----------------------------
  // ✅ commit helpers
  // -----------------------------
  const commitPanelsBatch = useCallback(
    (panels = [], { emit = true } = {}) => {
      if (!panels?.length) return;
      for (const p of panels) {
        CommitHelpers.updatePanel({ dispatch, socket, panel: p, emit });
      }
    },
    [dispatch, socket]
  );

  // -----------------------------
  // ✅ geometry
  // -----------------------------
  const getCellFromPointer = useCallback(
    (clientX, clientY) => {
      const gridEl = gridRef?.current;
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

      const cs =
        Array.isArray(colSizes) && colSizes.length
          ? colSizes
          : Array(cols || 1).fill(1);
      const rs =
        Array.isArray(rowSizes) && rowSizes.length
          ? rowSizes
          : Array(rows || 1).fill(1);

      const totalCols = cs.reduce((a, b) => a + b, 0);
      const totalRows = rs.reduce((a, b) => a + b, 0);

      let col = cs.length - 1;
      let accX = 0;
      for (let i = 0; i < cs.length; i++) {
        accX += (cs[i] / totalCols) * rect.width;
        if (x < accX) {
          col = i;
          break;
        }
      }

      let row = rs.length - 1;
      let accY = 0;
      for (let i = 0; i < rs.length; i++) {
        accY += (rs[i] / totalRows) * rect.height;
        if (y < accY) {
          row = i;
          break;
        }
      }

      return { row, col };
    },
    [gridRef, rowSizes, colSizes, rows, cols]
  );

  // -----------------------------
  // ✅ DOM hit-testing
  // -----------------------------
  const getHoveredPanelId = useCallback((pt) => {
    if (!pt) return null;
    const stack = document.elementsFromPoint(pt.x, pt.y);

    for (const el of stack) {
      // ignore overlays
      if (
        el.closest?.(".panel-overlay, .container-overlay, .instance-overlay")
      )
        continue;
      if (el.closest?.("[data-fullscreen-overlay='true']")) continue;

      const panelEl = el.closest?.("[data-panel-id]");
      if (panelEl) {
        return (
          panelEl.getAttribute("data-panel-id") || panelEl.dataset.panelId || null
        );
      }
    }
    return null;
  }, []);

  // -----------------------------
  // ✅ pointer listeners while dragging
  // -----------------------------
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
  }, [activeRole]);

  // -----------------------------
  // ✅ collisionDetection
  // -----------------------------
  const collisionDetection = useMemo(() => {
    return (args) => {
      const role = args.active?.data?.current?.role;

      // ✅ Panel drags use the "grid cell" highlight id
      if (role === "panel") {
        return panelOverCellId ? [{ id: panelOverCellId }] : [];
      }

      // Start with pointerWithin
      const hits = pointerWithin(args);
      const shouldScope = role === "instance" || role === "container";

      // Default behavior for non-scoped roles
      if (!shouldScope) {
        if (hits.length) return hits;
        return closestCenter(args);
      }

      const getMeta = (c) => c?.data?.droppableContainer?.data?.current ?? null;

      const pickPanelIdFromHits = () => {
        const preferred = hits.find((c) => {
          const d = getMeta(c);
          const r = d?.role;
          return (
            d?.panelId &&
            (r === "instance" ||
              (typeof r === "string" && r.startsWith("container:")))
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

      if (!hoveredPanelId) {
        if (hits.length) return hits;
        return closestCenter(args);
      }

      const scopedHits = hits.filter((c) => getMeta(c)?.panelId === hoveredPanelId);
      const workingHits = scopedHits.length ? scopedHits : hits;

      if (role === "instance") {
        const instanceHits = workingHits.filter(
          (c) => getMeta(c)?.role === "instance"
        );
        if (instanceHits.length) return instanceHits;

        const containerZoneHits = workingHits.filter((c) =>
          String(getMeta(c)?.role || "").startsWith("container:")
        );
        if (containerZoneHits.length) return containerZoneHits;

        const panelTargets = workingHits.filter(
          (c) => getMeta(c)?.role === "panel:drop"
        );
        if (panelTargets.length) return panelTargets;

        if (hits.length) return hits;
        return closestCenter(args);
      }

      if (workingHits.length) return workingHits;
      if (hits.length) return hits;
      return closestCenter(args);
    };
  }, [panelOverCellId]);

  // -----------------------------
  // ✅ internal: panel preview cell update
  // -----------------------------
  const updatePanelOverCellFromPointer = useCallback(() => {
    const live = pointerRef.current;
    if (typeof live?.x !== "number" || typeof live?.y !== "number") return;

    const rc = getCellFromPointer(live.x, live.y);
    const next = rc ? `cell-${rc.row}-${rc.col}` : null;

    if (next !== lastCellRef.current) {
      lastCellRef.current = next;
      setPanelOverCellId(next);
    }
  }, [getCellFromPointer]);

  // -----------------------------
  // ✅ DnD handlers (unified)
  // -----------------------------
  const onDragStart = useCallback(
    (event) => {
      const id = event.active?.id ?? null;
      const role = event.active?.data?.current?.role ?? null;

      setActiveId(id);
      setActiveRole(role);
      dispatch(setActiveIdAction(id));

      const rect = event.active.rect?.current?.initial;
      if (rect) {
        dispatch(setActiveSizeAction({ width: rect.width, height: rect.height }));
      }

      // drafts always ready
      containersDraftRef.current = deepCloneContainers(state.containers);
      panelsDraftRef.current = deepClonePanels(visiblePanels ?? state.panels);
      panelsStartRef.current = deepClonePanels(visiblePanels ?? state.panels);

      lastInstanceMoveRef.current = null;
      lastContainerMoveRef.current = null;
      frameRectsRef.current = null;

      // reset injected hover state
      overDataRef.current = null;
      setOverPanelId(null);
      setHotTarget(null);

      // initialize pointer from activator event
      const startX =
        event?.activatorEvent?.clientX ??
        event?.activatorEvent?.touches?.[0]?.clientX ??
        null;
      const startY =
        event?.activatorEvent?.clientY ??
        event?.activatorEvent?.touches?.[0]?.clientY ??
        null;

      pointerRef.current = { x: startX, y: startY };

      // panel mode
      if (role === "panel") {
        setPanelDragging(true);
        if (typeof startX === "number" && typeof startY === "number") {
          const rc = getCellFromPointer(startX, startY);
          const next = rc ? `cell-${rc.row}-${rc.col}` : null;
          lastCellRef.current = next;
          setPanelOverCellId(next);
        } else {
          lastCellRef.current = null;
          setPanelOverCellId(null);
        }
      } else {
        setPanelDragging(false);
        lastCellRef.current = null;
        setPanelOverCellId(null);
      }

      scheduleSoftTick();
    },
    [
      dispatch,
      scheduleSoftTick,
      state.containers,
      state.panels,
      visiblePanels,
      getCellFromPointer,
    ]
  );

  const onDragCancel = useCallback(() => {
    setActiveId(null);
    setActiveRole(null);
    setPanelDragging(false);

    dispatch(setActiveIdAction(null));
    dispatch(setActiveSizeAction(null));

    containersDraftRef.current = null;
    panelsDraftRef.current = null;
    panelsStartRef.current = null;

    lastInstanceMoveRef.current = null;
    lastContainerMoveRef.current = null;

    frameRectsRef.current = null;

    pointerRef.current = { x: null, y: null };
    hoveredPanelIdRef.current = null;
    lastCellRef.current = null;
    setPanelOverCellId(null);

    // reset injected hover state
    overDataRef.current = null;
    setOverPanelId(null);
    setHotTarget(null);

    scheduleSoftTick();
  }, [dispatch, scheduleSoftTick]);

  const onDragMove = useCallback(() => {
    if (!activeRole) return;

    // raf throttle the expensive stuff
    if (!rafMoveRef.current) {
      rafMoveRef.current = requestAnimationFrame(() => {
        rafMoveRef.current = null;

        // update hoveredPanelId for scoping when dragging instances/containers
        if (activeRole === "instance" || activeRole === "container") {
          const pt = pointerRef.current;
          if (pt?.x != null && pt?.y != null) {
            const now = performance.now();
            const last = lastHoverPtRef.current;
            const moved = pt.x !== last.x || pt.y !== last.y;

            if (moved && now - lastHoverUpdateRef.current > 80) {
              lastHoverUpdateRef.current = now;
              lastHoverPtRef.current = { x: pt.x, y: pt.y };
              hoveredPanelIdRef.current = getHoveredPanelId(pt);
            }
          }
        }

        // panel preview highlight
        if (panelDragging && activeRole === "panel") {
          updatePanelOverCellFromPointer();
        }
      });
    }
  }, [activeRole, panelDragging, getHoveredPanelId, updatePanelOverCellFromPointer]);

  const onDragOver = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over) return;

      const activeRoleNow = active.data?.current?.role;

      // ✅ keep raw over data available to Panels
      overDataRef.current = over?.data?.current ?? null;

      // store panelId if present (Panels use this for hover state)
      const pid = overDataRef.current?.panelId ?? null;
      // only update state when it changes (avoid rerenders)
      if (pid !== overPanelId) setOverPanelId(pid);

      // Panels use pointer + grid geometry, not over droppables
      if (activeRoleNow === "panel") return;

      // ======================================================
      // ✅ CONTAINER DRAG (container -> panel; reorder between panels)
      // ======================================================
      if (activeRoleNow === "container") {
        const overInfo = getOverParent(over, activeRoleNow);
        if (!overInfo || overInfo.parentRole !== "panel") return;

        const draftPanels = panelsDraftRef.current;
        if (!draftPanels) return;

        const containerId = active.id;

        const fromPanel = findPanelByContainerId(containerId, draftPanels);
        const toPanel = findPanelById(overInfo.parentId, draftPanels);
        if (!fromPanel || !toPanel) return;

        // ✅ expose hotTarget for Panel highlight logic
        setHotTarget({
          panelId: toPanel.id,
          containerId: overInfo.overChildId || null,
          role: "container",
        });

        const fromList = fromPanel.containers || [];
        const toList = toPanel.containers || [];

        const fromIndex = fromList.indexOf(containerId);
        if (fromIndex === -1) return;

        let targetIndex = toList.length;

        if (overInfo.overChildId) {
          const hoverId = overInfo.overChildId;
          const hoverIdx = toList.indexOf(hoverId);
          if (hoverIdx !== -1) {
            const pt = pointerRef?.current;
            const r = over.rect;
            const after = pt && r ? pt.y > r.top + r.height / 2 : false;
            targetIndex = hoverIdx + (after ? 1 : 0);
          }
        }

        if (fromPanel.id === toPanel.id) {
          targetIndex = Math.max(0, Math.min(toList.length - 1, targetIndex));
        } else {
          targetIndex = Math.max(0, Math.min(toList.length, targetIndex));
        }

        const moveKey = `${fromPanel.id}|${toPanel.id}|${containerId}|${targetIndex}`;
        if (lastContainerMoveRef.current === moveKey) return;
        lastContainerMoveRef.current = moveKey;

        let nextFromPanel = fromPanel;
        let nextToPanel = toPanel;

        if (fromPanel.id === toPanel.id) {
          if (fromIndex === targetIndex) return;
          nextFromPanel = {
            ...fromPanel,
            containers: arrayMove(fromList, fromIndex, targetIndex),
          };
          nextToPanel = nextFromPanel;
        } else {
          const moved = moveChildAcrossParents({
            childId: containerId,
            fromParent: fromPanel,
            toParent: toPanel,
            childKey: "containers",
            toIndex: targetIndex,
          });
          if (!moved) return;
          nextFromPanel = moved.nextFromParent;
          nextToPanel = moved.nextToParent;
        }

        panelsDraftRef.current = draftPanels.map((p) =>
          p.id === nextFromPanel.id
            ? nextFromPanel
            : p.id === nextToPanel.id
            ? nextToPanel
            : p
        );

        // optimistic reducer update DURING drag (emit OFF)
        CommitHelpers.updatePanel({
          dispatch,
          socket,
          panel: nextFromPanel,
          emit: false,
        });
        if (nextToPanel.id !== nextFromPanel.id) {
          CommitHelpers.updatePanel({
            dispatch,
            socket,
            panel: nextToPanel,
            emit: false,
          });
        }

        scheduleSoftTick();
        return;
      }

      // ======================================================
      // ✅ INSTANCE DRAG
      // ======================================================
      if (activeRoleNow !== "instance") return;

      const overInfo = getOverParent(over, activeRoleNow);
      if (!overInfo || overInfo.parentRole !== "container") return;

      const draft = containersDraftRef.current;
      if (!draft) return;

      const instanceId = active.id;
      const fromContainer = findContainerByInstanceId(instanceId, draft);
      const toContainer = findContainerById(overInfo.parentId, draft);
      if (!fromContainer || !toContainer) return;

      // ✅ expose hotTarget for Panel highlight logic (need panelId for this container)
      {
        const draftPanels = getWorkingPanels() || [];
        const parentPanel = findPanelByContainerId(toContainer.id, draftPanels);
        setHotTarget({
          panelId: parentPanel?.id || null,
          containerId: toContainer.id,
          role: "instance",
        });
      }

      const overRole = over.data?.current?.role;
      if (overRole === "container") return; // hovering header zone => ignore

      const items = toContainer.items || [];
      const fromIndex = (fromContainer.items || []).indexOf(instanceId);
      if (fromIndex === -1) return;

      if (!frameRectsRef.current) {
        frameRectsRef.current = {
          activeRect: active.rect?.current?.translated,
          overRect: over.rect,
        };
        requestAnimationFrame(() => {
          frameRectsRef.current = null;
        });
      }

      const { activeRect, overRect } = frameRectsRef.current;

      const overInstanceId = overRole === "instance" ? over.id : null;

      if (overInstanceId) {
        const idx = items.indexOf(overInstanceId);
        if (idx === -1) return;

        const isBelow =
          activeRect && overRect
            ? activeRect.top > overRect.top + overRect.height / 2
            : false;

        const targetIndex = idx + (isBelow ? 1 : 0);

        const moveKey = `${fromContainer.id}|${toContainer.id}|${instanceId}|inst|${targetIndex}`;
        if (lastInstanceMoveRef.current === moveKey) return;
        lastInstanceMoveRef.current = moveKey;

        const moved =
          fromContainer.id === toContainer.id
            ? {
                nextFromParent: {
                  ...fromContainer,
                  items: arrayMove(items, fromIndex, targetIndex),
                },
              }
            : moveChildAcrossParents({
                childId: instanceId,
                fromParent: fromContainer,
                toParent: toContainer,
                childKey: "items",
                toIndex: targetIndex,
              });

        if (!moved) return;

        containersDraftRef.current = draft.map((c) =>
          c.id === moved.nextFromParent?.id
            ? moved.nextFromParent
            : c.id === moved.nextToParent?.id
            ? moved.nextToParent
            : c
        );

        scheduleSoftTick();
        return;
      }

      if (overRole === "container:list") {
        const pt = pointerRef?.current;
        if (!overRect || typeof pt?.y !== "number") return;

        const rel = (pt.y - overRect.top) / Math.max(1, overRect.height);
        const TOP = 0.25;
        const BOTTOM = 0.75;

        if (fromContainer.id === toContainer.id) {
          const lastIndex = Math.max(0, items.length - 1);

          if (rel <= TOP) {
            if (fromIndex === 0) return;

            const moveKey = `${fromContainer.id}|${toContainer.id}|${instanceId}|list|0`;
            if (lastInstanceMoveRef.current === moveKey) return;
            lastInstanceMoveRef.current = moveKey;

            containersDraftRef.current = draft.map((c) =>
              c.id === fromContainer.id
                ? { ...c, items: arrayMove(items, fromIndex, 0) }
                : c
            );
            scheduleSoftTick();
            return;
          }

          if (rel >= BOTTOM) {
            if (fromIndex === lastIndex) return;

            const moveKey = `${fromContainer.id}|${toContainer.id}|${instanceId}|list|${lastIndex}`;
            if (lastInstanceMoveRef.current === moveKey) return;
            lastInstanceMoveRef.current = moveKey;

            containersDraftRef.current = draft.map((c) =>
              c.id === fromContainer.id
                ? { ...c, items: arrayMove(items, fromIndex, lastIndex) }
                : c
            );
            scheduleSoftTick();
            return;
          }

          return;
        }

        const toIndex =
          rel <= TOP ? 0 : rel >= BOTTOM ? items.length : items.length;

        const moveKey = `${fromContainer.id}|${toContainer.id}|${instanceId}|list|${toIndex}`;
        if (lastInstanceMoveRef.current === moveKey) return;
        lastInstanceMoveRef.current = moveKey;

        const moved = moveChildAcrossParents({
          childId: instanceId,
          fromParent: fromContainer,
          toParent: toContainer,
          childKey: "items",
          toIndex,
        });

        if (!moved) return;

        containersDraftRef.current = draft.map((c) =>
          c.id === moved.nextFromParent?.id
            ? moved.nextFromParent
            : c.id === moved.nextToParent?.id
            ? moved.nextToParent
            : c
        );

        scheduleSoftTick();
      }
    },
    [
      dispatch,
      socket,
      scheduleSoftTick,
      overPanelId,
      getWorkingPanels,
      state.containers,
      state.panels,
      visiblePanels,
    ]
  );

  const onDragEnd = useCallback(
    (event) => {
      const role = event?.active?.data?.current?.role ?? activeRole;

      // clear UI state
      setActiveId(null);
      setActiveRole(null);
      dispatch(setActiveIdAction(null));
      dispatch(setActiveSizeAction(null));

      // ======================================================
      // ✅ PANEL drop + commit
      // ======================================================
      if (role === "panel") {
        const panelId = event?.active?.id;

        // ✅ draft-aware panel lookup
        const all = getWorkingPanels() || [];
        const panel = all.find((p) => p.id === panelId) || null;

        if (panel) {
          const live = pointerRef.current;
          const rc =
            typeof live?.x === "number" && typeof live?.y === "number"
              ? getCellFromPointer(live.x, live.y)
              : null;

          if (rc) {
            const stacks = getStacksByCell();
            const fromKey = cellKey(panel.row, panel.col);
            const toKey = cellKey(rc.row, rc.col);

            const targetStack = (stacks[toKey] || []).filter((p) => p.id !== panel.id);
            const updates = [];

            // hide target stack
            for (const p of targetStack) updates.push(setDisplay(p, "none"));

            // move + show
            const movedRaw = sanitizePanelPlacement(
              { ...panel, row: rc.row, col: rc.col, width: 1, height: 1 },
              rows,
              cols
            );
            const moved = setDisplay(movedRaw, "block");
            updates.push(moved);

            // ensure old cell has a visible panel if we moved away
            if (fromKey !== toKey) {
              const oldStack = (stacks[fromKey] || []).filter((p) => p.id !== panel.id);
              const oldVisible = oldStack.find((p) => getDisplay(p) !== "none") || null;
              if (!oldVisible && oldStack.length > 0) {
                updates.push(setDisplay(oldStack[0], "block"));
              }
            }

            // hard save
            commitPanelsBatch(updates, { emit: true });
          }
        }

        // reset panel UI
        pointerRef.current = { x: null, y: null };
        hoveredPanelIdRef.current = null;
        lastCellRef.current = null;
        setPanelOverCellId(null);

        // reset injected hover state
        overDataRef.current = null;
        setOverPanelId(null);
        setHotTarget(null);

        requestAnimationFrame(() => setPanelDragging(false));

        // clear drafts too
        containersDraftRef.current = null;
        panelsDraftRef.current = null;
        panelsStartRef.current = null;

        lastInstanceMoveRef.current = null;
        lastContainerMoveRef.current = null;
        frameRectsRef.current = null;

        scheduleSoftTick();
        return;
      }

      // ======================================================
      // ✅ Commit container.items changes (instances)
      // ======================================================
      const draft = containersDraftRef.current;
      if (draft) {
        for (const next of draft) {
          const prev = (state.containers || []).find((c) => c.id === next.id);
          if (!itemsEqual(prev?.items, next.items)) {
            CommitHelpers.updateContainer({
              dispatch,
              socket,
              container: { id: next.id, items: next.items },
              emit: true,
            });
          }
        }
      }

      // ======================================================
      // ✅ Commit panel.containers changes (containers)
      // ======================================================
      const startPanels = panelsStartRef.current;
      const endPanels = panelsDraftRef.current;
      if (startPanels && endPanels) {
        for (const end of endPanels) {
          const start = startPanels.find((p) => p.id === end.id);
          const a = start?.containers || [];
          const b = end?.containers || [];
          if (!itemsEqual(a, b)) {
            CommitHelpers.updatePanel({
              dispatch,
              socket,
              panel: { ...end, containers: b },
              emit: true,
            });
          }
        }
      }

      // reset everything
      containersDraftRef.current = null;
      panelsDraftRef.current = null;
      panelsStartRef.current = null;

      lastInstanceMoveRef.current = null;
      lastContainerMoveRef.current = null;

      frameRectsRef.current = null;

      pointerRef.current = { x: null, y: null };
      hoveredPanelIdRef.current = null;
      lastCellRef.current = null;
      setPanelOverCellId(null);

      setPanelDragging(false);

      // reset injected hover state
      overDataRef.current = null;
      setOverPanelId(null);
      setHotTarget(null);

      scheduleSoftTick();
    },
    [
      activeRole,
      dispatch,
      socket,
      state.containers,
      getWorkingPanels,
      getStacksByCell,
      rows,
      cols,
      getCellFromPointer,
      commitPanelsBatch,
      scheduleSoftTick,
    ]
  );

  // Keep preview cell updated while dragging panels
  useEffect(() => {
    if (!panelDragging || activeRole !== "panel") return;
    updatePanelOverCellFromPointer();
  }, [panelDragging, activeRole, updatePanelOverCellFromPointer]);

  // -----------------------------
  // public API
  // -----------------------------
  return useMemo(
    () => ({
      // wiring
      sensors,
      collisionDetection,
      onDragStart,
      onDragMove,
      onDragOver,
      onDragEnd,
      onDragCancel,

      // ui state
      activeId,
      activeRole,
      panelDragging,
      panelOverCellId,

      // data
      getWorkingContainers,
      getWorkingPanels,

      // ✅ stack exposure back to Panel (via Grid props)
      getStacksByCell,
      getStackForPanel,
      cyclePanelStack,
      setActivePanelInCell,

      // refs if you want to debug
      pointerRef,
      hoveredPanelIdRef,
      containersDraftRef,
      panelsDraftRef,

      // ✅ injected hover/hot state
      overPanelId,
      overDataRef,
      hotTarget,
      isContainerDrag: activeRole === "container",
      isInstanceDrag: activeRole === "instance",
    }),
    [
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
      getStacksByCell,
      getStackForPanel,
      cyclePanelStack,
      setActivePanelInCell,
      overPanelId,
      hotTarget,
    ]
  );
}
