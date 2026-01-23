// helpers/dragSystem.js
// ============================================================
// UNIFIED DRAG & DROP SYSTEM
// ============================================================
//
// PHILOSOPHY:
// - Components are DUMB - they just render UI
// - Drag/drop behavior is ATTACHED via hooks
// - All state flows through ONE coordinator (DragProvider)
//
// HOOKS:
// - useDraggable() - makes an element draggable
// - useDroppable() - makes an element a drop target
// - useDragDrop()  - both (for sortable items)
//
// DROP ZONE MATRIX:
// ┌─────────────────┬────────────────────────────────────────┐
// │ Component       │ Accepts drops from                     │
// ├─────────────────┼────────────────────────────────────────┤
// │ GridCell        │ PANEL                                  │
// │ Panel (content) │ CONTAINER, INSTANCE, FILE, TEXT, URL   │
// │ Container (list)│ INSTANCE, FILE, TEXT, URL              │
// │ Instance        │ INSTANCE (for sorting)                 │
// └─────────────────┴────────────────────────────────────────┘
//
// USAGE:
//   // Make something draggable
//   const { ref, isDragging } = useDraggable({
//     type: DragType.INSTANCE,
//     id: instance.id,
//     data: instance,
//     context: { containerId, panelId },
//   });
//
//   // Make something a drop target
//   const { ref, isOver } = useDroppable({
//     type: 'container-list',
//     id: container.id,
//     context: { panelId },
//     accepts: [DragType.INSTANCE],
//   });
//
//   return <div ref={ref}>...</div>

import { useCallback, useEffect, useRef, useState, createContext, useContext } from "react";

// ============================================================
// CONSTANTS & TYPES
// ============================================================
export const NATIVE_DND_MIME = "application/x-daytracker-dnd";

export const DragType = {
  PANEL: "panel",
  CONTAINER: "container",
  INSTANCE: "instance",
  EXTERNAL: "external",
  FILE: "file",
  TEXT: "text",
  URL: "url",
};

// What each drop zone accepts
export const DropAccepts = {
  GRID_CELL: [DragType.PANEL],
  PANEL_CONTENT: [DragType.CONTAINER, DragType.INSTANCE, DragType.EXTERNAL, DragType.FILE, DragType.TEXT, DragType.URL],
  CONTAINER_LIST: [DragType.INSTANCE, DragType.EXTERNAL, DragType.FILE, DragType.TEXT, DragType.URL],
  INSTANCE: [DragType.INSTANCE],
};

// ============================================================
// DRAG CONTEXT
// ============================================================
const DragContext = createContext(null);

export function useDragContext() {
  const ctx = useContext(DragContext);
  if (!ctx) {
    throw new Error("useDraggable/useDroppable must be used within DragProvider");
  }
  return ctx;
}

export { DragContext };

