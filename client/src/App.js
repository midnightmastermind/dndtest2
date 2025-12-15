import React, { useCallback, useEffect, useMemo, useState } from "react";
import Textfield from "@atlaskit/textfield";
import Button from "@atlaskit/button";
import { Label } from "@atlaskit/form";

import { socket } from "./socket";
import { bindSocketToStore } from "./state/bindSocketToStore";

// ✅ use your action creators (no ActionTypes import)

import {
  updateGridAction,
  createPanelAction,
  updatePanelAction,

  // ✅ add these (you already have them in actions.js)
  createContainerAction,
  createInstanceInContainerAction,
} from "./state/actions";

import Grid from "./Grid";
import LoginScreen from "./LoginScreen";

import { GridDataContext } from "./GridDataContext";
import { GridActionsContext } from "./GridActionsContext";

import { useBoardState } from "./state/useBoardState";
import { useDndReorderCoordinator } from "./helpers/useDndReorderCoordinator";
import SortableContainer from "./SortableContainer";
import SortableInstance from "./SortableInstance";
import Instance from "./Instance";
import Debugbar from "./Debugbar";
import Toolbar from "./Toolbar";



function useRenderCount(label) {
  const ref = React.useRef(0);
  ref.current += 1;
  console.log(`${label} render #${ref.current}`);
}


