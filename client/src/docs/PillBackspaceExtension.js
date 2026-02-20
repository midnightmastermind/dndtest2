// docs/PillBackspaceExtension.js
// ============================================================
// Tiptap Extension: Custom backspace behavior for pills
// - Instance pills (text-only): convert back to plain text
// - Instance pills (with fields): delete whole node
// - Field pills: delete whole node
// ============================================================

import { Extension } from "@tiptap/core";

/**
 * Checks if an instance is "text-only" (no field bindings).
 * Looks up the instance in the editor's storage or falls back
 * to treating it as text-only if we can't determine.
 */
function isTextOnlyInstance(instanceId, instancesById) {
  if (!instancesById || !instanceId) return true;
  const inst = instancesById[instanceId];
  if (!inst) return true;
  // If the instance has field bindings, it's not text-only
  const bindings = inst.fieldBindings || inst.fields;
  if (bindings && typeof bindings === "object") {
    return Object.keys(bindings).length === 0;
  }
  return true;
}

export const PillBackspace = Extension.create({
  name: "pillBackspace",

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $anchor } = selection;

        // Only handle when cursor is at a regular position (not a node selection)
        if (!selection.empty) return false;

        const pos = $anchor.pos;
        // Resolve the position just before the cursor
        if (pos < 1) return false;

        const nodeBefore = state.doc.resolve(pos).nodeBefore;
        if (!nodeBefore) return false;

        const nodeType = nodeBefore.type.name;

        if (nodeType === "fieldPill") {
          // Always delete the whole field pill
          const from = pos - nodeBefore.nodeSize;
          editor.chain().deleteRange({ from, to: pos }).run();
          return true;
        }

        if (nodeType === "instancePill") {
          const attrs = nodeBefore.attrs;
          const instanceId = attrs.instanceId;

          // Try to get instancesById from editor options or global context
          const instancesById =
            editor.options?.editorProps?.instancesById || null;

          if (isTextOnlyInstance(instanceId, instancesById)) {
            // Convert to plain text using the label
            const label = attrs.instanceLabel || "";
            const from = pos - nodeBefore.nodeSize;
            editor.chain().deleteRange({ from, to: pos }).insertContentAt(from, label).run();
          } else {
            // Has fields — delete the whole pill
            const from = pos - nodeBefore.nodeSize;
            editor.chain().deleteRange({ from, to: pos }).run();
          }
          return true;
        }

        // Not a pill — let default backspace handle it
        return false;
      },
    };
  },
});

export default PillBackspace;
