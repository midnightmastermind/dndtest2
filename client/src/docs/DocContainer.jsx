// docs/DocContainer.jsx
// ============================================================
// Container wrapper for doc-type containers
// Replaces instance list with rich text editor
// Drop instances/fields to insert as pills
// ============================================================

import { useCallback, useState, useRef, useEffect, useContext } from "react";
import DocEditor from "./DocEditor";
import * as CommitHelpers from "../helpers/CommitHelpers";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { GridActionsContext } from "../GridActionsContext";

/**
 * DocContainer - Renders a doc-type container with rich text editor
 *
 * Instead of showing a list of instances, doc containers show
 * a Tiptap editor where users can write text with embedded field pills.
 *
 * Doc content is stored on the OCCURRENCE (not container) following
 * the occurrence-based architecture - same container can have different
 * content per placement (e.g., different day pages).
 *
 * Props:
 * - container: The container object (defines kind, label, etc.)
 * - occurrence: The occurrence object (stores docContent)
 * - dispatch: Redux-style dispatch
 * - socket: Socket.io instance
 * - isHot: Whether this container is a hot drop target
 */
export default function DocContainer({
  container: _container, // Container for future use (label, settings)
  occurrence,
  dispatch,
  socket,
  isHot = false,
  docModel = null, // Legacy: save to Doc model for pre-migration docs without real occurrences
}) {
  const { state } = useContext(GridActionsContext) || {};
  const gridId = state?.grid?._id;
  const userId = state?.userId;

  const saveTimeout = useRef(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const containerRef = useRef(null);
  const editorRef = useRef(null);

  // Helper: resolve editor position from drop coordinates
  const resolveInsertPos = useCallback((editor, nativeEvent) => {
    if (!editor?.view || !nativeEvent) return null;
    const { clientX, clientY } = nativeEvent;
    if (clientX == null || clientY == null) return null;
    const pos = editor.view.posAtCoords({ left: clientX, top: clientY });
    return pos ? pos.pos : null;
  }, []);

  // Helper: insert content at a specific position, or end of doc if no position
  const insertAtPos = useCallback((editor, pos, content) => {
    if (pos != null) {
      // Insert at the resolved position
      editor.chain()
        .focus()
        .insertContentAt(pos, content)
        .insertContentAt(pos + 1, " ")
        .run();
    } else {
      // Fallback: insert at end
      editor.chain()
        .focus()
        .insertContent(content)
        .insertContent(" ")
        .run();
    }
  }, []);

  // Handle native file drops — upload and insert as instance pills
  const handleFileDrop = useCallback(async (e) => {
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    e.preventDefault();
    e.stopPropagation();

    const editor = editorRef.current?.editor;

    for (const file of files) {
      const artifact = await CommitHelpers.uploadFile({
        dispatch, file, gridId, userId, folderId: null,
      });
      if (artifact && editor) {
        editor.chain().focus().insertContent({
          type: "instancePill",
          attrs: {
            instanceId: artifact.id || artifact._id,
            instanceLabel: artifact.name || file.name,
          },
        }).insertContent(" ").run();
      }
    }
  }, [dispatch, gridId, userId]);

  // Set up drop target for instances/fields
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Store last native drag event for position resolution
    let lastNativeEvent = null;
    const handleNativeDragOver = (e) => { lastNativeEvent = e; };
    el.addEventListener("dragover", handleNativeDragOver);

    const cleanup = dropTargetForElements({
      element: el,
      canDrop: ({ source }) => {
        // Accept instances, fields, and containers
        const type = source.data?.type;
        return type === "instance" || type === "field" || type === "container";
      },
      onDragEnter: () => setIsDropTarget(true),
      onDragLeave: () => setIsDropTarget(false),
      onDrop: ({ source }) => {
        setIsDropTarget(false);

        // If pill is being dragged within the doc, let TipTap handle it natively
        if (source.data?.fromDoc) return;

        const { type, id, data, context } = source.data || {};
        const editor = editorRef.current?.editor;
        if (!editor) return;

        // Resolve drop position from last native dragover event
        const insertPos = resolveInsertPos(editor, lastNativeEvent);

        if (type === "instance") {
          const instance = data || {};
          const occurrenceId = context?.occurrenceId || instance.occurrence?.id || null;
          insertAtPos(editor, insertPos, {
            type: "instancePill",
            attrs: {
              instanceId: id || instance.id,
              instanceLabel: instance.label || "Item",
              occurrenceId,
              containerId: context?.containerId || null,
              showIcon: true,
            },
          });
        }

        if (type === "container") {
          const container = data || {};
          insertAtPos(editor, insertPos, {
            type: "paragraph",
            content: [
              { type: "text", text: container.label || id || "Container", marks: [{ type: "bold" }] },
            ],
          });
        }

        if (type === "field") {
          const field = data || {};
          insertAtPos(editor, insertPos, {
            type: "fieldPill",
            attrs: {
              fieldId: id || field.id,
              fieldName: field.name || "Field",
              fieldType: field.type || "text",
              fieldMode: field.mode || "input",
              showValue: true,
              showLabel: true,
            },
          });
        }
      },
    });

    return () => {
      el.removeEventListener("dragover", handleNativeDragOver);
      cleanup();
    };
  }, [resolveInsertPos, insertAtPos]);

  // Debounced save to avoid too many updates
  // Saves docContent to the OCCURRENCE (not container)
  const saveContent = useCallback((content) => {
    if (!occurrence && !docModel) {
      console.warn("DocContainer: No occurrence or docModel provided, cannot save");
      return;
    }

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    setIsSaving(true);

    saveTimeout.current = setTimeout(() => {
      if (docModel) {
        // Save directly to the Doc model
        socket?.emit("update_doc_content", { docId: docModel.id, content });
      } else {
        CommitHelpers.updateOccurrence({
          dispatch,
          socket,
          occurrence: {
            ...occurrence,
            docContent: content,
          },
          emit: true,
        });
      }
      setIsSaving(false);
    }, 500); // 500ms debounce
  }, [occurrence, dispatch, socket, docModel]);

  // Handle content change
  const handleChange = useCallback((content) => {
    saveContent(content);
  }, [saveContent]);

  // Handle blur - immediate save
  const handleBlur = useCallback((content) => {
    if (!occurrence && !docModel) return;

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }
    if (docModel) {
      socket?.emit("update_doc_content", { docId: docModel.id, content });
    } else {
      CommitHelpers.updateOccurrence({
        dispatch,
        socket,
        occurrence: {
          ...occurrence,
          docContent: content,
        },
        emit: true,
      });
    }
    setIsSaving(false);
  }, [occurrence, dispatch, socket, docModel]);

  return (
    <div
      ref={containerRef}
      className="doc-container flex flex-col flex-1 min-h-0 relative"
      onDrop={handleFileDrop}
      onDragOver={(e) => {
        // Allow native file drops
        if (e.dataTransfer?.types?.includes("Files")) {
          e.preventDefault();
        }
      }}
      style={{
        outline: isHot || isDropTarget ? "2px solid rgba(50,150,255,0.9)" : "none",
      }}
    >
      {/* Drop indicator */}
      {isDropTarget && (
        <div className="absolute inset-0 bg-blue-500/10 pointer-events-none z-10 flex items-center justify-center">
          <span className="text-sm text-blue-400 font-medium">Drop to insert as pill</span>
        </div>
      )}

      {/* Saving indicator */}
      {isSaving && (
        <div className="absolute top-1 right-1 text-xs text-muted-foreground opacity-60 z-20">
          Saving...
        </div>
      )}

      {/* Doc Editor */}
      <DocEditor
        ref={editorRef}
        content={occurrence?.docContent}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Start writing... Use @ to insert fields"
        editable={true}
        showToolbar={true}
        className="flex-1 overflow-auto"
      />
    </div>
  );
}
