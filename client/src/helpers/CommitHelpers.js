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
  updateInstanceAction,
  deleteInstanceAction,
} from "../state/actions";

/**
 * Commit helper contract:
 * - Always safe to call with missing dispatch/socket.
 * - "emit" controls whether we talk to the backend (hard save).
 *   - default: emit = true (keeps existing behavior)
 *   - set emit: false for "soft save" (dispatch only)
 *
 * NOTE:
 * - If emit=false, we do NOT call socket.emit even if socket exists.
 * - If emit=true but socket is missing, we still do the dispatch (if provided).
 */

// ===== GRID =====
export function createGrid({ dispatch, socket, grid, emit = true }) {
  if (!grid) return;
  dispatch?.(createGridAction(grid));
  if (emit) socket?.emit("create_grid", { grid });
}

export function updateGrid({ dispatch, socket, gridId, grid, emit = true }) {
  if (!gridId || !grid) return;
  dispatch?.(updateGridAction({ gridId, grid }));
  if (emit) socket?.emit("update_grid", { gridId, grid });
}

export function deleteGrid({ dispatch, socket, gridId, emit = true }) {
  if (!gridId) return;
  dispatch?.(deleteGridAction(gridId));
  if (emit) socket?.emit("delete_grid", { gridId });
}

// ===== PANEL =====
export function createPanel({ dispatch, socket, panel, emit = true }) {
  if (!panel) return;
  dispatch?.(createPanelAction(panel));
  if (emit) socket?.emit("create_panel", { panel });
}

export function updatePanel({ dispatch, socket, panel, emit = true }) {
  if (!panel?.id) return;
  dispatch?.(updatePanelAction(panel));
  if (emit) socket?.emit("update_panel", { panel });
}

export function deletePanel({ dispatch, socket, panelId, emit = true }) {
  if (!panelId) return;
  dispatch?.(deletePanelAction(panelId));
  if (emit) socket?.emit("delete_panel", { panelId });
}

// ===== CONTAINER =====
export function createContainer({ dispatch, socket, container, emit = true }) {
  if (!container) return;
  dispatch?.(createContainerAction(container));
  if (emit) socket?.emit("create_container", { container });
}

export function updateContainer({ dispatch, socket, container, emit = true }) {
  if (!container?.id) return;
  dispatch?.(updateContainerAction(container));
  if (emit) socket?.emit("update_container", { container });
}

export function deleteContainer({ dispatch, socket, containerId, emit = true }) {
  if (!containerId) return;
  dispatch?.(deleteContainerAction(containerId));
  if (emit) socket?.emit("delete_container", { containerId });
}

// ===== INSTANCE =====
export function createInstance({ dispatch, socket, instance, emit = true }) {
  if (!instance) return;
  dispatch?.(createInstanceAction(instance));
  if (emit) socket?.emit("create_instance", { instance });
}

export function updateInstance({ dispatch, socket, instance, emit = true }) {
  if (!instance?.id) return;
  dispatch?.(updateInstanceAction(instance));
  if (emit) socket?.emit("update_instance", { instance });
}

export function deleteInstance({ dispatch, socket, instanceId, emit = true }) {
  if (!instanceId) return;
  dispatch?.(deleteInstanceAction(instanceId));
  if (emit) socket?.emit("delete_instance", { instanceId });
}
