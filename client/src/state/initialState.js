// state/initialState.js

export const initialState = {
  // auth
  userId: localStorage.getItem("moduli-userId") || null,

  // grid
  gridId: localStorage.getItem("moduli-gridId") || null,
  grid: null,
  availableGrids: [],

  // panels
  panels: [],

  // your current DnD app data (keep arrays!)
  containers: [], // { id, label, items: [instanceId...] }
  instances: [],  // { id, label }

  // drag state
  activeId: null,
  activeSize: null,

  // debug
  debugEvent: null,

  // rerender tick for draft-ref driven soft-sort
  softTick: 0,

  hydrated: false,
};
