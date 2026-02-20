// ui/FieldInput.jsx
// ============================================================
// Component for rendering input fields based on field type
// Used for mode: "input" fields
// ============================================================

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { X, Plus, Check, ChevronDown, ArrowUp, ArrowDown, Equal, Shuffle } from "lucide-react";

/**
 * MultiSelectWithAdd - Multi-select dropdown with quick-add functionality
 */
function MultiSelectWithAdd({
  name,
  options,
  selected,
  onChange,
  onAddOption,
  disabled,
  compact,
  showLabel,
  randomize = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [newValue, setNewValue] = useState("");

  const selectedOptions = useMemo(() => {
    return options.filter(opt => selected.includes(opt.value));
  }, [options, selected]);

  const toggleOption = useCallback((value) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }, [selected, onChange]);

  const removeOption = useCallback((value, e) => {
    e?.stopPropagation();
    onChange(selected.filter(v => v !== value));
  }, [selected, onChange]);

  const handleAddNew = useCallback(() => {
    if (!newValue.trim()) return;
    const value = newValue.toLowerCase().replace(/\s+/g, "_");
    const newOption = { value, label: newValue.trim() };
    onAddOption?.(newOption);
    onChange([...selected, value]);
    setNewValue("");
  }, [newValue, selected, onChange, onAddOption]);

  return (
    <div className="field-input field-input-select-multi">
      {showLabel && (
        <Label className="text-xs text-muted-foreground mb-1">{name}</Label>
      )}
      <div className="flex items-center gap-1">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            disabled={disabled}
            className={`w-full justify-between font-normal ${compact ? "h-6 text-xs" : "h-7 text-sm"}`}
          >
            {selectedOptions.length === 0 ? (
              <span className="text-muted-foreground">{compact ? name : "Select..."}</span>
            ) : (
              <div className="flex flex-wrap gap-1 items-center overflow-hidden">
                {selectedOptions.slice(0, 2).map(opt => (
                  <span
                    key={opt.value}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0 text-[10px] rounded-full bg-primary/20 text-primary"
                  >
                    {opt.label}
                    <X
                      className="h-2.5 w-2.5 cursor-pointer"
                      onClick={(e) => removeOption(opt.value, e)}
                    />
                  </span>
                ))}
                {selectedOptions.length > 2 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{selectedOptions.length - 2}
                  </span>
                )}
              </div>
            )}
            <ChevronDown className="h-3 w-3 opacity-50 flex-shrink-0" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-56 p-0" align="start">
          {/* Quick add input */}
          {onAddOption && (
            <div className="flex items-center gap-1 p-2 border-b border-border">
              <Input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddNew()}
                className="h-6 text-xs flex-1"
                placeholder="Add new..."
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleAddNew}
                disabled={!newValue.trim()}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto p-1">
            {options.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No options available
              </div>
            ) : (
              options.map(opt => {
                const isSelected = selected.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleOption(opt.value)}
                    className={`
                      w-full flex items-center gap-2 px-2 py-1.5 rounded-sm
                      text-left text-xs transition-colors
                      ${isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"}
                    `}
                  >
                    <div className={`
                      w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                      ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"}
                    `}>
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
      {randomize && options.length > 0 && (
        <Button
          variant="ghost"
          size="icon"
          className={compact ? "h-6 w-6" : "h-7 w-7"}
          title="Pick random"
          disabled={disabled}
          onClick={() => {
            const pick = options[Math.floor(Math.random() * options.length)];
            if (pick) onChange([pick.value]);
          }}
        >
          <Shuffle className="h-3.5 w-3.5" />
        </Button>
      )}
      </div>
    </div>
  );
}

/**
 * FlowToggle - Small popover with 3 flow direction options (In/Out/Replace)
 * Shows current flow as a colored icon button. Click to open selector.
 */
function FlowToggle({ flow = "in", onChange, compact = false, disabled = false }) {
  const [open, setOpen] = useState(false);

  const configs = {
    in:      { icon: ArrowUp,   color: "text-green-400 bg-green-500/20 border-green-500/30", label: "In (+)",   desc: "Positive value" },
    out:     { icon: ArrowDown, color: "text-red-400 bg-red-500/20 border-red-500/30",       label: "Out (−)",  desc: "Negative value" },
    replace: { icon: Equal,     color: "text-blue-400 bg-blue-500/20 border-blue-500/30",    label: "Replace",  desc: "Overwrites" },
  };
  const options = ["in", "out", "replace"];
  const config = configs[flow] || configs.in;
  const Icon = config.icon;

  const handleSelect = useCallback((newFlow) => {
    onChange?.(newFlow);
    setOpen(false);
  }, [onChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={`Flow: ${config.label}`}
          className={`
            inline-flex items-center justify-center rounded border
            transition-colors flex-shrink-0
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:brightness-125"}
            ${config.color}
            ${compact ? "w-5 h-5" : "w-6 h-6"}
          `}
        >
          <Icon className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1" align="start" side="bottom">
        {options.map((key) => {
          const opt = configs[key];
          const OptIcon = opt.icon;
          const isActive = flow === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleSelect(key)}
              className={`
                w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs transition-colors
                ${isActive ? "bg-accent text-accent-foreground" : "hover:bg-muted"}
              `}
            >
              <OptIcon className={`w-3 h-3 ${isActive ? "" : "opacity-60"}`} />
              <span>{opt.label}</span>
              <span className="text-[9px] text-muted-foreground ml-auto">{opt.desc}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/**
 * FieldInput - Renders an input for a field based on its type
 *
 * Props:
 * - field: Field definition { id, name, type, mode, unit, meta }
 * - binding: FieldBinding { fieldId, role, record, display, order }
 * - value: Current value of the field
 * - flow: Current flow direction ("in" | "out" | "replace")
 * - onChange: (value) => void - called when value changes
 * - onCommit: (value) => void - called when value should be persisted (blur/enter)
 * - onFlowChange: (flow) => void - called when flow direction changes
 * - disabled: boolean
 * - compact: boolean - use compact display mode
 * - usedCompletedValues: string[] - values used in completed instances (for removeOnComplete)
 * - onAddOption: (option) => void - callback to add new option to field
 */
function FieldInput({
  field,
  binding,
  value,
  flow,
  onChange,
  onCommit,
  onFlowChange,
  disabled = false,
  compact = false,
  usedCompletedValues = [],
  onAddOption,
}) {
  // Extract raw value if it's stored as { value, flow } object (safety check)
  const extractValue = (v) => {
    if (v && typeof v === "object" && "value" in v) return v.value;
    return v;
  };

  const [localValue, setLocalValue] = useState(() => extractValue(value));

  // Sync local value with prop value
  useEffect(() => {
    setLocalValue(extractValue(value));
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
          <FlowToggle flow={flow || "in"} onChange={onFlowChange} compact={compact} disabled={disabled} />
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
    // Check both field.meta.variant and binding.display.variant for checkbox setting
    const useSwitch = meta?.variant !== "checkbox" && binding?.display?.variant !== "checkbox";

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
  // SELECT INPUT (supports multi-select and quick-add)
  // ============================================================
  if (type === "select") {
    const allOptions = meta?.options || [];
    const isMulti = meta?.multiSelect === true;
    const removeOnComplete = meta?.removeOnComplete === true;

    // Filter out completed values if removeOnComplete is enabled
    const options = removeOnComplete
      ? allOptions.filter(opt => !usedCompletedValues.includes(opt.value))
      : allOptions;

    // For multi-select, value is an array
    const selectedValues = isMulti
      ? (Array.isArray(localValue) ? localValue : localValue ? [localValue] : [])
      : [];

    // Single select
    if (!isMulti) {
      return (
        <div className="field-input field-input-select">
          {showLabel && (
            <Label className="text-xs text-muted-foreground mb-1">{name}</Label>
          )}
          <div className="flex items-center gap-1">
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
            {meta?.randomize && options.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className={compact ? "h-6 w-6 flex-shrink-0" : "h-7 w-7 flex-shrink-0"}
                title="Pick random"
                disabled={disabled}
                onClick={() => {
                  const pick = options[Math.floor(Math.random() * options.length)];
                  if (pick) {
                    handleChange(pick.value);
                    onCommit?.(pick.value);
                  }
                }}
              >
                <Shuffle className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      );
    }

    // Multi-select with quick add
    return (
      <MultiSelectWithAdd
        name={name}
        options={options}
        selected={selectedValues}
        onChange={(vals) => {
          handleChange(vals);
          onCommit?.(vals);
        }}
        onAddOption={onAddOption}
        disabled={disabled}
        compact={compact}
        showLabel={showLabel}
        randomize={!!meta?.randomize}
      />
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
  // RATING INPUT (1-5 stars)
  // ============================================================
  if (type === "rating") {
    const maxRating = meta?.max || 5;
    const currentRating = localValue ?? 0;

    return (
      <div className="field-input field-input-rating">
        {showLabel && (
          <Label className="text-xs text-muted-foreground mb-1">{name}</Label>
        )}
        <div className="flex items-center gap-0.5">
          {Array.from({ length: maxRating }, (_, i) => i + 1).map((star) => (
            <button
              key={star}
              type="button"
              disabled={disabled}
              className={`p-0.5 transition-colors ${
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:scale-110"
              }`}
              onClick={() => {
                const newValue = star === currentRating ? 0 : star;
                handleChange(newValue);
                onCommit?.(newValue);
              }}
            >
              <svg
                className={`${compact ? "w-4 h-4" : "w-5 h-5"} ${
                  star <= currentRating
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-gray-400 fill-transparent"
                }`}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ============================================================
  // DURATION INPUT (hours + minutes)
  // ============================================================
  if (type === "duration") {
    // Value stored as total minutes
    const totalMinutes = localValue ?? 0;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const updateDuration = (newHours, newMinutes) => {
      const total = (newHours * 60) + newMinutes;
      handleChange(total);
    };

    return (
      <div className="field-input field-input-duration">
        {showLabel && (
          <Label className="text-xs text-muted-foreground mb-1">{name}</Label>
        )}
        <div className="flex items-center gap-1">
          <FlowToggle flow={flow || "in"} onChange={onFlowChange} compact={compact} disabled={disabled} />
          <Input
            type="number"
            value={hours}
            disabled={disabled}
            min={0}
            max={23}
            className={compact ? "h-6 text-xs w-12" : "h-7 text-sm w-14"}
            onChange={(e) => updateDuration(parseInt(e.target.value) || 0, minutes)}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
          />
          <span className="text-xs text-muted-foreground">h</span>
          <Input
            type="number"
            value={minutes}
            disabled={disabled}
            min={0}
            max={59}
            step={5}
            className={compact ? "h-6 text-xs w-12" : "h-7 text-sm w-14"}
            onChange={(e) => updateDuration(hours, parseInt(e.target.value) || 0)}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
          />
          <span className="text-xs text-muted-foreground">m</span>
        </div>
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
