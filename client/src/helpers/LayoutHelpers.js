// helpers/LayoutHelpers.js
import * as CommitHelpers from "./CommitHelpers";
import { uid } from "../uid";

// ============================================================================
// LOOKUP HELPERS - get items from state by ID
// ============================================================================

/**
 * Builds a lookup map from an array of items
 * @param {Array} items - Array of items with `id` property
 * @returns {Object} Map of id -> item
 */
export function buildLookup(items = []) {
  const m = Object.create(null);
  for (const item of items) if (item?.id) m[item.id] = item;
  return m;
}

/**
 * Gets a single item by ID from a lookup map
 * @param {string} id - The item ID
 * @param {Object} lookup - The lookup map (id -> item)
 * @returns {Object|null} The item or null if not found
 */
export function getItemById(id, lookup) {
  if (!id || !lookup) return null;
  return lookup[id] || null;
}

/**
 * Gets multiple items by IDs from a lookup map
 * @param {Array} ids - Array of item IDs
 * @param {Object} lookup - The lookup map (id -> item)
 * @returns {Array} Array of items (nulls filtered out)
 */
export function getItemsByIds(ids, lookup) {
  if (!Array.isArray(ids) || !lookup) return [];
  return ids.map(id => lookup[id]).filter(Boolean);
}

/**
 * Gets the instances for a container by looking up its occurrences
 * @param {Object} container - Container with occurrences array (of IDs)
 * @param {Object} occurrencesLookup - Lookup map for occurrences
 * @param {Object} instancesLookup - Lookup map for instances
 * @returns {Array} Array of instance objects
 */
export function getContainerItems(container, occurrencesLookup, instancesLookup) {
  if (!container?.occurrences) return [];
  return (container.occurrences || [])
    .map(occId => {
      const occ = getItemById(occId, occurrencesLookup);
      if (!occ) return null;
      // Occurrence has targetType and targetId - lookup the actual item
      return getItemById(occ.targetId, instancesLookup);
    })
    .filter(Boolean);
}

/**
 * Gets instances with their occurrences for a container
 * Returns array of { instance, occurrence } pairs for rendering with fields
 * @param {Object} container - Container with occurrences array (of IDs)
 * @param {Object} occurrencesLookup - Lookup map for occurrences
 * @param {Object} instancesLookup - Lookup map for instances
 * @returns {Array} Array of { instance, occurrence } objects
 */
export function getContainerItemsWithOccurrences(container, occurrencesLookup, instancesLookup) {
  if (!container?.occurrences) return [];
  return (container.occurrences || [])
    .map(occId => {
      const occ = getItemById(occId, occurrencesLookup);
      if (!occ) return null;
      const instance = getItemById(occ.targetId, instancesLookup);
      if (!instance) return null;
      return { instance, occurrence: occ };
    })
    .filter(Boolean);
}

/**
 * Gets the containers for a panel by looking up its occurrences
 * @param {Object} panel - Panel with occurrences array (of IDs)
 * @param {Object} occurrencesLookup - Lookup map for occurrences
 * @param {Object} containersLookup - Lookup map for containers
 * @returns {Array} Array of container objects
 */
export function getPanelContainers(panel, occurrencesLookup, containersLookup) {
  if (!panel?.occurrences) return [];
  return (panel.occurrences || [])
    .map(occId => {
      const occ = getItemById(occId, occurrencesLookup);
      if (!occ) return null;
      // Occurrence has targetType and targetId - lookup the actual item
      return getItemById(occ.targetId, containersLookup);
    })
    .filter(Boolean);
}

/**
 * Finds the occurrence ID for a given target (instance/container/panel) within a parent's occurrences
 * @param {string} targetId - The target entity ID (instance, container, or panel ID)
 * @param {Array} parentOccurrences - Array of occurrence IDs from the parent (container.occurrences or panel.occurrences)
 * @param {Object} occurrencesLookup - Lookup map for occurrences
 * @returns {string|null} The occurrence ID or null if not found
 */
export function findOccurrenceIdByTarget(targetId, parentOccurrences, occurrencesLookup) {
  if (!targetId || !Array.isArray(parentOccurrences) || !occurrencesLookup) return null;
  for (const occId of parentOccurrences) {
    const occ = occurrencesLookup[occId];
    if (occ && occ.targetId === targetId) {
      return occId;
    }
  }
  return null;
}

/**
 * Gets the index of a target within a parent's occurrences array
 * @param {string} targetId - The target entity ID
 * @param {Array} parentOccurrences - Array of occurrence IDs from the parent
 * @param {Object} occurrencesLookup - Lookup map for occurrences
 * @returns {number} The index or -1 if not found
 */
