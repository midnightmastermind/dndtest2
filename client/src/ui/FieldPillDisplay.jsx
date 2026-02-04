// ui/FieldPillDisplay.jsx
// ============================================================
// Display pill for derived/calculated field values
// Shows the aggregation result with prefix/postfix formatting
// Only recalculates when relevant occurrences change
// ============================================================

import React, { useMemo } from "react";
import { calculateDerivedField } from "../state/selectors";
import {
  getDerivedFieldCacheKey,
  getAggregationSymbol,
  checkTarget,
  getScaledTargetValue,
} from "../helpers/CalculationHelpers";

/**
 * FieldPillDisplay - Display pill for derived field values
 *
 * Props:
 * - field: Field definition { id, name, type, mode, metric, meta: { prefix, postfix } }
 * - state: Full app state for calculations
 * - context: { gridId, panelId, containerId } for scope
 * - compact: boolean
 */
export default function FieldPillDisplay({
  field,
  state,
  context,
  compact = false,
}) {
  // Create a cache key based only on relevant occurrences
  // This ensures we only recalculate when the specific field values we care about change
  const cacheKey = useMemo(() => {
    return getDerivedFieldCacheKey(state, field, context);
  }, [state.occurrences, field, context]);

  // Calculate the derived value - only recomputes when cacheKey changes
  const calculatedValue = useMemo(() => {
    if (!field || field.mode !== "derived") return null;
    return calculateDerivedField(state, field, context);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  // Get formatting from field meta
  const prefix = field?.meta?.prefix || "";
  const postfix = field?.meta?.postfix || "";
  const rawFieldName = field?.name ?? "";
  const fieldName = rawFieldName || null; // null means don't show label
  const aggregation = field?.metric?.aggregation || "sum";

  // Check for target
  const target = field?.metric?.target;
  const hasTarget = target?.value !== undefined;

  // Get current iteration's time filter for target scaling
  const currentTimeFilter = context?.currentIteration || "daily";

  // Get scaled target value based on current viewing period
  const scaledTargetValue = useMemo(() => {
    return getScaledTargetValue(target, currentTimeFilter);
  }, [target, currentTimeFilter]);

  // Format display value
  const displayValue = calculatedValue ?? 0;
  const formattedValue = typeof displayValue === "number"
    ? (Number.isInteger(displayValue) ? displayValue : displayValue.toFixed(2))
    : displayValue;

  // Format target value for display (scaled)
  const formattedTargetValue = typeof scaledTargetValue === "number"
    ? (Number.isInteger(scaledTargetValue) ? scaledTargetValue : scaledTargetValue.toFixed(2))
    : scaledTargetValue;

  // If there's a target, show as "current/target" format (with scaled target)
  const formattedDisplay = hasTarget
    ? `${prefix}${formattedValue}/${formattedTargetValue}${postfix}`
    : `${prefix}${formattedValue}${postfix}`;

  // Check if target is met (uses scaled target via checkTarget helper)
  const targetMet = useMemo(() => {
    if (!hasTarget) return null;
    return checkTarget(displayValue, target, currentTimeFilter);
  }, [hasTarget, target, displayValue, currentTimeFilter]);

  // Get aggregation symbol from helpers
  const aggSymbol = getAggregationSymbol(aggregation);

  if (!field) return null;

  // Pill color based on target status
  const getPillColors = () => {
    if (!hasTarget) {
      return "bg-violet-500/20 text-violet-300 border-violet-500/30";
    }
    if (targetMet) {
      return "bg-green-500/20 text-green-300 border-green-500/30";
    }
    return "bg-red-500/20 text-red-300 border-red-500/30";
  };

  return (
    <div
      className={`
        field-pill-display
        inline-flex items-center gap-1
        ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"}
        rounded-full border
        ${getPillColors()}
      `}
      title={fieldName ? `${fieldName}: ${aggregation}(${field?.metric?.fieldId || "?"})` : `${aggregation}(${field?.metric?.fieldId || "?"})`}
    >
      {fieldName && <span className="opacity-70">{fieldName}:</span>}
      {!hasTarget && <span className="opacity-70">{aggSymbol}</span>}
      <span className="font-bold">{formattedDisplay}</span>
    </div>
  );
}
