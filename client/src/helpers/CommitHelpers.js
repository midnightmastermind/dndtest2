// helpers/CommitHelpers.js
import {
  createGridAction,
  updateGridAction,
  deleteGridAction,
  createPanelAction,
  updatePanelAction,
  deletePanelAction,
  createContainerAction,
  updateContainerAction,
  deleteContainerAction,
  createInstanceAction,
  createInstanceInContainerAction,
  updateInstanceAction,
  deleteInstanceAction,
} from "../state/actions";

/**
 * Commit helper contract:
 * - Always safe to call with missing dispatch/socket.
 * - "emit" controls whether we talk to the backend (hard save).
 *   - default: emit = true
 *   - set emit: false for "soft save" (dispatch only)
 */
function shouldEmit(emit) {
  return emit !== false;
}

// ===== GRID =====
export function createGrid({ dispatch, socket, grid, emit = true }) {
  if (!grid) return;
  dispatch?.(createGridAction(grid));
  if (shouldEmit(emit)) socket?.emit("create_grid", { grid });
}

export function updateGrid({ dispatch, socket, gridId, grid, emit = true }) {
  if (!gridId || !grid) return;

  // ✅ action creator now expects { gridId, grid }
  dispatch?.(updateGridAction({ gridId, grid }));

  if (shouldEmit(emit)) socket?.emit("update_grid", { gridId, grid });
}

export function deleteGrid({ dispatch, socket, gridId, emit = true }) {
  if (!gridId) return;
  dispatch?.(deleteGridAction(gridId));
  if (shouldEmit(emit)) socket?.emit("delete_grid", { gridId });
}

// ===== PANEL =====
export function createPanel({ dispatch, socket, panel, emit = true }) {
  if (!panel) return;
  dispatch?.(createPanelAction(panel));
  if (shouldEmit(emit)) socket?.emit("create_panel", { panel });
}

export function updatePanel({ dispatch, socket, panel, emit = true }) {
  if (!panel?.id) return;
  dispatch?.(updatePanelAction(panel));
  if (shouldEmit(emit)) socket?.emit("update_panel", { panel });
}

export function deletePanel({ dispatch, socket, panelId, emit = true }) {
  if (!panelId) return;
  dispatch?.(deletePanelAction(panelId));
  if (shouldEmit(emit)) socket?.emit("delete_panel", { panelId });
}

// ===== CONTAINER =====
export function createContainer({ dispatch, socket, container, emit = true }) {
  if (!container) return;
  dispatch?.(createContainerAction(container));
  if (shouldEmit(emit)) socket?.emit("create_container", { container });
}

export function updateContainer({ dispatch, socket, container, emit = true }) {
  if (!container?.id) return;
  dispatch?.(updateContainerAction(container));
  if (shouldEmit(emit)) socket?.emit("update_container", { container });
}

export function deleteContainer({ dispatch, socket, containerId, emit = true }) {
  if (!containerId) return;
  dispatch?.(deleteContainerAction(containerId));
  if (shouldEmit(emit)) socket?.emit("delete_container", { containerId });
}

// ===== INSTANCE =====
//
// IMPORTANT:
// Your server supports:
// - "create_instance_in_container" (upsert + attach)
// - "update_instance" (upsert)
// - "delete_instance"
//
// It does NOT (in the file you pasted) support "create_instance".
//
export function createInstance({ dispatch, socket, instance, emit = true }) {
  if (!instance) return;

  // local create is still useful for optimistic UI
  dispatch?.(createInstanceAction(instance));

  // ✅ use update_instance as the backend upsert path
  if (shouldEmit(emit)) socket?.emit("update_instance", { instance });
}

// ✅ NEW: preferred path for “add item to a list”
export function createInstanceInContainer({
  dispatch,
  socket,
  containerId,
  instance,
  emit = true,
}) {
  if (!containerId || !instance?.id) return;

  // atomic optimistic state: adds instance (if missing) AND pushes into container.items
  dispatch?.(createInstanceInContainerAction({ containerId, instance }));

  if (shouldEmit(emit)) {
    socket?.emit("create_instance_in_container", { containerId, instance });
  }
}

export function updateInstance({ dispatch, socket, instance, emit = true }) {
  if (!instance?.id) return;
  dispatch?.(updateInstanceAction(instance));
  if (shouldEmit(emit)) socket?.emit("update_instance", { instance });
}

export function deleteInstance({ dispatch, socket, instanceId, emit = true }) {
  if (!instanceId) return;
  dispatch?.(deleteInstanceAction(instanceId));
  if (shouldEmit(emit)) socket?.emit("delete_instance", { instanceId });
}