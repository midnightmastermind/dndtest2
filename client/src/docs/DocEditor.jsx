// docs/DocEditor.jsx
// ============================================================
// Main Tiptap rich text editor with Field Pills support
// Obsidian-style markdown + @ mentions for field insertion
// ============================================================

import { useCallback, useContext, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { FieldPill } from "./FieldPillExtension";
import { InstancePill } from "./InstancePillExtension";
import { DocLink } from "./DocLinkExtension";
import { PillBackspace } from "./PillBackspaceExtension";
import { HeadingFocus } from "./HeadingFocusExtension";
import FieldSuggestion from "./suggestions/FieldSuggestion";
import CommandPalette from "./suggestions/CommandPalette";
import DocLinkSuggestion from "./suggestions/DocLinkSuggestion";
import DocToolbar from "./DocToolbar";
import { GridActionsContext } from "../GridActionsContext";

/**
 * DocEditor - Rich text editor with embedded field pills
 *
 * Features:
 * - Markdown shortcuts (# headings, **bold**, etc.)
 * - @ mention to insert field pills
 * - Drag & drop fields from palette
 * - Live value updates
 *
 * Props:
 * - content: Initial Tiptap JSON content
 * - onChange: Callback when content changes
 * - onBlur: Callback on editor blur
 * - placeholder: Placeholder text
 * - editable: Whether editor is editable
 * - className: Additional CSS classes
 */
const DocEditor = forwardRef(function DocEditor({
  content = null,
  onChange,
  onBlur,
  placeholder = "Start typing... Use @ to insert a field",
  editable = true,
  className = "",
  showToolbar = true,
}, ref) {
  const { fieldsById, instancesById, containersById, occurrencesById } = useContext(GridActionsContext) || {};
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandPos, setCommandPos] = useState({ top: 0, left: 0 });
  const [showDocLink, setShowDocLink] = useState(false);
  const [docLinkQuery, setDocLinkQuery] = useState("");
  const [docLinkPos, setDocLinkPos] = useState({ top: 0, left: 0 });
  const lastCharRef = useRef("");
  const editorRef = useRef(null);

  // Get available fields for suggestions
  const availableFields = useMemo(() => {
    if (!fieldsById) return [];
    return Object.values(fieldsById).filter(f => f && f.id);
  }, [fieldsById]);

  // Filter fields based on query
  const filteredFields = useMemo(() => {
    if (!suggestionQuery) return availableFields;
    const q = suggestionQuery.toLowerCase();
    return availableFields.filter(f =>
      f.name?.toLowerCase().includes(q) ||
      f.id?.toLowerCase().includes(q)
    );
  }, [availableFields, suggestionQuery]);

  // Get cursor position for popup placement
  const getCursorPosition = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const editorRect = editorRef.current?.getBoundingClientRect();
      if (editorRect) {
        return {
          top: rect.bottom - editorRect.top + 4,
          left: rect.left - editorRect.left,
        };
      }
    }
    return { top: 0, left: 0 };
  }, []);

  // Handle @ key to trigger field suggestions
  const handleAtKey = useCallback(() => {
    if (!showSuggestion) {
      setSuggestionPos(getCursorPosition());
      setShowSuggestion(true);
      setSuggestionQuery("");
    }
  }, [showSuggestion, getCursorPosition]);

  // Handle / key to trigger command palette
  const handleSlashKey = useCallback(() => {
    if (!showCommandPalette) {
      setCommandPos(getCursorPosition());
      setShowCommandPalette(true);
      setCommandQuery("");
    }
  }, [showCommandPalette, getCursorPosition]);

  // Handle [[ to trigger doc link suggestions
  const handleDocLinkTrigger = useCallback(() => {
    if (!showDocLink) {
      setDocLinkPos(getCursorPosition());
      setShowDocLink(true);
      setDocLinkQuery("");
    }
  }, [showDocLink, getCursorPosition]);

  // Initialize Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Enable markdown-like shortcuts
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      FieldPill,
      InstancePill,
      DocLink,
      PillBackspace,
      HeadingFocus,
    ],
    content: content || {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [],
        },
      ],
    },
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());
    },
    onBlur: ({ editor }) => {
      onBlur?.(editor.getJSON());
      // Close suggestion on blur (with delay to allow click)
      setTimeout(() => setShowSuggestion(false), 200);
    },
    editorProps: {
      instancesById,
      attributes: {
        class: "doc-editor-content prose prose-invert max-w-none focus:outline-none",
      },
      handleKeyDown: (_view, event) => {
        // Track @ for field suggestions
        if (event.key === "@") {
          handleAtKey();
        }
        // Track / for command palette
        if (event.key === "/") {
          handleSlashKey();
        }
        // Track [ for doc links (check if previous char was also [)
        if (event.key === "[" && lastCharRef.current === "[") {
          handleDocLinkTrigger();
        }
        lastCharRef.current = event.key;
        // Close popups on Escape
        if (event.key === "Escape") {
          if (showSuggestion) {
            setShowSuggestion(false);
            return true;
          }
          if (showCommandPalette) {
            setShowCommandPalette(false);
            return true;
          }
          if (showDocLink) {
            setShowDocLink(false);
            return true;
          }
        }
        return false;
      },
      handleTextInput: (_view, _from, _to, text) => {
        // Update suggestion query as user types after @
        if (showSuggestion) {
          setSuggestionQuery(prev => prev + text);
        }
        // Update command query as user types after /
        if (showCommandPalette) {
          setCommandQuery(prev => prev + text);
        }
        // Update doc link query as user types after [[
        if (showDocLink) {
          setDocLinkQuery(prev => prev + text);
        }
        return false;
      },
    },
  });

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content && !editor.isFocused) {
      const currentContent = editor.getJSON();
      if (JSON.stringify(currentContent) !== JSON.stringify(content)) {
        editor.commands.setContent(content);
      }
    }
  }, [editor, content]);

  // Insert a field pill at current cursor position
  const insertFieldPill = useCallback((field) => {
    if (!editor) return;

    // Delete the @ character that triggered the suggestion
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 20), from);
    const atIndex = textBefore.lastIndexOf("@");
    if (atIndex >= 0) {
      const deleteFrom = from - (textBefore.length - atIndex);
      editor.chain()
        .focus()
        .deleteRange({ from: deleteFrom, to: from })
        .insertFieldPill({
          fieldId: field.id,
          fieldName: field.name,
          fieldType: field.type || "text",
          fieldMode: field.mode || "input",
          showValue: true,
          showLabel: true,
        })
        .run();
    } else {
      // No @ found, just insert
      editor.chain()
        .focus()
        .insertFieldPill({
          fieldId: field.id,
          fieldName: field.name,
          fieldType: field.type || "text",
          fieldMode: field.mode || "input",
          showValue: true,
          showLabel: true,
        })
        .run();
    }

    setShowSuggestion(false);
    setSuggestionQuery("");
  }, [editor]);

  // Handle suggestion selection — field from @ creates a field pill with value-only display
  const handleSelectField = useCallback((field) => {
    if (!editor) return;

    // Delete the @ trigger
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 20), from);
    const atIndex = textBefore.lastIndexOf("@");
    const chain = editor.chain().focus();
    if (atIndex >= 0) {
      const deleteFrom = from - (textBefore.length - atIndex);
      chain.deleteRange({ from: deleteFrom, to: from });
    }

    // Insert a field pill showing value only (no label) — acts like an inline field-bearing instance
    chain.insertFieldPill({
      fieldId: field.id,
      fieldName: field.name,
      fieldType: field.type || "text",
      fieldMode: field.mode || "input",
      showValue: true,
      showLabel: false, // no label — just the field value inline
    }).run();

    setShowSuggestion(false);
    setSuggestionQuery("");
  }, [editor]);

  // Delete the @ trigger text before inserting
  const deleteAtTrigger = useCallback(() => {
    if (!editor) return;
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 20), from);
    const atIndex = textBefore.lastIndexOf("@");
    if (atIndex >= 0) {
      const deleteFrom = from - (textBefore.length - atIndex);
      editor.chain().focus().deleteRange({ from: deleteFrom, to: from }).run();
    }
  }, [editor]);

  // Handle instance selection from @ popup
  const handleSelectInstance = useCallback((instance, mode) => {
    if (!editor) return;
    deleteAtTrigger();
    editor.chain()
      .focus()
      .insertContent({
        type: "instancePill",
        attrs: {
          instanceId: instance.id,
          instanceLabel: instance.label || instance.id,
          containerId: instance.containerId || null,
          showIcon: true,
        },
      })
      .insertContent(" ")
      .run();
    setShowSuggestion(false);
    setSuggestionQuery("");
  }, [editor, deleteAtTrigger]);

  // Handle container selection from @ popup — inserts bolded title + bullet list of instances
  const handleSelectContainer = useCallback((container, mode) => {
    if (!editor) return;
    deleteAtTrigger();

    // Build content: bolded container name + bullet list of its instances
    const content = [];
    content.push({
      type: "paragraph",
      content: [
        { type: "text", text: container.label || container.id, marks: [{ type: "bold" }] },
      ],
    });

    // Get instances in this container from its occurrences
    const items = container.occurrences || [];
    if (items.length > 0 && instancesById) {
      const listItems = [];
      for (const itemId of items) {
        // itemId could be an occurrence ID — look up the instance
        const occ = occurrencesById?.[itemId];
        const instId = occ?.targetId || itemId;
        const inst = instancesById[instId];
        if (inst) {
          listItems.push({
            type: "listItem",
            content: [{
              type: "paragraph",
              content: [{
                type: "instancePill",
                attrs: {
                  instanceId: inst.id,
                  instanceLabel: inst.label || inst.id,
                  occurrenceId: occ?.id || null,
                  containerId: container.id,
                  showIcon: true,
                },
              }],
            }],
          });
        }
      }
      if (listItems.length > 0) {
        content.push({ type: "bulletList", content: listItems });
      }
    }

    editor.chain().focus().insertContent(content).run();
    setShowSuggestion(false);
    setSuggestionQuery("");
  }, [editor, deleteAtTrigger, instancesById, occurrencesById]);

  // Handle backspace in suggestion/command/doclink mode
  useEffect(() => {
    if (!showSuggestion && !showCommandPalette && !showDocLink) return;

    const handleBackspace = (e) => {
      if (e.key === "Backspace") {
        if (showSuggestion) {
          if (suggestionQuery.length > 0) {
            setSuggestionQuery(prev => prev.slice(0, -1));
          } else {
            setShowSuggestion(false);
          }
        }
        if (showCommandPalette) {
          if (commandQuery.length > 0) {
            setCommandQuery(prev => prev.slice(0, -1));
          } else {
            setShowCommandPalette(false);
          }
        }
        if (showDocLink) {
          if (docLinkQuery.length > 0) {
            setDocLinkQuery(prev => prev.slice(0, -1));
          } else {
            setShowDocLink(false);
          }
        }
      }
    };

    window.addEventListener("keydown", handleBackspace);
    return () => window.removeEventListener("keydown", handleBackspace);
  }, [showSuggestion, suggestionQuery, showCommandPalette, commandQuery, showDocLink, docLinkQuery]);

  // Expose editor to parent via ref
  useImperativeHandle(ref, () => ({
    editor,
    insertFieldPill,
    insertInstancePill: (instance) => {
      if (!editor) return;
      editor.chain()
        .focus()
        .insertContent({
          type: "instancePill",
          attrs: {
            instanceId: instance.id,
            instanceLabel: instance.label || "Item",
            containerId: instance.containerId || null,
            showIcon: true,
          },
        })
        .run();
    },
  }), [editor, insertFieldPill]);

  return (
    <div
      ref={editorRef}
      className={`doc-editor relative ${className}`}
    >
      {/* Toolbar */}
      {showToolbar && editor && (
        <DocToolbar editor={editor} />
      )}

      {/* Editor Content */}
      <div className="doc-editor-wrapper min-h-[100px] p-3">
        <EditorContent editor={editor} />
      </div>

      {/* Field Suggestion Popup */}
      {showSuggestion && (
        <FieldSuggestion
          fields={filteredFields}
          query={suggestionQuery}
          onSelect={handleSelectField}
          onSelectInstance={handleSelectInstance}
          onSelectContainer={handleSelectContainer}
          onClose={() => setShowSuggestion(false)}
          position={suggestionPos}
        />
      )}

      {/* Command Palette Popup */}
      {showCommandPalette && (
        <CommandPalette
          query={commandQuery}
          position={commandPos}
          onSelect={() => {}}
          onClose={() => {
            setShowCommandPalette(false);
            setCommandQuery("");
          }}
          editor={editor}
        />
      )}

      {/* Document Link Suggestion Popup */}
      {showDocLink && (
        <DocLinkSuggestion
          query={docLinkQuery}
          position={docLinkPos}
          onSelect={(linkData) => {
            if (!editor) return;
            // Delete the [[ that triggered the suggestion
            const { from } = editor.state.selection;
            const textBefore = editor.state.doc.textBetween(Math.max(0, from - 30), from);
            const bracketIndex = textBefore.lastIndexOf("[[");
            if (bracketIndex >= 0) {
              const deleteFrom = from - (textBefore.length - bracketIndex);
              editor.chain()
                .focus()
                .deleteRange({ from: deleteFrom, to: from })
                .insertDocLink(linkData)
                .run();
            }
            setShowDocLink(false);
            setDocLinkQuery("");
          }}
          onClose={() => {
            setShowDocLink(false);
            setDocLinkQuery("");
          }}
        />
      )}
    </div>
  );
});

export default DocEditor;
