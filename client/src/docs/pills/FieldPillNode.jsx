// docs/pills/FieldPillNode.jsx
// ============================================================
// React component for rendering Field Pills in Tiptap editor
// Displays field name + live calculated value as a colored pill
// ============================================================

import { useContext, useMemo, useState, useCallback, useRef, useEffect } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { GridActionsContext } from "../../GridActionsContext";
import { useFieldValue } from "../hooks/useDocFieldValues";
import { Copy, Link, Trash2, Settings } from "lucide-react";
import RadialMenu from "../../ui/RadialMenu";
import * as CommitHelpers from "../../helpers/CommitHelpers";

// Block colors matching Phase 3 OperationsBuilder
const PILL_COLORS = {
  input: {
    bg: "bg-blue-500",
    border: "border-blue-600",
    text: "text-white",
  },
  derived: {
    bg: "bg-purple-500",
    border: "border-purple-600",
    text: "text-white",
  },
};

/**
 * FieldPillNode - Renders a field reference as an inline pill
 *
 * Props from Tiptap NodeViewWrapper:
 * - node: The ProseMirror node with attrs
 * - updateAttributes: Function to update node attributes
 * - selected: Whether the node is currently selected
 * - deleteNode: Function to delete this node
 */
export default function FieldPillNode({ node, selected, deleteNode }) {
  const { fieldsById, dispatch, socket } = useContext(GridActionsContext) || {};
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const showMenu = hovered || menuOpen;
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const pillRef = useRef(null);
  const inputRef = useRef(null);

  const {
    fieldId,
    fieldName,
    fieldType = "text",
    fieldMode = "input",
    showValue = true,
    showLabel = true,
  } = node.attrs;

  // Get the field definition
  const field = useMemo(() => {
    return fieldsById?.[fieldId] || null;
  }, [fieldsById, fieldId]);

  // Get live calculated value using the hook
  const { displayValue, error } = useFieldValue(fieldId);

  // Use the live value or fallback
  const currentValue = useMemo(() => {
    if (!showValue) return null;
    if (error) return "!";
    return displayValue;
  }, [showValue, displayValue, error]);

  // Determine colors based on mode
  const colors = PILL_COLORS[fieldMode] || PILL_COLORS.input;
  const displayName = field?.name || fieldName || "Unknown Field";

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(`#${displayName}${currentValue != null ? `: ${currentValue}` : ""}`);
  }, [displayName, currentValue]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard?.writeText(`[[field:${fieldId}]]`);
  }, [fieldId]);

  const handleDelete = useCallback(() => {
    deleteNode?.();
  }, [deleteNode]);

  // Double-click to edit field name
  const handleDoubleClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    setEditValue(displayName);
    setEditing(true);
  }, [displayName]);

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== displayName && field && dispatch && socket) {
      CommitHelpers.updateField({
        dispatch,
        socket,
        field: { ...field, name: trimmed },
        emit: true,
      });
    }
    setEditing(false);
  }, [editValue, displayName, field, dispatch, socket]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  // Focus input when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // RadialMenu items for this pill
  const radialItems = useMemo(() => [
    {
      icon: Copy,
      label: "Copy",
      onClick: handleCopy,
      color: "bg-blue-600 hover:bg-blue-500",
    },
    {
      icon: Link,
      label: "Copy Link",
      onClick: handleCopyLink,
      color: "bg-purple-600 hover:bg-purple-500",
    },
    {
      icon: Trash2,
      label: "Remove",
      onClick: handleDelete,
      color: "bg-red-600 hover:bg-red-500",
    },
  ], [handleCopy, handleCopyLink, handleDelete]);

  // Set up pragmatic DnD so the pill can be dragged out of the doc
  useEffect(() => {
    const el = pillRef.current;
    if (!el) return;

    return draggable({
      element: el,
      getInitialData: () => ({
        type: "field",
        fieldId,
        fieldName: displayName,
        fromDoc: true,
      }),
    });
  }, [fieldId, displayName]);

  return (
    <NodeViewWrapper as="span" contentEditable={false}>
      <span
        ref={pillRef}
        className={`
          field-pill inline-flex items-center gap-1 relative
          ${colors.bg} ${colors.border} ${colors.text}
          px-2 py-0.5 rounded-full text-xs font-medium
          border cursor-pointer select-none
          transition-all duration-150
          ${selected ? "ring-2 ring-white ring-offset-1 ring-offset-transparent" : ""}
          hover:brightness-110
        `}
        data-field-id={fieldId}
        data-field-mode={fieldMode}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={handleDoubleClick}
      >
        {/* # prefix */}
        <span className="opacity-50">#</span>

        {/* Field name — editable on double-click */}
        {showLabel && !editing && (
          <span className="font-medium">{displayName}</span>
        )}
        {showLabel && editing && (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
              if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-transparent border-none outline-none text-inherit font-medium text-xs w-auto min-w-[30px]"
            style={{ width: `${Math.max(editValue.length, 3)}ch` }}
          />
        )}

        {/* Separator */}
        {showLabel && showValue && currentValue !== null && !editing && (
          <span className="opacity-60">:</span>
        )}

        {/* Value */}
        {showValue && currentValue !== null && !editing && (
          <span className="font-normal">{currentValue}</span>
        )}

        {/* Cog button with radial menu — appears on hover */}
        <span className={`inline-flex items-center ml-0.5 -mr-1 transition-opacity duration-150 ${showMenu ? "opacity-100" : "opacity-0 pointer-events-none"}`} contentEditable={false}>
          <RadialMenu
            items={radialItems}
            handleIcon={Settings}
            handleTitle={`${displayName} — Click for actions`}
            size="sm"
            handleClassName={`${colors.bg} border-none rounded-full !w-4 !h-4 !px-0 !rounded-r-full !rounded-l-full`}
            forceDirection="down"
            onOpenChange={setMenuOpen}
          />
        </span>
      </span>
    </NodeViewWrapper>
  );
}
