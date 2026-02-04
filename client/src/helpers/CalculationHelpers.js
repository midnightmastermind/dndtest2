// helpers/CalculationHelpers.js
// ============================================================
// Calculation helpers for derived fields
// Supports aggregations, targets, conditions, and complex rules
// ============================================================

/**
 * Available aggregation functions
 */
export const AGGREGATIONS = {
  sum: {
    label: "Sum",
    symbol: "Σ",
    description: "Add all values together",
    types: ["number"],
    fn: (values) => values.reduce((a, b) => a + b, 0),
  },
  count: {
    label: "Count",
    symbol: "#",
    description: "Count number of occurrences",
    types: ["number", "text", "boolean", "date"],
    fn: (values) => values.length,
  },
  countTrue: {
    label: "Count True",
    symbol: "#✓",
    description: "Count occurrences where value is true/truthy",
    types: ["boolean", "number"],
    fn: (values) => values.filter(Boolean).length,
  },
  avg: {
    label: "Average",
    symbol: "μ",
    description: "Calculate mean average",
    types: ["number"],
    fn: (values) => values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
  },
  min: {
    label: "Minimum",
    symbol: "↓",
    description: "Find smallest value",
    types: ["number", "date"],
    fn: (values) => values.length > 0 ? Math.min(...values) : 0,
  },
  max: {
    label: "Maximum",
    symbol: "↑",
    description: "Find largest value",
    types: ["number", "date"],
    fn: (values) => values.length > 0 ? Math.max(...values) : 0,
  },
  last: {
    label: "Latest",
    symbol: "→",
    description: "Get most recent value",
    types: ["number", "text", "boolean", "date"],
    fn: (values) => values.length > 0 ? values[values.length - 1] : null,
  },
  first: {
    label: "First",
    symbol: "←",
    description: "Get earliest value",
    types: ["number", "text", "boolean", "date"],
    fn: (values) => values.length > 0 ? values[0] : null,
  },
  range: {
    label: "Range",
    symbol: "⟷",
    description: "Difference between max and min",
    types: ["number"],
    fn: (values) => values.length > 0 ? Math.max(...values) - Math.min(...values) : 0,
  },
  median: {
    label: "Median",
    symbol: "M",
    description: "Middle value when sorted",
    types: ["number"],
    fn: (values) => {
      if (values.length === 0) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    },
  },
  mode: {
    label: "Mode",
    symbol: "Mo",
    description: "Most frequent value",
    types: ["number", "text"],
    fn: (values) => {
      if (values.length === 0) return null;
      const counts = {};
      values.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
      return Object.entries(counts).reduce((a, b) => b[1] > a[1] ? b : a, [null, 0])[0];
    },
  },
  stdDev: {
    label: "Std Dev",
    symbol: "σ",
    description: "Standard deviation",
    types: ["number"],
    fn: (values) => {
      if (values.length === 0) return 0;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
      return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
    },
  },
  product: {
    label: "Product",
    symbol: "∏",
    description: "Multiply all values",
    types: ["number"],
    fn: (values) => values.length > 0 ? values.reduce((a, b) => a * b, 1) : 0,
  },
  concat: {
    label: "Concatenate",
    symbol: "++",
    description: "Join text values",
    types: ["text"],
    fn: (values, options = {}) => values.join(options.separator || ", "),
  },
  unique: {
    label: "Unique Count",
    symbol: "#!",
    description: "Count distinct values",
    types: ["number", "text"],
    fn: (values) => new Set(values).size,
  },
};

/**
 * Comparison operators for targets and conditions
 */
export const COMPARISONS = {
  ">=": { label: "≥ (at least)", fn: (a, b) => a >= b },
  "<=": { label: "≤ (at most)", fn: (a, b) => a <= b },
  "==": { label: "= (exactly)", fn: (a, b) => a === b },
  "!=": { label: "≠ (not equal)", fn: (a, b) => a !== b },
  ">": { label: "> (more than)", fn: (a, b) => a > b },
  "<": { label: "< (less than)", fn: (a, b) => a < b },
};

/**
 * Flow options for input fields
 * Determines how the value affects aggregations
 */
