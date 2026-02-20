// GridActionsContext.js
import { createContext } from "react";

export const GridActionsContext = createContext({
  socket: null,
  dispatch: () => {},

  // Full state object (for calculations)
  state: {},

  // action creators (you pass these)
  updatePanel: () => {},
  updateGrid: () => {},

  // lookups (you pass these)
  instancesById: Object.create(null),
  occurrencesById: Object.create(null),
  containersById: Object.create(null),
  fieldsById: Object.create(null),
  panelsById: Object.create(null),
  manifestsById: Object.create(null),
  viewsById: Object.create(null),
  docsById: Object.create(null),
  foldersById: Object.create(null),
  artifactsById: Object.create(null),

  // adders (you pass these)
  addContainerToPanel: () => {},
  addInstanceToContainer: () => {},

  // Field CRUD actions (grid-level field management)
  createField: () => {},
  updateField: () => {},
  deleteField: () => {},

  // Undo/Redo state (lifted to App.jsx)
  canUndo: false,
  canRedo: false,
  undo: () => {},
  redo: () => {},
  isProcessing: false,
});