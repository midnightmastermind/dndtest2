// GridActionsContext.js
import { createContext } from "react";

export const GridActionsContext = createContext({
  socket: null,
  dispatch: () => {},

  // action creators (you pass these)
  updatePanel: () => {},
  updateGrid: () => {},

  // helpers / lookups (you pass these)
  instancesById: Object.create(null),

  // adders (you pass these)
  addContainerToPanel: () => {},
  addInstanceToContainer: () => {},


});