export function getTargetIndexInOccurrences(targetId, parentOccurrences, occurrencesLookup) {
  if (!targetId || !Array.isArray(parentOccurrences) || !occurrencesLookup) return -1;
  for (let i = 0; i < parentOccurrences.length; i++) {
    const occ = occurrencesLookup[parentOccurrences[i]];
    if (occ && occ.targetId === targetId) {
      return i;
    }
  }
  return -1;
}

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
// LIST UTILS (pure) - work with occurrence IDs
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
  // Remove if already exists to prevent duplicates
  const cleaned = arr.filter(x => x !== value);
  const i = Math.max(0, Math.min(cleaned.length, index));
  cleaned.splice(i, 0, value);
  return cleaned;
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
// OCCURRENCE CREATION HELPERS
// ============================================================================

/**
 * Creates a panel with its occurrence in the grid
 */
export function createPanelInGrid({
  dispatch,
  socket,
  grid,
  panel,
  placement,
  emit = true,
}) {
  if (!grid || !panel?.id) return;

  const gridId = grid._id?.toString() || grid.id;
  const occurrenceId = uid();

  // 1. Create the panel entity
  CommitHelpers.createPanel({ dispatch, socket, panel, emit });

  // 2. Create the occurrence
  const occurrence = {
    id: occurrenceId,
    targetType: "panel",
    targetId: panel.id,
    gridId,
    iteration: { key: "time", value: new Date() },
    timestamp: new Date(),
    placement: placement || { row: 0, col: 0, width: 1, height: 1 },
    fields: {},
    meta: {},
  };

  // Always dispatch locally for optimistic update (server uses no-echo rooms)
  dispatch({
    type: "CREATE_OCCURRENCE",
    payload: { occurrence },
  });

  if (emit) {
    socket.emit("create_occurrence", { occurrence });
  }

  // 3. Add occurrence to grid
  addPanelToGrid({ dispatch, socket, grid, occurrenceId, emit });

  return { panel, occurrence };
}

/**
 * Creates a container with its occurrence in a panel
 */
export function createContainerInPanel({
  dispatch,
  socket,
  gridId,
  panel,
  container,
  index = null,
  emit = true,
}) {
  if (!gridId || !panel || !container?.id) return;

  const panelId = panel.id || panel._id?.toString();
  const occurrenceId = uid();

  // 1. Create the container entity
  CommitHelpers.createContainer({ dispatch, socket, container, emit });

  // 2. Create the occurrence
  const occurrence = {
    id: occurrenceId,
    targetType: "container",
    targetId: container.id,
    gridId,
    iteration: { key: "time", value: new Date() },
    timestamp: new Date(),
    fields: {},
    meta: { panelId },
  };

  // Always dispatch locally for optimistic update (server uses no-echo rooms)
  dispatch({
    type: "CREATE_OCCURRENCE",
    payload: { occurrence },
  });

  if (emit) {
    socket.emit("create_occurrence", { occurrence });
  }

  // 3. Add occurrence to panel
  addContainerToPanel({ dispatch, socket, panel, occurrenceId, index, emit });

  return { container, occurrence };
}

/**
 * Creates an instance with its occurrence in a container
 */
export function createInstanceInContainer({
  dispatch,
  socket,
  gridId,
  container,
  instance,
  index = null,
  emit = true,
}) {
  if (!gridId || !container || !instance?.id) return;

  const containerId = container.id || container._id?.toString();
  const occurrenceId = uid();

  // 1. Create the instance entity
  CommitHelpers.createInstanceInContainer({
    dispatch,
    socket,
    containerId,
    instance,
    emit,
  });

  // 2. Create the occurrence
  const occurrence = {
    id: occurrenceId,
    targetType: "instance",
    targetId: instance.id,
    gridId,
    iteration: { key: "time", value: new Date() },
    timestamp: new Date(),
    fields: {},
    meta: { containerId },
  };

  // Always dispatch locally for optimistic update (server uses no-echo rooms)
  dispatch({
    type: "CREATE_OCCURRENCE",
    payload: { occurrence },
  });

  if (emit) {
    socket.emit("create_occurrence", { occurrence });
  }

  // 3. Add occurrence to container
  addInstanceToContainer({ dispatch, socket, container, occurrenceId, index, emit });

  return { instance, occurrence };
}

// ============================================================================
// COPY HELPERS (duplicate entity + create new occurrence)
// ============================================================================

/**
 * Copies a container (creates duplicate container + new occurrence)
 */
