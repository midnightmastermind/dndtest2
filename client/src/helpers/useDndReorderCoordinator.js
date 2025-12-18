// helpers/useDndReorderCoordinator.js
import { useCallback, useMemo, useRef, useEffect } from "react";
import {
  setActiveIdAction,
  setActiveSizeAction,
  setContainersAction,
  softTickAction,
  updatePanelAction,
} from "../state/actions";

const ACCEPTS = {
  panel: ["container"],
  container: ["instance"],
};

function arrayMove(arr, from, to) {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function deepCloneContainers(containers) {
  return (containers || []).map((c) => ({ ...c, items: [...(c.items || [])] }));
}

function itemsEqual(a = [], b = []) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
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

function getOverParent(over, activeRole) {
  if (!over) return null;
  const d = over.data?.current || {};

  if (
    activeRole === "container" &&
    d?.panelId &&
    typeof d?.role === "string" &&
    d.role.startsWith("container:")
  ) {
    return { parentRole: "panel", parentId: d.panelId, overChildId: d.containerId };
  }

  if (d?.containerId && typeof d?.role === "string" && d.role.startsWith("container:")) {
    return { parentRole: "container", parentId: d.containerId };
  }

  if (d?.role === "instance" && d?.containerId) {
    return { parentRole: "container", parentId: d.containerId, overChildId: over.id };
  }

  if (d?.role === "panel:drop" && d?.panelId) {
    return { parentRole: "panel", parentId: d.panelId };
  }

  if (d?.role === "container" && d?.panelId) {
    return { parentRole: "panel", parentId: d.panelId, overChildId: over.id };
  }

  return null;
}

export function useDndReorderCoordinator({
  state,
  dispatch,
  socket,
  pointerRef,
  scheduleSoftTick: scheduleSoftTickExternal,
}) {
  const containersDraftRef = useRef(null);

  const lastContainerMoveRef = useRef({
    fromPanelId: null,
    toPanelId: null,
    activeContainerId: null,
    overChildId: null,
  });

  const touchedPanelsRef = useRef(new Set());
  const touchedPanelsMapRef = useRef(new Map());

  const hoverIntentRef = useRef({ key: null, t0: 0 });

  const getWorkingContainers = useCallback(() => {
    return containersDraftRef.current ?? state.containers;
  }, [state.containers]);

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

  const handleDragStart = useCallback(
    (event) => {
      dispatch(setActiveIdAction(event.active.id));

      const rect = event.active.rect?.current?.initial;
      if (rect) dispatch(setActiveSizeAction({ width: rect.width, height: rect.height }));

      containersDraftRef.current = deepCloneContainers(state.containers);

      lastContainerMoveRef.current = {
        fromPanelId: null,
        toPanelId: null,
        activeContainerId: null,
        overChildId: null,
      };

      touchedPanelsRef.current = new Set();
      touchedPanelsMapRef.current = new Map();

      hoverIntentRef.current = { key: null, t0: 0 };

      scheduleSoftTick();
    },
    [dispatch, state.containers, scheduleSoftTick]
  );

  const handleDragCancel = useCallback(() => {
    dispatch(setActiveIdAction(null));
    dispatch(setActiveSizeAction(null));

    containersDraftRef.current = null;
    touchedPanelsRef.current = new Set();
    touchedPanelsMapRef.current = new Map();

    hoverIntentRef.current = { key: null, t0: 0 };

    scheduleSoftTick();
  }, [dispatch, scheduleSoftTick]);

  const handleDragOver = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over) return;

      const activeRole = active.data?.current?.role ?? null;
      if (activeRole !== "container" && activeRole !== "instance") return;

      if (activeRole === "instance" && over?.data?.current?.role === "panel:drop") return;

      const overInfo = getOverParent(over, activeRole);
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
        const overInstanceId = overRole === "instance" ? over.id : null;

        const fromId = fromContainer.id;
        const toId = toContainer.id;

        if (overRole === "container") return;

        const fromIndex = (fromContainer.items || []).indexOf(instanceId);
        if (fromIndex === -1) return;

        if (fromId === toId) {
          const items = fromContainer.items || [];
          const lastIndex = Math.max(0, items.length - 1);

          if (overRole === "container:top") {
            if (fromIndex === 0) return;
            const nextItems = arrayMove(items, fromIndex, 0);
            containersDraftRef.current = draft.map((c) =>
              c.id === fromId ? { ...c, items: nextItems } : c
            );
            scheduleSoftTick();
            return;
          }

          if (overRole === "container:bottom") {
            if (fromIndex === lastIndex) return;
            const nextItems = arrayMove(items, fromIndex, lastIndex);
            containersDraftRef.current = draft.map((c) =>
              c.id === fromId ? { ...c, items: nextItems } : c
            );
            scheduleSoftTick();
            return;
          }

          if (overRole === "container:list" && !overInstanceId) return;

          if (overInstanceId) {
            if (overInstanceId === instanceId) return;

            const overRect = over.rect;
            if (!overRect) return;

            const pointerY = pointerRef?.current?.y;
            const midY = overRect.top + overRect.height / 2;
            const isBelow = typeof pointerY === "number" ? pointerY > midY : false;

            const withoutActive = items.filter((id) => id !== instanceId);
            const overIndex = withoutActive.indexOf(overInstanceId);
            if (overIndex === -1) return;

            const insertIndex = overIndex + (isBelow ? 1 : 0);

            const nextItems = [...withoutActive];
            nextItems.splice(insertIndex, 0, instanceId);

            if (itemsEqual(items, nextItems)) return;

            containersDraftRef.current = draft.map((c) =>
              c.id === fromId ? { ...c, items: nextItems } : c
            );

            scheduleSoftTick();
            return;
          }

          return;
        }

        let toIndex = null;

        if (overRole === "container:top") {
          toIndex = 0;
        } else if (overRole === "container:bottom") {
          toIndex = (toContainer.items || []).length;
        } else if (overInstanceId) {
          const idx = (toContainer.items || []).indexOf(overInstanceId);
          toIndex = idx >= 0 ? idx : (toContainer.items || []).length;

          const overRect = over.rect;
          const pointerY = pointerRef?.current?.y;
          const midY = overRect ? overRect.top + overRect.height / 2 : null;
          const isBelow =
            typeof pointerY === "number" && typeof midY === "number" ? pointerY > midY : false;

          toIndex = toIndex + (isBelow ? 1 : 0);
        } else {
          toIndex = null;
        }

        if (toIndex == null) toIndex = (toContainer.items || []).length;

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

        if (fromPanel.id === toPanel.id && !overInfo.overChildId) return;

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

        if (fromPanel.id === toPanel.id && overInfo.overChildId) {
          const ids = fromPanel.containers || [];
          const fromIndex = ids.indexOf(activeContainerId);
          const hoverIndex = ids.indexOf(overInfo.overChildId);
          if (fromIndex === -1 || hoverIndex === -1) return;
          if (fromIndex === hoverIndex) return;

          const nextIds = arrayMove(ids, fromIndex, hoverIndex);
          const updated = { ...fromPanel, containers: nextIds };

          dispatch(updatePanelAction(updated));
          touchedPanelsRef.current.add(fromPanel.id);
          touchedPanelsMapRef.current.set(fromPanel.id, updated);

          scheduleSoftTick();
          return;
        }

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

        touchedPanelsMapRef.current.set(moved.nextFromParent.id, moved.nextFromParent);
        touchedPanelsMapRef.current.set(moved.nextToParent.id, moved.nextToParent);

        scheduleSoftTick();
        return;
      }
    },
    [dispatch, state.panels, scheduleSoftTick, pointerRef]
  );

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      const activeRole = active?.data?.current?.role ?? null;

      dispatch(setActiveIdAction(null));
      dispatch(setActiveSizeAction(null));

      hoverIntentRef.current.key = null;
      hoverIntentRef.current.t0 = 0;

      if (activeRole === "container") {
        if (!over) return;

        const touched = Array.from(touchedPanelsRef.current || []);
        for (const panelId of touched) {
          const panel = touchedPanelsMapRef.current.get(panelId);
          if (panel) socket?.emit("update_panel", { panel, gridId: panel.gridId });
        }

        touchedPanelsRef.current = new Set();
        touchedPanelsMapRef.current = new Map();
        return;
      }

      if (!over) {
        containersDraftRef.current = null;
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
        scheduleSoftTick();
      }
    },
    [dispatch, socket, state.containers, scheduleSoftTick]
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