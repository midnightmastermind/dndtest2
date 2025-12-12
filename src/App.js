import React, { useMemo, useRef, useState, useCallback } from "react";
import Grid from "./Grid";
import { GridDataContext } from "./GridDataContext";
import { GridActionsContext } from "./GridActionsContext";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function useRenderCount(label) {
  const ref = React.useRef(0);
  ref.current += 1;
  console.log(`${label} render #${ref.current}`);
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

function DebugBar({ containers, containersDraft, activeId, debugEvent }) {
  return (
    <div
      style={{
        position: "relative",
        top: 0,
        zIndex: 999,
        background: "#0e1116",
        borderBottom: "1px solid #222",
        padding: "8px 12px",
        fontSize: 12,
        fontFamily: "monospace",
        color: "#9aa4b2",
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
      }}
      className="debugbar"
    >
      <div>
        <strong>activeId:</strong>{" "}
        <span style={{ color: "#fff" }}>{activeId ?? "null"}</span>
      </div>

      <div>
        <strong>debugEvent:</strong>{" "}
        <span style={{ color: "#fff" }}>{debugEvent?.type ?? "null"}</span>
      </div>

      <div>
        <strong>containers (state):</strong> {containers.length}
      </div>

      <div>
        <strong>draftRef:</strong>{" "}
        <span style={{ color: containersDraft ? "#4caf50" : "#f44336" }}>
          {containersDraft ? "ACTIVE" : "null"}
        </span>
      </div>

      <details style={{ cursor: "pointer" }}>
        <summary>event</summary>
        <pre style={{ whiteSpace: "pre-wrap", maxWidth: 700 }}>
          {JSON.stringify(debugEvent, null, 2)}
        </pre>
      </details>

      <details style={{ cursor: "pointer" }}>
        <summary>state</summary>
        <pre style={{ whiteSpace: "pre-wrap", maxWidth: 700 }}>
          {JSON.stringify(containers, null, 2)}
        </pre>
      </details>

      <details style={{ cursor: "pointer" }}>
        <summary>draft</summary>
        <pre style={{ whiteSpace: "pre-wrap", maxWidth: 700 }}>
          {JSON.stringify(containersDraft, null, 2)}
        </pre>
      </details>
    </div>
  );
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

export default function App() {
  // drag state
  const [activeId, setActiveId] = useState(null);
  const [activeSize, setActiveSize] = useState(null);

  // ✅ debug event snapshot state
  const [debugEvent, setDebugEvent] = useState(null);

  // data state
  const [containers, setContainers] = useState([]); // {id,label,items:[]}
  const [instances, setInstances] = useState([]); // {id,label}

  // soft-sort draft
  const containersDraftRef = useRef(null);
  const [softTick, setSoftTick] = useState(0);

  // throttle debugEvent (only update when meaningful change)
  const lastOverRef = useRef({
    activeId: null,
    overId: null,
    overRole: null,
    overContainerId: null,
  });

  // creators
  const addContainer = useCallback(() => {
    const id = uid();
    setContainers((prev) => [
      ...prev,
      { id, label: `List ${prev.length + 1}`, items: [] },
    ]);
  }, []);

  const addInstanceToContainer = useCallback((containerId) => {
    const instanceId = uid();

    setInstances((prev) => [
      ...prev,
      { id: instanceId, label: `Item ${prev.length + 1}` },
    ]);

    setContainers((prev) =>
      prev.map((c) =>
        c.id === containerId ? { ...c, items: [...c.items, instanceId] } : c
      )
    );
  }, []);

  // helpers
  function getOverContainerId(over) {
    if (!over) return null;

    const role = over.data?.current?.role ?? null;

    // preferred: explicit
    const cid = over.data?.current?.containerId;
    if (cid) return cid;

    // list:<id>
    if (typeof over.id === "string" && over.id.startsWith("list:")) {
      return over.id.slice("list:".length);
    }

    // sortable container itself
    if (role === "container") {
      return typeof over.id === "string" ? over.id : null;
    }

    return null;
  }

  const findContainerByInstanceId = useCallback((instanceId, list) => {
    return list.find((c) => c.items.includes(instanceId));
  }, []);

  const getWorkingContainers = () => containersDraftRef.current ?? containers;

  // -------------------------
  // Drag Handlers (App-owned)
  // -------------------------
  const handleDragStart = useCallback(
    (event) => {
      setDebugEvent(pickEvent(event, "start"));
      setActiveId(event.active.id);

      const rect = event.active.rect?.current?.initial;
      if (rect) setActiveSize({ width: rect.width, height: rect.height });

      containersDraftRef.current = deepCloneContainers(containers);
      setSoftTick((t) => t + 1);
    },
    [containers]
  );

  const handleDragCancel = useCallback(() => {
    setDebugEvent({ type: "cancel", ts: Date.now() });

    setActiveId(null);
    setActiveSize(null);
    containersDraftRef.current = null;
    setSoftTick((t) => t + 1);
  }, []);

  const handleDragOver = useCallback(
  (event) => {
    console.log("dragover:start");

    const { active, over } = event;
    if (!over) return;

    const nextOverRole = over.data.current?.role ?? null;
    const nextOverContainerId =
      over.data.current?.containerId ??
      (typeof over.id === "string" ? over.id : null);

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
      setDebugEvent(pickEvent(event, "over"));
    }

    const draft = containersDraftRef.current;
    if (!draft) return;

    const activeRole = active.data.current?.role;
    const overRole = nextOverRole;

    // --------------------------------------------------
    // A) Dragging a CONTAINER (disabled for now)
    // --------------------------------------------------
    if (activeRole === "container") {
      return;
    }

    // --------------------------------------------------
    // B) Dragging an INSTANCE
    // --------------------------------------------------
    if (activeRole === "instance") {
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

      // -----------------------------
      // Compute target index
      // -----------------------------
      let toIndex;
      if (!overInstanceId) {
        // hovering list zone → append
        toIndex = toContainer.items.length;
      } else {
        const idx = toContainer.items.indexOf(overInstanceId);
        if (idx === -1) return;

        // 👇 midpoint logic (insert after when dragging downward)
        const activeRect = active.rect.current.translated;
        const overRect = over.rect;

        const isBelow =
          activeRect && overRect
            ? activeRect.top > overRect.top + overRect.height / 2
            : false;

        toIndex = idx + (isBelow ? 1 : 0);
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

        const nextItems = arrayMove(
          fromContainer.items,
          fromIndex,
          toIndex
        );

        containersDraftRef.current = draft.map((c) =>
          c.id === fromId ? { ...c, items: nextItems } : c
        );

        setSoftTick((t) => t + 1);
        console.log("dragover:end (reorder)");
        return;
      }

      // -----------------------------
      // Cross-container move
      // -----------------------------
      const nextFromItems = fromContainer.items.filter(
        (id) => id !== instanceId
      );

      const clamped = Math.max(0, Math.min(toContainer.items.length, toIndex));
      const nextToItems = [...toContainer.items];
      nextToItems.splice(clamped, 0, instanceId);

      containersDraftRef.current = draft.map((c) => {
        if (c.id === fromId) return { ...c, items: nextFromItems };
        if (c.id === toId) return { ...c, items: nextToItems };
        return c;
      });

      setSoftTick((t) => t + 1);
      console.log("dragover:end (cross-container)");
      return;
    }
  },
  [findContainerByInstanceId]
);


  const handleDragEnd = useCallback(
    (event) => {
      setDebugEvent(pickEvent(event, "end"));
      const { active, over } = event;
      console.log("dragend");
      console.log(active);
      console.log(over);
      setActiveId(null);
      setActiveSize(null);

      if (!over) {
        containersDraftRef.current = null;
        setSoftTick((t) => t + 1);
        return;
      }

      if (containersDraftRef.current) {
        setContainers(containersDraftRef.current);
        containersDraftRef.current = null;
        setSoftTick((t) => t + 1);
      }
    },
    []
  );

  const containersRender = getWorkingContainers();

  // ✅ useMemo improvements: split contexts, keep values stable
  const dataValue = useMemo(
    () => ({
      activeId,
      activeSize,
      debugEvent,
      containers,
      containersRender,
      instances,
      softTick, // consumers can depend on this if needed
    }),
    [activeId, activeSize, debugEvent, containers, containersRender, instances, softTick]
  );

  const actionsValue = useMemo(
    () => ({
      addContainer,
      addInstanceToContainer,
      handleDragStart,
      handleDragOver,
      handleDragEnd,
      handleDragCancel,
      useRenderCount,
    }),
    [
      addContainer,
      addInstanceToContainer,
      handleDragStart,
      handleDragOver,
      handleDragEnd,
      handleDragCancel,
    ]
  );

  useRenderCount("App");

  return (
    <GridActionsContext.Provider value={actionsValue}>
      <GridDataContext.Provider value={dataValue}>
        <DebugBar
          containers={containers}
          containersDraft={containersDraftRef.current}
          activeId={activeId}
          debugEvent={debugEvent}
        />

        <div className="app-root">
          <div className="dnd-page">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>Sortable Containers + Instances</h2>
              <button onClick={addContainer}>+ Container</button>
            </div>

            <Grid />

            {containers.length === 0 && (
              <div style={{ marginTop: 12, opacity: 0.7, fontSize: 13 }}>
                Create a container to start.
              </div>
            )}
          </div>
        </div>
      </GridDataContext.Provider>
    </GridActionsContext.Provider>
  );
}
