// ui/FieldRenderer.jsx
// ============================================================
// Smart component that renders the appropriate field UI based on:
// - Field mode (input vs derived)
// - Binding role (input, display, or both)
// - compact: uses pill components (FieldPillInput, FieldPillDisplay)
// ============================================================

import React, { useCallback, useMemo } from "react";
import FieldInput from "./FieldInput";
import FieldDisplay from "./FieldDisplay";
import FieldPillInput from "./FieldPillInput";
import FieldPillDisplay from "./FieldPillDisplay";
import * as CommitHelpers from "../helpers/CommitHelpers";

// Removed unused: useContext, GridActionsContext

/**
 * FieldRenderer - Renders field input or display based on configuration
 *
 * Props:
 * - field: Field definition
 * - binding: FieldBinding from instance
 * - occurrence: The occurrence containing field values
 * - instance: The instance (for fieldBindings reference)
 * - context: { gridId, panelId, containerId } for derived calculations
 * - state: Full app state (for derived field calculations)
 * - dispatch: Redux dispatch
 * - socket: Socket.io socket
 * - compact: boolean - use compact display mode
 */
function FieldRenderer({
  field,
  binding,
  occurrence,
  instance,
  context,
  state,
  dispatch,
  socket,
  compact = false,
}) {
  // Get current value from occurrence.fields
  // Values are stored as { value, flow } objects, so extract the raw value
  const value = useMemo(() => {
    if (!occurrence?.fields || !field?.id) return undefined;
    const storedValue = occurrence.fields[field.id];
    // Handle both old format (raw value) and new format ({ value, flow })
    if (storedValue && typeof storedValue === "object" && "value" in storedValue) {
      return storedValue.value;
    }
    return storedValue;
  }, [occurrence?.fields, field?.id]);

  // Handle value change - update occurrence.fields
  const handleChange = useCallback((newValue) => {
    // Optimistic update could go here if needed
  }, []);

  // Handle value commit - persist to server
  const handleCommit = useCallback((newValue) => {
    if (!occurrence?.id || !field?.id) return;

    // Get the flow from the field's meta (for input fields)
    // Store as { value, flow } format for proper aggregation support
    const flow = field?.meta?.flow || "in";
    const fieldValue = field.mode === "input"
      ? { value: newValue, flow }
      : newValue;

    const updatedFields = {
      ...((occurrence.fields) || {}),
      [field.id]: fieldValue,
    };

    // Update occurrence with new field value
    CommitHelpers.updateOccurrence({
      dispatch,
      socket,
      occurrence: {
        id: occurrence.id,
        fields: updatedFields,
      },
      emit: true,
    });
  }, [occurrence, field?.id, field?.meta?.flow, field?.mode, dispatch, socket]);

  if (!field) return null;

  // Determine what to render based on field mode and binding role
  const role = binding?.role || "input";
  const isDerivedField = field.mode === "derived";

  // ============================================================
  // COMPACT MODE: Use pill components
  // ============================================================
  if (compact) {
    // Derived fields are always display-only (pill display)
    if (isDerivedField) {
      return (
        <FieldPillDisplay
          field={field}
          state={state}
          context={context}
          compact={compact}
        />
      );
    }

    // Input fields in compact mode use pill input (click to edit)
    return (
      <FieldPillInput
        field={field}
        value={value}
        onChange={handleChange}
        onCommit={handleCommit}
        compact={compact}
      />
    );
  }

  // ============================================================
  // FULL MODE: Use standard components
  // ============================================================

  // Derived fields are always display-only
  if (isDerivedField) {
    return (
      <FieldDisplay
        field={field}
        binding={binding}
        value={value}
        state={state}
        context={context}
        compact={compact}
      />
    );
  }

  // Input fields: render based on binding role
  if (role === "display") {
    return (
      <FieldDisplay
        field={field}
        binding={binding}
        value={value}
        compact={compact}
      />
    );
  }

  if (role === "both") {
    // Show both input and display (useful for showing current value prominently)
    return (
      <div className="field-renderer-both">
        <FieldDisplay
          field={field}
          binding={binding}
          value={value}
          compact={compact}
        />
        <FieldInput
          field={field}
          binding={binding}
          value={value}
          onChange={handleChange}
          onCommit={handleCommit}
          compact={compact}
        />
      </div>
    );
  }

  // Default: role === "input"
  return (
    <FieldInput
      field={field}
      binding={binding}
      value={value}
      onChange={handleChange}
      onCommit={handleCommit}
      compact={compact}
    />
  );
}

export default React.memo(FieldRenderer);
