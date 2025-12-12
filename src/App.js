import React, { useMemo } from "react";
import Grid from "./Grid";
import { GridDataContext } from "./GridDataContext";
import { GridActionsContext } from "./GridActionsContext";

import { useBoardState } from "./state/useBoardState";
import { useDndReorderCoordinator } from "./helpers/useDndReorderCoordinator";

function useRenderCount(label) {
  const ref = React.useRef(0);
  ref.current += 1;
  console.log(`${label} render #${ref.current}`);
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

export default function App() {
  const { state, dispatch } = useBoardState();

  const {
    addContainer,
    addInstanceToContainer,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    containersDraftRef,
    getWorkingContainers,
  } = useDndReorderCoordinator({ state, dispatch });

  const containersRender = getWorkingContainers();

  const dataValue = useMemo(
    () => ({
      activeId: state.activeId,
      activeSize: state.activeSize,
      debugEvent: state.debugEvent,
      containers: state.containers,
      containersRender,
      instances: state.instances,
      softTick: state.softTick,
    }),
    [
      state.activeId,
      state.activeSize,
      state.debugEvent,
      state.containers,
      containersRender,
      state.instances,
      state.softTick,
    ]
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
          containers={state.containers}
          containersDraft={containersDraftRef.current}
          activeId={state.activeId}
          debugEvent={state.debugEvent}
        />

        <div className="app-root">
          <div className="dnd-page">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>Sortable Containers + Instances</h2>
              <button onClick={addContainer}>+ Container</button>
            </div>

            <Grid />

            {state.containers.length === 0 && (
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
