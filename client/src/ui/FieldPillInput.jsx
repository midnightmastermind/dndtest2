// ui/FieldPillInput.jsx
// ============================================================
// Click-guarded pill input for field values
// Displays as a pill, click to edit, enter to save
// ============================================================

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ArrowUp, ArrowDown, Equal } from "lucide-react";

/**
 * FieldPillInput - Click-guarded pill input for field values
 *
 * Props:
 * - field: Field definition { id, name, type, meta: { prefix, postfix } }
 * - value: Current value
 * - flow: Current flow direction ("in" | "out" | "replace")
 * - onChange: (value) => void - called on each keystroke
 * - onCommit: (value) => void - called on enter/blur
 * - onFlowChange: (flow) => void - called when flow cycles
 * - disabled: boolean
 * - compact: boolean
 */
export default function FieldPillInput({
  field,
  value,
  flow = "in",
  onChange,
  onCommit,
  onFlowChange,
  disabled = false,
  compact = false,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef(null);

  // Extract raw value if it's stored as { value, flow } object
  // This is a safety check in case the value wasn't extracted upstream
  const extractValue = (v) => {
    if (v && typeof v === "object" && "value" in v) {
      return v.value;
    }
    return v;
  };

  const [localValue, setLocalValue] = useState(() => extractValue(value));

  // Sync local value with prop
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(extractValue(value));
    }
  }, [value, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = useCallback(() => {
    if (!disabled) {
      setIsEditing(true);
    }
  }, [disabled]);

  const handleChange = useCallback((e) => {
    const newValue = field?.type === "number"
      ? (e.target.value === "" ? null : Number(e.target.value))
      : e.target.value;
    setLocalValue(newValue);
    onChange?.(newValue);
  }, [field?.type, onChange]);

  const handleCommit = useCallback(() => {
    setIsEditing(false);
    onCommit?.(localValue);
  }, [localValue, onCommit]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommit();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setLocalValue(extractValue(value)); // Reset to original
    }
  }, [handleCommit, value]);

  const handleBlur = useCallback(() => {
    handleCommit();
  }, [handleCommit]);

  // Get formatting from field meta
  const prefix = field?.meta?.prefix || "";
  const postfix = field?.meta?.postfix || "";
  const rawFieldName = field?.name ?? "";
  const fieldName = rawFieldName || null; // null means don't show label
  const fieldType = field?.type || "text";

  // Format display value
  const displayValue = localValue ?? (fieldType === "number" ? 0 : "");
  const formattedDisplay = `${prefix}${displayValue}${postfix}`;

  // Pill color reflects flow direction
  const getPillColor = () => {
    if (flow === "out") return "bg-red-500/20 text-red-300 border-red-500/30";
    if (flow === "replace") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    return "bg-green-500/20 text-green-300 border-green-500/30"; // "in" default
  };

  const flowIcons = { in: ArrowUp, out: ArrowDown, replace: Equal };
  const flowLabels = { in: "In (+)", out: "Out (−)", replace: "Replace" };
  const FlowIcon = flowIcons[flow] || ArrowUp;

  const handleFlowCycle = useCallback((e) => {
    e.stopPropagation();
    const cycle = ["in", "out", "replace"];
    const nextIndex = (cycle.indexOf(flow) + 1) % cycle.length;
    onFlowChange?.(cycle[nextIndex]);
  }, [flow, onFlowChange]);

  // Input type based on field type
  const getInputType = () => {
    switch (fieldType) {
      case "number":
        return "number";
      case "date":
        return "date";
      default:
        return "text";
    }
  };

  if (isEditing) {
    return (
      <div className="field-pill-input editing inline-flex items-center gap-0.5">
        <button
          type="button"
          onClick={handleFlowCycle}
          title={`Flow: ${flowLabels[flow]} — click to cycle`}
          className={`
            inline-flex items-center justify-center rounded border w-5 h-5 flex-shrink-0 transition-colors
            ${flow === "out" ? "text-red-400 bg-red-500/20 border-red-500/30" :
              flow === "replace" ? "text-blue-400 bg-blue-500/20 border-blue-500/30" :
              "text-green-400 bg-green-500/20 border-green-500/30"}
          `}
        >
          <FlowIcon className="w-3 h-3" />
        </button>
        {prefix && (
          <span className="text-[10px] text-muted-foreground">{prefix}</span>
        )}
        <Input
          ref={inputRef}
          type={getInputType()}
          value={localValue ?? ""}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={disabled}
          className={`${compact ? "h-5 text-[10px] w-14" : "h-6 text-xs w-16"} px-1 text-center`}
          style={{ minWidth: 40 }}
        />
        {postfix && (
          <span className="text-[10px] text-muted-foreground">{postfix}</span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`
        field-pill-input
        inline-flex items-center gap-1
        ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"}
        rounded-full border
        transition-all
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:brightness-110"}
        ${getPillColor()}
      `}
      title={fieldName ? `${fieldName}: ${flowLabels[flow]} — Click to edit` : `${flowLabels[flow]} — Click to edit`}
    >
      <span
        onClick={handleFlowCycle}
        className="inline-flex items-center opacity-70 hover:opacity-100"
      >
        <FlowIcon className="w-2.5 h-2.5" />
      </span>
      {fieldName && <span className="opacity-70">{fieldName}:</span>}
      <span>{formattedDisplay}</span>
    </button>
  );
}
