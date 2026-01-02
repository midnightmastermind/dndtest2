// state/actions.js
// =========================================
// actions.js — SINGLE SOURCE OF TRUTH
// ✅ UPDATED:
// - updateGridAction now matches reducer + bindSocketToStore:
//   payload: { gridId, grid }
// - adds creator for CREATE_INSTANCE_IN_CONTAINER (already in ActionTypes)
// =========================================

export const ActionTypes = {
  FULL_STATE: "FULL_STATE",

  SET_USER_ID: "SET_USER_ID",
  SET_GRID_ID: "SET_GRID_ID",
  LOGOUT: "LOGOUT",

  CREATE_GRID: "CREATE_GRID",
  UPDATE_GRID: "UPDATE_GRID",
  DELETE_GRID: "DELETE_GRID",
  SET_AVAILABLE_GRIDS: "SET_AVAILABLE_GRIDS",
  SET_GRID: "SET_GRID",

  CREATE_PANEL: "CREATE_PANEL",
  UPDATE_PANEL: "UPDATE_PANEL",
  DELETE_PANEL: "DELETE_PANEL",
  SET_PANELS: "SET_PANELS",

  CREATE_CONTAINER: "CREATE_CONTAINER",
  UPDATE_CONTAINER: "UPDATE_CONTAINER",
  DELETE_CONTAINER: "DELETE_CONTAINER",
  SET_CONTAINERS: "SET_CONTAINERS",
  UPDATE_CONTAINER_ITEMS: "UPDATE_CONTAINER_ITEMS",

  CREATE_INSTANCE: "CREATE_INSTANCE",
  UPDATE_INSTANCE: "UPDATE_INSTANCE",
  DELETE_INSTANCE: "DELETE_INSTANCE",
  SET_INSTANCES: "SET_INSTANCES",

  CREATE_INSTANCE_IN_CONTAINER: "CREATE_INSTANCE_IN_CONTAINER",

  SET_ACTIVE_ID: "SET_ACTIVE_ID",
  SET_ACTIVE_SIZE: "SET_ACTIVE_SIZE",
  SOFT_TICK: "SOFT_TICK",
};

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

// ✅ FIX: now matches reducer expectations
export const updateGridAction = ({ gridId, grid }) => ({
  type: ActionTypes.UPDATE_GRID,
  payload: { gridId, grid },
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

// ✅ IMPORTANT for your server’s supported API
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

export const softTickAction = () => ({
  type: ActionTypes.SOFT_TICK,
});