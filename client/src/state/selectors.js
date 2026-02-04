// state/selectors.js
// Selectors for working with occurrences and entities in the state
import * as CalcHelpers from "../helpers/CalculationHelpers";

/**
 * Creates lookup maps from state arrays
 */
export function createLookupsFromState(state) {
  const panelsById = {};
  const containersById = {};
  const instancesById = {};
  const occurrencesById = {};
  const fieldsById = {};

  (state.panels || []).forEach(p => {
    if (p.id) panelsById[p.id] = p;
  });

  (state.containers || []).forEach(c => {
    if (c.id) containersById[c.id] = c;
  });

  (state.instances || []).forEach(i => {
    if (i.id) instancesById[i.id] = i;
  });

  (state.occurrences || []).forEach(o => {
    if (o.id) occurrencesById[o.id] = o;
  });

  (state.fields || []).forEach(f => {
    if (f.id) fieldsById[f.id] = f;
  });

  return {
    panelsById,
    containersById,
    instancesById,
    occurrencesById,
    fieldsById,
  };
}

/**
 * Autofills an occurrence with its target entity
 */
export function autofillOccurrence(occurrence, lookups) {
  if (!occurrence) return occurrence;

  const filled = { ...occurrence };

  switch (occurrence.targetType) {
    case "panel":
      if (occurrence.targetId && lookups.panelsById[occurrence.targetId]) {
        filled.panel = lookups.panelsById[occurrence.targetId];
      }
      break;

    case "container":
      if (occurrence.targetId && lookups.containersById[occurrence.targetId]) {
        filled.container = lookups.containersById[occurrence.targetId];
      }
      break;

    case "instance":
      if (occurrence.targetId && lookups.instancesById[occurrence.targetId]) {
        filled.instance = lookups.instancesById[occurrence.targetId];
      }
      break;
  }

  return filled;
}

/**
 * Gets all occurrences for a grid, autofilled
 */
export function getOccurrencesForGrid(state, gridId) {
  if (!gridId || !state.occurrences) return [];

  const lookups = createLookupsFromState(state);

  return state.occurrences
    .filter(occ => occ.gridId === gridId)
    .map(occ => autofillOccurrence(occ, lookups));
}

/**
 * Autofills a grid with its occurrences (panel occurrences)
 */
export function autofillGrid(grid, state) {
  if (!grid) return grid;

  const lookups = createLookupsFromState(state);
  const occurrences = (grid.occurrences || [])
    .map(occId => lookups.occurrencesById[occId])
    .filter(Boolean)
    .map(occ => autofillOccurrence(occ, lookups));

  return { ...grid, occurrences };
}

/**
 * Autofills a panel with its occurrences (container occurrences)
 */
export function autofillPanel(panel, state) {
  if (!panel) return panel;

  const lookups = createLookupsFromState(state);
  const occurrences = (panel.occurrences || [])
    .map(occId => lookups.occurrencesById[occId])
    .filter(Boolean)
    .map(occ => autofillOccurrence(occ, lookups));

  return { ...panel, occurrences };
}

/**
 * Autofills a container with its occurrences (instance occurrences)
 */
export function autofillContainer(container, state) {
  if (!container) return container;

  const lookups = createLookupsFromState(state);
  const occurrences = (container.occurrences || [])
    .map(occId => lookups.occurrencesById[occId])
    .filter(Boolean)
    .map(occ => autofillOccurrence(occ, lookups));

  return { ...container, occurrences };
}

/**
 * Gets a panel by ID
 */
export function getPanelById(state, panelId) {
  return (state.panels || []).find(p => p.id === panelId);
}

/**
 * Gets a container by ID
 */
export function getContainerById(state, containerId) {
  return (state.containers || []).find(c => c.id === containerId);
}

/**
 * Gets an instance by ID
 */
export function getInstanceById(state, instanceId) {
  return (state.instances || []).find(i => i.id === instanceId);
}

/**
 * Gets an occurrence by ID
 */
export function getOccurrenceById(state, occurrenceId) {
  return (state.occurrences || []).find(o => o.id === occurrenceId);
}

/**
 * Gets the grid's panel occurrences, autofilled
 */