export const INPUT_FLOWS = {
  in: { label: "In (+)", description: "Value counts as positive" },
  out: { label: "Out (−)", description: "Value counts as negative" },
  replace: { label: "Replace", description: "Value replaces (not summed)" },
};

/**
 * Flow filters for derived fields
 * Determines which input flows are counted in aggregations
 */
export const DERIVED_FLOWS = {
  any: { label: "Any", description: "Count both in and out values" },
  in: { label: "In only", description: "Only count positive (in) values" },
  out: { label: "Out only", description: "Only count negative (out) values" },
};

/**
 * Scope types for occurrence filtering
 */
export const SCOPES = {
  grid: { label: "Grid (all)", description: "All occurrences in the grid" },
  panel: { label: "Panel", description: "Occurrences in the same panel" },
  container: { label: "Container", description: "Occurrences in the same container" },
  instance: { label: "Instance", description: "All occurrences of this instance" },
};

/**
 * Time-based filter presets for occurrence filtering
 */
export const TIME_FILTERS = {
  all: { label: "All time", fn: () => true },
  today: {
    label: "Today",
    fn: (occ) => {
      const today = new Date().setHours(0, 0, 0, 0);
      const occDate = new Date(occ.createdAt || occ.meta?.createdAt).setHours(0, 0, 0, 0);
      return occDate === today;
    },
  },
  thisWeek: {
    label: "This week",
    fn: (occ) => {
      const now = new Date();
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay())).setHours(0, 0, 0, 0);
      const occDate = new Date(occ.createdAt || occ.meta?.createdAt).getTime();
      return occDate >= weekStart;
    },
  },
  thisMonth: {
    label: "This month",
    fn: (occ) => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const occDate = new Date(occ.createdAt || occ.meta?.createdAt).getTime();
      return occDate >= monthStart;
    },
  },
  last7Days: {
    label: "Last 7 days",
    fn: (occ) => {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const occDate = new Date(occ.createdAt || occ.meta?.createdAt).getTime();
      return occDate >= sevenDaysAgo;
    },
  },
  last30Days: {
    label: "Last 30 days",
    fn: (occ) => {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const occDate = new Date(occ.createdAt || occ.meta?.createdAt).getTime();
      return occDate >= thirtyDaysAgo;
    },
  },
};

/**
 * Time filter multipliers relative to daily
 * Used to scale targets when viewing in different time periods
 */
export const TIME_FILTER_MULTIPLIERS = {
  daily: 1,
  weekly: 7,
  monthly: 30, // approximate
  yearly: 365, // approximate
};

/**
 * Scale a target value from its base time filter to the current viewing time filter
 *
 * @param {number} targetValue - The base target value
 * @param {string} targetTimeFilter - The time filter the target was set for ('daily', 'weekly', etc.)
 * @param {string} currentTimeFilter - The time filter we're currently viewing
 * @returns {number} The scaled target value
 *
 * @example
 * // If target is "3 per day" and we're viewing weekly:
 * scaleTarget(3, "daily", "weekly") // => 21
 *
 * // If target is "100 per month" and we're viewing daily:
 * scaleTarget(100, "monthly", "daily") // => 3.33
 */
export function scaleTarget(targetValue, targetTimeFilter, currentTimeFilter) {
  if (targetValue === null || targetValue === undefined) return null;
  if (!targetTimeFilter || !currentTimeFilter) return targetValue;
  if (targetTimeFilter === currentTimeFilter) return targetValue;
  if (targetTimeFilter === "inherit" || targetTimeFilter === "all") return targetValue;
  if (currentTimeFilter === "inherit" || currentTimeFilter === "all") return targetValue;

  const targetMultiplier = TIME_FILTER_MULTIPLIERS[targetTimeFilter] || 1;
  const currentMultiplier = TIME_FILTER_MULTIPLIERS[currentTimeFilter] || 1;

  // Scale from target's base period to current viewing period
  // e.g., 3 per day × (7 days / 1 day) = 21 per week
  return targetValue * (currentMultiplier / targetMultiplier);
}

/**
 * Get the effective time filter for a derived field source
 * Handles "inherit" by using the parent iteration
 *
 * @param {string} sourceTimeFilter - The time filter from the derived field source ('daily', 'inherit', etc.)
 * @param {string} parentTimeFilter - The resolved parent iteration time filter
 * @returns {string} The effective time filter to use
 */
