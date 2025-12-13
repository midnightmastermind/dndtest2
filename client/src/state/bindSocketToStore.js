// state/bindSocketToStore.js
// =========================================
// bindSocketToStore.js — UPDATED (Aligned w/ server.js + ActionTypes)
// Goals:
// - Match backend event names + payload shapes (CURRENT server.js)
// - Dispatch ONLY the new unified ActionTypes (no legacy)
// - Keep auth + full_state behavior the same
// - Prepare for future CRUD (delete / unified update upserts) without breaking now
//
// Current server.js actually emits (today):
// - full_state
// - container_created                 { container }
// - instance_created_in_container     { containerId, instance }
// - container_items_updated           { containerId, items }
// - instance_updated                  { instance }
// - panel_updated                     panelObject
// - grid_updated                      gridPatchObject
//
// “Deleted” / “*_updated” (container_updated, etc.) are included as forward-compat
// listeners only (safe no-ops until server emits them).
// =========================================

import { ActionTypes } from "./actions";

export function bindSocketToStore(socket, dispatch) {
  // ======================================================
  // FULL STATE HYDRATE
  // (DO NOT CHANGE request_full_state behavior on server)
  // ======================================================
  socket.on("full_state", (payload = {}) => {
    console.log("[socket] full_state received:", payload);

    // Persist gridId like old app (if provided)
    if (payload.gridId) {
      localStorage.setItem("moduli-gridId", payload.gridId);
      dispatch({ type: ActionTypes.SET_GRID_ID, payload: payload.gridId });
    }

    dispatch({ type: ActionTypes.FULL_STATE, payload });
  });

  // ======================================================
  // CONTAINERS (CRUD)
  // NOTE: server.js currently emits container_created + container_items_updated
  // ======================================================

  // CURRENT server event
  socket.on("container_created", ({ container } = {}) => {
    if (!container?.id) return;

    dispatch({
      type: ActionTypes.CREATE_CONTAINER,
      payload: { container },
    });
  });

  // CURRENT server event
  socket.on("container_items_updated", ({ containerId, items } = {}) => {
    if (!containerId || !Array.isArray(items)) return;

    dispatch({
      type: ActionTypes.UPDATE_CONTAINER_ITEMS,
      payload: { containerId, items },
    });
  });

  // FORWARD-COMPAT (if you later make server emit this unified update upsert)
  socket.on("container_updated", (payload = {}) => {
    const container = payload.container || payload;
    const id = container?.id || payload.containerId;
    if (!id) return;

    dispatch({
      type: ActionTypes.UPDATE_CONTAINER,
      payload: { container: { ...container, id } },
    });
  });

  // FORWARD-COMPAT (not emitted by current server.js yet)
  socket.on("container_deleted", (payload = {}) => {
    const containerId = payload.containerId || payload.id;
    if (!containerId) return;

    dispatch({
      type: ActionTypes.DELETE_CONTAINER,
      payload: { containerId },
    });
  });

  // ======================================================
  // INSTANCES (CRUD)
  // NOTE: server.js currently emits instance_created_in_container + instance_updated
  // ======================================================

  // CURRENT server event
  socket.on("instance_created_in_container", ({ containerId, instance } = {}) => {
    if (!containerId || !instance?.id) return;

    dispatch({
      type: ActionTypes.CREATE_INSTANCE_IN_CONTAINER,
      payload: { containerId, instance },
    });
  });

  // CURRENT server event
  socket.on("instance_updated", ({ instance } = {}) => {
    if (!instance?.id) return;

    dispatch({
      type: ActionTypes.UPDATE_INSTANCE,
      payload: { instance },
    });
  });

  // FORWARD-COMPAT (not emitted by current server.js yet)
  socket.on("instance_deleted", (payload = {}) => {
    const instanceId = payload.instanceId || payload.id;
    if (!instanceId) return;

    dispatch({
      type: ActionTypes.DELETE_INSTANCE,
      payload: { instanceId },
    });
  });

  // ======================================================
  // PANELS (CRUD)
  // NOTE: server.js currently emits panel_updated (and uses it for create too)
  // ======================================================

  // CURRENT server event (used for create + update)
  socket.on("panel_updated", (panel) => {
    if (!panel?.id) return;

    dispatch({
      type: ActionTypes.UPDATE_PANEL,
      payload: { panel },
    });
  });

  // FORWARD-COMPAT (not emitted by current server.js yet)
  socket.on("panel_deleted", (payload = {}) => {
    const panelId = payload.panelId || payload.id;
    if (!panelId) return;

    dispatch({
      type: ActionTypes.DELETE_PANEL,
      payload: { panelId },
    });
  });

  // (Optional forward-compat alias)
  socket.on("panel_created", (panel) => {
    if (!panel?.id) return;

    dispatch({
      type: ActionTypes.UPDATE_PANEL,
      payload: { panel },
    });
  });

  // ======================================================
  // GRIDS (CRUD)
  // NOTE: server.js currently emits grid_updated with a PATCH OBJECT (not full grid)
  // ======================================================

  // CURRENT server event
  socket.on("grid_updated", (gridPatch = {}) => {
    // server currently does: io.emit("grid_updated", updatePatch)
    dispatch({
      type: ActionTypes.UPDATE_GRID,
      payload: { grid: gridPatch },
    });
  });

  // FORWARD-COMPAT (not emitted by current server.js yet)
  socket.on("grid_deleted", (payload = {}) => {
    const gridId = payload.gridId || payload.id;
    if (!gridId) return;

    dispatch({
      type: ActionTypes.DELETE_GRID,
      payload: { gridId },
    });

    // If you deleted the active grid, clear persisted selection
    const saved = localStorage.getItem("moduli-gridId");
    if (saved && saved === gridId) localStorage.removeItem("moduli-gridId");
  });

  // (Optional forward-compat alias)
  socket.on("grid_created", (payload = {}) => {
    const grid = payload.grid || payload;
    dispatch({
      type: ActionTypes.CREATE_GRID,
      payload: { grid },
    });
  });

  // ======================================================
  // AUTH (old behavior)
  // ======================================================
  socket.on("auth_success", ({ token, userId }) => {
    console.log("[socket] auth_success", { userId });

    localStorage.setItem("moduli-token", token);
    localStorage.setItem("moduli-userId", userId);
    localStorage.removeItem("moduli-gridId");

    // easiest: reload so socket.js re-auths cleanly
    window.location.reload();
  });

  socket.on("auth_error", (msg) => {
    console.log("[socket] auth_error:", msg);
    localStorage.removeItem("moduli-token");
    localStorage.removeItem("moduli-userId");
    localStorage.removeItem("moduli-gridId");
  });

  socket.on("connect_error", (err) => {
    console.log("[socket] connect_error:", err?.message);

    if (err?.message === "INVALID_TOKEN" || err?.message === "USER_NOT_FOUND") {
      localStorage.removeItem("moduli-token");
      localStorage.removeItem("moduli-userId");
      localStorage.removeItem("moduli-gridId");
      window.location.reload();
    }
  });

  // ======================================================
  // SERVER ERRORS / MISC
  // ======================================================
  socket.on("server_error", (msg) => {
    console.warn("[socket] server_error:", msg);
  });

  // ======================================================
  // CLEANUP (important with HMR)
  // ======================================================
  return () => {
    // full_state
    socket.off("full_state");

    // containers
    socket.off("container_created");
    socket.off("container_items_updated");
    socket.off("container_updated");
    socket.off("container_deleted");

    // instances
    socket.off("instance_created_in_container");
    socket.off("instance_updated");
    socket.off("instance_deleted");

    // panels
    socket.off("panel_updated");
    socket.off("panel_deleted");
    socket.off("panel_created");

    // grids
    socket.off("grid_updated");
    socket.off("grid_deleted");
    socket.off("grid_created");

    // auth
    socket.off("auth_success");
    socket.off("auth_error");
    socket.off("connect_error");

    // misc
    socket.off("server_error");
  };
}
