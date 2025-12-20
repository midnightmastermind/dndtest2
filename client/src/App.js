// App.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { socket } from "./socket";
import { bindSocketToStore } from "./state/bindSocketToStore";

import {
  updateGridAction,
  createPanelAction,
  updatePanelAction,
  createContainerAction,
  createInstanceInContainerAction,
} from "./state/actions";
  import { deleteGridAction } from "./state/actions";
import { ActionTypes } from "./state/actions";
import Grid from "./Grid";
import LoginScreen from "./LoginScreen";

import { GridDataContext } from "./GridDataContext";
import { GridActionsContext } from "./GridActionsContext";

import { useBoardState } from "./state/useBoardState";
import { useDndReorderCoordinator } from "./helpers/useDndReorderCoordinator";

import SortableContainer from "./SortableContainer";
import SortableInstance from "./SortableInstance";
import Instance from "./Instance";
import Toolbar from "./Toolbar";
import { SpinnerOverlay } from "./components/ui/spinner";
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

  // ✅ single shared live pointer ref for EVERYTHING (GridInner + coordinator)
  const livePointerRef = useRef({ x: null, y: null });

  // ✅ local tick for drag preview rendering (no reducer writes)
  const [dragTick, setDragTick] = useState(0);
  const scheduleSoftTick = useCallback(() => {
    setDragTick((x) => x + 1);
  }, []);

  const {
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    containersDraftRef,
    getWorkingContainers,
  } = useDndReorderCoordinator({
    state,
    dispatch,
    socket,
    scheduleSoftTick,
  });

  // ✅ containers used for rendering (draft during drag, real otherwise)
  const containersRender = getWorkingContainers();

  // ✅ instance lookup map once
  const instancesById = useMemo(() => {
    const m = Object.create(null);
    for (const inst of state.instances || []) m[inst.id] = inst;
    return m;
  }, [state.instances]);

  // -----------------------------
  // TOOLBAR LOCAL UI STATE
  // -----------------------------
  const [gridName, setGridName] = useState("");
  const [rowInput, setRowInput] = useState("1");
  const [colInput, setColInput] = useState("1");

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
    if (!token) return () => unbind?.();

    let didRequest = false;
    const request = () => {
      if (didRequest) return;
      didRequest = true;

      const savedGridId = localStorage.getItem("moduli-gridId");
      socket.emit(
        "request_full_state",
        savedGridId ? { gridId: savedGridId } : undefined
      );
    };

    if (socket.connected) request();
    else socket.once("connect", request);

    return () => {
      socket.off("connect", request);
      unbind?.();
    };
  }, [dispatch]);

  // -----------------------------
  // TOOLBAR HANDLERS
  // -----------------------------
  const handleGridChange = (e) => {
    const newGridId = e.target.value;
    if (!newGridId || newGridId === state.gridId) return;

dispatch({ type: ActionTypes.SET_GRID_ID, payload: newGridId });
    localStorage.setItem("moduli-gridId", newGridId);
    
    socket.emit("request_full_state", { gridId: newGridId });
  };

  const handleCreateNewGrid = () => {
    localStorage.removeItem("moduli-gridId");
    socket.emit("request_full_state");
  };

  const commitGridName = () => {
    if (!state.gridId) return;
    const trimmed = (gridName || "").trim();
    if (!trimmed) return;

    dispatch(updateGridAction({ name: trimmed }));
    socket.emit("update_grid", { gridId: state.gridId, name: trimmed });
  };

  const updateRows = (val) => {
    if (!state.gridId) return;
    const num = Math.max(1, Number(val) || 1);
    dispatch(updateGridAction({ rows: num }));
    socket.emit("update_grid", { gridId: state.gridId, rows: num });
  };

  const updateCols = (val) => {
    if (!state.gridId) return;
    const num = Math.max(1, Number(val) || 1);
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

    dispatch(createPanelAction(panel));
    socket.emit("create_panel", { panel });
  };

  const addContainerToPanel = useCallback(
    (panelId) => {
      if (!panelId || !state.gridId) return;

      const id = crypto.randomUUID();
      const label = `List ${(state.containers?.length || 0) + 1}`;
      const container = { id, label, items: [] };

      dispatch(createContainerAction(container));
      socket.emit("create_container", { container });

      const panel = (state.panels || []).find((p) => p.id === panelId);
      if (!panel) return;

      const nextPanel = {
        ...panel,
        containers: [...(panel.containers || []), id],
      };

      dispatch(updatePanelAction(nextPanel));
      socket.emit("update_panel", { panel: nextPanel, gridId: state.gridId });
    },
    [dispatch, state.gridId, state.containers, state.panels]
  );

  const addInstanceToContainer = useCallback(
    (containerId) => {
      if (!containerId) return;

      const id = crypto.randomUUID();
      const label = `Item ${(state.instances?.length || 0) + 1}`;
      const instance = { id, label };

      dispatch(createInstanceInContainerAction({ containerId, instance }));
      socket.emit("create_instance_in_container", { containerId, instance });
    },
    [dispatch, state.instances]
  );


const deleteGridFinal = () => {
  const gridId = state?.gridId || state?.grid?._id;
  if (!gridId) return;

  // optimistic remove from local state (matches reducer + bindSocketToStore)
  dispatch(deleteGridAction(gridId)); // payload: { gridId } :contentReference[oaicite:4]{index=4}

  // tell backend (server should accept { gridId })
  socket.emit("delete_grid", { gridId });

  // optional: clear any local pointers
};

  // -----------------------------
  // CONTEXT VALUES
  // -----------------------------
  const dataValue = useMemo(
    () => ({
      state: {
        userId: state.userId,
        gridId: state.gridId,
        grid: state.grid,
        panels: state.panels,
        containers: state.containers,
        instances: state.instances,
        activeId: state.activeId,
        activeSize: state.activeSize,
        softTick: state.softTick,
      },
      containersRender,
      dragTick,
    }),
    [
      state.userId,
      state.gridId,
      state.grid,
      state.panels,
      state.containers,
      state.instances,
      state.activeId,
      state.activeSize,
      state.softTick,
      containersRender,
      dragTick,
    ]
  );

  const actionsValue = useMemo(
    () => ({
      socket,
      dispatch,
      updatePanel: updatePanelAction,
      updateGrid: updateGridAction,

      instancesById,
      addContainerToPanel,
      addInstanceToContainer,

      pointerRef: livePointerRef,
      
      handleDragStart,
      handleDragOver,
      handleDragEnd,
      handleDragCancel,
    }),
    [
      socket,
      dispatch,
      instancesById,
      addContainerToPanel,
      addInstanceToContainer,
      livePointerRef, // ✅ include so it's never accidentally stale
      handleDragStart,
      handleDragOver,
      handleDragEnd,
      handleDragCancel,
    ]
  );

  const components = useMemo(
    () => ({
      SortableContainer,
      Instance,
      SortableInstance,
    }),
    []
  );

  if (!state.userId) return <LoginScreen />;

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
          onDeleteGrid={deleteGridFinal}
        />

        <div className="app-root grid-frame bg-background2 ring-1 ring-black/40 rounded-xl p-3 shadow-inner border border-border">
          {state.grid?._id ? <Grid components={components} /> : <SpinnerOverlay label="Syncing grid…" />}
        </div>
      </GridDataContext.Provider>
    </GridActionsContext.Provider>
  );
}