export function resolveSourceTimeFilter(sourceTimeFilter, parentTimeFilter) {
  if (!sourceTimeFilter || sourceTimeFilter === "inherit") {
    return parentTimeFilter || "daily";
  }
  return sourceTimeFilter;
}

/**
 * Resolve the effective iteration for an item by walking up the parent chain
 * Hierarchy: Instance → Container → Panel → Grid
 *
 * @param {Object} item - The item (instance, container, or panel)
 * @param {string} itemType - 'instance', 'container', or 'panel'
 * @param {Object} lookups - { containersById, panelsById, grid }
 * @returns {Object} { timeFilter, source } - resolved iteration and where it came from
 */
export function resolveEffectiveIteration(item, itemType, lookups = {}) {
  const { containersById = {}, panelsById = {}, grid } = lookups;

  // Get the grid's current iteration timeFilter as the fallback
  const iterations = grid?.iterations || [];
  const selectedIterationId = grid?.selectedIterationId || "default";
  const gridIteration = iterations.find(i => i.id === selectedIterationId) || iterations[0];
  const gridTimeFilter = gridIteration?.timeFilter || "daily";

  // Walk up the chain based on item type
  let current = item;
  let currentType = itemType;
  let source = "grid";

  while (current) {
    const iteration = current.iteration;

    // If this item has mode: "own", use its timeFilter
    if (iteration?.mode === "own") {
      return {
        timeFilter: iteration.timeFilter || "daily",
        source: currentType,
      };
    }

    // Otherwise, walk up to parent
    if (currentType === "instance") {
      // Instance → Container
      const containerId = current.meta?.containerId || current.containerId;
      current = containersById[containerId];
      currentType = "container";
    } else if (currentType === "container") {
      // Container → Panel
      const panelId = current.panelId;
      current = panelsById[panelId];
      currentType = "panel";
    } else if (currentType === "panel") {
      // Panel → Grid (end of chain)
      break;
    } else {
      break;
    }
  }

  // Fallback to grid's iteration
  return { timeFilter: gridTimeFilter, source };
}

/**
 * Filter occurrences by iteration (timeFilter + currentDate)
 * This filters based on the selected iteration's time period
 *
 * @param {Array} occurrences - Array of occurrences
 * @param {string} timeFilter - 'daily', 'weekly', 'monthly', 'yearly'
 * @param {Date|string} currentDate - The date being viewed (center of the period)
 * @returns {Array} Filtered occurrences
 */
export function filterOccurrencesByIteration(occurrences, timeFilter, currentDate) {
  if (!timeFilter || timeFilter === "all" || !currentDate) {
    return occurrences;
  }

  const targetDate = new Date(currentDate);
  targetDate.setHours(0, 0, 0, 0);

  return occurrences.filter(occ => {
    const occDate = new Date(occ.createdAt || occ.meta?.createdAt || 0);
    occDate.setHours(0, 0, 0, 0);

    switch (timeFilter) {
      case "daily":
        return occDate.getTime() === targetDate.getTime();

      case "weekly": {
        // Get start of target week (Sunday)
        const targetWeekStart = new Date(targetDate);
        targetWeekStart.setDate(targetDate.getDate() - targetDate.getDay());
        const targetWeekEnd = new Date(targetWeekStart);
        targetWeekEnd.setDate(targetWeekStart.getDate() + 7);

        return occDate >= targetWeekStart && occDate < targetWeekEnd;
      }

      case "monthly":
        return occDate.getFullYear() === targetDate.getFullYear() &&
               occDate.getMonth() === targetDate.getMonth();

      case "yearly":
        return occDate.getFullYear() === targetDate.getFullYear();

      default:
        return true;
    }
  });
}

/**
 * Filter occurrences by scope
 */
