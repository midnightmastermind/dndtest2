// client/src/state/bindSocketToStore.js
// =========================================
// bindSocketToStore.js — CLEAN + CONSISTENT
// Goals:
// - Match server.js event names + payload shapes
// - Dispatch ActionTypes using the SAME shapes your reducer/action-creators expect
// - Keep auth + full_state behavior correct (reconnect w/ token, then hydrate)
// - Provide proper cleanup for HMR
//
// MERGED FIXES:
// - full_state -> ONLY dispatch FULL_STATE (atomic hydrate incl gridId)
// - auth_success -> DO NOT wipe moduli-gridId (so selection persists)
// =========================================

import { ActionTypes } from "./actions";

export function bindSocketToStore(socket, dispatch) {
  // ======================================================
  // FULL STATE HYDRATE
  // ======================================================
  function onFullState(payload = {}) {
    console.log("[socket] full_state received:", payload);

    // persist selection
    if (payload.gridId) {
      localStorage.setItem("moduli-gridId", payload.gridId);
    }

    // ✅ single atomic hydrate (sets gridId + grid + panels + grids list + etc)
    dispatch({ type: ActionTypes.FULL_STATE, payload });
  }

  socket.on("full_state", onFullState);

  // ======================================================
  // CONTAINERS (CRUD)
  // ======================================================
  function onContainerCreated({ container } = {}) {
    if (!container?.id) return;

    dispatch({
      type: ActionTypes.CREATE_CONTAINER,
      payload: { container },
    });
  }

  function onContainerItemsUpdated({ containerId, items } = {}) {
    if (!containerId || !Array.isArray(items)) return;

    dispatch({
      type: ActionTypes.UPDATE_CONTAINER_ITEMS,
      payload: { containerId, items },
    });
  }

  // forward-compat
  function onContainerUpdated(payload = {}) {
    const container = payload.container || payload;
    const id = container?.id || payload.containerId;
    if (!id) return;

    dispatch({
      type: ActionTypes.UPDATE_CONTAINER,
      payload: { container: { ...container, id } },
    });
  }

  // forward-compat
  function onContainerDeleted(payload = {}) {
    const containerId = payload.containerId || payload.id;
    if (!containerId) return;

    dispatch({
      type: ActionTypes.DELETE_CONTAINER,
      payload: { containerId },
    });
  }

  socket.on("container_created", onContainerCreated);
  socket.on("container_items_updated", onContainerItemsUpdated);
  socket.on("container_updated", onContainerUpdated);
  socket.on("container_deleted", onContainerDeleted);

  // ======================================================
  // INSTANCES (CRUD)
  // ======================================================
  function onInstanceCreatedInContainer({ containerId, instance } = {}) {
    if (!containerId || !instance?.id) return;

    dispatch({
      type: ActionTypes.CREATE_INSTANCE_IN_CONTAINER,
      payload: { containerId, instance },
    });
  }

  function onInstanceUpdated({ instance } = {}) {
    if (!instance?.id) return;

    dispatch({
      type: ActionTypes.UPDATE_INSTANCE,
      payload: { instance },
    });
  }

  // forward-compat
  function onInstanceDeleted(payload = {}) {
    const instanceId = payload.instanceId || payload.id;
    if (!instanceId) return;

    dispatch({
      type: ActionTypes.DELETE_INSTANCE,
      payload: { instanceId },
    });
  }

  socket.on("instance_created_in_container", onInstanceCreatedInContainer);
  socket.on("instance_updated", onInstanceUpdated);
  socket.on("instance_deleted", onInstanceDeleted);

  // ======================================================
  // PANELS (CRUD)
  // ======================================================
  function onPanelUpdated(panel) {
    if (!panel?.id) return;

    dispatch({
      type: ActionTypes.UPDATE_PANEL,
      payload: { panel },
    });
  }

  // forward-compat
  function onPanelDeleted(payload = {}) {
    const panelId = payload.panelId || payload.id;
    if (!panelId) return;

    dispatch({
      type: ActionTypes.DELETE_PANEL,
      payload: { panelId },
    });
  }

  // optional alias
  function onPanelCreated(panel) {
    if (!panel?.id) return;

    dispatch({
      type: ActionTypes.UPDATE_PANEL,
      payload: { panel },
    });
  }

  socket.on("panel_updated", onPanelUpdated);
  socket.on("panel_deleted", onPanelDeleted);
  socket.on("panel_created", onPanelCreated);

  // ======================================================
  // GRIDS (CRUD)
  // ======================================================
  function onGridUpdated(gridPatch = {}) {
    dispatch({
      type: ActionTypes.UPDATE_GRID,
      payload: { grid: gridPatch },
    });
  }

  // forward-compat
  function onGridDeleted(payload = {}) {
    const gridId = payload.gridId || payload.id;
    if (!gridId) return;

    dispatch({
      type: ActionTypes.DELETE_GRID,
      payload: { gridId },
    });

    const saved = localStorage.getItem("moduli-gridId");
    if (saved && saved === gridId) localStorage.removeItem("moduli-gridId");
  }

  // optional alias
  function onGridCreated(payload = {}) {
    const grid = payload.grid || payload;
    dispatch({
      type: ActionTypes.CREATE_GRID,
      payload: { grid },
    });
  }

  socket.on("grid_updated", onGridUpdated);
  socket.on("grid_deleted", onGridDeleted);
  socket.on("grid_created", onGridCreated);

  // ======================================================
  // AUTH
  // ======================================================
  function onAuthSuccess({ token, userId } = {}) {
    console.log("[socket] auth_success", { userId });

    if (token) localStorage.setItem("moduli-token", token);
    if (userId) localStorage.setItem("moduli-userId", userId);

    // ✅ IMPORTANT FIX:
    // Do NOT wipe moduli-gridId here, or you lose selected grid persistence.
    // localStorage.removeItem("moduli-gridId");

    dispatch({
      type: ActionTypes.SET_USER_ID,
      payload: { userId },
    });

    // Force a new handshake so io.use(auth) runs with the token
    try {
      socket.disconnect();
    } catch {}

    socket.auth = { token };
    socket.connect();

    // Wait for reconnect, THEN hydrate
    socket.once("connect", () => {
      const savedGridId = localStorage.getItem("moduli-gridId");
      socket.emit(
        "request_full_state",
        savedGridId ? { gridId: savedGridId } : undefined
      );
    });
  }

  function onAuthError(msg) {
    console.log("[socket] auth_error:", msg);
    localStorage.removeItem("moduli-token");
    localStorage.removeItem("moduli-userId");
    localStorage.removeItem("moduli-gridId");
    dispatch({ type: ActionTypes.LOGOUT });
  }

  function onConnectError(err) {
    const msg = err?.message;
    console.log("[socket] connect_error:", msg);

    if (msg === "INVALID_TOKEN" || msg === "USER_NOT_FOUND") {
      localStorage.removeItem("moduli-token");
      localStorage.removeItem("moduli-userId");
      localStorage.removeItem("moduli-gridId");

      dispatch({ type: ActionTypes.LOGOUT });

      try {
        socket.disconnect();
      } catch {}

      socket.auth = {}; // guest
      socket.connect();
    }
  }

  socket.on("auth_success", onAuthSuccess);
  socket.on("auth_error", onAuthError);
  socket.on("connect_error", onConnectError);

  // ======================================================
  // SERVER ERRORS / MISC
  // ======================================================
  function onServerError(msg) {
    console.warn("[socket] server_error:", msg);
  }
  socket.on("server_error", onServerError);

  // ======================================================
  // CLEANUP (important with HMR)
  // ======================================================
  return () => {
    socket.off("full_state", onFullState);

    socket.off("container_created", onContainerCreated);
    socket.off("container_items_updated", onContainerItemsUpdated);
    socket.off("container_updated", onContainerUpdated);
    socket.off("container_deleted", onContainerDeleted);

    socket.off("instance_created_in_container", onInstanceCreatedInContainer);
    socket.off("instance_updated", onInstanceUpdated);
    socket.off("instance_deleted", onInstanceDeleted);

    socket.off("panel_updated", onPanelUpdated);
    socket.off("panel_deleted", onPanelDeleted);
    socket.off("panel_created", onPanelCreated);

    socket.off("grid_updated", onGridUpdated);
    socket.off("grid_deleted", onGridDeleted);
    socket.off("grid_created", onGridCreated);

    socket.off("auth_success", onAuthSuccess);
    socket.off("auth_error", onAuthError);
    socket.off("connect_error", onConnectError);

    socket.off("server_error", onServerError);
  };
}