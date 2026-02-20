// client/src/state/bindSocketToStore.js
// =========================================
// bindSocketToStore.js — CLEAN + CONSISTENT
// ✅ UPDATED for no-echo rooms:
// - Other windows must self-heal if their active grid is deleted.
// =========================================

import { ActionTypes } from "./actions";

export function bindSocketToStore(socket, dispatch) {
  // Wrap dispatch to tag all socket-originated actions
  // This prevents BroadcastChannel from re-broadcasting server events
  const socketDispatch = (action) => dispatch({ ...action, _fromSocket: true });

  // ======================================================
  // FULL STATE HYDRATE
  // ======================================================
  function onFullState(payload = {}) {
    console.log("[socket] full_state received:", payload);

    // persist selection
    if (payload.gridId) {
      localStorage.setItem("moduli-gridId", payload.gridId);
    }

    socketDispatch({ type: ActionTypes.FULL_STATE, payload });
  }

  socket.on("full_state", onFullState);

  // ======================================================
  // CONTAINERS (CRUD)
  // ======================================================
  function onContainerCreated({ container } = {}) {
    if (!container?.id) return;

    socketDispatch({
      type: ActionTypes.CREATE_CONTAINER,
      payload: { container },
    });
  }

  function onContainerItemsUpdated({ containerId, items, occurrences } = {}) {
    const occList = occurrences || items;
    if (!containerId || !Array.isArray(occList)) return;

    socketDispatch({
      type: ActionTypes.UPDATE_CONTAINER_OCCURRENCES,
      payload: { containerId, occurrences: occList },
    });
  }

  function onContainerUpdated(payload = {}) {
    const container = payload.container || payload;
    const id = container?.id || payload.containerId;
    if (!id) return;

    socketDispatch({
      type: ActionTypes.UPDATE_CONTAINER,
      payload: { container: { ...container, id } },
    });
  }

  function onContainerDeleted(payload = {}) {
    const containerId = payload.containerId || payload.id;
    if (!containerId) return;

    socketDispatch({
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

    socketDispatch({
      type: ActionTypes.CREATE_INSTANCE_IN_CONTAINER,
      payload: { containerId, instance },
    });
  }

  function onInstanceUpdated({ instance } = {}) {
    if (!instance?.id) return;

    socketDispatch({
      type: ActionTypes.UPDATE_INSTANCE,
      payload: { instance },
    });
  }

  function onInstanceDeleted(payload = {}) {
    const instanceId = payload.instanceId || payload.id;
    if (!instanceId) return;

    socketDispatch({
      type: ActionTypes.DELETE_INSTANCE,
      payload: { instanceId },
    });
  }

  socket.on("instance_created_in_container", onInstanceCreatedInContainer);
  socket.on("instance_updated", onInstanceUpdated);
  socket.on("instance_deleted", onInstanceDeleted);

  // ======================================================
  // OCCURRENCES (CRUD)
  // ======================================================
  function onOccurrenceCreated({ occurrence } = {}) {
    if (!occurrence?.id) return;

    socketDispatch({
      type: ActionTypes.CREATE_OCCURRENCE,
      payload: { occurrence },
    });
  }

  function onOccurrenceUpdated({ occurrence } = {}) {
    if (!occurrence?.id) return;

    socketDispatch({
      type: ActionTypes.UPDATE_OCCURRENCE,
      payload: { occurrence },
    });
  }

  function onOccurrenceDeleted(payload = {}) {
    const occurrenceId = payload.occurrenceId || payload.id;
    if (!occurrenceId) return;

    socketDispatch({
      type: ActionTypes.DELETE_OCCURRENCE,
      payload: { occurrenceId },
    });
  }

  socket.on("occurrence_created", onOccurrenceCreated);
  socket.on("occurrence_updated", onOccurrenceUpdated);
  socket.on("occurrence_deleted", onOccurrenceDeleted);

  // ======================================================
  // FIELDS (CRUD)
  // ======================================================
  function onFieldCreated({ field } = {}) {
    if (!field?.id) return;

    socketDispatch({
      type: ActionTypes.CREATE_FIELD,
      payload: { field },
    });
  }

  function onFieldUpdated({ field } = {}) {
    if (!field?.id) return;

    socketDispatch({
      type: ActionTypes.UPDATE_FIELD,
      payload: { field },
    });
  }

  function onFieldDeleted(payload = {}) {
    const fieldId = payload.fieldId || payload.id;
    if (!fieldId) return;

    socketDispatch({
      type: ActionTypes.DELETE_FIELD,
      payload: { fieldId },
    });
  }

  socket.on("field_created", onFieldCreated);
  socket.on("field_updated", onFieldUpdated);
  socket.on("field_deleted", onFieldDeleted);

  // ======================================================
  // PANELS (CRUD)
  // ======================================================
  function onPanelUpdated(panel) {
    if (!panel?.id) return;

    socketDispatch({
      type: ActionTypes.UPDATE_PANEL,
      payload: { panel },
    });
  }

  function onPanelDeleted(payload = {}) {
    const panelId = payload.panelId || payload.id;
    if (!panelId) return;

    socketDispatch({
      type: ActionTypes.DELETE_PANEL,
      payload: { panelId },
    });
  }

  function onPanelCreated(panel) {
    if (!panel?.id) return;

    socketDispatch({
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
  function onGridUpdated(payload = {}) {
    const gridId = payload.gridId || payload.id;
    const patch = payload.grid || payload;

    if (!gridId) return;

    socketDispatch({
      type: ActionTypes.UPDATE_GRID,
      payload: { gridId, grid: patch },
    });
  }

  // ✅ UPDATED: self-heal other windows when their active grid is deleted
  function onGridDeleted(payload = {}) {
    const gridId = payload.gridId || payload.id;
    if (!gridId) return;

    socketDispatch({
      type: ActionTypes.DELETE_GRID,
      payload: { gridId },
    });

    const saved = localStorage.getItem("moduli-gridId");
    if (saved && saved === gridId) {
      localStorage.removeItem("moduli-gridId");
      // ✅ in no-echo mode, other windows must re-hydrate themselves
      socket.emit("request_full_state");
    }
  }

  function onGridCreated(payload = {}) {
    const grid = payload.grid || payload;
    socketDispatch({
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

    socketDispatch({
      type: ActionTypes.SET_USER_ID,
      payload: { userId },
    });

    try {
      socket.disconnect();
    } catch {}

    socket.auth = { token };
    socket.connect();

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
    socketDispatch({ type: ActionTypes.LOGOUT });
  }

  function onConnectError(err) {
    const msg = err?.message;
    console.log("[socket] connect_error:", msg);

    if (msg === "INVALID_TOKEN" || msg === "USER_NOT_FOUND") {
      localStorage.removeItem("moduli-token");
      localStorage.removeItem("moduli-userId");
      localStorage.removeItem("moduli-gridId");

      socketDispatch({ type: ActionTypes.LOGOUT });

      try {
        socket.disconnect();
      } catch {}

      socket.auth = {};
      socket.connect();
    }
  }

  socket.on("auth_success", onAuthSuccess);
  socket.on("auth_error", onAuthError);
  socket.on("connect_error", onConnectError);

  // ======================================================
  // GENERIC CRUD — Manifests, Views, Docs, Folders, Artifacts
  // ======================================================
  const genericModels = [
    { name: "manifest", createType: ActionTypes.CREATE_MANIFEST, updateType: ActionTypes.UPDATE_MANIFEST, deleteType: ActionTypes.DELETE_MANIFEST },
    { name: "view", createType: ActionTypes.CREATE_VIEW, updateType: ActionTypes.UPDATE_VIEW, deleteType: ActionTypes.DELETE_VIEW },
    { name: "doc", createType: ActionTypes.CREATE_DOC, updateType: ActionTypes.UPDATE_DOC, deleteType: ActionTypes.DELETE_DOC },
    { name: "folder", createType: ActionTypes.CREATE_FOLDER, updateType: ActionTypes.UPDATE_FOLDER, deleteType: ActionTypes.DELETE_FOLDER },
    { name: "artifact", createType: ActionTypes.CREATE_ARTIFACT, updateType: ActionTypes.UPDATE_ARTIFACT, deleteType: ActionTypes.DELETE_ARTIFACT },
  ];

  const genericHandlers = [];

  for (const { name, createType, updateType, deleteType } of genericModels) {
    const onCreated = (payload = {}) => {
      const entity = payload[name];
      if (!entity?.id) return;
      socketDispatch({ type: createType, payload: { [name]: entity } });
    };
    const onUpdated = (payload = {}) => {
      const entity = payload[name];
      if (!entity?.id) return;
      socketDispatch({ type: updateType, payload: { [name]: entity } });
    };
    const onDeleted = (payload = {}) => {
      const entityId = payload[`${name}Id`] || payload.id;
      if (!entityId) return;
      socketDispatch({ type: deleteType, payload: { [`${name}Id`]: entityId } });
    };

    socket.on(`${name}_created`, onCreated);
    socket.on(`${name}_updated`, onUpdated);
    socket.on(`${name}_deleted`, onDeleted);

    genericHandlers.push({ name, onCreated, onUpdated, onDeleted });
  }

  // ======================================================
  // SERVER ERRORS / MISC
  // ======================================================
  function onServerError(msg) {
    console.warn("[socket] server_error:", msg);

    if (typeof msg === "string" && msg.toLowerCase().includes("grid not found")) {
      localStorage.removeItem("moduli-gridId");
      socket.emit("request_full_state");
    }
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

    socket.off("occurrence_created", onOccurrenceCreated);
    socket.off("occurrence_updated", onOccurrenceUpdated);
    socket.off("occurrence_deleted", onOccurrenceDeleted);

    socket.off("field_created", onFieldCreated);
    socket.off("field_updated", onFieldUpdated);
    socket.off("field_deleted", onFieldDeleted);

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

    for (const { name, onCreated, onUpdated, onDeleted } of genericHandlers) {
      socket.off(`${name}_created`, onCreated);
      socket.off(`${name}_updated`, onUpdated);
      socket.off(`${name}_deleted`, onDeleted);
    }
  };
}