// forms/InstanceForm.jsx
import React, { useState, useCallback, useContext, useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import FormInput from "./FormInput";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import MultiSelectPills from "./MultiSelectPills";
import { GridActionsContext } from "../GridActionsContext";
import * as CommitHelpers from "../helpers/CommitHelpers";
import { uid } from "../uid";
import {
  TIME_FILTERS,
  COMPARISONS,
  INPUT_FLOWS,
  DERIVED_FLOWS,
  getAggregationsForType,
} from "../helpers/CalculationHelpers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ITERATION_MODES = [
  { value: "inherit", label: "Inherit from Container" },
  { value: "own", label: "Use own iteration" },
];

const ITER_TIME_FILTER_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const DRAG_MODE_OPTIONS = [
  { value: "move", label: "Move (relocate occurrence)" },
  { value: "copy", label: "Copy (create new occurrence)" },
];

export default function InstanceForm({
  value,            // { label }
  onChange,         // (next) => void
  onCommitLabel,    // () => void
  onDeleteInstance, // () => void
  instanceId,
  instance,         // Full instance object with fieldBindings
  iteration,        // { mode, timeFilter }
  onIterationChange, // (next) => void
  dispatch,
  socket,
}) {
  const { fieldsById, containersById, panelsById } = useContext(GridActionsContext);

  // Local state for field bindings being edited
  const [localBindings, setLocalBindings] = useState(() =>
    instance?.fieldBindings || []
  );

  // Get all fields as array
  const allFields = Object.values(fieldsById || {});
  const panels = Object.values(panelsById || {});
  const containers = Object.values(containersById || {});

  return (
    <div className="font-mono" style={{ minWidth: 280 }}>
      <div>
        <h4 className="text-sm font-semibold text-white">Instance settings</h4>
        <p className="text-[11px] pt-[2px] text-foregroundScale-2">
          Edit instance label and fields.
        </p>
      </div>

      <Separator />

      <FormInput
        schema={{
          className: "",
          type: "text-input",
          key: "label",
          label: "Label",
          placeholder: "Untitled",
          onKeyDown: (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommitLabel?.();
              e.currentTarget.blur();
            }
          },
        }}
        value={value}
        onChange={onChange}
      />

      <Separator />

      {/* Drag Behavior */}
      <div className="py-2">
        <h4 className="text-xs font-semibold text-foregroundScale-2 mb-2">Drag Behavior</h4>
        <FormInput
          schema={{
            type: "select",
            key: "__defaultDragMode",
            label: "Default Mode",
            options: DRAG_MODE_OPTIONS,
            description: "Default behavior when dragging this instance.",
          }}
          value={{ __defaultDragMode: instance?.defaultDragMode || "move" }}
          onChange={(next) => {
            if (instance) {
              CommitHelpers.updateInstance({
                dispatch,
                socket,
                instance: {
                  id: instance.id,
                  defaultDragMode: next?.__defaultDragMode || "move",
                },
                emit: true,
              });
            }
          }}
        />
      </div>

      <Separator />

      {/* Fields Section */}
      <FieldsSection
        instance={instance}
        localBindings={localBindings}
        setLocalBindings={setLocalBindings}
        allFields={allFields}
        fieldsById={fieldsById}
        panels={panels}
        containers={containers}
        dispatch={dispatch}
        socket={socket}
      />

      <Separator />

      <div className="pt-2">
        <h4 className="text-xs font-semibold text-red-400">Danger zone</h4>
        <p className="text-[10px] text-foregroundScale-2/80 mt-1">
          Deletes this instance and removes it from any containers that reference it.
        </p>

        <div className="mt-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              const ok = window.confirm(
                `Delete this instance${instanceId ? ` (${instanceId})` : ""}? This cannot be undone.`
              );
              if (!ok) return;
              onDeleteInstance?.();
            }}
            disabled={!onDeleteInstance}
          >
            Delete Instance
          </Button>
        </div>
      </div>
    </div>
  );
}

// Time filter options for destinations
const TIME_FILTER_OPTIONS = Object.entries(TIME_FILTERS).map(([value, config]) => ({
  value,
  label: config.label,
}));

// Time filter options for derived field sources (includes "inherit from parent" option)
const SOURCE_TIME_FILTER_OPTIONS = [
  { value: "inherit", label: "Inherit (use parent iteration)" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "all", label: "All time" },
];

