import React, { useEffect, useMemo, useState } from "react";
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
  addContainerAction,
  patchContainerItemsAction,
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
    addContainer,
    addInstanceToContainer,
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
  }, [state?.grid?._id, state?.grid?.rows, state?.grid?.cols]);

  // -----------------------------
  // SOCKET BIND + HYDRATE
  // -----------------------------
  useEffect(() => {
    const unbind = bindSocketToStore(socket, dispatch);

    const savedUserId = localStorage.getItem("moduli-userId");
    const savedGridId = localStorage.getItem("moduli-gridId");

    if (savedUserId) {
      if (savedGridId)
        socket.emit("request_full_state", { gridId: savedGridId });
      else socket.emit("request_full_state");
    }

    return () => unbind?.();
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
    const containerId = `taskbox-${panelId}`;

    const { row, col } = findNextOpenPosition(
      state.panels || [],
      state.grid.rows ?? 1,
      state.grid.cols ?? 1
    );

    const panel = {
      id: panelId,
      role: "panel",
      type: "taskbox",
      containerId,
      props: { containerId },
      row,
      col,
      width: 1,
      height: 1,
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

  // -----------------------------
  // CONTEXT VALUES
  // -----------------------------
  const dataValue = useMemo(
    () => ({
      activeId: state.activeId,
      activeSize: state.activeSize,
      debugEvent: state.debugEvent,

      containers: state.containers,
      containersRender,
      instances: state.instances,

      softTick: state.softTick,

      userId: state.userId,
      gridId: state.gridId,
      grid: state.grid,
      panels: state.panels,
      availableGrids: state.availableGrids,
      hydrated: state.hydrated,
    }),
    [
      state.activeId,
      state.activeSize,
      state.debugEvent,
      state.containers,
      containersRender,
      state.instances,
      state.softTick,
      state.userId,
      state.gridId,
      state.grid,
      state.panels,
      state.availableGrids,
      state.hydrated,
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
      socket,
      dispatch,
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
  const components = useMemo(
    () => ({
      sortableInstance: SortableInstance,
      instance: Instance,
      sortableContainer: SortableContainer,
    }),
    []
  );

  // -----------------------------
  // LOGIN GATE
  // -----------------------------
  const savedUserId = localStorage.getItem("moduli-userId");
  if (!savedUserId) return <LoginScreen />;

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
          <div className="dnd-page">
         {/* <Grid components={components} /> */}
          </div>
        </div>
      </GridDataContext.Provider>
    </GridActionsContext.Provider>
  );
}
