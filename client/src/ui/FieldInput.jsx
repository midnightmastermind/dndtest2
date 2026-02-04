// ui/FieldInput.jsx
// ============================================================
// Component for rendering input fields based on field type
// Used for mode: "input" fields
// ============================================================

import React, { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * FieldInput - Renders an input for a field based on its type
 *
 * Props:
 * - field: Field definition { id, name, type, mode, unit, meta }
 * - binding: FieldBinding { fieldId, role, record, display, order }
 * - value: Current value of the field
 * - onChange: (value) => void - called when value changes
 * - onCommit: (value) => void - called when value should be persisted (blur/enter)
 * - disabled: boolean
 * - compact: boolean - use compact display mode
 */
function FieldInput({
  field,
  binding,
  value,
  onChange,
  onCommit,
  disabled = false,
  compact = false,
}) {
  const [localValue, setLocalValue] = useState(value);

  // Sync local value with prop value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((newValue) => {
    setLocalValue(newValue);
    onChange?.(newValue);
  }, [onChange]);

  const handleCommit = useCallback(() => {
    onCommit?.(localValue);
  }, [localValue, onCommit]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommit();
    }
  }, [handleCommit]);

  if (!field) return null;

  const { type, name, unit, meta } = field;
  const showLabel = !compact && binding?.display?.showLabel !== false;
  const showUnit = unit && binding?.display?.showUnit !== false;

  // ============================================================
  // NUMBER INPUT
  // ============================================================
  if (type === "number") {
    return (
      <div className="field-input field-input-number">
        {showLabel && (
          <Label className="text-xs text-muted-foreground mb-1">{name}</Label>
        )}
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={localValue ?? ""}
            disabled={disabled}
            placeholder={compact ? name : ""}
            className={compact ? "h-6 text-xs w-16" : "h-7 text-sm"}
            onChange={(e) => handleChange(e.target.value === "" ? null : Number(e.target.value))}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
            min={meta?.min}
            max={meta?.max}
            step={meta?.step}
          />
          {showUnit && (
            <span className="text-xs text-muted-foreground">{unit}</span>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // TEXT INPUT
  // ============================================================
  if (type === "text") {
    return (
      <div className="field-input field-input-text">
        {showLabel && (
          <Label className="text-xs text-muted-foreground mb-1">{name}</Label>
        )}
        <Input
          type="text"
          value={localValue ?? ""}
          disabled={disabled}
          placeholder={compact ? name : ""}
          className={compact ? "h-6 text-xs" : "h-7 text-sm"}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
        />
      </div>
    );
  }

  // ============================================================
  // BOOLEAN INPUT (Switch or Checkbox)
  // ============================================================
  if (type === "boolean") {
    const useSwitch = binding?.display?.variant !== "checkbox";

    return (
      <div className="field-input field-input-boolean flex items-center gap-2">
        {useSwitch ? (
          <>
            <Switch
              checked={!!localValue}
              disabled={disabled}
              onCheckedChange={(checked) => {
                handleChange(checked);
                onCommit?.(checked);
              }}
            />
            {showLabel && (
              <Label className="text-xs">{name}</Label>
            )}
          </>
        ) : (
          <>
            <Checkbox
              checked={!!localValue}
              disabled={disabled}
              onCheckedChange={(checked) => {
                handleChange(checked);
                onCommit?.(checked);
              }}
            />
            {showLabel && (
              <Label className="text-xs">{name}</Label>
            )}
          </>
        )}
      </div>
    );
  }

  // ============================================================
  // SELECT INPUT
  // ============================================================
  if (type === "select") {
    const options = meta?.options || [];

    return (
      <div className="field-input field-input-select">
        {showLabel && (
          <Label className="text-xs text-muted-foreground mb-1">{name}</Label>
        )}
        <Select
          value={localValue ?? ""}
          disabled={disabled}
          onValueChange={(val) => {
            handleChange(val);
            onCommit?.(val);
          }}
        >
          <SelectTrigger className={compact ? "h-6 text-xs" : "h-7 text-sm"}>
            <SelectValue placeholder={compact ? name : "Select..."} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // ============================================================
  // DATE INPUT
  // ============================================================
  if (type === "date") {
    return (
      <div className="field-input field-input-date">
        {showLabel && (
          <Label className="text-xs text-muted-foreground mb-1">{name}</Label>
        )}
        <Input
          type="date"
          value={localValue ?? ""}
          disabled={disabled}
          className={compact ? "h-6 text-xs" : "h-7 text-sm"}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleCommit}
        />
      </div>
    );
  }

  // ============================================================
  // UNKNOWN TYPE
  // ============================================================
  return (
    <div className="text-xs text-muted-foreground">
      Unknown field type: {type}
    </div>
  );
}

export default React.memo(FieldInput);
