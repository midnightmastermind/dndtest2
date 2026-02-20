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
import TransactionHistory from "./ui/TransactionHistory";
import { SpinnerOverlay } from "./components/ui/spinner";
import { Toaster } from "./components/ui/sonner";

import { useUndoRedo } from "./hooks/useUndoRedo";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

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

  const manifestsById = useMemo(
    () => buildLookup(state.manifests),
    [state.manifests]
  );

  const viewsById = useMemo(
    () => buildLookup(state.views),
    [state.views]
  );

  const docsById = useMemo(
    () => buildLookup(state.docs),
    [state.docs]
  );

  const foldersById = useMemo(
    () => buildLookup(state.folders),
    [state.folders]
  );

  const artifactsById = useMemo(
    () => buildLookup(state.artifacts),
    [state.artifacts]
  );

  // Undo/Redo state (lifted from Grid so Toolbar can access it)
  const [historyOpen, setHistoryOpen] = useState(false);

  const { canUndo, canRedo, undo, redo, isProcessing } = useUndoRedo(
    socket,
    state.grid?._id
  );

  // Global keyboard shortcuts for undo/redo (Ctrl+Z, Ctrl+Y)
  useKeyboardShortcuts({
    onUndo: undo,
    onRedo: redo,
    enabled: !isProcessing,
  });

  const [gridName, setGridName] = useState("");
  const [rowInput, setRowInput] = useState("1");
  const [colInput, setColInput] = useState("1");

  // Time iteration state
  const iterations = state?.grid?.iterations || [{ id: "default", name: "Daily", timeFilter: "daily" }];
  const [selectedIterationId, setSelectedIterationId] = useState(
    state?.grid?.selectedIterationId || "default"
  );
  const [currentIterationValue, setCurrentIterationValue] = useState(
    state?.grid?.currentIterationValue ? new Date(state.grid.currentIterationValue) : new Date()
  );

  // Category iteration state (for compound filtering: time + category)
  const categoryDimensions = state?.grid?.categoryDimensions || [];
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    state?.grid?.selectedCategoryId || null
  );
  const [currentCategoryValue, setCurrentCategoryValue] = useState(
    state?.grid?.currentCategoryValue || null
  );

  useEffect(() => {
    if (state?.grid) {
      setGridName(state.grid.name || "");
      setRowInput(String(state.grid.rows ?? 1));
      setColInput(String(state.grid.cols ?? 1));
      // Sync time iteration state from grid
      if (state.grid.selectedIterationId) {
        setSelectedIterationId(state.grid.selectedIterationId);
      }
      if (state.grid.currentIterationValue) {
        setCurrentIterationValue(new Date(state.grid.currentIterationValue));
      }
      // Sync category iteration state from grid
      if (state.grid.selectedCategoryId !== undefined) {
        setSelectedCategoryId(state.grid.selectedCategoryId);
      }
      if (state.grid.currentCategoryValue !== undefined) {
        setCurrentCategoryValue(state.grid.currentCategoryValue);
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

  const addNewPanel = useCallback((kind = "board") => {
    if (!state.gridId || !state.grid || !state.userId) return;

    const panelId = crypto.randomUUID();
    const { row, col } = findNextOpenPosition(
      state.panels || [],
      state.grid.rows ?? 1,
      state.grid.cols ?? 1
    );

    const panelNumber = (state.panels?.length || 0) + 1;
    const kindLabels = { board: "Board", notebook: "Notebook", doc: "Doc", mixed: "Mixed" };

    // Panel entity - no row/col (that's in occurrence.placement)
    const panel = {
      id: panelId,
      kind, // Add the kind to the panel
      occurrences: [],
      layout: { name: `${kindLabels[kind] || "Panel"} ${panelNumber}` },
    };

    // Use occurrence-based helper: creates panel + occurrence + adds to grid
    LayoutHelpers.createPanelInGrid({
      dispatch,
      socket,
      grid: state.grid,
      panel,
      placement: { row, col, width: 1, height: 1 },
      userId: state.userId,
      emit: true,
    });
  }, [dispatch, state.gridId, state.grid, state.panels, state.userId]);

  const addContainerToPanel = useCallback(
    (panelId, kind = "list") => {
      if (!panelId || !state.gridId || !state.userId) return;

      const id = crypto.randomUUID();
      // Label based on kind
      const kindLabels = { list: "List", doc: "Doc", log: "Log", smart: "Smart" };
      const label = `${kindLabels[kind] || "List"} ${(state.containers?.length || 0) + 1}`;
      const container = { id, label, kind, occurrences: [] };

      const panel = (state.panels || []).find((p) => p.id === panelId);
      if (!panel) return;

      // Use the occurrence-based helper which creates container + occurrence + adds to panel
      LayoutHelpers.createContainerInPanel({
        dispatch,
        socket,
        gridId: state.gridId,
        panel,
        container,
        userId: state.userId,
        emit: true,
      });
    },
    [dispatch, state.gridId, state.userId, state.containers, state.panels, socket]
  );

  // Use occurrence-based creation with userId
  const addInstanceToContainer = useCallback(
    (containerId) => {
      if (!containerId || !state.gridId || !state.userId) return;

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
        userId: state.userId,
        emit: true,
      });
    },
    [dispatch, state.instances, state.gridId, state.userId, state.containers, socket]
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

    // Day page auto-creation: if a "day-pages" folder exists, create a doc for this date
    const folders = state?.folders || [];
    const docs = state?.docs || [];
    const dayPagesFolder = folders.find(f => f.folderType === "day-pages");
    if (dayPagesFolder) {
      const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
      const existingDoc = docs.find(
        d => d.folderId === dayPagesFolder.id && d.title === dateStr
      );
      if (!existingDoc) {
        const docId = crypto.randomUUID();
        CommitHelpers.createDoc({
          dispatch,
          socket,
          doc: {
            id: docId,
            userId: state?.userId,
            gridId,
            folderId: dayPagesFolder.id,
            manifestId: dayPagesFolder.manifestId || null,
            title: dateStr,
            docType: "day-page",
            sortOrder: Date.now(),
            content: {
              type: "doc",
              content: [
                { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: dateStr }] },
                { type: "paragraph", content: [] },
              ],
            },
          },
          emit: true,
        });
      }
    }
  }, [dispatch, state?.gridId, state?.grid?._id, state?.folders, state?.docs, state?.userId]);

  // Category handlers (for compound filtering: time + category)
  const handleSelectCategory = useCallback((categoryId) => {
    setSelectedCategoryId(categoryId);
    const gridId = state?.gridId || state?.grid?._id;
    if (gridId) {
      CommitHelpers.updateGrid({
        dispatch,
        socket,
        gridId,
        grid: { selectedCategoryId: categoryId },
        emit: true,
      });
    }
  }, [dispatch, state?.gridId, state?.grid?._id]);

  const handleCategoryValueChange = useCallback((value) => {
    setCurrentCategoryValue(value);
    const gridId = state?.gridId || state?.grid?._id;
    if (gridId) {
      CommitHelpers.updateGrid({
        dispatch,
        socket,
        gridId,
        grid: { currentCategoryValue: value },
        emit: true,
      });
    }
  }, [dispatch, state?.gridId, state?.grid?._id]);

  const handleCommitCategoryDimensions = useCallback((newDimensions) => {
    const gridId = state?.gridId || state?.grid?._id;
    if (!gridId) return;

    CommitHelpers.updateGrid({
      dispatch,
      socket,
      gridId,
      grid: { categoryDimensions: newDimensions },
      emit: true,
    });
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

  // Field CRUD handlers (grid-level field management)
  const createField = useCallback((field) => {
    const gridId = state?.gridId || state?.grid?._id;
    if (!gridId || !state.userId) return;

    const fieldWithGrid = { ...field, gridId, userId: state.userId };
    dispatch({ type: ActionTypes.CREATE_FIELD, payload: fieldWithGrid });
    socket.emit("create_field", { field: fieldWithGrid });
  }, [dispatch, state?.gridId, state?.grid?._id, state.userId]);

  const updateField = useCallback((field) => {
    if (!field?.id) return;
    dispatch({ type: ActionTypes.UPDATE_FIELD, payload: field });
    socket.emit("update_field", { field });
  }, [dispatch]);

  const deleteField = useCallback((fieldId) => {
    if (!fieldId) return;
    dispatch({ type: ActionTypes.DELETE_FIELD, payload: fieldId });
    socket.emit("delete_field", { fieldId });
  }, [dispatch]);

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

      // Full state object for calculations
      state,

      instancesById,
      occurrencesById,
      containersById,
      fieldsById,
      panelsById,
      manifestsById,
      viewsById,
      docsById,
      foldersById,
      artifactsById,
      addContainerToPanel,
      addInstanceToContainer,
      // Field CRUD
      createField,
      updateField,
      deleteField,
      // Iteration handlers
      // Time iteration handlers
      onCommitIterations: handleCommitIterations,
      iterations,
      selectedIterationId,
      currentIterationValue,
      onSelectIteration: handleSelectIteration,
      onIterationValueChange: handleIterationValueChange,
      // Category iteration handlers (for compound filtering)
      categoryDimensions,
      selectedCategoryId,
      currentCategoryValue,
      onSelectCategory: handleSelectCategory,
      onCategoryValueChange: handleCategoryValueChange,
      onCommitCategoryDimensions: handleCommitCategoryDimensions,

      // Undo/Redo state (lifted to App so Toolbar + Grid can both access)
      canUndo,
      canRedo,
      undo,
      redo,
      isProcessing,
    }),
    [
      dispatch,
      state,
      instancesById,
      occurrencesById,
      containersById,
      fieldsById,
      panelsById,
      manifestsById,
      viewsById,
      docsById,
      foldersById,
      artifactsById,
      addContainerToPanel,
      addInstanceToContainer,
      createField,
      updateField,
      deleteField,
      handleCommitIterations,
      iterations,
      selectedIterationId,
      currentIterationValue,
      handleSelectIteration,
      handleIterationValueChange,
      categoryDimensions,
      selectedCategoryId,
      currentCategoryValue,
      handleSelectCategory,
      handleCategoryValueChange,
      handleCommitCategoryDimensions,
      canUndo,
      canRedo,
      undo,
      redo,
      isProcessing,
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
          categoryDimensions={categoryDimensions}
          selectedCategoryId={selectedCategoryId}
          currentCategoryValue={currentCategoryValue}
          onSelectCategory={handleSelectCategory}
          onCategoryValueChange={handleCategoryValueChange}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo && !isProcessing}
          canRedo={canRedo && !isProcessing}
          onHistory={() => setHistoryOpen(true)}
        />

        {/* Transaction History Dialog */}
        <TransactionHistory
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          gridId={state.gridId}
        />

        <div className="app-root grid-frame bg-background2 ring-1 ring-black/40 rounded-xl p-3 shadow-inner border border-border">
          {state.grid?._id ? (
            <Grid components={components} />
          ) : (
            <SpinnerOverlay label="Syncing grid…" />
          )}
        </div>

        {/* Toast notifications */}
        <Toaster />
      </GridDataContext.Provider>
    </GridActionsContext.Provider>
  );
}