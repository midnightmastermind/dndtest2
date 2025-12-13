// dnd/useDndReorderCoordinator.js
import { useCallback, useMemo, useRef } from "react";
import {
  createContainerAction,
  createInstanceInContainerAction,
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
function itemsEqual(a = [], b = []) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ---------- hook ----------
export function useDndReorderCoordinator({ state, dispatch, socket }) {
  // soft-sort draft ref (kept out of reducer on purpose)
  const containersDraftRef = useRef(null);

  const lastOverRef = useRef({
    activeId: null,
    overId: null,
    overRole: null,
    overContainerId: null,
  });

  const addContainer = useCallback(() => {
    const id = uid();
    const label = `List ${state.containers.length + 1}`;

    // optimistic UI
    dispatch(createContainerAction({ id, label }));

    // persist
    socket?.emit("create_container", { container: { id, label } });
  }, [dispatch, socket, state.containers.length]);

  const createInstanceInContainer = useCallback(
    (containerId) => {
      const id = uid();
      const label = `Item ${state.instances.length + 1}`;

      // optimistic UI
      dispatch(
        createInstanceInContainerAction({
          containerId,
          instance: { id, label },
        })
      );

      // persist
      socket?.emit("create_instance_in_container", {
        containerId,
        instance: { id, label },
      });
    },
    [dispatch, socket, state.instances.length]
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

      containersDraftRef.current = deepCloneContainers(state.containers);

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

      if (activeRole === "container") return;
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

      let toIndex;
      if (!overInstanceId) {
        toIndex = toContainer.items.length;
      } else {
        const idx = toContainer.items.indexOf(overInstanceId);
        toIndex = idx >= 0 ? idx : toContainer.items.length;

        const activeRect = active.rect.current.translated;
        const overRect = over.rect;
        const isBelow =
          activeRect && overRect
            ? activeRect.top > overRect.top + overRect.height / 2
            : false;

        toIndex = toIndex + (isBelow ? 1 : 0);
      }

      if (fromId === toId && !overInstanceId) return;
      if (overInstanceId === instanceId) return;

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

      if (!over) {
        containersDraftRef.current = null;
        dispatch(softTickAction());
        return;
      }

      const draft = containersDraftRef.current;

      // commit locally + persist
      if (draft) {
        dispatch(setContainersAction(draft));

        // emit ONLY containers that changed
        const prev = state.containers;
        for (const nextC of draft) {
          const prevC = prev.find((c) => c.id === nextC.id);
          const prevItems = prevC?.items ?? [];
          if (!itemsEqual(prevItems, nextC.items)) {
            socket?.emit("update_container_items", {
              containerId: nextC.id,
              items: nextC.items,
            });
          }
        }

        containersDraftRef.current = null;
        dispatch(softTickAction());
      }
    },
    [dispatch, socket, state.containers]
  );

  return useMemo(
    () => ({
      addContainer,
      createInstanceInContainer,
      handleDragStart,
      handleDragOver,
      handleDragEnd,
      handleDragCancel,
      containersDraftRef,
      getWorkingContainers,
    }),
    [
      addContainer,
      createInstanceInContainer,
      handleDragStart,
      handleDragOver,
      handleDragEnd,
      handleDragCancel,
      getWorkingContainers,
    ]
  );
}