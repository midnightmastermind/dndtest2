// ui/FieldPillInput.jsx
// ============================================================
// Click-guarded pill input for field values
// Displays as a pill, click to edit, enter to save
// ============================================================

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

/**
 * FieldPillInput - Click-guarded pill input for field values
 *
 * Props:
 * - field: Field definition { id, name, type, meta: { prefix, postfix } }
 * - value: Current value
 * - onChange: (value) => void - called on each keystroke
 * - onCommit: (value) => void - called on enter/blur
 * - disabled: boolean
 * - compact: boolean
 */
export default function FieldPillInput({
  field,
  value,
  onChange,
  onCommit,
  disabled = false,
  compact = false,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef(null);

  // Sync local value with prop
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value);
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
      setLocalValue(value); // Reset to original
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

  // All input field pills are blue
  const getPillColor = () => {
    return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  };

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
      title={fieldName ? `${fieldName}: Click to edit` : "Click to edit"}
    >
      {fieldName && <span className="opacity-70">{fieldName}:</span>}
      <span>{formattedDisplay}</span>
    </button>
  );
}
