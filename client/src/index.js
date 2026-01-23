// helpers/index.js
// ============================================================
// UNIFIED DRAG SYSTEM - PUBLIC API
// ============================================================

// Core hooks
export {
  useDraggable,
  useDroppable,
  useDragDrop,
  useDragContext,
} from "./dragSystem";

// Types & constants
export {
  DragType,
  DropAccepts,
  NATIVE_DND_MIME,
  DragContext,
} from "./dragSystem";

// Provider
export { DragProvider } from "./DragProvider";

// Utilities (for advanced use)
export {
  createPayload,
  serializePayload,
  parseExternalDrop,
  getWindowId,
} from "./dragSystem";