// ============================================================
// WINDOW ID (for cross-window detection)
// ============================================================
let _windowId = null;
export function getWindowId() {
  if (!_windowId) {
    _windowId = crypto?.randomUUID?.() || `win-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return _windowId;
}

// ============================================================
// PAYLOAD HELPERS
// ============================================================
export function createPayload(type, id, data, context = {}) {
  return {
    type,
    id,
    data,
    context,
    sourceWindowId: getWindowId(),
  };
}

export function serializePayload(payload) {
  return JSON.stringify({
    v: 1,
    type: payload.type,
    id: payload.id,
    context: payload.context,
    meta: { label: payload.data?.label || payload.data?.name || "" },
    sourceWindowId: payload.sourceWindowId,
  });
}

export function parseExternalDrop(dataTransfer) {
  const types = Array.from(dataTransfer?.types || []);
  
  // Check for our MIME first (cross-window)
  if (types.includes(NATIVE_DND_MIME)) {
    try {
      const raw = dataTransfer.getData(NATIVE_DND_MIME);
      const parsed = JSON.parse(raw);
      return {
        type: parsed.type,
        id: parsed.id,
        data: parsed,
        context: parsed.context || {},
        isCrossWindow: parsed.sourceWindowId !== getWindowId(),
      };
    } catch { /* fall through */ }
  }

  // Files
  const files = Array.from(dataTransfer?.files || []);
  if (files.length > 0) {
    return {
      type: DragType.FILE,
      id: "__file__",
      data: { files, name: files[0]?.name },
      context: {},
      isCrossWindow: false,
    };
  }

  // URL
  if (types.includes("text/uri-list")) {
    return {
      type: DragType.URL,
      id: "__url__",
      data: { url: dataTransfer.getData("text/uri-list") },
      context: {},
      isCrossWindow: false,
    };
  }

  // Text
  const text = dataTransfer.getData("text/plain") || "";
  return {
    type: DragType.TEXT,
    id: "__text__",
    data: { text: text.slice(0, 200) },
    context: {},
    isCrossWindow: false,
  };
}

// ============================================================
// useDraggable HOOK
// ============================================================
export function useDraggable({
  type,
  id,
  data = {},
  context = {},
  disabled = false,
  nativeEnabled = true,
}) {
  const ref = useRef(null);
  const dragCtx = useDragContext();
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If disabled, ensure not draggable
    if (disabled) {
      el.removeAttribute("draggable");
      return;
    }

    let dragStarted = false;
    const payload = createPayload(type, id, data, context);

    const onDragStart = (e) => {
      if (disabled) {
        e.preventDefault();
        return;
      }

      dragStarted = true;
      setIsDragging(true);

      // Set native data for cross-window
      try {
        e.dataTransfer.effectAllowed = "copyMove";
        e.dataTransfer.setData(NATIVE_DND_MIME, serializePayload(payload));
        e.dataTransfer.setData("text/plain", data?.label || "");
      } catch { /* ignore */ }

      dragCtx.handleDragStart(payload, e.clientX, e.clientY);
    };

    const onDrag = (e) => {
      if (!dragStarted) return;
      if (e.clientX === 0 && e.clientY === 0) return; // Filter bogus events
      dragCtx.handleDragMove(e.clientX, e.clientY);
    };

    const onDragEnd = () => {
      if (!dragStarted) return;
      dragStarted = false;
      setIsDragging(false);
      dragCtx.handleDragEnd();
    };

    el.setAttribute("draggable", "true");
    el.addEventListener("dragstart", onDragStart);
    el.addEventListener("drag", onDrag);
    el.addEventListener("dragend", onDragEnd);

    return () => {
      el.removeAttribute("draggable");
      el.removeEventListener("dragstart", onDragStart);
      el.removeEventListener("drag", onDrag);
      el.removeEventListener("dragend", onDragEnd);
    };
  }, [type, id, data, context, disabled, dragCtx]);

  return {
    ref,
    isDragging,
    dragProps: {
      "data-draggable": "true",
      "data-drag-type": type,
      "data-drag-id": id,
    },
  };
}

// ============================================================
// useDroppable HOOK
// ============================================================
export function useDroppable({
  type,
  id,
  context = {},
  accepts = [],
  disabled = false,
}) {
  const ref = useRef(null);
  const dragCtx = useDragContext();
  const [isOver, setIsOver] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    const canAccept = (dragType) => {
      if (accepts.length === 0) return true;
      return accepts.includes(dragType);
    };

    const onDragEnter = (e) => {
      e.preventDefault();
      const activeType = dragCtx.getActiveType();
      if (canAccept(activeType)) {
        setIsOver(true);
      }
    };

    const onDragOver = (e) => {
      e.preventDefault();
      const activeType = dragCtx.getActiveType();
      if (!canAccept(activeType)) {
        e.dataTransfer.dropEffect = "none";
        return;
      }
      e.dataTransfer.dropEffect = "move";
      
      // Update coordinator with hover info
      dragCtx.handleDragOver?.({ type, id, context, clientX: e.clientX, clientY: e.clientY });
    };

    const onDragLeave = (e) => {
      if (!el.contains(e.relatedTarget)) {
        setIsOver(false);
      }
    };

    const onDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsOver(false);

      const activeType = dragCtx.getActiveType();
      if (!canAccept(activeType)) return;

      dragCtx.handleDrop({
        type,
        id,
        context,
        clientX: e.clientX,
        clientY: e.clientY,
        dataTransfer: e.dataTransfer,
      });
    };

    el.addEventListener("dragenter", onDragEnter);
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);

    return () => {
      el.removeEventListener("dragenter", onDragEnter);
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, [type, id, context, accepts, disabled, dragCtx]);

  return {
    ref,
    isOver,
    dropProps: {
      "data-droppable": "true",
      "data-drop-type": type,
      "data-drop-id": id,
    },
  };
}

// ============================================================
// useDragDrop HOOK (combined)
// ============================================================
export function useDragDrop({
  type,
  id,
  data = {},
  context = {},
  disabled = false,
  nativeEnabled = true,
  accepts = [],
}) {
  const dragRef = useRef(null);
  const dropRef = useRef(null);
  
  const drag = useDraggable({ type, id, data, context, disabled, nativeEnabled });
  const drop = useDroppable({ type, id, context, accepts, disabled });

  // Combined ref setter
  const ref = useCallback((node) => {
    drag.ref.current = node;
    drop.ref.current = node;
  }, []);

  return {
    ref,
    isDragging: drag.isDragging,
    isOver: drop.isOver,
    props: {
      ...drag.dragProps,
      ...drop.dropProps,
    },
  };
}
