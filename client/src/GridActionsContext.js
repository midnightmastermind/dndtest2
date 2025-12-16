import { createContext } from "react";

export const GridActionsContext = createContext({
  // creators
  addContainer: () => {},
  addInstanceToContainer: () => {},

  // handlers
  handleDragStart: () => {},
  handleDragOver: () => {},
  handleDragEnd: () => {},
  handleDragCancel: () => {},

  // debug helpers
  useRenderCount: () => {},
  dispatch: () => {},
      instancesById: () => {},
      addContainerToPanel: () => {},

});