export function copyContainer({
  dispatch,
  socket,
  gridId,
  panel,
  sourceContainer,
  emit = true,
}) {
  if (!sourceContainer) return null;

  const newContainerId = uid();
  const newContainer = {
    ...sourceContainer,
    id: newContainerId,
    label: `${sourceContainer.label} (Copy)`,
  };

  return createContainerInPanel({
    dispatch,
    socket,
    gridId,
    panel,
    container: newContainer,
    emit,
  });
}

/**
 * Copies an instance (creates duplicate instance + new occurrence)
 */
export function copyInstance({
  dispatch,
  socket,
  gridId,
  container,
  sourceInstance,
  emit = true,
}) {
  if (!sourceInstance) return null;

  const newInstanceId = uid();
  const newInstance = {
    ...sourceInstance,
    id: newInstanceId,
    label: `${sourceInstance.label} (Copy)`,
  };

  return createInstanceInContainer({
    dispatch,
    socket,
    gridId,
    container,
    instance: newInstance,
    emit,
  });
}

/**
 * Creates a new occurrence for an existing instance in a container
 * Used for "copy-drag" mode where the same instance appears in multiple places
 * This does NOT duplicate the instance - just creates a new occurrence reference
 */
export function copyInstanceToContainer({
  dispatch,
  socket,
  gridId,
  sourceInstanceId,
  toContainer,
  toIndex = null,
  emit = true,
}) {
  if (!gridId || !sourceInstanceId || !toContainer) return null;

  const containerId = toContainer.id || toContainer._id?.toString();
  const occurrenceId = uid();

  // Create the occurrence (no instance creation - we're referencing an existing instance)
  const occurrence = {
    id: occurrenceId,
    targetType: "instance",
    targetId: sourceInstanceId,
    gridId,
    iteration: { key: "time", value: new Date() },
    timestamp: new Date(),
    fields: {},
    meta: { containerId },
  };

  // Dispatch locally for optimistic update
  dispatch({
    type: "CREATE_OCCURRENCE",
    payload: { occurrence },
  });

  if (emit) {
    socket.emit("create_occurrence", { occurrence });
  }

  // Add occurrence to container
  addInstanceToContainer({ dispatch, socket, container: toContainer, occurrenceId, index: toIndex, emit });

  return { occurrence };
}

/**
 * Creates a new occurrence for an existing container in a panel
 * Used for "copy-drag" mode where the same container appears in multiple panels
 * This does NOT duplicate the container entity - just creates a new occurrence reference
 *
 * @param {Object} params
 * @param {string} params.sourceContainerId - The container entity ID to reference
 * @param {Object} params.toPanel - The target panel to add the occurrence to
 * @param {number} params.toIndex - Optional insertion index
 */
export function copyContainerToPanel({
  dispatch,
  socket,
  gridId,
  sourceContainerId,
  toPanel,
  toIndex = null,
  emit = true,
}) {
  if (!gridId || !sourceContainerId || !toPanel) return null;

  const panelId = toPanel.id || toPanel._id?.toString();
  const occurrenceId = uid();

  // Create the occurrence (referencing the existing container entity)
  const occurrence = {
    id: occurrenceId,
    targetType: "container",
    targetId: sourceContainerId, // Same container, new occurrence
    gridId,
    iteration: { key: "time", value: new Date() },
    timestamp: new Date(),
    fields: {},
    meta: { panelId },
  };

  // Dispatch locally for optimistic update
  dispatch({
    type: "CREATE_OCCURRENCE",
    payload: { occurrence },
  });

  if (emit) {
    socket.emit("create_occurrence", { occurrence });
  }

  // Add occurrence to panel
  addContainerToPanel({ dispatch, socket, panel: toPanel, occurrenceId, index: toIndex, emit });

  return { occurrence };
}

// ============================================================================
// GRID: add/remove panel occurrence
// ============================================================================
export function addPanelToGrid({ dispatch, socket, grid, occurrenceId, emit = true }) {
  if (!grid || !occurrenceId) return;
  const updatedGrid = { ...grid, occurrences: ensureId(grid.occurrences || [], occurrenceId) };
  const gridId = updatedGrid?._id ?? updatedGrid?.id;
  if (!gridId) return;
  CommitHelpers.updateGrid({ dispatch, socket, gridId: String(gridId), grid: updatedGrid, emit });
}

export function removePanelFromGrid({ dispatch, socket, grid, occurrenceId, emit = true }) {
  if (!grid || !occurrenceId) return;
  const updatedGrid = { ...grid, occurrences: removeId(grid.occurrences || [], occurrenceId) };
  const gridId = updatedGrid?._id ?? updatedGrid?.id;
  if (!gridId) return;
  CommitHelpers.updateGrid({ dispatch, socket, gridId: String(gridId), grid: updatedGrid, emit });
}

