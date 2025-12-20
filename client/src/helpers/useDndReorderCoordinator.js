// helpers/useDndReorderCoordinator.js
import { useCallback, useMemo, useRef, useEffect } from "react";
import {
  setActiveIdAction,
  setActiveSizeAction,
  setContainersAction,
  softTickAction,
  updatePanelAction, // (kept even if unused in this trimmed version)
} from "../state/actions";

// ✅ Schema: who accepts what
const ACCEPTS = {
  panel: ["container"],
  container: ["instance"],
};

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

/**
 * Normalizes over into:
 *   { parentRole: "panel"|"container", parentId, overChildId? }
 *
 * (This trimmed version only returns container targets)
 */
function getOverParent(over, activeRole) {
  if (!over) return null;
  const d = over.data?.current || {};

  if (
    d?.containerId &&
    typeof d?.role === "string" &&
    d.role.startsWith("container:")
  ) {
    return { parentRole: "container", parentId: d.containerId };
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

// ---------- hook ----------
export function useDndReorderCoordinator({
  state,
  dispatch,
  socket,
  scheduleSoftTick: scheduleSoftTickExternal,
  pointerRef,
}) {
  const containersDraftRef = useRef(null);

  // 🔥 ACTUALLY USED NOW
  const lastInstanceMoveRef = useRef(null);

  // 🔥 cache geometry per frame
  const frameRectsRef = useRef(null);

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
      if (rect) {
        dispatch(setActiveSizeAction({ width: rect.width, height: rect.height }));
      }

      containersDraftRef.current = deepCloneContainers(state.containers);
      lastInstanceMoveRef.current = null;
      frameRectsRef.current = null;

      scheduleSoftTick();
    },
    [dispatch, state.containers, scheduleSoftTick]
  );

  const handleDragCancel = useCallback(() => {
    dispatch(setActiveIdAction(null));
    dispatch(setActiveSizeAction(null));
    containersDraftRef.current = null;
    lastInstanceMoveRef.current = null;
    frameRectsRef.current = null;
    scheduleSoftTick();
  }, [dispatch, scheduleSoftTick]);

  const handleDragOver = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over) return;

      const activeRole = active.data?.current?.role;
      if (activeRole !== "instance") return;

      const overInfo = getOverParent(over, activeRole);
      if (!overInfo || overInfo.parentRole !== "container") return;

      const draft = containersDraftRef.current;
      if (!draft) return;

      const instanceId = active.id;
      const fromContainer = findContainerByInstanceId(instanceId, draft);
      const toContainer = findContainerById(overInfo.parentId, draft);
      if (!fromContainer || !toContainer) return;

      const overRole = over.data?.current?.role;
      if (overRole === "container") return; // hovering header zone => ignore

      const items = toContainer.items || [];
      const fromIndex = (fromContainer.items || []).indexOf(instanceId);
      if (fromIndex === -1) return;

      // ---------- cache rects once per frame ----------
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

      // ---------- hovering another instance ----------
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

      // ---------- container:list empty space ----------
      if (overRole === "container:list") {
        const pt = pointerRef?.current;
        if (!overRect || typeof pt?.y !== "number") return;

        const rel = (pt.y - overRect.top) / Math.max(1, overRect.height);
        const TOP = 0.25;
        const BOTTOM = 0.75;

        // ✅ SAME-CONTAINER:
        // - top zone => move to 0
        // - bottom zone => move to end
        // - middle => do nothing
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

          // middle => do nothing (prevents snap-to-end)
          return;
        }

        // ✅ CROSS-CONTAINER:
        // - top zone => insert at 0
        // - bottom zone => insert at end
        // - middle => ALSO insert at end (this is what fixes empty containers)
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
    [dispatch, state.containers, scheduleSoftTick, pointerRef]
  );

  const handleDragEnd = useCallback(
    () => {
      dispatch(setActiveIdAction(null));
      dispatch(setActiveSizeAction(null));

      const draft = containersDraftRef.current;
      if (!draft) return;

      dispatch(setContainersAction(draft));

      for (const next of draft) {
        const prev = state.containers.find((c) => c.id === next.id);
        if (!itemsEqual(prev?.items, next.items)) {
          socket?.emit("update_container_items", {
            containerId: next.id,
            items: next.items,
          });
        }
      }

      containersDraftRef.current = null;
      lastInstanceMoveRef.current = null;
      frameRectsRef.current = null;
      scheduleSoftTick();
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
    [
      handleDragStart,
      handleDragOver,
      handleDragEnd,
      handleDragCancel,
      getWorkingContainers,
    ]
  );
}