export function filterOccurrencesByScope(occurrences, scope, context = {}) {
  const { gridId, panelId, containerId, instanceId } = context;

  switch (scope) {
    case "grid":
      return occurrences.filter(occ => occ.gridId === gridId);

    case "panel":
      return occurrences.filter(occ =>
        occ.gridId === gridId && occ.meta?.panelId === panelId
      );

    case "container":
      return occurrences.filter(occ =>
        occ.gridId === gridId && occ.meta?.containerId === containerId
      );

    case "instance":
      return occurrences.filter(occ =>
        occ.gridId === gridId && occ.targetId === instanceId
      );

    default:
      return occurrences;
  }
}

/**
 * Filter occurrences by time
 */
export function filterOccurrencesByTime(occurrences, timeFilter = "all") {
  const filter = TIME_FILTERS[timeFilter];
  if (!filter || timeFilter === "all") return occurrences;
  return occurrences.filter(filter.fn);
}

/**
 * Extract field values from occurrences
 *
 * @param {Array} occurrences - Array of occurrences
 * @param {string} fieldId - Field ID to extract values from
 * @param {Object} options - Options for extraction
 * @param {string} options.flowFilter - 'any', 'in', or 'out' - which flows to include
 * @returns {Array} Array of values (with sign applied based on flow)
 */
export function extractFieldValues(occurrences, fieldId, options = {}) {
  const { flowFilter = "any" } = options;

  return occurrences
    .map(occ => {
      const fieldData = occ.fields?.[fieldId];
      if (fieldData === undefined || fieldData === null) return null;

      // Handle simple values (backwards compatibility)
      if (typeof fieldData !== "object") {
        return flowFilter === "any" || flowFilter === "in" ? fieldData : null;
      }

      // Handle { value, flow } format
      const { value, flow = "in" } = fieldData;
      if (value === undefined || value === null) return null;

      // Filter by flow type
      if (flowFilter !== "any" && flow !== flowFilter) {
        return null;
      }

      // Apply sign based on flow
      if (typeof value === "number") {
        return flow === "out" ? -value : value;
      }

      return value;
    })
    .filter(v => v !== null);
}

/**
 * Apply aggregation to values
 */
export function applyAggregation(values, aggregation, options = {}) {
  const agg = AGGREGATIONS[aggregation];
  if (!agg) {
    console.warn(`Unknown aggregation: ${aggregation}`);
    return null;
  }
  return agg.fn(values, options);
}

/**
 * Check if a value meets a target condition
 *
 * @param {number} value - The calculated value
 * @param {Object} target - Target config { value, op, timeFilter }
 * @param {string} currentTimeFilter - The current viewing time filter (for scaling)
 * @returns {boolean|null} Whether target is met, or null if no target
 */
export function checkTarget(value, target, currentTimeFilter = null) {
  if (!target || target.value === undefined) return null;

  const comparison = COMPARISONS[target.op || ">="];
  if (!comparison) return false;

  // Scale the target if viewing in a different time period
  let scaledTarget = target.value;
  if (currentTimeFilter && target.timeFilter && target.timeFilter !== "inherit") {
    scaledTarget = scaleTarget(target.value, target.timeFilter, currentTimeFilter);
  }

  return comparison.fn(value, scaledTarget);
}

/**
 * Get the scaled target value for display
 *
 * @param {Object} target - Target config { value, op, timeFilter }
 * @param {string} currentTimeFilter - The current viewing time filter
 * @returns {number|null} The scaled target value
 */
export function getScaledTargetValue(target, currentTimeFilter) {
  if (!target || target.value === undefined) return null;

  if (currentTimeFilter && target.timeFilter && target.timeFilter !== "inherit") {
    return scaleTarget(target.value, target.timeFilter, currentTimeFilter);
  }

  return target.value;
}

/**
 * Calculate progress towards a target (0-100%)
 *
 * @param {number} value - The calculated value
 * @param {Object} target - Target config { value, op, timeFilter }
 * @param {string} currentTimeFilter - The current viewing time filter (for scaling)
 * @returns {number|null} Progress percentage, or null if no target
 */
export function calculateProgress(value, target, currentTimeFilter = null) {
  if (!target || target.value === undefined || target.value === 0) return null;

  // Scale the target if viewing in a different time period
  let scaledTarget = target.value;
  if (currentTimeFilter && target.timeFilter && target.timeFilter !== "inherit") {
    scaledTarget = scaleTarget(target.value, target.timeFilter, currentTimeFilter);
  }

  if (scaledTarget === 0) return null;

  const progress = (value / scaledTarget) * 100;
  return Math.min(Math.max(progress, 0), 100);
}

