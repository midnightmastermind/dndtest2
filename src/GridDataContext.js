import { createContext } from "react";

export const GridDataContext = createContext({
  // drag state
  activeId: null,
  activeSize: null,

  // debug
  debugEvent: null,

  // data state
  containers: [],
  containersRender: [],
  instances: [],

  // rerender tick for draft ref
  softTick: 0,
});