export function getGridPanels(state) {
  if (!state.grid) return [];

  const lookups = createLookupsFromState(state);

  return (state.grid.occurrences || [])
    .map(occId => lookups.occurrencesById[occId])
    .filter(Boolean)
    .map(occ => autofillOccurrence(occ, lookups));
}

/**
 * Gets a panel's container occurrences, autofilled
 */
export function getPanelContainers(state, panelId) {
  const panel = getPanelById(state, panelId);
  if (!panel) return [];

  const lookups = createLookupsFromState(state);

  return (panel.occurrences || [])
    .map(occId => lookups.occurrencesById[occId])
    .filter(Boolean)
    .map(occ => autofillOccurrence(occ, lookups));
}

/**
 * Gets a container's instance occurrences, autofilled
 */
export function getContainerInstances(state, containerId) {
  const container = getContainerById(state, containerId);
  if (!container) return [];

  const lookups = createLookupsFromState(state);

  return (container.occurrences || [])
    .map(occId => lookups.occurrencesById[occId])
    .filter(Boolean)
    .map(occ => autofillOccurrence(occ, lookups));
}

// ============================================================
// FIELD SELECTORS (Phase 2)
// ============================================================

/**
 * Gets a field by ID
 */
export function getFieldById(state, fieldId) {
  return (state.fields || []).find(f => f.id === fieldId);
}

/**
 * Gets all fields for an instance based on its fieldBindings
 * Returns array of { field, binding } pairs
 */
export function getFieldsForInstance(state, instanceId) {
  const instance = getInstanceById(state, instanceId);
  if (!instance || !instance.fieldBindings) return [];

  const lookups = createLookupsFromState(state);

  return (instance.fieldBindings || [])
    .map(binding => {
      const field = lookups.fieldsById[binding.fieldId];
      if (!field) return null;
      return { field, binding };
    })
    .filter(Boolean)
    .sort((a, b) => (a.binding.order || 0) - (b.binding.order || 0));
}

/**
 * Gets fields in scope - resolves field inheritance hierarchy
 * Grid fields → Panel fields → Container fields → Instance fields
 */
export function getFieldsInScope(state, { gridId, panelId, containerId, instanceId } = {}) {
  const lookups = createLookupsFromState(state);
  const fieldsMap = {};

  // Grid-level fields (most generic)
  if (state.grid?.fieldIds) {
    state.grid.fieldIds.forEach(fieldId => {
      const field = lookups.fieldsById[fieldId];
      if (field) fieldsMap[fieldId] = { field, source: 'grid' };
    });
  }

  // Panel-level fields
  if (panelId) {
    const panel = lookups.panelsById[panelId];
    if (panel?.fieldIds) {
      panel.fieldIds.forEach(fieldId => {
        const field = lookups.fieldsById[fieldId];
        if (field) fieldsMap[fieldId] = { field, source: 'panel' };
      });
    }
  }

  // Container-level fields
  if (containerId) {
    const container = lookups.containersById[containerId];
    if (container?.fieldIds) {
      container.fieldIds.forEach(fieldId => {
        const field = lookups.fieldsById[fieldId];
        if (field) fieldsMap[fieldId] = { field, source: 'container' };
      });
    }
  }

  // Instance-level fields (most specific)
  if (instanceId) {
    const instance = lookups.instancesById[instanceId];
    if (instance?.fieldIds) {
      instance.fieldIds.forEach(fieldId => {
        const field = lookups.fieldsById[fieldId];
        if (field) fieldsMap[fieldId] = { field, source: 'instance' };
      });
    }
  }

  return Object.values(fieldsMap);
}

/**
 * Gets the value of a field from an occurrence
 */
export function getFieldValueFromOccurrence(occurrence, fieldId) {
  if (!occurrence?.fields) return undefined;
  return occurrence.fields[fieldId];
}

/**
 * Gets all occurrences for a specific instance
 */
export function getOccurrencesForInstance(state, instanceId) {
  return (state.occurrences || []).filter(
    occ => occ.targetType === 'instance' && occ.targetId === instanceId
  );
}

/**
 * Calculates a derived field value
 * Delegates to CalculationHelpers for the actual computation
 */
export function calculateDerivedField(state, field, context = {}) {
  return CalcHelpers.calculateDerivedField(state, field, context);
}

// Re-export calculation helpers for convenience
export { CalcHelpers };
