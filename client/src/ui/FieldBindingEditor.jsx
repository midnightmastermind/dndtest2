// ui/FieldBindingEditor.jsx
// ============================================================
// Editor for individual field bindings on an instance
// Handles field creation, type/mode selection, prefix/postfix, and derived field metrics
// ============================================================

import React, { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { uid } from "../uid";
import MultiSelectPills from "./MultiSelectPills";
import {
  AGGREGATIONS as CALC_AGGREGATIONS,
  SCOPES as CALC_SCOPES,
  TIME_FILTERS,
  COMPARISONS,
  getAggregationsForType,
} from "../helpers/CalculationHelpers";

const FIELD_TYPES = [
  { value: "number", label: "Number", defaultValue: 0 },
  { value: "text", label: "Text", defaultValue: "" },
  { value: "boolean", label: "Boolean", defaultValue: false },
  { value: "date", label: "Date", defaultValue: null },
];

const FIELD_MODES = [
  { value: "input", label: "Input" },
  { value: "derived", label: "Display (Calculated)" },
];

// Convert calculation helpers to select options
const SCOPES = Object.entries(CALC_SCOPES).map(([value, config]) => ({
  value,
  label: config.label,
}));

const TIME_FILTER_OPTIONS = Object.entries(TIME_FILTERS).map(([value, config]) => ({
  value,
  label: config.label,
}));

const COMPARISON_OPTIONS = Object.entries(COMPARISONS).map(([value, config]) => ({
  value,
  label: config.label,
}));

const BINDING_ROLES = [
  { value: "input", label: "Input" },
  { value: "display", label: "Display only" },
  { value: "both", label: "Both" },
];

// Common presets for prefix/postfix
const FORMAT_PRESETS = [
  { label: "None", prefix: "", postfix: "" },
  { label: "Dollars ($)", prefix: "$", postfix: "" },
  { label: "Percent (%)", prefix: "", postfix: "%" },
  { label: "Hours (h)", prefix: "", postfix: "h" },
  { label: "Minutes (m)", prefix: "", postfix: "m" },
  { label: "Kilograms (kg)", prefix: "", postfix: "kg" },
  { label: "Pounds (lbs)", prefix: "", postfix: "lbs" },
  { label: "Custom", prefix: null, postfix: null },
];

/**
 * FieldBindingEditor - Editor for a single field binding
 */
export default function FieldBindingEditor({
  binding,
  field,
  allFields = [],
  panels = [],
  containers = [],
  onUpdate,
  onDelete,
  onCreateField,
  onUpdateField,
}) {
  const [expanded, setExpanded] = useState(!field); // Expand if new
  const [isCreatingNew, setIsCreatingNew] = useState(!field);

  // Local field state for creation/editing
  const [localField, setLocalField] = useState(() => field || {
    id: uid(),
    name: "", // Allow empty name - will use type as fallback
    type: "number",
    mode: "input",
    unit: "",
    meta: {
      prefix: "",
      postfix: "",
      increment: 1,
    },
    metric: null,
  });

  // Source fields for derived calculations
  const [sourceFields, setSourceFields] = useState(() => {
    if (field?.mode === "derived" && field?.metric?.fieldId) {
      return [{ fieldId: field.metric.fieldId, aggregation: field.metric.aggregation || "sum" }];
    }
    return [];
  });

  // Available fields for source selection - only matching types and input mode
  const availableSourceFields = useMemo(() => {
    return allFields.filter(f =>
      f.mode === "input" &&
      f.id !== localField.id &&
      f.type === localField.type // Type matching!
    );
  }, [allFields, localField.id, localField.type]);

  const handleFieldChange = useCallback((key, value) => {
    setLocalField(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleMetaChange = useCallback((key, value) => {
    setLocalField(prev => ({
      ...prev,
      meta: { ...(prev.meta || {}), [key]: value },
    }));
  }, []);

  const handleModeChange = useCallback((mode) => {
    setLocalField(prev => ({
      ...prev,
      mode,
      metric: mode === "derived" ? {
        source: "occurrences",
        fieldId: null,
        aggregation: "sum",
        scope: "container",
      } : null,
    }));
    if (mode === "input") {
      setSourceFields([]);
    }
  }, []);

  // When type changes, clear incompatible source fields
  const handleTypeChange = useCallback((type) => {
    setLocalField(prev => ({ ...prev, type }));
    // Clear source fields that don't match the new type
    setSourceFields(prev => prev.filter(sf => {
      const sourceField = allFields.find(f => f.id === sf.fieldId);
      return sourceField?.type === type;
    }));
  }, [allFields]);

  const addSourceField = useCallback(() => {
    if (availableSourceFields.length === 0) return;
    setSourceFields(prev => [...prev, {
      fieldId: availableSourceFields[0]?.id || null,
      aggregation: "sum",
    }]);
  }, [availableSourceFields]);

  const updateSourceField = useCallback((index, key, value) => {
    setSourceFields(prev => prev.map((sf, i) =>
      i === index ? { ...sf, [key]: value } : sf
    ));
  }, []);

  const removeSourceField = useCallback((index) => {
    setSourceFields(prev => prev.filter((_, i) => i !== index));
  }, []);

  const applyFormatPreset = useCallback((preset) => {
    if (preset.prefix !== null) {
      handleMetaChange("prefix", preset.prefix);
    }
    if (preset.postfix !== null) {
      handleMetaChange("postfix", preset.postfix);
    }
  }, [handleMetaChange]);

  const handleSave = useCallback(() => {
    // Build the field with metric if derived
    const fieldToSave = { ...localField };

    if (localField.mode === "derived" && sourceFields.length > 0) {
      const primarySource = sourceFields[0];
      fieldToSave.metric = {
        source: "occurrences",
        fieldId: primarySource.fieldId,
        aggregation: primarySource.aggregation,
        scope: localField.metric?.scope || "container",
      };
    }

    if (isCreatingNew) {
      onCreateField?.(fieldToSave);
      setIsCreatingNew(false);
    } else {
      onUpdateField?.(fieldToSave);
    }

    // Update the binding
    onUpdate?.({
      ...binding,
      fieldId: fieldToSave.id,
      role: binding?.role || (localField.mode === "derived" ? "display" : "input"),
    }, fieldToSave);
  }, [localField, sourceFields, isCreatingNew, binding, onCreateField, onUpdateField, onUpdate]);

  const handleSelectExistingField = useCallback((fieldId) => {
    const existingField = allFields.find(f => f.id === fieldId);
    if (existingField) {
      setLocalField(existingField);
      setIsCreatingNew(false);

      if (existingField.mode === "derived" && existingField.metric?.fieldId) {
        setSourceFields([{
          fieldId: existingField.metric.fieldId,
          aggregation: existingField.metric.aggregation || "sum",
        }]);
      } else {
        setSourceFields([]);
      }

      onUpdate?.({
        ...binding,
        fieldId: existingField.id,
        role: binding?.role || (existingField.mode === "derived" ? "display" : "input"),
      });
    }
  }, [allFields, binding, onUpdate]);

  // Format display helpers - allow empty name, use type as fallback display
  const rawFieldName = field?.name ?? localField.name ?? "";
  const fieldName = rawFieldName || localField.type || "Field"; // Fallback to type for display
  const fieldType = field?.type || localField.type || "number";
  const fieldMode = field?.mode || localField.mode || "input";
  const prefix = localField.meta?.prefix || "";
  const postfix = localField.meta?.postfix || "";

  return (
    <div className="field-binding-editor border border-border rounded-md mb-2 overflow-hidden">
      {/* Header - collapsible */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-muted/30 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {expanded ? <ChevronUp className="h-3 w-3 flex-shrink-0" /> : <ChevronDown className="h-3 w-3 flex-shrink-0" />}

          {/* Field pill display */}
          <div className="flex items-center gap-1 min-w-0">
            <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full truncate">
              {fieldName}
            </span>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              {fieldType}
            </span>
            {prefix || postfix ? (
              <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                ({prefix}...{postfix})
              </span>
            ) : null}
          </div>

          {/* Show aggregation for derived fields */}
          {fieldMode === "derived" && sourceFields.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-shrink-0">
              <span>=</span>
              {sourceFields.map((sf, i) => {
                const sourceFieldObj = allFields.find(f => f.id === sf.fieldId);
                return (
                  <span key={i} className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                    {sf.aggregation}({sourceFieldObj?.name || "?"})
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="p-3 space-y-3 border-t border-border">
          {/* Field selection or creation */}
          {allFields.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Select existing field</Label>
              <Select
                value={isCreatingNew ? "__new__" : localField.id}
                onValueChange={(val) => {
                  if (val === "__new__") {
                    setIsCreatingNew(true);
                    setLocalField({
                      id: uid(),
                      name: "", // Allow empty name
                      type: "number",
                      mode: "input",
                      unit: "",
                      meta: { prefix: "", postfix: "", increment: 1 },
                      metric: null,
                    });
                  } else {
                    handleSelectExistingField(val);
                  }
                }}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">+ Create new field</SelectItem>
                  {allFields.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} ({f.type}, {f.mode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Field name */}
          <div>
            <Label className="text-xs text-muted-foreground">Field Name</Label>
            <Input
              type="text"
              value={localField.name}
              onChange={(e) => handleFieldChange("name", e.target.value)}
              className="h-7 text-xs"
              placeholder="Field name"
            />
          </div>

          {/* Type and Mode row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={localField.type} onValueChange={handleTypeChange}>
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

            <div>
              <Label className="text-xs text-muted-foreground">Mode</Label>
              <Select value={localField.mode} onValueChange={handleModeChange}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_MODES.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Prefix/Postfix formatting (for number type) */}
          {localField.type === "number" && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Value Format</Label>

              {/* Quick presets */}
              <div className="flex flex-wrap gap-1">
                {FORMAT_PRESETS.slice(0, -1).map((preset, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="h-5 text-[10px] px-2"
                    onClick={() => applyFormatPreset(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              {/* Custom prefix/postfix */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Prefix</Label>
                  <Input
                    type="text"
                    value={localField.meta?.prefix || ""}
                    onChange={(e) => handleMetaChange("prefix", e.target.value)}
                    className="h-6 text-xs"
                    placeholder="e.g., $"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Postfix</Label>
                  <Input
                    type="text"
                    value={localField.meta?.postfix || ""}
                    onChange={(e) => handleMetaChange("postfix", e.target.value)}
                    className="h-6 text-xs"
                    placeholder="e.g., kg"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="text-[10px] text-muted-foreground">
                Preview: <span className="text-primary">{prefix}123{postfix}</span>
              </div>

              {/* Increment value for counting */}
              {localField.mode === "input" && (
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Default increment (for occurrence counting)
                  </Label>
                  <Input
                    type="number"
                    value={localField.meta?.increment ?? 1}
                    onChange={(e) => handleMetaChange("increment", Number(e.target.value) || 1)}
                    className="h-6 text-xs w-20"
                    min={0}
                    step={1}
                  />
                </div>
              )}
            </div>
          )}

          {/* Binding role */}
          <div>
            <Label className="text-xs text-muted-foreground">Display As</Label>
            <Select
              value={binding?.role || "input"}
              onValueChange={(v) => onUpdate?.({ ...binding, role: v })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BINDING_ROLES.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Calculation section for derived fields */}
          {localField.mode === "derived" && (
            <div className="pt-2 border-t border-border">
              <Label className="text-xs font-semibold">Calculation</Label>

              {/* Scope and Time filter row */}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Scope</Label>
                  <Select
                    value={localField.metric?.scope || "container"}
                    onValueChange={(v) => handleFieldChange("metric", {
                      ...localField.metric,
                      scope: v,
                    })}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCOPES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground">Time Period</Label>
                  <Select
                    value={localField.metric?.timeFilter || "all"}
                    onValueChange={(v) => handleFieldChange("metric", {
                      ...localField.metric,
                      timeFilter: v,
                    })}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_FILTER_OPTIONS.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Source fields with aggregation */}
              <div className="mt-2 space-y-2">
                <Label className="text-[10px] text-muted-foreground">
                  Source Fields (type: {localField.type})
                </Label>

                {/* MultiSelect for source fields */}
                <MultiSelectPills
                  options={availableSourceFields.map(f => ({
                    value: f.id,
                    label: f.name || f.type,
                    description: f.meta?.prefix ? `${f.meta.prefix}...${f.meta.postfix || ""}` : f.type,
                    color: "bg-blue-500/20 text-blue-300",
                  }))}
                  selected={sourceFields.map(sf => sf.fieldId).filter(Boolean)}
                  onChange={(selectedIds) => {
                    // Update sourceFields array based on selection
                    const newSourceFields = selectedIds.map(fieldId => {
                      // Keep existing aggregation if field was already selected
                      const existing = sourceFields.find(sf => sf.fieldId === fieldId);
                      return existing || { fieldId, aggregation: "sum" };
                    });
                    setSourceFields(newSourceFields);
                  }}
                  placeholder="Select input fields..."
                  emptyMessage={`No ${localField.type} input fields available`}
                  compact
                />

                {/* Aggregation config for each selected field */}
                {sourceFields.filter(sf => sf.fieldId).map((sf, index) => {
                  const sourceFieldObj = availableSourceFields.find(f => f.id === sf.fieldId);
                  return (
                    <div key={sf.fieldId} className="flex items-center gap-2 bg-muted/20 p-2 rounded">
                      <span className="text-[10px] text-blue-300 px-1.5 py-0.5 bg-blue-500/20 rounded-full">
                        {sourceFieldObj?.name || sourceFieldObj?.type || "Field"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">=</span>
                      <Select
                        value={sf.aggregation}
                        onValueChange={(v) => updateSourceField(index, "aggregation", v)}
                      >
                        <SelectTrigger className="h-6 text-[10px] w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getAggregationsForType(localField.type).map(a => (
                            <SelectItem key={a.value} value={a.value} title={a.description}>
                              {a.symbol} {a.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>

              {/* Target/Progress section */}
              {localField.type === "number" && (
                <div className="mt-3 pt-2 border-t border-border">
                  <Label className="text-[10px] text-muted-foreground">
                    Target (shows as current/target, e.g., 10/20)
                  </Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Select
                      value={localField.metric?.target?.op || ">="}
                      onValueChange={(v) => handleFieldChange("metric", {
                        ...localField.metric,
                        target: {
                          ...(localField.metric?.target || {}),
                          op: v,
                        },
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
                      value={localField.metric?.target?.value ?? ""}
                      onChange={(e) => handleFieldChange("metric", {
                        ...localField.metric,
                        target: e.target.value === "" ? undefined : {
                          ...(localField.metric?.target || {}),
                          op: localField.metric?.target?.op || ">=",
                          value: Number(e.target.value),
                        },
                      })}
                      className="h-6 text-[10px] w-20"
                      placeholder="Target"
                    />

                    {localField.metric?.target?.value !== undefined && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => handleFieldChange("metric", {
                          ...localField.metric,
                          target: undefined,
                        })}
                        title="Remove target"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {localField.metric?.target?.value !== undefined && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Preview: <span className="text-primary">0/{localField.metric.target.value}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Save button */}
          <div className="pt-2">
            <Button
              variant="default"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={handleSave}
            >
              {isCreatingNew ? "Create & Bind Field" : "Save Changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
