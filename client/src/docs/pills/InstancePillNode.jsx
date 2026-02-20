// docs/pills/InstancePillNode.jsx
// ============================================================
// Instance Pills in Tiptap editor — inline or block display
// Block pills have editable markdown body (double-click to edit)
// ============================================================

import React, { useContext, useMemo, useState, useCallback, useRef, useEffect } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { GridActionsContext } from "../../GridActionsContext";
import { Copy, Link, Trash2, Settings, Move, Check } from "lucide-react";
import RadialMenu from "../../ui/RadialMenu";
import * as CommitHelpers from "../../helpers/CommitHelpers";

function extractRaw(stored) {
  if (stored && typeof stored === "object" && "value" in stored) return stored.value;
  return stored;
}

function formatFieldValue(field, rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === "") return null;
  const prefix = field?.meta?.prefix || "";
  const postfix = field?.meta?.postfix || "";
  if (field.type === "boolean") return rawValue ? "✓" : null;
  if (field.type === "duration") {
    if (typeof rawValue === "object") {
      const h = rawValue.hours || 0, m = rawValue.minutes || 0;
      if (!h && !m) return null;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    return rawValue ? `${rawValue}` : null;
  }
  if (field.type === "rating") return rawValue ? `${"★".repeat(rawValue)}` : null;
  if (field.type === "select") return Array.isArray(rawValue) ? rawValue.join(", ") : String(rawValue);
  if (field.type === "number") return `${prefix}${rawValue}${postfix}`;
  if (field.type === "text") { const s = String(rawValue); return s.length > 20 ? s.slice(0, 18) + "…" : s; }
  return String(rawValue);
}

