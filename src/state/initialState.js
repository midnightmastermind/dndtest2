// state/initialState.js

export const initialState = {
  // drag state
  activeId: null,
  activeSize: null,

  // debug
  debugEvent: null,

  // data state
  containers: [], // { id, label, items: [instanceId...] }
  instances: [],  // { id, label }

  // rerender tick for draft-ref driven soft-sort
  softTick: 0,
};
