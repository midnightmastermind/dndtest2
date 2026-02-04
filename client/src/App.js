// App.jsx — STEP 2: commits routed through CommitHelpers / LayoutHelpers
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { socket } from "./socket";
import { bindSocketToStore } from "./state/bindSocketToStore";

import { ActionTypes } from "./state/actions";
import Grid from "./Grid";
import LoginScreen from "./LoginScreen";

import { GridDataContext } from "./GridDataContext";
import { GridActionsContext } from "./GridActionsContext";

import { useBoardState } from "./state/useBoardState";

import SortableContainer from "./SortableContainer";
import SortableInstance from "./SortableInstance";
import Instance from "./Instance";
import Toolbar from "./Toolbar";
import { SpinnerOverlay } from "./components/ui/spinner";

import * as CommitHelpers from "./helpers/CommitHelpers";
import * as LayoutHelpers from "./helpers/LayoutHelpers";
import { buildLookup } from "./helpers/LayoutHelpers";

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

  const instancesById = useMemo(
    () => buildLookup(state.instances),
    [state.instances]
  );

  const occurrencesById = useMemo(
    () => buildLookup(state.occurrences),
    [state.occurrences]
  );

  const containersById = useMemo(
    () => buildLookup(state.containers),
    [state.containers]
  );

  const fieldsById = useMemo(
    () => buildLookup(state.fields),
    [state.fields]
  );

  const [gridName, setGridName] = useState("");
  const [rowInput, setRowInput] = useState("1");
  const [colInput, setColInput] = useState("1");

  // Iteration state
  const iterations = state?.grid?.iterations || [{ id: "default", name: "Daily", timeFilter: "daily" }];
  const [selectedIterationId, setSelectedIterationId] = useState(
    state?.grid?.selectedIterationId || "default"
  );
  const [currentIterationValue, setCurrentIterationValue] = useState(
    state?.grid?.currentIterationValue ? new Date(state.grid.currentIterationValue) : new Date()
  );

  useEffect(() => {
    if (state?.grid) {
      setGridName(state.grid.name || "");
      setRowInput(String(state.grid.rows ?? 1));
      setColInput(String(state.grid.cols ?? 1));
      // Sync iteration state from grid
      if (state.grid.selectedIterationId) {
        setSelectedIterationId(state.grid.selectedIterationId);
      }
      if (state.grid.currentIterationValue) {
        setCurrentIterationValue(new Date(state.grid.currentIterationValue));
      }
    } else {
      setGridName("");
      setRowInput("1");
      setColInput("1");
    }
  }, [state?.grid?._id, state?.grid?.name, state?.grid?.rows, state?.grid?.cols]);

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

  const commitGridName = useCallback(
    (nextName) => {
      const gridId = state?.gridId || state?.grid?._id;
      if (!gridId) return;

      const trimmed = String(nextName ?? gridName ?? "").trim();
      if (!trimmed) return;

      CommitHelpers.updateGrid({
        dispatch,
        socket,
        gridId,
        grid: { name: trimmed },
        emit: true,
      });
    },
    [dispatch, state?.gridId, state?.grid?._id, gridName]
  );

  const updateRows = useCallback(
    (val) => {
      const gridId = state?.gridId || state?.grid?._id;
      if (!gridId) return;

      const num = Math.max(1, Number(val) || 1);

      CommitHelpers.updateGrid({
        dispatch,
        socket,
        gridId,
        grid: { rows: num },
        emit: true,
      });
    },
    [dispatch, state?.gridId, state?.grid?._id]
  );

  const updateCols = useCallback(
    (val) => {
      const gridId = state?.gridId || state?.grid?._id;
      if (!gridId) return;

      const num = Math.max(1, Number(val) || 1);

      CommitHelpers.updateGrid({
        dispatch,
        socket,
        gridId,
        grid: { cols: num },
        emit: true,
      });
    },
    [dispatch, state?.gridId, state?.grid?._id]
  );

  const addNewPanel = useCallback(() => {
    if (!state.gridId || !state.grid) return;

    const panelId = crypto.randomUUID();
    const { row, col } = findNextOpenPosition(
      state.panels || [],
      state.grid.rows ?? 1,
      state.grid.cols ?? 1
    );

    const panelNumber = (state.panels?.length || 0) + 1;

    const panel = {
      id: panelId,
      role: "panel",
      row,
      col,
      width: 1,
      height: 1,
      containers: [],
      gridId: state.gridId,
      layout: { name: `Panel ${panelNumber}` },
    };

    CommitHelpers.createPanel({ dispatch, socket, panel, emit: true });
  }, [dispatch, state.gridId, state.grid, state.panels]);

  const addContainerToPanel = useCallback(
    (panelId) => {
      if (!panelId || !state.gridId) return;

      const id = crypto.randomUUID();
      const label = `List ${(state.containers?.length || 0) + 1}`;
      const container = { id, label, occurrences: [] };

      const panel = (state.panels || []).find((p) => p.id === panelId);
      if (!panel) return;

      // Use the occurrence-based helper which creates container + occurrence + adds to panel
      LayoutHelpers.createContainerInPanel({
        dispatch,
        socket,
        gridId: state.gridId,
        panel,
        container,
        emit: true,
      });
    },
    [dispatch, state.gridId, state.containers, state.panels, socket]
  );

  // ✅ UPDATED: use occurrence-based creation
  const addInstanceToContainer = useCallback(
    (containerId) => {
      if (!containerId || !state.gridId) return;

      const id = crypto.randomUUID();
      const label = `Item ${(state.instances?.length || 0) + 1}`;
      const instance = { id, label };

      const container = (state.containers || []).find((c) => c.id === containerId);
      if (!container) return;

      // Use the occurrence-based helper which creates instance + occurrence + adds to container
      LayoutHelpers.createInstanceInContainer({
        dispatch,
        socket,
        gridId: state.gridId,
        container,
        instance,
        emit: true,
      });
    },
    [dispatch, state.instances, state.gridId, state.containers, socket]
  );

  const deleteGridFinal = useCallback(() => {
    const gridId = state?.gridId || state?.grid?._id;
    if (!gridId) return;

    CommitHelpers.deleteGrid({ dispatch, socket, gridId, emit: true });
  }, [dispatch, state?.gridId, state?.grid?._id]);

  // Iteration handlers
  const handleSelectIteration = useCallback((iterationId) => {
    setSelectedIterationId(iterationId);
    const gridId = state?.gridId || state?.grid?._id;
    if (gridId) {
      CommitHelpers.updateGrid({
        dispatch,
        socket,
        gridId,
        grid: { selectedIterationId: iterationId },
        emit: true,
      });
    }
  }, [dispatch, state?.gridId, state?.grid?._id]);

  const handleIterationValueChange = useCallback((date) => {
    setCurrentIterationValue(date);
    const gridId = state?.gridId || state?.grid?._id;
    if (gridId) {
      CommitHelpers.updateGrid({
        dispatch,
        socket,
        gridId,
        grid: { currentIterationValue: date.toISOString() },
        emit: true,
      });
    }
  }, [dispatch, state?.gridId, state?.grid?._id]);

  const handleCommitIterations = useCallback((newIterations) => {
    const gridId = state?.gridId || state?.grid?._id;
    if (gridId) {
      CommitHelpers.updateGrid({
        dispatch,
        socket,
        gridId,
        grid: { iterations: newIterations },
        emit: true,
      });
    }
  }, [dispatch, state?.gridId, state?.grid?._id]);

  const dataValue = useMemo(
    () => ({
      // Raw state - components use lookups from context (occurrencesById, instancesById, containersById)
      state: {
        userId: state.userId,
        gridId: state.gridId,
        grid: state.grid,
        panels: state.panels || [],
        containers: state.containers || [],
        instances: state.instances || [],
        occurrences: state.occurrences || [],
        fields: state.fields || [],
        activeId: state.activeId,
        activeSize: state.activeSize,
        softTick: state.softTick,
        // Iteration context
        containersById,
        panelsById: buildLookup(state.panels),
        selectedIterationId,
        currentIterationValue,
      },
    }),
    [
      state.userId,
      state.gridId,
      state.grid,
      state.panels,
      state.containers,
      state.instances,
      state.occurrences,
      state.fields,
      state.activeId,
      state.activeSize,
      state.softTick,
      containersById,
      selectedIterationId,
      currentIterationValue,
    ]
  );

  const panelsById = useMemo(
    () => buildLookup(state.panels),
    [state.panels]
  );

  const actionsValue = useMemo(
    () => ({
      socket,
      dispatch,

      instancesById,
      occurrencesById,
      containersById,
      fieldsById,
      panelsById,
      addContainerToPanel,
      addInstanceToContainer,
      // Iteration handlers
      onCommitIterations: handleCommitIterations,
      iterations,
      selectedIterationId,
      currentIterationValue,
      onSelectIteration: handleSelectIteration,
      onIterationValueChange: handleIterationValueChange,
    }),
    [
      dispatch,
      instancesById,
      occurrencesById,
      containersById,
      fieldsById,
      panelsById,
      addContainerToPanel,
      addInstanceToContainer,
      handleCommitIterations,
      iterations,
      selectedIterationId,
      currentIterationValue,
      handleSelectIteration,
      handleIterationValueChange,
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
          onCommitIterations={handleCommitIterations}
          iterations={iterations}
          selectedIterationId={selectedIterationId}
          onSelectIteration={handleSelectIteration}
          currentIterationValue={currentIterationValue}
          onIterationValueChange={handleIterationValueChange}
        />

        <div className="app-root grid-frame bg-background2 ring-1 ring-black/40 rounded-xl p-3 shadow-inner border border-border">
          {state.grid?._id ? (
            <Grid components={components} />
          ) : (
            <SpinnerOverlay label="Syncing grid…" />
          )}
        </div>
      </GridDataContext.Provider>
    </GridActionsContext.Provider>
  );
}