export default function InstancePillNode({ node, updateAttributes, selected, deleteNode }) {
  const { instancesById, occurrencesById, fieldsById, dispatch, socket } = useContext(GridActionsContext) || {};
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pillRef = useRef(null);
  const blockWrapRef = useRef(null);

  // Inline edit state
  const [inlineEditing, setInlineEditing] = useState(false);
  const [inlineEditValue, setInlineEditValue] = useState("");
  const inlineInputRef = useRef(null);

  // Block full-edit state — one flag controls the whole edit UI
  const [fullEdit, setFullEdit] = useState(false);
  const [headerDraft, setHeaderDraft] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");
  const headerInputRef = useRef(null);
  const bodyTextareaRef = useRef(null);
  // Track which element to focus on entering edit mode
  const editFocusTarget = useRef("header"); // "header" | "body"

  const {
    instanceId, instanceLabel, occurrenceId, containerId,
    showIcon = true, bodyContent = null, pillDisplay = "inline",
    headerLevel = 1,
  } = node.attrs;

  const showMenu = hovered || menuOpen;

  const instance = useMemo(() => instancesById?.[instanceId] || null, [instancesById, instanceId]);
  const isTextOnly = !instance?.fieldBindings?.length && !instance?.artifactId;
  const displayLabel = instance?.label || instanceLabel || "Unknown Item";
  const isBlockMode = pillDisplay === "block" && bodyContent != null;

  // Field values from occurrences
  const fieldValues = useMemo(() => {
    if (!instance?.fieldBindings?.length || !occurrencesById || !fieldsById) return [];
    const instanceOccs = Object.values(occurrencesById).filter(
      occ => occ.targetType === "instance" && occ.targetId === instanceId && occ.fields
    );
    if (instanceOccs.length === 0) return [];
    const merged = {};
    for (const occ of instanceOccs) {
      if (!occ.fields) continue;
      for (const [fid, val] of Object.entries(occ.fields)) {
        const raw = extractRaw(val);
        if (raw !== undefined && raw !== null && raw !== "") merged[fid] = val;
      }
    }
    return (instance.fieldBindings || [])
      .map(b => {
        const field = fieldsById[b.fieldId];
        if (!field || field.mode === "derived") return null;
        const stored = merged[b.fieldId];
        if (!stored) return null;
        const raw = extractRaw(stored);
        const formatted = formatFieldValue(field, raw);
        if (!formatted) return null;
        return { field, formatted, isBoolean: field.type === "boolean" };
      })
      .filter(Boolean);
  }, [instance?.fieldBindings, instanceId, occurrencesById, fieldsById]);

  // ---- BLOCK: enter/exit full edit ----

  const enterFullEdit = useCallback((target) => {
    return (e) => {
      e.stopPropagation();
      e.preventDefault();
      editFocusTarget.current = target;
      // Include the # prefix in the header draft so it's editable like Obsidian
      const hashes = "#".repeat(headerLevel || 1);
      setHeaderDraft(`${hashes} ${displayLabel}`);
      setBodyDraft(bodyContent || "");
      setFullEdit(true);
    };
  }, [displayLabel, bodyContent, headerLevel]);

  const commitFullEdit = useCallback(() => {
    const rawHeader = headerDraft.trim();
    // Parse heading level from # prefix
    const hashMatch = rawHeader.match(/^(#{1,6})\s*/);
    const newLevel = hashMatch ? hashMatch[1].length : 1;
    const labelOnly = rawHeader.replace(/^#{1,6}\s*/, "").trim();

    if (labelOnly && labelOnly !== displayLabel && instance && dispatch && socket) {
      CommitHelpers.updateInstance({
        dispatch, socket,
        instance: { id: instance.id, label: labelOnly },
        emit: true,
      });
    }
    // Save heading level + body content
    const attrsToUpdate = {};
    if (newLevel !== headerLevel) attrsToUpdate.headerLevel = newLevel;
    if (bodyDraft !== bodyContent) attrsToUpdate.bodyContent = bodyDraft;
    if (Object.keys(attrsToUpdate).length > 0) updateAttributes(attrsToUpdate);

    setFullEdit(false);
  }, [headerDraft, displayLabel, instance, dispatch, socket, bodyDraft, bodyContent, headerLevel, updateAttributes]);

  const cancelFullEdit = useCallback(() => setFullEdit(false), []);

  // Only close when focus leaves the ENTIRE pill
  const handleBlockBlur = useCallback(() => {
    const wrapper = blockWrapRef.current;
    if (!wrapper) return;
    requestAnimationFrame(() => {
      if (!wrapper.contains(document.activeElement)) {
        commitFullEdit();
      }
    });
  }, [commitFullEdit]);

  // Focus the right element when entering full edit
  useEffect(() => {
    if (!fullEdit) return;
    const el = editFocusTarget.current === "body" ? bodyTextareaRef.current : headerInputRef.current;
    if (el) {
      el.focus();
      // Place cursor at end so user can immediately type
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [fullEdit]);

  // ---- INLINE: enter/exit edit ----

  const enterInlineEdit = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    setInlineEditValue(displayLabel);
    setInlineEditing(true);
  }, [displayLabel]);

  const commitInlineEdit = useCallback(() => {
    const trimmed = inlineEditValue.trim();
    if (trimmed && trimmed !== displayLabel && instance && dispatch && socket) {
      CommitHelpers.updateInstance({
        dispatch, socket,
        instance: { id: instance.id, label: trimmed },
        emit: true,
      });
    }
    setInlineEditing(false);
  }, [inlineEditValue, displayLabel, instance, dispatch, socket]);

  useEffect(() => {
    if (inlineEditing && inlineInputRef.current) {
      inlineInputRef.current.focus();
      const len = inlineInputRef.current.value.length;
      inlineInputRef.current.setSelectionRange(len, len);
    }
  }, [inlineEditing]);

  // ---- Shared ----

  const handleCopy = useCallback(() => navigator.clipboard?.writeText(`#${displayLabel}`), [displayLabel]);
  const handleCopyLink = useCallback(() => navigator.clipboard?.writeText(`[[instance:${instanceId}]]`), [instanceId]);
  const handleMove = useCallback(() => navigator.clipboard?.writeText(instanceId), [instanceId]);
  const handleDelete = useCallback(() => deleteNode?.(), [deleteNode]);

  const radialItems = useMemo(() => [
    { icon: Copy, label: "Copy", onClick: handleCopy, color: "bg-blue-600 hover:bg-blue-500" },
    { icon: Link, label: "Copy Link", onClick: handleCopyLink, color: "bg-emerald-700 hover:bg-emerald-600" },
    { icon: Move, label: "Move", onClick: handleMove, color: "bg-slate-600 hover:bg-slate-500" },
    { icon: Trash2, label: "Remove", onClick: handleDelete, color: "bg-red-600 hover:bg-red-500" },
  ], [handleCopy, handleCopyLink, handleMove, handleDelete]);

  // Pragmatic DnD — DISABLED when in edit mode so mouse events work normally
  useEffect(() => {
    const el = pillRef.current;
    if (!el || fullEdit || inlineEditing) return;
    return draggable({
      element: el,
      getInitialData: () => ({ type: "instance", instanceId, instanceLabel: displayLabel, occurrenceId, fromDoc: true }),
    });
  }, [instanceId, displayLabel, occurrenceId, fullEdit, inlineEditing]);

  // Render markdown-like body lines (view mode only)
  const renderBodyLines = useCallback((text) => {
    if (!text) return null;
    return text.split("\n").map((line, i) => {
      if (line.startsWith("### ")) return <div key={i} className="text-sm font-semibold mt-2 mb-0.5 opacity-80">{line.slice(4)}</div>;
      if (line.startsWith("## ")) return <div key={i} className="text-base font-semibold mt-2 mb-0.5 opacity-85">{line.slice(3)}</div>;
      if (line.startsWith("# ")) return <div key={i} className="text-lg font-bold mt-2 mb-0.5">{line.slice(2)}</div>;
      if (line.startsWith("- ")) return <div key={i} className="pl-4 before:content-['•'] before:absolute before:left-1 relative text-xs leading-relaxed opacity-75">{line.slice(2)}</div>;
      if (!line.trim()) return <div key={i} className="h-2" />;
      return <div key={i} className="text-xs leading-relaxed opacity-75">{line}</div>;
    });
  }, []);

  // Field value badges
  const fieldBadges = useMemo(() => {
    if (fieldValues.length === 0) return null;
    return (
      <span className="inline-flex items-center gap-0.5 ml-1">
        {fieldValues.map(({ field, formatted, isBoolean }, i) => (
          isBoolean ? (
            <span key={i} className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-500/30 text-green-300" title={field.name}>
              <Check className="w-2.5 h-2.5" />
            </span>
          ) : (
            <span key={i} className="inline-flex items-center px-1 py-0 rounded text-[10px] bg-white/10 text-gray-200 whitespace-nowrap" title={field.name}>
              {formatted}
            </span>
          )
        ))}
      </span>
    );
  }, [fieldValues]);

  // ==================================================================
  // BLOCK MODE
  // ==================================================================
  if (isBlockMode) {
    return (
      <NodeViewWrapper as="span" contentEditable={false} style={{ display: "block" }}>
        <div
          ref={(el) => { pillRef.current = el; blockWrapRef.current = el; }}
          className={`
            instance-pill block-pill my-2 rounded-lg
            border-l-4 border-emerald-500/60 bg-emerald-900/15
            ${selected ? "ring-2 ring-white ring-offset-1 ring-offset-transparent" : ""}
            ${fullEdit ? "" : "hover:bg-emerald-900/25 select-none"} transition-colors duration-150
          `}
          data-instance-id={instanceId}
          data-occurrence-id={occurrenceId}
          data-container-id={containerId}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* ---- VIEW MODE ---- */}
          {!fullEdit && (
            <>
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 border-b border-emerald-500/20 cursor-pointer"
                onDoubleClick={enterFullEdit("header")}
              >
                <span className={`font-semibold text-emerald-300 ${headerLevel >= 3 ? "text-sm" : headerLevel === 2 ? "text-base" : "text-lg"}`}>{displayLabel}</span>
                <span className={`inline-flex items-center ml-auto transition-opacity duration-150 ${showMenu ? "opacity-100" : "opacity-0 pointer-events-none"}`} contentEditable={false}>
                  <RadialMenu
                    items={radialItems}
                    handleIcon={Settings}
                    handleTitle={`${displayLabel} — Click for actions`}
                    size="sm"
                    handleClassName="bg-emerald-600 border-none rounded-full !w-4 !h-4 !px-0 !rounded-r-full !rounded-l-full"
                    forceDirection="down"
                    onOpenChange={setMenuOpen}
                  />
                </span>
              </div>
              <div className="px-3 py-2 text-gray-300 cursor-text" onDoubleClick={enterFullEdit("body")}>
                {renderBodyLines(bodyContent)}
              </div>
            </>
          )}

          {/* ---- EDIT MODE ---- */}
          {fullEdit && (
            <>
              <div className="px-3 py-1.5 border-b border-emerald-500/20">
                <input
                  ref={headerInputRef}
                  type="text"
                  value={headerDraft}
                  onChange={(e) => setHeaderDraft(e.target.value)}
                  onBlur={handleBlockBlur}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); commitFullEdit(); }
                    if (e.key === "Escape") { e.preventDefault(); cancelFullEdit(); }
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-black/30 border border-emerald-500/40 rounded px-1.5 py-0.5 outline-none text-emerald-200 font-semibold text-sm min-w-[60px]"
                  style={{ caretColor: "#6ee7b7" }}
                />
              </div>
              <div className="px-3 py-2">
                <textarea
                  ref={bodyTextareaRef}
                  value={bodyDraft}
                  onChange={(e) => setBodyDraft(e.target.value)}
                  onBlur={handleBlockBlur}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { e.preventDefault(); cancelFullEdit(); }
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-black/20 border border-emerald-500/20 rounded text-xs text-gray-200 p-2 outline-none resize-y font-mono leading-relaxed"
                  style={{ minHeight: "100px", caretColor: "#a7f3d0" }}
                />
              </div>
            </>
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  // ==================================================================
  // INLINE MODE
  // ==================================================================
  return (
    <NodeViewWrapper as="span" contentEditable={false}>
      <span
        ref={pillRef}
        className={`
          instance-pill inline-flex items-center gap-1 relative
          ${isTextOnly && fieldValues.length === 0
            ? "bg-gray-500/40 border-gray-600/40 text-gray-200"
            : "bg-emerald-600 border-emerald-700 text-white"
          }
          px-2 py-0.5 rounded-full text-xs font-medium
          border cursor-pointer transition-all duration-150
          ${inlineEditing ? "" : "select-none"}
          ${selected ? "ring-2 ring-white ring-offset-1 ring-offset-transparent" : ""}
          hover:brightness-110
        `}
        data-instance-id={instanceId}
        data-occurrence-id={occurrenceId}
        data-container-id={containerId}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={enterInlineEdit}
      >
        <span className="opacity-50">#</span>

        {!inlineEditing && (
          <span className="font-medium truncate max-w-[120px]">{displayLabel}</span>
        )}
        {inlineEditing && (
          <input
            ref={inlineInputRef}
            type="text"
            value={inlineEditValue}
            onChange={(e) => setInlineEditValue(e.target.value)}
            onBlur={commitInlineEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitInlineEdit(); }
              if (e.key === "Escape") { e.preventDefault(); setInlineEditing(false); }
              e.stopPropagation();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="bg-black/30 border border-white/20 rounded px-1 outline-none text-inherit font-medium text-xs min-w-[40px]"
            style={{ width: `${Math.max(inlineEditValue.length + 1, 4)}ch`, caretColor: "white" }}
          />
        )}

        {fieldBadges}

        {!inlineEditing && (
          <span className={`inline-flex items-center ml-0.5 -mr-1 transition-opacity duration-150 ${showMenu ? "opacity-100" : "opacity-0 pointer-events-none"}`} contentEditable={false}>
            <RadialMenu
              items={radialItems}
              handleIcon={Settings}
              handleTitle={`${displayLabel} — Click for actions`}
              size="sm"
              handleClassName={`${isTextOnly && fieldValues.length === 0 ? "bg-gray-500/40" : "bg-emerald-600"} border-none rounded-full !w-4 !h-4 !px-0 !rounded-r-full !rounded-l-full`}
              forceDirection="down"
              onOpenChange={setMenuOpen}
            />
          </span>
        )}
      </span>
    </NodeViewWrapper>
  );
}
