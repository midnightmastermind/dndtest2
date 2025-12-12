// state/actions.js

export const ActionTypes = {
  ADD_CONTAINER: "ADD_CONTAINER",
  ADD_INSTANCE_TO_CONTAINER: "ADD_INSTANCE_TO_CONTAINER",

  SET_ACTIVE_ID: "SET_ACTIVE_ID",
  SET_ACTIVE_SIZE: "SET_ACTIVE_SIZE",

  SET_DEBUG_EVENT: "SET_DEBUG_EVENT",

  SET_CONTAINERS: "SET_CONTAINERS",
  SOFT_TICK: "SOFT_TICK",
};

export const addContainerAction = ({ id, label }) => ({
  type: ActionTypes.ADD_CONTAINER,
  payload: { id, label },
});

export const addInstanceToContainerAction = ({ containerId, instance }) => ({
  type: ActionTypes.ADD_INSTANCE_TO_CONTAINER,
  payload: { containerId, instance },
});

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

export const setContainersAction = (containers) => ({
  type: ActionTypes.SET_CONTAINERS,
  payload: { containers },
});

export const softTickAction = () => ({
  type: ActionTypes.SOFT_TICK,
});
