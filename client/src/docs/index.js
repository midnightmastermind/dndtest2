// docs/index.js
// ============================================================
// Main exports for the Docs system (Phase 4)
// ============================================================

// Core components
export { default as DocEditor } from "./DocEditor";
export { default as DocToolbar } from "./DocToolbar";
export { default as DocContainer } from "./DocContainer";

// Extensions
export { FieldPill, default as FieldPillExtension } from "./FieldPillExtension";
export { InstancePill, default as InstancePillExtension } from "./InstancePillExtension";
export { DocLink, default as DocLinkExtension } from "./DocLinkExtension";

// Pills
export { default as FieldPillNode } from "./pills/FieldPillNode";
export { default as InstancePillNode } from "./pills/InstancePillNode";
export { default as DocLinkNode } from "./pills/DocLinkNode";

// Suggestions
export { default as FieldSuggestion } from "./suggestions/FieldSuggestion";
export { default as CommandPalette, COMMANDS } from "./suggestions/CommandPalette";
export { default as DocLinkSuggestion } from "./suggestions/DocLinkSuggestion";

// Hooks
export { useDocFieldValues, useFieldValue } from "./hooks/useDocFieldValues";