/**
 * Get the cache key for a derived field calculation
 * Used to determine if recalculation is needed
 *
 * Includes iteration context so calculations are recalculated when:
 * - The grid's selected iteration changes
 * - The viewing time filter changes
 * - Parent iteration settings change
 */
export function getDerivedFieldCacheKey(state, field, context = {}) {
  if (!field || field.mode !== "derived" || !field.metric) {
    return null;
  }

  const { metric } = field;
  const {
    fieldId: sourceFieldId,
    scope = "container",
    timeFilter = "all",
  } = metric;

  // Get relevant occurrences based on scope
  const allOccurrences = state.occurrences || [];
  const scopedOccurrences = filterOccurrencesByScope(allOccurrences, scope, context);
  const filteredOccurrences = filterOccurrencesByTime(scopedOccurrences, timeFilter);

  // Create a hash of only the relevant field values
  // This ensures we only recalculate when those specific values change
  const relevantValues = filteredOccurrences
    .map(occ => `${occ.id}:${occ.fields?.[sourceFieldId] ?? "null"}`)
    .join("|");

  // Include iteration context in cache key
  // This ensures recalculation when viewing period changes
  const { currentIteration, iterationDate } = context;
  const iterationKey = currentIteration || "default";
  const dateKey = iterationDate ? new Date(iterationDate).toISOString().split("T")[0] : "all";

  return `${field.id}:${scope}:${timeFilter}:${iterationKey}:${dateKey}:${relevantValues}`;
}

/**
 * Get only the relevant occurrences for a derived field calculation
 * Useful for memoization - only depends on specific occurrences
 */
export function getRelevantOccurrences(state, field, context = {}) {
  if (!field || field.mode !== "derived" || !field.metric) {
    return [];
  }

  const { metric } = field;
  const { scope = "container", timeFilter = "all" } = metric;

  const allOccurrences = state.occurrences || [];
  const scopedOccurrences = filterOccurrencesByScope(allOccurrences, scope, context);
  return filterOccurrencesByTime(scopedOccurrences, timeFilter);
}

/**
 * Calculate a derived field value
 *
 * @param {Object} state - Full app state (including selectedIterationId, currentIterationValue, grid.iterations)
 * @param {Object} field - Field definition with metric config
 * @param {Object} context - { gridId, panelId, containerId, instanceId }
 * @returns {any} Calculated value
 */
export function calculateDerivedField(state, field, context = {}) {
  if (!field || field.mode !== "derived" || !field.metric) {
    return null;
  }

  const { metric } = field;
  const {
    source = "occurrences",
    allowedFields = [],
    aggregation = "sum",
    options = {},
    // Legacy single field support
    fieldId: legacyFieldId,
  } = metric;

  // Only occurrence-based calculations for now
  if (source !== "occurrences") {
    console.warn(`Unknown metric source: ${source}`);
    return null;
  }

  // Get iteration context from state
  const iterations = state.grid?.iterations || [];
  const selectedIterationId = state.selectedIterationId || "default";
  const currentIterationValue = state.currentIterationValue;
  const selectedIteration = iterations.find(i => i.id === selectedIterationId) || iterations[0];
  const iterationTimeFilter = selectedIteration?.timeFilter;

  // Get all occurrences in the grid
  let allOccurrences = state.occurrences || [];
  const containersById = state.containersById || {};
  const panelsById = state.panelsById || {};

  // Apply iteration filter to all occurrences first
  if (iterationTimeFilter && currentIterationValue) {
    allOccurrences = filterOccurrencesByIteration(allOccurrences, iterationTimeFilter, currentIterationValue);
  }

  let allValues = [];

  // If using new allowedFields format
  if (allowedFields.length > 0) {
    for (const allowedField of allowedFields) {
      const { fieldId, destinations = [], flowFilter = "any" } = allowedField;

      // Filter occurrences by destination (if specified)
      let filteredOccs = allOccurrences;

      if (destinations.length > 0) {
        filteredOccs = allOccurrences.filter(occ => {
          const occContainerId = occ.meta?.containerId;
          const occPanelId = containersById[occContainerId]?.panelId;

          for (const dest of destinations) {
            // Check if destination matches
            if (dest.id.startsWith("container:")) {
              const containerId = dest.id.replace("container:", "");
              if (occContainerId !== containerId) continue;
            } else if (dest.id.startsWith("panel:")) {
              const panelId = dest.id.replace("panel:", "");
              if (occPanelId !== panelId) continue;
            }

            // Apply time filter for this destination
            const timeFilter = dest.timeFilter || "all";
            if (timeFilter !== "all") {
              const filter = TIME_FILTERS[timeFilter];
              if (filter && !filter.fn(occ)) continue;
            }

            return true;
          }
          return false;
        });
      }

      // Extract values with flow filter
      const values = extractFieldValues(filteredOccs, fieldId, { flowFilter });
      allValues = allValues.concat(values);
    }
  } else if (legacyFieldId) {
    // Legacy single field support
    const relevantOccurrences = getRelevantOccurrences(state, field, context);
    allValues = extractFieldValues(relevantOccurrences, legacyFieldId);
  }

  // Apply aggregation
  return applyAggregation(allValues, aggregation, options);
}

