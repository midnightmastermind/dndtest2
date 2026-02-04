// ui/FieldDisplay.jsx
// ============================================================
// Component for displaying field values (read-only)
// Used for mode: "derived" fields and display-only bindings
// ============================================================

import React, { useMemo } from "react";
import { calculateDerivedField } from "../state/selectors";
import { checkTarget, getScaledTargetValue, calculateProgress } from "../helpers/CalculationHelpers";

/**
 * FieldDisplay - Renders a read-only display of a field value
 *
 * Props:
 * - field: Field definition { id, name, type, mode, unit, metric }
 * - binding: FieldBinding { fieldId, role, display, order }
 * - value: Value to display (for input fields)
 * - state: Full app state (for derived field calculations)
 * - context: { gridId, panelId, containerId } for derived calculations
 * - compact: boolean - use compact display mode
 */
function FieldDisplay({
  field,
  binding,
  value,
  state,
  context,
  compact = false,
}) {
  // All hooks must be called before any early return

  // Calculate derived value if this is a derived field
  const displayValue = useMemo(() => {
    if (!field) return null;

    if (field.mode === "derived" && state) {
      return calculateDerivedField(state, field, context);
    }

    return value;
  }, [field, value, state, context]);

  // Format the value based on type
  const formattedValue = useMemo(() => {
    if (!field) return "—";
    if (displayValue === null || displayValue === undefined) {
      return compact ? "-" : "—";
    }

    const { type } = field;

    switch (type) {
      case "number": {
        const num = Number(displayValue);
        if (isNaN(num)) return displayValue;

        // Check for precision in display settings
        const precision = binding?.display?.precision ?? 2;
        const formatted = Number.isInteger(num)
          ? num.toString()
          : num.toFixed(precision);

        return formatted;
      }

      case "boolean":
        return displayValue ? "Yes" : "No";

      case "date": {
        if (!displayValue) return "—";
        try {
          const date = new Date(displayValue);
          return date.toLocaleDateString();
        } catch {
          return displayValue;
        }
      }

      case "select": {
        // Try to find the label for the value
        const options = field.meta?.options || [];
        const option = options.find((o) => o.value === displayValue);
        return option?.label ?? displayValue;
      }

      default:
        return String(displayValue);
    }
  }, [field, displayValue, compact, binding]);

  // Get aggregation label for derived fields
  const aggregationLabel = useMemo(() => {
    if (!field || field.mode !== "derived" || !field.metric) return null;

    const labels = {
      sum: "Total",
      count: "Count",
      avg: "Average",
      min: "Min",
      max: "Max",
      last: "Latest",
    };

    return labels[field.metric.aggregation] || null;
  }, [field]);

  // Progress bar for target comparison (with scaling based on iteration)
  const currentTimeFilter = context?.currentIteration || "daily";

  const targetProgress = useMemo(() => {
    const target = field?.metric?.target;
    if (!target || displayValue === null) return null;

    const targetValue = target.value;
    if (typeof targetValue !== "number") return null;

    const current = Number(displayValue);
    if (isNaN(current)) return null;

    // Get scaled target value based on current viewing period
    const scaledTarget = getScaledTargetValue(target, currentTimeFilter);

    // Calculate progress using helper (handles scaling)
    const progress = calculateProgress(current, target, currentTimeFilter) ?? 0;

    // Check if target is met using helper (handles scaling)
    const met = checkTarget(current, target, currentTimeFilter) ?? false;

    return { progress, met, target: scaledTarget };
  }, [field, displayValue, currentTimeFilter]);

  // Early return after all hooks
  if (!field) return null;

  const { name, unit } = field;
  const showLabel = !compact && binding?.display?.showLabel !== false;
  const showUnit = unit && binding?.display?.showUnit !== false;

  // ============================================================
  // COMPACT DISPLAY
  // ============================================================
  if (compact) {
    return (
      <div className="field-display field-display-compact flex items-center gap-1">
        <span className="text-xs font-medium">{formattedValue}</span>
        {showUnit && (
          <span className="text-xs text-muted-foreground">{unit}</span>
        )}
      </div>
    );
  }

  // ============================================================
  // FULL DISPLAY
  // ============================================================
  return (
    <div className="field-display">
      {showLabel && (
        <div className="flex items-center gap-1 mb-0.5">
          <span className="text-xs text-muted-foreground">{name}</span>
          {aggregationLabel && (
            <span className="text-[10px] text-muted-foreground/60">
              ({aggregationLabel})
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-1">
        <span className="text-sm font-medium">{formattedValue}</span>
        {showUnit && (
          <span className="text-xs text-muted-foreground">{unit}</span>
        )}
      </div>

      {/* Target progress bar */}
      {targetProgress && (
        <div className="mt-1">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                targetProgress.met ? "bg-green-500" : "bg-blue-500"
              }`}
              style={{ width: `${targetProgress.progress}%` }}
            />
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {targetProgress.met ? "Target met" : `Target: ${targetProgress.target}${unit ? ` ${unit}` : ""}`}
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(FieldDisplay);
