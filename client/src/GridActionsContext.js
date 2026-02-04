// GridActionsContext.js
import { createContext } from "react";

export const GridActionsContext = createContext({
  socket: null,
  dispatch: () => {},

  // action creators (you pass these)
  updatePanel: () => {},
  updateGrid: () => {},

  // lookups (you pass these)
  instancesById: Object.create(null),
  occurrencesById: Object.create(null),
  containersById: Object.create(null),
  fieldsById: Object.create(null),

  // adders (you pass these)
  addContainerToPanel: () => {},
  addInstanceToContainer: () => {},
});