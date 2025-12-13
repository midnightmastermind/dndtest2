import React, { useEffect, useMemo, useState } from "react";
import Textfield from "@atlaskit/textfield";
import Button from "@atlaskit/button";
import { Label } from "@atlaskit/form";

import { socket } from "./socket";
import { bindSocketToStore } from "./state/bindSocketToStore";
import { ActionTypes } from "./state/actions";

import Grid from "./Grid";
import LoginScreen from "./LoginScreen";

import { GridDataContext } from "./GridDataContext";
import { GridActionsContext } from "./GridActionsContext";

import { useBoardState } from "./state/useBoardState";
import { useDndReorderCoordinator } from "./helpers/useDndReorderCoordinator";

// --------- helpers ----------
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
  const { gridId, grid, panels = [], availableGrids = [] } = state;

  // coordinator stays, but we only use addContainer in Panel button
  const { addContainer } = useDndReorderCoordinator({ state, dispatch, socket });

  // toolbar UI state
  const [showToolbar, setShowToolbar] = useState(false);
  const [gridName, setGridName] = useState("");
  const [rowInput, setRowInput] = useState("1");
  const [colInput, setColInput] = useState("1");

  // SOCKET bind + hydrate
  useEffect(() => {
    const unbind = bindSocketToStore(socket, dispatch);

    const savedUserId = localStorage.getItem("moduli-userId");
    const savedGridId = localStorage.getItem("moduli-gridId");

    if (savedUserId) {
      if (savedGridId) socket.emit("request_full_state", { gridId: savedGridId });
      else socket.emit("request_full_state");
    }

    return () => unbind?.();
  }, [dispatch]);

  // sync toolbar inputs from grid
  useEffect(() => {
    if (!grid) {
      setGridName("");
      setRowInput("1");
      setColInput("1");
      return;
    }
    setGridName(grid.name || "");
    setRowInput(String(grid.rows ?? 1));
    setColInput(String(grid.cols ?? 1));
  }, [grid?._id, grid?.rows, grid?.cols, grid?.name]);

  // ---------- toolbar handlers (grid only) ----------
  const handleGridChange = (e) => {
    const newGridId = e.target.value;
    if (!newGridId || newGridId === gridId) return;

    localStorage.setItem("moduli-gridId", newGridId);
    socket.emit("request_full_state", { gridId: newGridId });
  };

  const handleCreateNewGrid = () => {
    localStorage.removeItem("moduli-gridId");
    socket.emit("request_full_state"); // server creates
  };

  const updateRows = (value) => {
    if (!gridId) return;
    const num = Math.max(1, Number(value) || 1);

    dispatch({ type: ActionTypes.PATCH_GRID, payload: { grid: { rows: num } } });
    socket.emit("update_grid", { gridId, rows: num });
  };

  const updateCols = (value) => {
    if (!gridId) return;
    const num = Math.max(1, Number(value) || 1);

    dispatch({ type: ActionTypes.PATCH_GRID, payload: { grid: { cols: num } } });
    socket.emit("update_grid", { gridId, cols: num });
  };

  const commitGridName = () => {
    if (!gridId) return;
    const trimmed = (gridName || "").trim();
    if (!trimmed) return;

    dispatch({ type: ActionTypes.PATCH_GRID, payload: { grid: { name: trimmed } } });
    socket.emit("update_grid", { gridId, name: trimmed });
  };

  const addNewPanel = () => {
    if (!gridId || !grid) return;

    const panelId = crypto.randomUUID();
    const { row, col } = findNextOpenPosition(panels, grid.rows ?? 1, grid.cols ?? 1);

    const panel = {
      id: panelId,
      type: "taskbox", // default; you can change options in Panel.jsx
      props: {},
      row,
      col,
      width: 1,
      height: 1,
      gridId, // keep so Grid can filter visible panels
    };

    // optimistic
    dispatch({ type: ActionTypes.PATCH_PANEL, payload: { panel } });
    socket.emit("add_panel", { panel });
  };

  // ---------- contexts ----------
  const dataValue = useMemo(
    () => ({
      gridId: state.gridId,
      grid: state.grid,
      panels: state.panels,
      availableGrids: state.availableGrids,
      hydrated: state.hydrated,
    }),
    [state.gridId, state.grid, state.panels, state.availableGrids, state.hydrated]
  );

  const actionsValue = useMemo(
    () => ({
      toggleToolbar: () => setShowToolbar(true),
      hideToolbar: () => setShowToolbar(false),

      // grid/panel actions used by Grid / Panel
      addPanel: addNewPanel,

      // your coordinator hook
      addContainer,
    }),
    [addContainer]
  );

  // LOGIN gate
  const savedUserId = localStorage.getItem("moduli-userId");
  if (!savedUserId) return <LoginScreen />;

  if (!grid) {
    return (
      <div
        style={{
          color: "white",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          border: "2px dashed rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        Initializing grid…
      </div>
    );
  }

  return (
    <GridActionsContext.Provider value={actionsValue}>
      <GridDataContext.Provider value={dataValue}>
        {/* Toolbar (same as old behavior) */}
        <div
          style={{
            position: "absolute",
            top: showToolbar ? 0 : "-60px",
            width: "100%",
            height: 60,
            background: "#1C1F26",
            borderBottom: "1px solid #444",
            display: "flex",
            alignItems: "center",
            gap: 10,
            transition: "top 200ms ease",
            zIndex: 5000,
          }}
        >
          <div style={{ marginLeft: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#fff", fontSize: 12 }}>Grid</span>
            <select
              value={gridId || ""}
              onChange={handleGridChange}
              style={{
                background: "#22272B",
                color: "white",
                border: "1px solid #444",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 12,
              }}
            >
              {availableGrids.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name || `Grid ${String(g.id).slice(-4)}`}
                </option>
              ))}
            </select>

            <Button appearance="default" onClick={handleCreateNewGrid}>
              New Grid
            </Button>
          </div>

          <div style={{ height: 45, maxWidth: 420, display: "flex", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <Label htmlFor="grid_name" style={{ color: "white" }}>
                Grid Name
              </Label>
              <Textfield
                id="grid_name"
                value={gridName ?? ""}
                onChange={(e) => setGridName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitGridName();
                    e.currentTarget.blur();
                  }
                }}
              />
            </div>

            <div style={{ maxWidth: 70, display: "flex", flexDirection: "column" }}>
              <Label htmlFor="grid_row" style={{ color: "white" }}>
                Row
              </Label>
              <Textfield
                id="grid_row"
                type="number"
                value={rowInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setRowInput(val);
                  if (val === "") return;
                  updateRows(val);
                }}
                onBlur={() => {
                  if (rowInput === "") {
                    setRowInput("1");
                    updateRows("1");
                  }
                }}
              />
            </div>

            <div style={{ maxWidth: 70, display: "flex", flexDirection: "column" }}>
              <Label htmlFor="grid_col" style={{ color: "white" }}>
                Col
              </Label>
              <Textfield
                id="grid_col"
                type="number"
                value={colInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setColInput(val);
                  if (val === "") return;
                  updateCols(val);
                }}
                onBlur={() => {
                  if (colInput === "") {
                    setColInput("1");
                    updateCols("1");
                  }
                }}
              />
            </div>
          </div>

          <Button appearance="primary" onClick={addNewPanel}>
            Add Panel
          </Button>

          <Button
            style={{ marginLeft: "auto", marginRight: 10 }}
            appearance="warning"
            onClick={() => setShowToolbar(false)}
          >
            Close
          </Button>
        </div>

        <div
          data-color-mode="dark"
          style={{ background: "#1D2125", height: "100vh", overflow: "hidden" }}
        >
          <Grid />
        </div>
      </GridDataContext.Provider>
    </GridActionsContext.Provider>
  );
}
