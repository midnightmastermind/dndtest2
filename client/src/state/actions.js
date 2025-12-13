// state/actions.js
// =========================================
// actions.js — SINGLE SOURCE OF TRUTH
// Aligned with:
// - server.js socket events
// - state/bindSocketToStore.js dispatches
//
// Conventions:
// - CREATE_* : create a new entity (server will create + emit created/updated)
// - UPDATE_* : update an existing entity
// - DELETE_* : delete an entity
//
// IMPORTANT (matches your current bindSocketToStore.js):
// - container_created          -> CREATE_CONTAINER
// - instance_created_in_container -> CREATE_INSTANCE_IN_CONTAINER
// - container_items_updated    -> UPDATE_CONTAINER_ITEMS
// - instance_updated           -> UPDATE_INSTANCE
// - panel_updated              -> UPDATE_PANEL
// - grid_updated               -> UPDATE_GRID
// - full_state                 -> FULL_STATE (+ SET_GRID_ID handled in bindSocketToStore)
// =========================================

export const ActionTypes = {
  // ------------------------------------------------------
  // Hydration
  // ------------------------------------------------------
  FULL_STATE: "FULL_STATE",

  // ------------------------------------------------------
  // Auth/User/Grid selection
  // ------------------------------------------------------
  SET_USER_ID: "SET_USER_ID",
  SET_GRID_ID: "SET_GRID_ID",
  LOGOUT: "LOGOUT",
  // ------------------------------------------------------
  // Grids
  // ------------------------------------------------------
  CREATE_GRID: "CREATE_GRID",
  UPDATE_GRID: "UPDATE_GRID",
  DELETE_GRID: "DELETE_GRID",
  SET_AVAILABLE_GRIDS: "SET_AVAILABLE_GRIDS",
  SET_GRID: "SET_GRID",

  // ------------------------------------------------------
  // Panels
  // ------------------------------------------------------
  CREATE_PANEL: "CREATE_PANEL",
  UPDATE_PANEL: "UPDATE_PANEL",
  DELETE_PANEL: "DELETE_PANEL",
  SET_PANELS: "SET_PANELS",

  // ------------------------------------------------------
  // Containers
  // ------------------------------------------------------
  CREATE_CONTAINER: "CREATE_CONTAINER",
  UPDATE_CONTAINER: "UPDATE_CONTAINER",
  DELETE_CONTAINER: "DELETE_CONTAINER",
  SET_CONTAINERS: "SET_CONTAINERS",

  // Used by bindSocketToStore for reorder:
  UPDATE_CONTAINER_ITEMS: "UPDATE_CONTAINER_ITEMS",

  // ------------------------------------------------------
  // Instances
  // ------------------------------------------------------
  CREATE_INSTANCE: "CREATE_INSTANCE",
  UPDATE_INSTANCE: "UPDATE_INSTANCE",
  DELETE_INSTANCE: "DELETE_INSTANCE",
  SET_INSTANCES: "SET_INSTANCES",

  // Used by bindSocketToStore for "create inside container":
  CREATE_INSTANCE_IN_CONTAINER: "CREATE_INSTANCE_IN_CONTAINER",

  // ------------------------------------------------------
  // DnD / UI debug
  // ------------------------------------------------------
  SET_ACTIVE_ID: "SET_ACTIVE_ID",
  SET_ACTIVE_SIZE: "SET_ACTIVE_SIZE",
  SET_DEBUG_EVENT: "SET_DEBUG_EVENT",
  SOFT_TICK: "SOFT_TICK",
};

// =========================================================
// Action Creators (optional but nice)
// =========================================================

// ---- hydration ----
export const fullStateAction = (payload) => ({
  type: ActionTypes.FULL_STATE,
  payload,
});

// ---- auth/user ----
export const setUserIdAction = (userId) => ({
  type: ActionTypes.SET_USER_ID,
  payload: { userId },
});

export const setGridIdAction = (gridId) => ({
  type: ActionTypes.SET_GRID_ID,
  payload: { gridId },
});

export const logoutAction = () => ({ type: ActionTypes.LOGOUT });
// ---- grids ----
export const setGridAction = (grid) => ({
  type: ActionTypes.SET_GRID,
  payload: { grid },
});

export const setAvailableGridsAction = (availableGrids) => ({
  type: ActionTypes.SET_AVAILABLE_GRIDS,
  payload: { availableGrids },
});

export const createGridAction = (grid) => ({
  type: ActionTypes.CREATE_GRID,
  payload: { grid },
});

export const updateGridAction = (grid) => ({
  type: ActionTypes.UPDATE_GRID,
  payload: { grid },
});

export const deleteGridAction = (gridId) => ({
  type: ActionTypes.DELETE_GRID,
  payload: { gridId },
});

// ---- panels ----
export const setPanelsAction = (panels) => ({
  type: ActionTypes.SET_PANELS,
  payload: { panels },
});

export const createPanelAction = (panel) => ({
  type: ActionTypes.CREATE_PANEL,
  payload: { panel },
});

export const updatePanelAction = (panel) => ({
  type: ActionTypes.UPDATE_PANEL,
  payload: { panel },
});

export const deletePanelAction = (panelId) => ({
  type: ActionTypes.DELETE_PANEL,
  payload: { panelId },
});

// ---- containers ----
export const setContainersAction = (containers) => ({
  type: ActionTypes.SET_CONTAINERS,
  payload: { containers },
});

export const createContainerAction = (container) => ({
  type: ActionTypes.CREATE_CONTAINER,
  payload: { container },
});

export const updateContainerAction = (container) => ({
  type: ActionTypes.UPDATE_CONTAINER,
  payload: { container },
});

export const deleteContainerAction = (containerId) => ({
  type: ActionTypes.DELETE_CONTAINER,
  payload: { containerId },
});

// This matches bindSocketToStore.js:
// dispatch({ type: UPDATE_CONTAINER_ITEMS, payload: { containerId, items } })
export const updateContainerItemsAction = ({ containerId, items }) => ({
  type: ActionTypes.UPDATE_CONTAINER_ITEMS,
  payload: { containerId, items },
});

// ---- instances ----
export const setInstancesAction = (instances) => ({
  type: ActionTypes.SET_INSTANCES,
  payload: { instances },
});

export const createInstanceAction = (instance) => ({
  type: ActionTypes.CREATE_INSTANCE,
  payload: { instance },
});

export const updateInstanceAction = (instance) => ({
  type: ActionTypes.UPDATE_INSTANCE,
  payload: { instance },
});

export const deleteInstanceAction = (instanceId) => ({
  type: ActionTypes.DELETE_INSTANCE,
  payload: { instanceId },
});

// This matches bindSocketToStore.js:
// dispatch({ type: CREATE_INSTANCE_IN_CONTAINER, payload: { containerId, instance } })
export const createInstanceInContainerAction = ({ containerId, instance }) => ({
  type: ActionTypes.CREATE_INSTANCE_IN_CONTAINER,
  payload: { containerId, instance },
});

// ---- dnd/ui ----
export const setActiveIdAction = (activeId) => ({
  type: ActionTypes.SET_ACTIVE_ID,
  payload: { activeId },
});

export const setActiveSizeAction = (activeSize) => ({
  type: ActionTypes.SET_ACTIVE_SIZE,
  payload: { activeSize },
});

export const setDebugEventAction = (debugEvent) => ({
  type: ActionTypes.SET_DEBUG_EVENT,
  payload: { debugEvent },
});

export const softTickAction = () => ({
  type: ActionTypes.SOFT_TICK,
});
