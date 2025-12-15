import { useCallback, useMemo, useRef, useEffect } from "react";
import {
  createContainerAction,
  createInstanceInContainerAction,
  setActiveIdAction,
  setActiveSizeAction,
  setContainersAction,
  setDebugEventAction,
  softTickAction,
  updatePanelAction,
} from "../state/actions";

// ✅ Schema: who accepts what
const ACCEPTS = {
  panel: ["container"],
  container: ["instance"],
};

// ---------- utilities ----------
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function arrayMove(arr, from, to) {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function deepCloneContainers(containers) {
  return (containers || []).map((c) => ({ ...c, items: [...(c.items || [])] }));
}

// ✅ Safe event snapshot for debug UI (no circular refs)
function pickEvent(event, type) {
  const a = event?.active;
  const o = event?.over;

  const activeData = a?.data?.current || null;
  const overData = o?.data?.current || null;

  return {
    type,
    ts: Date.now(),
    active: a
      ? {
          id: a.id,
          role: activeData?.role ?? null,
          containerId: activeData?.containerId ?? null,
          panelId: activeData?.panelId ?? null,
          data: activeData,
        }
      : null,
    over: o
      ? {
          id: o.id,
          role: overData?.role ?? null,
          containerId: overData?.containerId ?? null,
          panelId: overData?.panelId ?? null,
          data: overData,
        }
      : null,
  };
}

function itemsEqual(a = [], b = []) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ---------- generic list move helpers ----------
function removeOne(list = [], id) {
  const idx = list.indexOf(id);
  if (idx === -1) return { list, idx: -1 };
  const next = [...list];
  next.splice(idx, 1);
  return { list: next, idx };
}

function insertAt(list = [], id, index) {
  const next = [...list];
  const clamped = Math.max(0, Math.min(next.length, index));
  next.splice(clamped, 0, id);
  return next;
}

function moveChildAcrossParents({ childId, fromParent, toParent, childKey, toIndex = null }) {
  if (!fromParent || !toParent) return null;

  const rawFrom = fromParent[childKey] || [];
  const rawTo = toParent[childKey] || [];

  const fromHad = rawFrom.includes(childId);

  // ✅ remove from BOTH sides first to prevent duplicates during dragOver spam
  const fromList = rawFrom.filter((x) => x !== childId);
  const toList = rawTo.filter((x) => x !== childId);

  // If it's a true cross-parent move, and the source didn't actually have it, bail
  if (fromParent.id !== toParent.id && !fromHad) return null;

  const insertIndex = toIndex == null ? toList.length : toIndex;
  const toNext = insertAt(toList, childId, insertIndex);

  return {
    nextFromParent: { ...fromParent, [childKey]: fromList },
    nextToParent: { ...toParent, [childKey]: toNext },
  };
}

// ---------- parent finders ----------
function findPanelById(panelId, panels = []) {
  return (panels || []).find((p) => p.id === panelId) || null;
}

function findPanelByContainerId(containerId, panels = []) {
  return (panels || []).find((p) => (p.containers || []).includes(containerId)) || null;
}

function findContainerByInstanceId(instanceId, list = []) {
  return (list || []).find((c) => (c.items || []).includes(instanceId)) || null;
}

function findContainerById(containerId, list = []) {
  return (list || []).find((c) => c.id === containerId) || null;
}

function canDropInto(parentRole, childRole) {
  return (ACCEPTS[parentRole] || []).includes(childRole);
}

/**
 * Normalizes over into:
 *   { parentRole: "panel"|"container", parentId, overChildId? }
 */
function getOverParent(over) {
  if (!over) return null;
  const d = over.data?.current || {};

  // ✅ Container list/top/bottom => parent is container
  if (d?.containerId && typeof d?.role === "string" && d.role.startsWith("container:")) {
    return { parentRole: "container", parentId: d.containerId };
  }

  // ✅ Hovering an instance => parent is container
  if (d?.role === "instance" && d?.containerId) {
    return { parentRole: "container", parentId: d.containerId, overChildId: over.id };
  }

  // ✅ Panel dropzone => parent is panel
  if (d?.role === "panel:drop" && d?.panelId) {
    return { parentRole: "panel", parentId: d.panelId };
  }

  // ✅ Hovering a container tile => parent is panel (insert relative to that container)
  if (d?.role === "container" && d?.panelId) {
    return { parentRole: "panel", parentId: d.panelId, overChildId: over.id };
  }

  return null;
}

// ---------- hook ----------
export function useDndReorderCoordinator({ state, dispatch, socket }) {
  // instance soft-sort draft ref (kept out of reducer on purpose)
  const containersDraftRef = useRef(null);

  const lastOverRef = useRef({
    activeId: null,
    overId: null,
    overRole: null,
    overContainerId: null,
  });

  // ✅ de-dupe spam for panel container moves
  const lastContainerMoveRef = useRef({
    fromPanelId: null,
    toPanelId: null,
    activeContainerId: null,
    overChildId: null,
  });

  // ✅ track which panels were touched, so dragEnd persists once
  const touchedPanelsRef = useRef(new Set());

  const getWorkingContainers = useCallback(() => {
    return containersDraftRef.current ?? state.containers;
  }, [state.containers]);

  // ✅ throttle softTick to once per animation frame
  const softTickRafRef = useRef(0);

  const scheduleSoftTick = useCallback(() => {
    if (softTickRafRef.current) return;
    softTickRafRef.current = requestAnimationFrame(() => {
      softTickRafRef.current = 0;
      dispatch(softTickAction());
    });
  }, [dispatch]);

  useEffect(() => {
    return () => {
      if (softTickRafRef.current) cancelAnimationFrame(softTickRafRef.current);
    };
  }, []);

  const handleDragStart = useCallback(
    (event) => {
      dispatch(setDebugEventAction(pickEvent(event, "start")));
      dispatch(setActiveIdAction(event.active.id));

      const rect = event.active.rect?.current?.initial;
      if (rect) dispatch(setActiveSizeAction({ width: rect.width, height: rect.height }));

      containersDraftRef.current = deepCloneContainers(state.containers);

      lastOverRef.current = {
        activeId: event.active.id,
        overId: null,
        overRole: null,
        overContainerId: null,
      };

      lastContainerMoveRef.current = {
        fromPanelId: null,
        toPanelId: null,
        activeContainerId: null,
        overChildId: null,
      };

      touchedPanelsRef.current = new Set();

      // ✅ CHANGED
      scheduleSoftTick();
    },
    [dispatch, state.containers, scheduleSoftTick]
  );

  const handleDragCancel = useCallback(() => {
    dispatch(setDebugEventAction({ type: "cancel", ts: Date.now() }));
    dispatch(setActiveIdAction(null));
    dispatch(setActiveSizeAction(null));

    containersDraftRef.current = null;
    touchedPanelsRef.current = new Set();

    // ✅ CHANGED
    scheduleSoftTick();
  }, [dispatch, scheduleSoftTick]);

  const handleDragOver = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over) return;

      const nextOverRole = over.data?.current?.role ?? null;
      const nextOverContainerId = over.data?.current?.containerId ?? null;

      const last = lastOverRef.current;
      const sameOver =
        last.activeId === active.id &&
        last.overId === over.id &&
        last.overRole === nextOverRole &&
        last.overContainerId === nextOverContainerId;

      if (!sameOver) {
        lastOverRef.current = {
          activeId: active.id,
          overId: over.id,
          overRole: nextOverRole,
          overContainerId: nextOverContainerId,
        };
        dispatch(setDebugEventAction(pickEvent(event, "over")));
      }

      const activeRole = active.data?.current?.role ?? null;
      if (activeRole !== "container" && activeRole !== "instance") return;

      const overInfo = getOverParent(over);
      if (!overInfo) return;

      if (!canDropInto(overInfo.parentRole, activeRole)) return;

      // ======================================================
      // INSTANCE -> CONTAINER (items)
      // ======================================================
      if (activeRole === "instance" && overInfo.parentRole === "container") {
        const draft = containersDraftRef.current;
        if (!draft) return;

        const instanceId = active.id;
        const fromContainer = findContainerByInstanceId(instanceId, draft);
        const toContainer = findContainerById(overInfo.parentId, draft);
        if (!fromContainer || !toContainer) return;

        const overRole = over.data?.current?.role ?? null;
        const isOverInstance = overRole === "instance";
        const overInstanceId = isOverInstance ? over.id : null;

        const fromId = fromContainer.id;
        const toId = toContainer.id;

        const fromIndex = (fromContainer.items || []).indexOf(instanceId);
        if (fromIndex === -1) return;

        // compute toIndex
        let toIndex;
        if (!overInstanceId) {
          toIndex = (toContainer.items || []).length;
        } else {
          const idx = (toContainer.items || []).indexOf(overInstanceId);
          toIndex = idx >= 0 ? idx : (toContainer.items || []).length;

          const activeRect = active.rect?.current?.translated;
          const overRect = over.rect;
          const isBelow =
            activeRect && overRect
              ? activeRect.top > overRect.top + overRect.height / 2
              : false;

          toIndex = toIndex + (isBelow ? 1 : 0);
        }

        if (fromId === toId && !overInstanceId) return;
        if (overInstanceId === instanceId) return;

        // same container reorder
        if (fromId === toId) {
          if (toIndex === fromIndex) return;
          const nextItems = arrayMove(fromContainer.items, fromIndex, toIndex);
          containersDraftRef.current = draft.map((c) =>
            c.id === fromId ? { ...c, items: nextItems } : c
          );

          // ✅ CHANGED
          scheduleSoftTick();
          return;
        }

        // cross-container move
        const moved = moveChildAcrossParents({
          childId: instanceId,
          fromParent: fromContainer,
          toParent: toContainer,
          childKey: "items",
          toIndex,
        });
        if (!moved) return;

        containersDraftRef.current = draft.map((c) => {
          if (c.id === moved.nextFromParent.id) return moved.nextFromParent;
          if (c.id === moved.nextToParent.id) return moved.nextToParent;
          return c;
        });

        // ✅ CHANGED
        scheduleSoftTick();
        return;
      }

      // ======================================================
      // CONTAINER -> PANEL (containers)
      // ======================================================
      if (activeRole === "container" && overInfo.parentRole === "panel") {
        const activeContainerId = active.id;

        const fromPanel =
          findPanelByContainerId(activeContainerId, state.panels || []) ||
          (active.data?.current?.panelId
            ? findPanelById(active.data.current.panelId, state.panels || [])
            : null);

        const toPanel = findPanelById(overInfo.parentId, state.panels || []);
        if (!fromPanel || !toPanel) return;

        if (fromPanel.id === toPanel.id && !overInfo.overChildId) {
          return;
        }

        let toIndex = null;
        if (overInfo.overChildId) {
          const idx = (toPanel.containers || []).indexOf(overInfo.overChildId);
          if (idx >= 0) toIndex = idx;
        }

        const lastM = lastContainerMoveRef.current;
        if (
          lastM.fromPanelId === fromPanel.id &&
          lastM.toPanelId === toPanel.id &&
          lastM.activeContainerId === activeContainerId &&
          lastM.overChildId === (overInfo.overChildId ?? null)
        ) {
          return;
        }
        lastContainerMoveRef.current = {
          fromPanelId: fromPanel.id,
          toPanelId: toPanel.id,
          activeContainerId,
          overChildId: overInfo.overChildId ?? null,
        };

        // same-panel reorder
        if (fromPanel.id === toPanel.id && overInfo.overChildId) {
          const ids = fromPanel.containers || [];
          const fromIndex = ids.indexOf(activeContainerId);
          const hoverIndex = ids.indexOf(overInfo.overChildId);
          if (fromIndex === -1 || hoverIndex === -1) return;
          if (fromIndex === hoverIndex) return;

          const nextIds = arrayMove(ids, fromIndex, hoverIndex);
          dispatch(updatePanelAction({ ...fromPanel, containers: nextIds }));
          touchedPanelsRef.current.add(fromPanel.id);

          // ✅ CHANGED
          scheduleSoftTick();
          return;
        }

        // cross-panel move
        const moved = moveChildAcrossParents({
          childId: activeContainerId,
          fromParent: fromPanel,
          toParent: toPanel,
          childKey: "containers",
          toIndex,
        });
        if (!moved) return;

        dispatch(updatePanelAction(moved.nextFromParent));
        dispatch(updatePanelAction(moved.nextToParent));

        touchedPanelsRef.current.add(moved.nextFromParent.id);
        touchedPanelsRef.current.add(moved.nextToParent.id);

        // ✅ CHANGED
        scheduleSoftTick();
        return;
      }
    },
    [dispatch, state.panels, scheduleSoftTick]
  );

  const handleDragEnd = useCallback(
    (event) => {
      dispatch(setDebugEventAction(pickEvent(event, "end")));

      const { active, over } = event;
      const activeRole = active?.data?.current?.role ?? null;

      dispatch(setActiveIdAction(null));
      dispatch(setActiveSizeAction(null));

      // ======================================================
      // CONTAINER DROP END: persist touched panels
      // ======================================================
      if (activeRole === "container") {
        if (!over) return;

        const touched = Array.from(touchedPanelsRef.current || []);
        for (const panelId of touched) {
          const panel = (state.panels || []).find((p) => p.id === panelId);
          if (panel) socket?.emit("update_panel", { panel, gridId: panel.gridId });
        }

        touchedPanelsRef.current = new Set();
        return;
      }

      // ======================================================
      // INSTANCE DROP END: commit + persist diffs
      // ======================================================
      if (!over) {
        containersDraftRef.current = null;

        // ✅ CHANGED
        scheduleSoftTick();
        return;
      }

      const draft = containersDraftRef.current;

      if (draft) {
        dispatch(setContainersAction(draft));

        const prev = state.containers;
        for (const nextC of draft) {
          const prevC = (prev || []).find((c) => c.id === nextC.id);
          const prevItems = prevC?.items ?? [];
          if (!itemsEqual(prevItems, nextC.items)) {
            socket?.emit("update_container_items", {
              containerId: nextC.id,
              items: nextC.items,
            });
          }
        }

        containersDraftRef.current = null;

        // ✅ CHANGED
        scheduleSoftTick();
      }
    },
    [dispatch, socket, state.containers, state.panels, scheduleSoftTick]
  );

  return useMemo(
    () => ({
      handleDragStart,
      handleDragOver,
      handleDragEnd,
      handleDragCancel,
      containersDraftRef,
      getWorkingContainers,
    }),
    [handleDragStart, handleDragOver, handleDragEnd, handleDragCancel, getWorkingContainers]
  );
}