/**
 * Get aggregation options for a given field type
 */
export function getAggregationsForType(fieldType) {
  return Object.entries(AGGREGATIONS)
    .filter(([, config]) => config.types.includes(fieldType))
    .map(([value, config]) => ({
      value,
      label: config.label,
      symbol: config.symbol,
      description: config.description,
    }));
}

/**
 * Get aggregation symbol for display
 */
export function getAggregationSymbol(aggregation) {
  return AGGREGATIONS[aggregation]?.symbol || "=";
}

/**
 * Get aggregation label for display
 */
export function getAggregationLabel(aggregation) {
  return AGGREGATIONS[aggregation]?.label || aggregation;
}

/**
 * Calculate streak (consecutive occurrences meeting a condition)
 * Useful for habit tracking
 */
export function calculateStreak(occurrences, fieldId, condition = Boolean) {
  // Sort by date descending (most recent first)
  const sorted = [...occurrences].sort((a, b) => {
    const dateA = new Date(a.createdAt || a.meta?.createdAt || 0);
    const dateB = new Date(b.createdAt || b.meta?.createdAt || 0);
    return dateB - dateA;
  });

  let streak = 0;
  for (const occ of sorted) {
    const value = occ.fields?.[fieldId];
    if (condition(value)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Calculate rolling average over N most recent occurrences
 */
export function calculateRollingAverage(occurrences, fieldId, windowSize = 7) {
  // Sort by date descending
  const sorted = [...occurrences].sort((a, b) => {
    const dateA = new Date(a.createdAt || a.meta?.createdAt || 0);
    const dateB = new Date(b.createdAt || b.meta?.createdAt || 0);
    return dateB - dateA;
  });

  const window = sorted.slice(0, windowSize);
  const values = extractFieldValues(window, fieldId);

  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Format a calculated value with prefix/postfix
 */
export function formatValue(value, meta = {}) {
  const { prefix = "", postfix = "", precision = 2 } = meta;

  if (value === null || value === undefined) {
    return `${prefix}-${postfix}`;
  }

  let formatted = value;
  if (typeof value === "number") {
    formatted = Number.isInteger(value) ? value : value.toFixed(precision);
  }

  return `${prefix}${formatted}${postfix}`;
}

export default {
  AGGREGATIONS,
  COMPARISONS,
  SCOPES,
  TIME_FILTERS,
  TIME_FILTER_MULTIPLIERS,
  INPUT_FLOWS,
  DERIVED_FLOWS,
  scaleTarget,
  resolveSourceTimeFilter,
  resolveEffectiveIteration,
  filterOccurrencesByScope,
  filterOccurrencesByTime,
  filterOccurrencesByIteration,
  extractFieldValues,
  applyAggregation,
  checkTarget,
  getScaledTargetValue,
  calculateProgress,
  calculateDerivedField,
  getAggregationsForType,
  getAggregationSymbol,
  getAggregationLabel,
  calculateStreak,
  calculateRollingAverage,
  formatValue,
};
