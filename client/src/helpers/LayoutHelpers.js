// helpers/LayoutHelpers.js
import * as CommitHelpers from "./CommitHelpers";

// ============================================================================
// INTERNAL
// ============================================================================
function normalizeId(doc) {
  if (!doc) return doc;
  if (doc.id) return doc;
  if (doc._id) return { ...doc, id: String(doc._id) };
  return doc;
}

// ============================================================================
// LIST UTILS (pure)
// ============================================================================
export function removeId(list = [], id) {
  return (list || []).filter((x) => x !== id);
}

export function ensureId(list = [], id) {
  const arr = list || [];
  return arr.includes(id) ? arr : [...arr, id];
}

export function insertAt(list = [], index, value) {
  const arr = [...(list || [])];
  const i = Math.max(0, Math.min(arr.length, index));
  arr.splice(i, 0, value);
  return arr;
}

export function arrayMove(list = [], from, to) {
  const arr = [...(list || [])];
  if (from === to) return arr;
  if (from < 0 || from >= arr.length) return arr;
  const [item] = arr.splice(from, 1);
  const t = Math.max(0, Math.min(arr.length, to));
  arr.splice(t, 0, item);
  return arr;
}

// ============================================================================
// GRID / PANEL / CONTAINER / INSTANCE MUTATORS
// ============================================================================

// ------------------------
// GRID: add/remove panelId
// ------------------------
export function addPanelToGrid({ dispatch, socket, grid, panelId, emit = true }) {
  if (!grid || !panelId) return;
  const updatedGrid = { ...grid, panels: ensureId(grid.panels || [], panelId) };
  const gridId = updatedGrid?._id ?? updatedGrid?.id;
  if (!gridId) return;
  CommitHelpers.updateGrid({ dispatch, socket, gridId: String(gridId), grid: updatedGrid, emit });
}

export function removePanelFromGrid({ dispatch, socket, grid, panelId, emit = true }) {
  if (!grid || !panelId) return;
  const updatedGrid = { ...grid, panels: removeId(grid.panels || [], panelId) };
  const gridId = updatedGrid?._id ?? updatedGrid?.id;
  if (!gridId) return;
  CommitHelpers.updateGrid({ dispatch, socket, gridId: String(gridId), grid: updatedGrid, emit });
}

// ------------------------
// PANEL: add/remove/reorder containerId
// ------------------------
export function addContainerToPanel({
  dispatch,
  socket,
  panel,
  containerId,
  index = null,
  emit = true,
}) {
  if (!panel || !containerId) return;

  const list = panel.containers || [];
  const nextList =
    index == null
      ? ensureId(list, containerId)
      : insertAt(removeId(list, containerId), index, containerId);

  const updatedPanel = normalizeId({ ...panel, containers: nextList });
  CommitHelpers.updatePanel({ dispatch, socket, panel: updatedPanel, emit });
}

export function removeContainerFromPanel({
  dispatch,
  socket,
  panel,
  containerId,
  emit = true,
}) {
  if (!panel || !containerId) return;
  const updatedPanel = normalizeId({
    ...panel,
    containers: removeId(panel.containers || [], containerId),
  });
  CommitHelpers.updatePanel({ dispatch, socket, panel: updatedPanel, emit });
}

export function reorderContainersInPanel({
  dispatch,
  socket,
  panel,
  fromIndex,
  toIndex,
  emit = true,
}) {
  if (!panel) return;
  const next = arrayMove(panel.containers || [], fromIndex, toIndex);
  const updatedPanel = normalizeId({ ...panel, containers: next });
  CommitHelpers.updatePanel({ dispatch, socket, panel: updatedPanel, emit });
}

export function setPanelStackDisplay({
  dispatch,
  socket,
  panel,
  display,
  emit = true,
}) {
  const p = normalizeId(panel);
  if (!p?.id) return;

  const curr = p.layout || {};
  const style = curr.style && typeof curr.style === "object" ? curr.style : {};

  const nextPanel = {
    ...p,
    layout: {
      ...curr,
      style: {
        ...style,
        display: display ?? "block",
      },
    },
  };

  CommitHelpers.updatePanel({ dispatch, socket, panel: nextPanel, emit });
}