// ============================================================================
// PANEL: add/remove/reorder container occurrence
// ============================================================================
export function addContainerToPanel({
  dispatch,
  socket,
  panel,
  occurrenceId,
  index = null,
  emit = true,
}) {
  if (!panel || !occurrenceId) return;

  const list = panel.occurrences || [];
  const nextList =
    index == null
      ? ensureId(list, occurrenceId)
      : insertAt(list, index, occurrenceId);

  const updatedPanel = normalizeId({ ...panel, occurrences: nextList });
  CommitHelpers.updatePanel({ dispatch, socket, panel: updatedPanel, emit });
}

export function removeContainerFromPanel({
  dispatch,
  socket,
  panel,
  occurrenceId,
  emit = true,
}) {
  if (!panel || !occurrenceId) return;
  const updatedPanel = normalizeId({
    ...panel,
    occurrences: removeId(panel.occurrences || [], occurrenceId),
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
  const next = arrayMove(panel.occurrences || [], fromIndex, toIndex);
  const updatedPanel = normalizeId({ ...panel, occurrences: next });
  CommitHelpers.updatePanel({ dispatch, socket, panel: updatedPanel, emit });
}

/**
 * Moves a container occurrence between panels
 */
export function moveContainerBetweenPanels({
  dispatch,
  socket,
  fromPanel,
  toPanel,
  occurrenceId,
  toIndex = null,
  emit = true,
}) {
  if (!fromPanel || !toPanel || !occurrenceId) return;

  const fromIds = removeId(fromPanel.occurrences || [], occurrenceId);
  const toIdsRaw = removeId(toPanel.occurrences || [], occurrenceId);

  let toIds;
  if (toIndex == null || toIndex < 0 || toIndex > toIdsRaw.length) {
    toIds = [...toIdsRaw, occurrenceId];
  } else {
    toIds = [...toIdsRaw];
    toIds.splice(toIndex, 0, occurrenceId);
  }

  const nextFrom = normalizeId({ ...fromPanel, occurrences: fromIds });
  const nextTo = normalizeId({ ...toPanel, occurrences: toIds });

  CommitHelpers.updatePanel({ dispatch, socket, panel: nextFrom, emit });
  CommitHelpers.updatePanel({ dispatch, socket, panel: nextTo, emit });
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

// ============================================================================
// CONTAINER: add/remove/reorder instance occurrences
// ============================================================================
export function addInstanceToContainer({
  dispatch,
  socket,
  container,
  occurrenceId,
  index = null,
  emit = true,
}) {
  if (!container || !occurrenceId) return;

  const list = container.occurrences || [];
  const nextList =
    index == null
      ? ensureId(list, occurrenceId)
      : insertAt(list, index, occurrenceId);

  const updatedContainer = normalizeId({ ...container, occurrences: nextList });
  CommitHelpers.updateContainer({ dispatch, socket, container: updatedContainer, emit });
}

export function removeInstanceFromContainer({
  dispatch,
  socket,
  container,
  occurrenceId,
  emit = true,
}) {
  if (!container || !occurrenceId) return;
  const updatedContainer = normalizeId({
    ...container,
    occurrences: removeId(container.occurrences || [], occurrenceId),
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
  const next = arrayMove(container.occurrences || [], fromIndex, toIndex);
  const updatedContainer = normalizeId({ ...container, occurrences: next });
  CommitHelpers.updateContainer({ dispatch, socket, container: updatedContainer, emit });
}

/**
 * Moves an instance occurrence between containers
 */
export function moveInstanceBetweenContainers({
  dispatch,
  socket,
  fromContainer,
  toContainer,
  occurrenceId,
  toIndex = null,
  emit = true,
}) {
  if (!fromContainer || !toContainer || !occurrenceId) return;

  const fromIds = removeId(fromContainer.occurrences || [], occurrenceId);
  const toIdsRaw = removeId(toContainer.occurrences || [], occurrenceId);

  let toIds;
  if (toIndex == null || toIndex < 0 || toIndex > toIdsRaw.length) {
    toIds = [...toIdsRaw, occurrenceId];
  } else {
    toIds = [...toIdsRaw];
    toIds.splice(toIndex, 0, occurrenceId);
  }

  const nextFrom = normalizeId({ ...fromContainer, occurrences: fromIds });
  const nextTo = normalizeId({ ...toContainer, occurrences: toIds });

  CommitHelpers.updateContainer({ dispatch, socket, container: nextFrom, emit });
  CommitHelpers.updateContainer({ dispatch, socket, container: nextTo, emit });
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