// Time filter options for targets (when setting the base period for a target)
const TARGET_TIME_FILTER_OPTIONS = [
  { value: "daily", label: "Daily (per day)" },
  { value: "weekly", label: "Weekly (per week)" },
  { value: "monthly", label: "Monthly (per month)" },
  { value: "yearly", label: "Yearly (per year)" },
  { value: "inherit", label: "Inherit (match viewing period)" },
];

// Comparison options for targets
const COMPARISON_OPTIONS = Object.entries(COMPARISONS).map(([value, config]) => ({
  value,
  label: config.label,
}));

// Flow options for input fields
const INPUT_FLOW_OPTIONS = Object.entries(INPUT_FLOWS).map(([value, config]) => ({
  value,
  label: config.label,
}));

// Flow filter options for derived field sources
const DERIVED_FLOW_OPTIONS = Object.entries(DERIVED_FLOWS).map(([value, config]) => ({
  value,
  label: config.label,
}));

// Field type options
const FIELD_TYPES = [
  { value: "number", label: "Number" },
  { value: "text", label: "Text" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date" },
];

/**
 * FieldsSection - MultiSelect-based field binding management
 */
function FieldsSection({
  instance,
  localBindings,
  setLocalBindings,
  allFields,
  fieldsById,
  panels,
  containers,
  dispatch,
  socket,
}) {
  // Field options for multiselect (only existing fields)
  const fieldOptions = useMemo(() => {
    return allFields.map(f => ({
      value: f.id,
      label: f.name || f.type,
      description: `${f.type} (${f.mode})`,
      color: f.mode === "input"
        ? "bg-blue-500/20 text-blue-300"
        : "bg-violet-500/20 text-violet-300",
    }));
  }, [allFields]);

  // Destination options (panels + containers)
  const destinationOptions = useMemo(() => {
    const panelOpts = panels.map(p => ({
      value: `panel:${p.id}`,
      label: p.name || `Panel ${p.id?.slice(0, 6)}`,
      description: "Panel",
      color: "bg-cyan-500/20 text-cyan-300",
    }));
    const containerOpts = containers.map(c => ({
      value: `container:${c.id}`,
      label: c.name || `Container ${c.id?.slice(0, 6)}`,
      description: "Container",
      color: "bg-orange-500/20 text-orange-300",
    }));
    return [...panelOpts, ...containerOpts];
  }, [panels, containers]);

  // Currently selected field IDs
  const selectedFieldIds = useMemo(() => {
    return localBindings.map(b => b.fieldId).filter(Boolean);
  }, [localBindings]);

  // Handle field selection changes from multiselect
  const handleFieldSelectionChange = useCallback((selectedIds) => {
    const newBindings = selectedIds.map((fieldId, index) => {
      const existing = localBindings.find(b => b.fieldId === fieldId);
      if (existing) return existing;
      return {
        fieldId,
        role: "input",
        order: index,
      };
    });

    setLocalBindings(newBindings);

    if (instance) {
      CommitHelpers.updateInstance({
        dispatch,
        socket,
        instance: {
          id: instance.id,
          fieldBindings: newBindings,
        },
        emit: true,
      });
    }
  }, [localBindings, instance, dispatch, socket, setLocalBindings]);

  // Add a new field
  const addNewField = useCallback(() => {
    const newFieldId = uid();
    const newField = {
      id: newFieldId,
      name: "",
      type: "number",
      mode: "input",
      meta: { prefix: "", postfix: "", increment: 1 },
      metric: null,
    };

    // Create field on server
    CommitHelpers.createField({
      dispatch,
      socket,
      field: newField,
      emit: true,
    });

    // Add binding for this new field
    const newBinding = {
      fieldId: newFieldId,
      role: "input",
      order: localBindings.length,
    };
    const newBindings = [...localBindings, newBinding];
    setLocalBindings(newBindings);

    if (instance) {
      CommitHelpers.updateInstance({
        dispatch,
        socket,
        instance: {
          id: instance.id,
          fieldBindings: newBindings,
        },
        emit: true,
      });
    }
  }, [localBindings, instance, dispatch, socket, setLocalBindings]);

  // Update a field (global - affects all instances using this field)
  const updateField = useCallback((field) => {
    CommitHelpers.updateField({
      dispatch,
      socket,
      field,
      emit: true,
    });
  }, [dispatch, socket]);

  // Update a specific binding
  const updateBinding = useCallback((fieldId, updates) => {
    const newBindings = localBindings.map(b =>
      b.fieldId === fieldId ? { ...b, ...updates } : b
    );
    setLocalBindings(newBindings);

    if (instance) {
      CommitHelpers.updateInstance({
        dispatch,
        socket,
        instance: {
          id: instance.id,
          fieldBindings: newBindings,
        },
        emit: true,
      });
    }
  }, [localBindings, instance, dispatch, socket, setLocalBindings]);

  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-white">Fields</h4>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px]"
          onClick={addNewField}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add New Field
        </Button>
      </div>

      <p className="text-[10px] text-foregroundScale-2/80 mb-2">
        Select existing fields or add new ones.
      </p>

      {/* MultiSelect for existing fields */}
      <MultiSelectPills
        options={fieldOptions}
        selected={selectedFieldIds}
        onChange={handleFieldSelectionChange}
        placeholder="Select existing fields..."
        emptyMessage="No fields defined yet"
        compact
      />

      {/* List of bound fields with settings */}
      {localBindings.filter(b => b.fieldId).length > 0 && (
        <div className="mt-3 space-y-2">
          {localBindings.filter(b => b.fieldId).map((binding) => {
            const field = fieldsById[binding.fieldId];
            if (!field) return null;

            return (
              <FieldBindingRow
                key={binding.fieldId}
                field={field}
                binding={binding}
                allFields={allFields}
                destinationOptions={destinationOptions}
                onUpdateField={updateField}
                onUpdateBinding={(updates) => updateBinding(binding.fieldId, updates)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * FieldBindingRow - Individual field binding with full field editing
 */
function FieldBindingRow({
  field,
  binding,
  allFields,
  destinationOptions,
  onUpdateField,
  onUpdateBinding,
}) {
  const [expanded, setExpanded] = useState(false);

  const isInput = field.mode === "input";
  const pillColor = isInput
    ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
    : "bg-violet-500/20 text-violet-300 border-violet-500/30";

  // Handle field property changes
  const handleFieldChange = useCallback((key, value) => {
    onUpdateField({ ...field, [key]: value });
  }, [field, onUpdateField]);

  // Handle meta changes
  const handleMetaChange = useCallback((key, value) => {
    onUpdateField({
      ...field,
      meta: { ...(field.meta || {}), [key]: value },
    });
  }, [field, onUpdateField]);

  // Handle metric changes
  const handleMetricChange = useCallback((key, value) => {
    onUpdateField({
      ...field,
      metric: { ...(field.metric || {}), [key]: value },
    });
  }, [field, onUpdateField]);

  // Handle mode switch
  const handleModeSwitch = useCallback((isDerived) => {
    const newMode = isDerived ? "derived" : "input";
    onUpdateField({
      ...field,
      mode: newMode,
      metric: isDerived ? {
        source: "occurrences",
        aggregation: "sum",
        scope: "container",
        allowedFields: [],
      } : null,
    });
  }, [field, onUpdateField]);

  // Get available input fields for derived field source selection
  const inputFieldOptions = useMemo(() => {
    return allFields
      .filter(f => f.mode === "input" && f.id !== field.id && f.type === field.type)
      .map(f => ({
        value: f.id,
        label: f.name || f.type,
        description: f.type,
        color: "bg-blue-500/20 text-blue-300",
      }));
  }, [allFields, field.id, field.type]);

  // Allowed fields from metric
  const allowedFieldIds = field.metric?.allowedFields?.map(af => af.fieldId) || [];

  // Handle allowed field selection
  const handleAllowedFieldsChange = useCallback((selectedIds) => {
    const newAllowedFields = selectedIds.map(fieldId => {
      const existing = field.metric?.allowedFields?.find(af => af.fieldId === fieldId);
      return existing || { fieldId, destinations: [] };
    });
    handleMetricChange("allowedFields", newAllowedFields);
  }, [field.metric?.allowedFields, handleMetricChange]);

  // Update destinations for an allowed field
  const updateAllowedFieldDestinations = useCallback((fieldId, destinations) => {
    const newAllowedFields = (field.metric?.allowedFields || []).map(af =>
      af.fieldId === fieldId ? { ...af, destinations } : af
    );
    handleMetricChange("allowedFields", newAllowedFields);
  }, [field.metric?.allowedFields, handleMetricChange]);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-2 py-1.5 bg-muted/30 hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronUp className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          )}
          <span className={`px-2 py-0.5 text-[10px] rounded-full border ${pillColor}`}>
            {field.name || field.type}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {field.type} • {field.mode}
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="p-2 space-y-3 border-t border-border">
          {/* Row 1: Name + Input/Derived switch */}
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={field.name || ""}
              onChange={(e) => handleFieldChange("name", e.target.value)}
              placeholder="Field name"
              className="h-7 text-xs flex-1"
            />
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] ${isInput ? "text-blue-300" : "text-muted-foreground"}`}>
                Input
              </span>
              <Switch
                checked={!isInput}
                onCheckedChange={handleModeSwitch}
                className="data-[state=checked]:bg-violet-500"
              />
              <span className={`text-[10px] ${!isInput ? "text-violet-300" : "text-muted-foreground"}`}>
                Derived
              </span>
            </div>
          </div>

          {/* INPUT FIELD OPTIONS */}
          {isInput && (
            <div className="space-y-2">
              {/* Type */}
              <div>
                <Label className="text-[10px] text-muted-foreground">Type</Label>
                <Select value={field.type} onValueChange={(v) => handleFieldChange("type", v)}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Prefix/Postfix for numbers */}
              {field.type === "number" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Prefix</Label>
                    <Input
                      type="text"
                      value={field.meta?.prefix || ""}
                      onChange={(e) => handleMetaChange("prefix", e.target.value)}
                      placeholder="e.g., $"
                      className="h-6 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Postfix</Label>
                    <Input
                      type="text"
                      value={field.meta?.postfix || ""}
                      onChange={(e) => handleMetaChange("postfix", e.target.value)}
                      placeholder="e.g., kg"
                      className="h-6 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Flow for input fields */}
              {field.type === "number" && (
                <div>
                  <Label className="text-[10px] text-muted-foreground">Flow (how value affects aggregates)</Label>
                  <Select
                    value={field.meta?.flow || "in"}
                    onValueChange={(v) => handleMetaChange("flow", v)}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INPUT_FLOW_OPTIONS.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* DERIVED FIELD OPTIONS */}
          {!isInput && (
            <div className="space-y-3">
              {/* Type (for matching source fields) */}
              <div>
                <Label className="text-[10px] text-muted-foreground">Type (must match source fields)</Label>
                <Select value={field.type} onValueChange={(v) => handleFieldChange("type", v)}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Aggregation */}
              <div>
                <Label className="text-[10px] text-muted-foreground">Aggregation</Label>
                <Select
                  value={field.metric?.aggregation || "sum"}
                  onValueChange={(v) => handleMetricChange("aggregation", v)}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAggregationsForType(field.type).map(a => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.symbol} {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Source Time Filter */}
              <div>
                <Label className="text-[10px] text-muted-foreground">Source Time Filter</Label>
                <Select
                  value={field.metric?.timeFilter || "inherit"}
                  onValueChange={(v) => handleMetricChange("timeFilter", v)}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TIME_FILTER_OPTIONS.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  "Inherit" uses the parent's iteration (grid → panel → container)
                </p>
              </div>

              {/* Target (for number fields) */}
              {field.type === "number" && (
                <div className="space-y-2">
                  <Label className="text-[10px] text-muted-foreground">Target</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={field.metric?.target?.op || ">="}
                      onValueChange={(v) => handleMetricChange("target", {
                        ...(field.metric?.target || {}),
                        op: v,
                      })}
                    >
                      <SelectTrigger className="h-6 text-[10px] w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPARISON_OPTIONS.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={field.metric?.target?.value ?? ""}
                      onChange={(e) => handleMetricChange("target", e.target.value === "" ? undefined : {
                        ...(field.metric?.target || {}),
                        op: field.metric?.target?.op || ">=",
                        value: Number(e.target.value),
                        timeFilter: field.metric?.target?.timeFilter || "daily",
                      })}
                      placeholder="Target"
                      className="h-6 text-[10px] flex-1"
                    />
                  </div>
                  {/* Target time filter - what period the target value is for */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted-foreground">Target is per:</span>
                    <Select
                      value={field.metric?.target?.timeFilter || "daily"}
                      onValueChange={(v) => handleMetricChange("target", {
                        ...(field.metric?.target || {}),
                        timeFilter: v,
                      })}
                    >
                      <SelectTrigger className="h-5 text-[10px] flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TARGET_TIME_FILTER_OPTIONS.map(f => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[9px] text-muted-foreground">
                    e.g., "3 per day" → viewing weekly shows 21
                  </p>
                </div>
              )}

              {/* Prefix/Postfix for numbers */}
              {field.type === "number" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Prefix</Label>
                    <Input
                      type="text"
                      value={field.meta?.prefix || ""}
                      onChange={(e) => handleMetaChange("prefix", e.target.value)}
                      placeholder="e.g., $"
                      className="h-6 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Postfix</Label>
                    <Input
                      type="text"
                      value={field.meta?.postfix || ""}
                      onChange={(e) => handleMetaChange("postfix", e.target.value)}
                      placeholder="e.g., kg"
                      className="h-6 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Allowed Fields (source fields for aggregation) */}
              <div className="pt-2 border-t border-border">
                <Label className="text-[10px] text-muted-foreground">
                  Source Fields (type: {field.type})
                </Label>
                <MultiSelectPills
                  options={inputFieldOptions}
                  selected={allowedFieldIds}
                  onChange={handleAllowedFieldsChange}
                  placeholder="Select input fields to aggregate..."
                  emptyMessage={`No ${field.type} input fields available`}
                  compact
                />

                {/* Per-allowed-field destinations */}
                {(field.metric?.allowedFields || []).map((af) => {
                  const sourceField = allFields.find(f => f.id === af.fieldId);
                  if (!sourceField) return null;

                  const destIds = (af.destinations || []).map(d => d.id);

                  // Update flow filter for this allowed field
                  const updateAllowedFieldFlow = (flowValue) => {
                    const newAllowedFields = (field.metric?.allowedFields || []).map(a =>
                      a.fieldId === af.fieldId ? { ...a, flowFilter: flowValue } : a
                    );
                    handleMetricChange("allowedFields", newAllowedFields);
                  };

                  return (
                    <div key={af.fieldId} className="mt-2 p-2 bg-muted/20 rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-blue-500/20 text-blue-300">
                          {sourceField.name || sourceField.type}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex-1">config:</span>
                      </div>

                      {/* Flow filter for this source field */}
                      <div className="flex items-center gap-2 mb-2">
                        <Label className="text-[9px] text-muted-foreground">Flow:</Label>
                        <Select
                          value={af.flowFilter || "any"}
                          onValueChange={updateAllowedFieldFlow}
                        >
                          <SelectTrigger className="h-5 text-[9px] flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DERIVED_FLOW_OPTIONS.map(f => (
                              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Label className="text-[9px] text-muted-foreground">Destinations:</Label>
                      <MultiSelectPills
                        options={destinationOptions}
                        selected={destIds}
                        onChange={(selectedIds) => {
                          const newDests = selectedIds.map(id => {
                            const existing = af.destinations?.find(d => d.id === id);
                            return existing || { id, timeFilter: "all" };
                          });
                          updateAllowedFieldDestinations(af.fieldId, newDests);
                        }}
                        placeholder="All destinations"
                        emptyMessage="No panels/containers"
                        compact
                      />

                      {/* Per-destination time filters */}
                      {(af.destinations || []).length > 0 && (
                        <div className="mt-1 space-y-1">
                          {(af.destinations || []).map((dest) => {
                            const destOption = destinationOptions.find(o => o.value === dest.id);
                            return (
                              <div key={dest.id} className="flex items-center gap-2">
                                <span className={`px-1 py-0.5 text-[9px] rounded ${destOption?.color || "bg-muted"}`}>
                                  {destOption?.label || dest.id}
                                </span>
                                <Select
                                  value={dest.timeFilter || "all"}
                                  onValueChange={(v) => {
                                    const newDests = (af.destinations || []).map(d =>
                                      d.id === dest.id ? { ...d, timeFilter: v } : d
                                    );
                                    updateAllowedFieldDestinations(af.fieldId, newDests);
                                  }}
                                >
                                  <SelectTrigger className="h-5 text-[9px] flex-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TIME_FILTER_OPTIONS.map(t => (
                                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

