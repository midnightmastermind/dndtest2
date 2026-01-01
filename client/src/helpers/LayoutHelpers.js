// helpers/LayoutHelpers.js
import * as CommitHelpers from "./CommitHelpers";

// ========================
// PANEL / CONTAINER / INSTANCE ADD/REMOVE
// ========================

// Add a panel to a grid (updates grid state only, assumes panel exists)
export function addPanelToGrid({ dispatch, socket, grid, panelId }) {
  if (!grid || !panelId) return;

  const updatedGrid = {
    ...grid,
    panels: [...(grid.panels || []), panelId],
  };

  CommitHelpers.updateGrid({ dispatch, socket, gridId: grid.id, grid: updatedGrid });
}

export function removePanelFromGrid({ dispatch, socket, grid, panelId }) {
  if (!grid || !panelId) return;

  const updatedGrid = {
    ...grid,
    panels: (grid.panels || []).filter((id) => id !== panelId),
  };

  CommitHelpers.updateGrid({ dispatch, socket, gridId: grid.id, grid: updatedGrid });
}

// Add container to panel (update panel's container list only)
export function addContainerToPanel({ dispatch, socket, panel, containerId }) {
  if (!panel || !containerId) return;

  const updatedPanel = {
    ...panel,
    containers: [...(panel.containers || []), containerId],
  };

  CommitHelpers.updatePanel({ dispatch, socket, panel: updatedPanel });
}

export function removeContainerFromPanel({ dispatch, socket, panel, containerId }) {
  if (!panel || !containerId) return;

  const updatedPanel = {
    ...panel,
    containers: (panel.containers || []).filter((id) => id !== containerId),
  };

  CommitHelpers.updatePanel({ dispatch, socket, panel: updatedPanel });
}

// Add instance to container (update container's items list only)
export function addInstanceToContainer({ dispatch, socket, container, instanceId }) {
  if (!container || !instanceId) return;

  const updatedContainer = {
    ...container,
    items: [...(container.items || []), instanceId],
  };

  CommitHelpers.updateContainer({ dispatch, socket, container: updatedContainer });
}

export function removeInstanceFromContainer({ dispatch, socket, container, instanceId }) {
  if (!container || !instanceId) return;

  const updatedContainer = {
    ...container,
    items: (container.items || []).filter((id) => id !== instanceId),
  };

  CommitHelpers.updateContainer({ dispatch, socket, container: updatedContainer });
}

// Resize a grid
export function resizeGrid({ dispatch, socket, grid, rows, cols }) {
  if (!grid) return;

  const updatedGrid = { ...grid, rows, cols };
  CommitHelpers.updateGrid({ dispatch, socket, gridId: grid.id, grid: updatedGrid });
}