function findNextOpenPosition(panels = [], rows = 1, cols = 1) {
  const taken = new Set(panels.map((p) => `${p.row}-${p.col}`));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r}-${c}`;
      if (!taken.has(key)) return { row: r, col: c };
    }
  }
  return { row: 0, col: 0 };
}

export default function App() {
  const { state, dispatch } = useBoardState();

  const {
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    containersDraftRef,
    getWorkingContainers,
  } = useDndReorderCoordinator({ state, dispatch, socket });

  const containersRender = getWorkingContainers();

  // -----------------------------
  // TOOLBAR LOCAL UI STATE
  // -----------------------------
  const [gridName, setGridName] = useState("");
  const [rowInput, setRowInput] = useState("1");
  const [colInput, setColInput] = useState("1");

  // Sync toolbar fields from hydrated grid
  useEffect(() => {
    if (state?.grid) {
      setGridName(state.grid.name || "");
      setRowInput(String(state.grid.rows ?? 1));
      setColInput(String(state.grid.cols ?? 1));
    } else {
      setGridName("");
      setRowInput("1");
      setColInput("1");
    }
  }, [state?.grid?._id, state?.grid?.name, state?.grid?.rows, state?.grid?.cols]);

  // -----------------------------
  // SOCKET BIND + HYDRATE
  // -----------------------------

  useEffect(() => {
    const unbind = bindSocketToStore(socket, dispatch);

    const token = localStorage.getItem("moduli-token");
    if (!token) return () => unbind?.(); // 👈 don't request_full_state as guest

    let didRequest = false;
    const request = () => {
      if (didRequest) return;
      didRequest = true;

      const savedGridId = localStorage.getItem("moduli-gridId");
      socket.emit("request_full_state", savedGridId ? { gridId: savedGridId } : undefined);
    };

    if (socket.connected) request();
    else socket.once("connect", request);

    return () => {
      socket.off("connect", request);
      unbind?.();
    };
  }, [dispatch]);
  // -----------------------------
  // TOOLBAR HANDLERS (REAL EMITS)
  // -----------------------------
  const handleGridChange = (e) => {
    const newGridId = e.target.value;
    if (!newGridId || newGridId === state.gridId) return;

    localStorage.setItem("moduli-gridId", newGridId);
    socket.emit("request_full_state", { gridId: newGridId });
  };

  const handleCreateNewGrid = () => {
    localStorage.removeItem("moduli-gridId");
    socket.emit("request_full_state"); // server creates new grid
  };

  const commitGridName = () => {
    if (!state.gridId) return;

    const trimmed = (gridName || "").trim();
    if (!trimmed) return;

    // ✅ optimistic local patch
    dispatch(updateGridAction({ name: trimmed }));

    // server patch
    socket.emit("update_grid", { gridId: state.gridId, name: trimmed });
  };

  const updateRows = (val) => {
    if (!state.gridId) return;
    const num = Math.max(1, Number(val) || 1);

    // ✅ optimistic local patch
    dispatch(updateGridAction({ rows: num }));

    socket.emit("update_grid", { gridId: state.gridId, rows: num });
  };

  const updateCols = (val) => {
    if (!state.gridId) return;
    const num = Math.max(1, Number(val) || 1);

    // ✅ optimistic local patch
    dispatch(updateGridAction({ cols: num }));

    socket.emit("update_grid", { gridId: state.gridId, cols: num });
  };

  const addNewPanel = () => {
    if (!state.gridId || !state.grid) return;

    const panelId = crypto.randomUUID();

    const { row, col } = findNextOpenPosition(
      state.panels || [],
      state.grid.rows ?? 1,
      state.grid.cols ?? 1
    );

    const panel = {
      id: panelId,
      role: "panel",
      type: "",
      row,
      col,
      width: 1,
      height: 1,
      containers: [],
      gridId: state.gridId,
    };

    // ✅ optimistic local add (create)
    dispatch(createPanelAction(panel));

    // ✅ and also upsert/update (your request: do both)
    //   dispatch(updatePanelAction(panel));

    // tell server to upsert + broadcast panel_updated
    socket.emit("create_panel", { panel });

    // ensure container exists
    /*  if (!(state.containers || []).some((c) => c.id === containerId)) {
        dispatch(addContainerAction({ id: containerId, label: "TaskBox" }));
  
        socket.emit("create_container", {
          container: { id: containerId, label: "TaskBox" },
        });
      }
  
      // ensure items are empty (both local + server)
      dispatch(patchContainerItemsAction({ containerId, items: [] }));
      socket.emit("update_container_items", { containerId, items: [] });
      */
  };

  // App.jsx
const addContainerToPanel = useCallback(
  (panelId) => {
    if (!panelId || !state.gridId) return;

    const id = crypto.randomUUID();
    const label = `List ${(state.containers?.length || 0) + 1}`;

    const container = { id, label, items: [] };

    // 1) optimistic container create
    dispatch(createContainerAction(container));

    // 2) persist container
    socket.emit("create_container", { container });

    // 3) optimistic panel patch (attach container id)
    const panel = (state.panels || []).find((p) => p.id === panelId);
    if (!panel) return;

    const nextPanel = {
      ...panel,
      containers: [...(panel.containers || []), id],
    };

    dispatch(updatePanelAction(nextPanel));
    socket.emit("update_panel", { panel: nextPanel, gridId: state.gridId });
  },
  [dispatch, socket, state.gridId, state.containers, state.panels]
);

const addInstanceToContainer = useCallback(
  (containerId) => {
    if (!containerId) return;

    const id = crypto.randomUUID();
    const label = `Item ${(state.instances?.length || 0) + 1}`;

    const instance = { id, label };

    // optimistic
    dispatch(createInstanceInContainerAction({ containerId, instance }));

    // persist
    socket.emit("create_instance_in_container", { containerId, instance });
  },
  [dispatch, socket, state.instances]
);

  // -----------------------------
  // CONTEXT VALUES
  // -----------------------------
  const dataValue = useMemo(
    () => ({
      state,                 // ✅ THIS is the key fix
      containersRender,      // ✅ keep
    }),
    [state, containersRender]
  );

  const actionsValue = useMemo(
    () => ({
      socket,
      dispatch,

      // ✅ add these wrappers so Grid can call them
      updatePanel: updatePanelAction,
      updateGrid: updateGridAction,

      addContainerToPanel,
      addInstanceToContainer,
      handleDragStart,
      handleDragOver,
      handleDragEnd,
      handleDragCancel,
      useRenderCount,
    }),
    [
      socket,
      dispatch,
      addContainerToPanel,
      addInstanceToContainer,
      handleDragStart,
      handleDragOver,
      handleDragEnd,
      handleDragCancel,
    ]
  );

  useRenderCount("App");
  const components = useMemo(() => ({
    SortableContainer,
    Instance,
    SortableInstance,
  }), []);

  // -----------------------------
  // LOGIN GATE
  // -----------------------------
  if (!state.userId) return <LoginScreen />;

  console.log(state);
  return (
    <GridActionsContext.Provider value={actionsValue}>
      <GridDataContext.Provider value={dataValue}>
        <Toolbar
          gridId={state.gridId}
          availableGrids={state.availableGrids || []}
          gridName={gridName}
          setGridName={setGridName}
          rowInput={rowInput}
          setRowInput={setRowInput}
          colInput={colInput}
          setColInput={setColInput}
          onGridChange={handleGridChange}
          onCreateNewGrid={handleCreateNewGrid}
          onCommitGridName={commitGridName}
          onUpdateRows={updateRows}
          onUpdateCols={updateCols}
          onAddPanel={addNewPanel}
        />

        <Debugbar
          containers={state.containers}
          containersDraft={containersDraftRef.current}
          activeId={state.activeId}
          debugEvent={state.debugEvent}
        />

        <div className="app-root">
          {state.grid && <Grid components={components} />}
        </div>
      </GridDataContext.Provider>
    </GridActionsContext.Provider>
  );
}
