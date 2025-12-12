// dnd/useDndReorderCoordinator.js
import { useCallback, useMemo, useRef } from "react";
import {
  addContainerAction,
  addInstanceToContainerAction,
  setActiveIdAction,
  setActiveSizeAction,
  setContainersAction,
  setDebugEventAction,
  softTickAction,
} from "../state/actions";

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
  return containers.map((c) => ({ ...c, items: [...c.items] }));
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
          data: activeData,
        }
      : null,
    over: o
      ? {
          id: o.id,
          role: overData?.role ?? null,
          containerId: overData?.containerId ?? null,
          data: overData,
        }
      : null,
  };
}

function getOverContainerId(over) {
  if (!over) return null;

  // preferred: explicit data
  const cid = over.data?.current?.containerId;
  if (cid) return cid;

  // fallback: parse droppable id patterns (list:/top:/bottom:)
  if (typeof over.id === "string") {
    if (over.id.startsWith("list:")) return over.id.slice("list:".length);
    if (over.id.startsWith("top:")) return over.id.slice("top:".length);
    if (over.id.startsWith("bottom:")) return over.id.slice("bottom:".length);
  }

  return null;
}

function findContainerByInstanceId(instanceId, list) {
  return list.find((c) => c.items.includes(instanceId));
}

// ---------- hook ----------
export function useDndReorderCoordinator({ state, dispatch }) {
  // soft-sort draft ref (kept out of reducer on purpose)
  const containersDraftRef = useRef(null);

  // throttle debugEvent (only update when meaningful change)
  const lastOverRef = useRef({
    activeId: null,
    overId: null,
    overRole: null,
    overContainerId: null,
  });

  const addContainer = useCallback(() => {
    const id = uid();
    dispatch(addContainerAction({ id, label: `List ${state.containers.length + 1}` }));
  }, [dispatch, state.containers.length]);

  const addInstanceToContainer = useCallback(
    (containerId) => {
      const instanceId = uid();
      dispatch(
        addInstanceToContainerAction({
          containerId,
          instance: { id: instanceId, label: `Item ${state.instances.length + 1}` },
        })
      );
    },
    [dispatch, state.instances.length]
  );

  const getWorkingContainers = useCallback(() => {
    return containersDraftRef.current ?? state.containers;
  }, [state.containers]);

  const handleDragStart = useCallback(
    (event) => {
      dispatch(setDebugEventAction(pickEvent(event, "start")));
      dispatch(setActiveIdAction(event.active.id));

      const rect = event.active.rect?.current?.initial;
      if (rect) dispatch(setActiveSizeAction({ width: rect.width, height: rect.height }));

      // start draft snapshot
      containersDraftRef.current = deepCloneContainers(state.containers);

      // reset debug throttle baseline
      lastOverRef.current = {
        activeId: event.active.id,
        overId: null,
        overRole: null,
        overContainerId: null,
      };

      dispatch(softTickAction());
    },
    [dispatch, state.containers]
  );

  const handleDragCancel = useCallback(() => {
    dispatch(setDebugEventAction({ type: "cancel", ts: Date.now() }));
    dispatch(setActiveIdAction(null));
    dispatch(setActiveSizeAction(null));

    containersDraftRef.current = null;
    dispatch(softTickAction());
  }, [dispatch]);

  const handleDragOver = useCallback(
    (event) => {
      console.log("dragover:start");

      const { active, over } = event;
      if (!over) return;

      // ---- throttle debugEvent (only if meaningful change) ----
      const nextOverRole = over.data.current?.role ?? null;
      const nextOverContainerId =
        over.data.current?.containerId ?? (typeof over.id === "string" ? over.id : null);

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

      const draft = containersDraftRef.current;
      if (!draft) return;

      const activeRole = active.data.current?.role;
      const overRole = nextOverRole;

      // A) Dragging a CONTAINER (still disabled)
      if (activeRole === "container") return;

      // B) Dragging an INSTANCE (sortable + cross-container)
      if (activeRole !== "instance") return;

      const instanceId = active.id;

      const fromContainer = findContainerByInstanceId(instanceId, draft);
      if (!fromContainer) return;

      const toContainerId = getOverContainerId(over);
      if (!toContainerId) return;

      const toContainer = draft.find((c) => c.id === toContainerId);
      if (!toContainer) return;

      const fromId = fromContainer.id;
      const toId = toContainer.id;

      const fromIndex = fromContainer.items.indexOf(instanceId);
      if (fromIndex === -1) return;

      const isOverInstance = overRole === "instance";
      const overInstanceId = isOverInstance ? over.id : null;

      // compute base toIndex
      let toIndex;
      if (!overInstanceId) {
        toIndex = toContainer.items.length;
      } else {
        const idx = toContainer.items.indexOf(overInstanceId);
        toIndex = idx >= 0 ? idx : toContainer.items.length;

        // 👇 midpoint logic (insert after when dragging downward)
        const activeRect = active.rect.current.translated;
        const overRect = over.rect;

        const isBelow =
          activeRect && overRect
            ? activeRect.top > overRect.top + overRect.height / 2
            : false;

        toIndex = toIndex + (isBelow ? 1 : 0);
      }

      // -----------------------------
      // Guards
      // -----------------------------
      if (fromId === toId && !overInstanceId) return;
      if (overInstanceId === instanceId) return;

      // -----------------------------
      // Same container reorder
      // -----------------------------
      if (fromId === toId) {
        if (toIndex === fromIndex) return;

        const nextItems = arrayMove(fromContainer.items, fromIndex, toIndex);

        containersDraftRef.current = draft.map((c) =>
          c.id === fromId ? { ...c, items: nextItems } : c
        );

        dispatch(softTickAction());
        console.log("dragover:end");
        return;
      }

      // -----------------------------
      // Cross-container move
      // -----------------------------
      const nextFromItems = fromContainer.items.filter((id) => id !== instanceId);

      const clamped = Math.max(0, Math.min(toContainer.items.length, toIndex));
      const nextToItems = [...toContainer.items];
      nextToItems.splice(clamped, 0, instanceId);

      containersDraftRef.current = draft.map((c) => {
        if (c.id === fromId) return { ...c, items: nextFromItems };
        if (c.id === toId) return { ...c, items: nextToItems };
        return c;
      });

      dispatch(softTickAction());
      console.log("dragover:end");
    },
    [dispatch]
  );

  const handleDragEnd = useCallback(
    (event) => {
      dispatch(setDebugEventAction(pickEvent(event, "end")));

      const { over } = event;

      dispatch(setActiveIdAction(null));
      dispatch(setActiveSizeAction(null));

      // if no drop target, revert
      if (!over) {
        containersDraftRef.current = null;
        dispatch(softTickAction());
        return;
      }

      // commit draft if present
      if (containersDraftRef.current) {
        dispatch(setContainersAction(containersDraftRef.current));
        containersDraftRef.current = null;
        dispatch(softTickAction());
      }
    },
    [dispatch]
  );

  return useMemo(
    () => ({
      // creators
      addContainer,
      addInstanceToContainer,

      // handlers
      handleDragStart,
      handleDragOver,
      handleDragEnd,
      handleDragCancel,

      // draft + helpers
      containersDraftRef,
      getWorkingContainers,
    }),
    [
      addContainer,
      addInstanceToContainer,
      handleDragStart,
      handleDragOver,
      handleDragEnd,
      handleDragCancel,
      getWorkingContainers,
    ]
  );
}
