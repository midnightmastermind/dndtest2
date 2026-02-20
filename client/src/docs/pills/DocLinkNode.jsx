// docs/pills/DocLinkNode.jsx
// ============================================================
// React component for rendering Document Links in Tiptap editor
// Displays [[bracketed]] links to other documents
// ============================================================

import { useContext, useMemo, useCallback } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import { FileText, Calendar } from "lucide-react";
import { GridActionsContext } from "../../GridActionsContext";

/**
 * DocLinkNode - Renders a document link as [[bracketed text]]
 *
 * Props from Tiptap NodeViewWrapper:
 * - node: The ProseMirror node with attrs
 * - selected: Whether the node is currently selected
 */
export default function DocLinkNode({ node, selected }) {
  const { containersById, setSelectedDocId } = useContext(GridActionsContext) || {};

  const { targetId, label, linkType = "doc" } = node.attrs;

  // Get the target container/document
  const target = useMemo(() => {
    return containersById?.[targetId] || null;
  }, [containersById, targetId]);

  // Determine display label
  const displayLabel = label || target?.label || targetId || "Unknown";

  // Determine if link is valid
  const isValid = !!target || linkType === "dayPage";

  // Icon based on link type
  const Icon = linkType === "dayPage" ? Calendar : FileText;

  // Handle click to navigate
  const handleClick = useCallback(() => {
    if (targetId && setSelectedDocId) {
      setSelectedDocId(targetId);
    }
  }, [targetId, setSelectedDocId]);

  return (
    <NodeViewWrapper
      as="span"
      className={`
        doc-link inline-flex items-center gap-0.5
        text-blue-400 hover:text-blue-300
        cursor-pointer select-none
        transition-colors duration-150
        ${selected ? "bg-blue-500/20 rounded" : ""}
        ${!isValid ? "text-red-400 line-through" : ""}
      `}
      contentEditable={false}
      data-target-id={targetId}
      data-link-type={linkType}
      onClick={handleClick}
    >
      {/* Opening bracket */}
      <span className="opacity-50">[[</span>

      {/* Icon */}
      <Icon className="w-3 h-3 opacity-70" />

      {/* Label */}
      <span className="hover:underline">{displayLabel}</span>

      {/* Closing bracket */}
      <span className="opacity-50">]]</span>
    </NodeViewWrapper>
  );
}