// ------------------------
// CONTAINER: add/remove/reorder instanceId
// ------------------------
export function addInstanceToContainer({
  dispatch,
  socket,
  container,
  instanceId,
  index = null,
  emit = true,
}) {
  if (!container || !instanceId) return;

  const list = container.items || [];
  const nextList =
    index == null
      ? ensureId(list, instanceId)
      : insertAt(removeId(list, instanceId), index, instanceId);

  const updatedContainer = normalizeId({ ...container, items: nextList });
  CommitHelpers.updateContainer({ dispatch, socket, container: updatedContainer, emit });
}

export function removeInstanceFromContainer({
  dispatch,
  socket,
  container,
  instanceId,
  emit = true,
}) {
  if (!container || !instanceId) return;
  const updatedContainer = normalizeId({
    ...container,
    items: removeId(container.items || [], instanceId),
  });
  CommitHelpers.updateContainer({ dispatch, socket, container: updatedContainer, emit });
}

export function reorderInstancesInContainer({
  dispatch,
  socket,
  container,
  fromIndex,
  toIndex,
  emit = true,
}) {
  if (!container) return;
  const next = arrayMove(container.items || [], fromIndex, toIndex);
  const updatedContainer = normalizeId({ ...container, items: next });
  CommitHelpers.updateContainer({ dispatch, socket, container: updatedContainer, emit });
}

// ------------------------
// MOVE HELPERS (two-doc commits)
// ------------------------
export function moveContainerBetweenPanels({
  dispatch,
  socket,
  fromPanel,
  toPanel,
  containerId,
  toIndex = null,
  emit = true,
}) {
  if (!fromPanel || !toPanel || !containerId) return;

  const fromIds = (fromPanel.containers || []).filter((id) => id !== containerId);
  const toIdsRaw = (toPanel.containers || []).filter((id) => id !== containerId);

  let toIds;
  if (toIndex == null || toIndex < 0 || toIndex > toIdsRaw.length) {
    toIds = [...toIdsRaw, containerId];
  } else {
    toIds = [...toIdsRaw];
    toIds.splice(toIndex, 0, containerId);
  }

  const nextFrom = { ...fromPanel, containers: fromIds };
  const nextTo = { ...toPanel, containers: toIds };

  // use YOUR existing commit path here:
  // (some projects call CommitHelpers.updatePanel, some call updatePanel directly)
  CommitHelpers.updatePanel?.({ dispatch, socket, panel: nextFrom, emit });
  CommitHelpers.updatePanel?.({ dispatch, socket, panel: nextTo, emit });
}

export function moveInstanceBetweenContainers({
  dispatch,
  socket,
  fromContainer,
  toContainer,
  instanceId,
  toIndex = null,
  emit = true,
}) {
  if (!fromContainer || !toContainer || !instanceId) return;

  const fromNext = normalizeId({
    ...fromContainer,
    items: removeId(fromContainer.items || [], instanceId),
  });

  const toNext = normalizeId({
    ...toContainer,
    items:
      toIndex == null
        ? ensureId(toContainer.items || [], instanceId)
        : insertAt(removeId(toContainer.items || [], instanceId), toIndex, instanceId),
  });

  CommitHelpers.updateContainer({ dispatch, socket, container: fromNext, emit });
  CommitHelpers.updateContainer({ dispatch, socket, container: toNext, emit });
}

// ============================================================================
// ATOMIC “create instance in container” helper (preferred)
// ============================================================================
export function createInstanceInContainer({
  dispatch,
  socket,
  containerId,
  instance,
  emit = true,
}) {
  if (!containerId || !instance?.id) return;
  CommitHelpers.createInstanceInContainer({ dispatch, socket, containerId, instance, emit });
}

// ============================================================================
// GRID RESIZE
// ============================================================================
export function resizeGrid({ dispatch, socket, grid, rows, cols, emit = true }) {
  if (!grid) return;
  const updatedGrid = { ...grid, rows, cols };
  const gridId = updatedGrid?._id ?? updatedGrid?.id;
  if (!gridId) return;
  CommitHelpers.updateGrid({ dispatch, socket, gridId: String(gridId), grid: updatedGrid, emit });
}