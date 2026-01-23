// helpers/DragProvider.jsx
// ============================================================
// DRAG PROVIDER - THE BRAIN
// ============================================================
//
// This owns ALL drag/drop state and logic.
// Components just attach hooks and read from context.
//
// RESPONSIBILITIES:
// - Track active drag payload
// - Track hot target (what's being hovered)
// - Handle drop commits (panel→cell, container→panel, instance→container)
// - Manage draft state for live previews
// - Handle external/cross-window drops

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DragContext,
  DragType,
  NATIVE_DND_MIME,
  parseExternalDrop,
  getWindowId,
} from "./dragSystem";
import * as CommitHelpers from "./CommitHelpers";
import * as LayoutHelpers from "./LayoutHelpers";

// ============================================================
// UTILITIES
// ============================================================
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function deepClonePanels(panels = []) {
  return panels.map((p) => ({
    ...p,
    layout: p.layout ? { ...p.layout, style: { ...(p.layout.style || {}) } } : p.layout,
    containers: [...(p.containers || [])],
  }));
}

function deepCloneContainers(containers = []) {
  return containers.map((c) => ({ ...c, items: [...(c.items || [])] }));
}

function cellKeyFromPanel(p) {
  return `cell-${p.row}-${p.col}`;
}

function panelDisplay(p) {
  return p?.layout?.style?.display ?? "block";
}

function makeUUID() {
  return crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ============================================================
// DRAG PROVIDER
// ============================================================
export function DragProvider({
  children,
  state,
  dispatch,
  socket,
  gridRef,
  rows = 1,
  cols = 1,
  rowSizes = [],
  colSizes = [],
  visiblePanels = [],
  onTick,
}) {
  // ============================================================
  // STATE
  // ============================================================
  const [activePayload, setActivePayload] = useState(null);
  const [hotTarget, setHotTarget] = useState(null);
  const [panelOverCellId, setPanelOverCellId] = useState(null);

  const activeType = activePayload?.type || null;
  const activeId = activePayload?.id || null;
  const isDragging = activePayload !== null;

  // ============================================================
  // REFS
  // ============================================================
  const sessionRef = useRef({
    dragging: false,
    payload: null,
    startPanels: null,
    startContainers: null,
    draftPanels: null,
    draftContainers: null,
  });

  const pointerRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);

  // ============================================================
  // BASE DATA
  // ============================================================
  const basePanels = useMemo(
    () => (Array.isArray(visiblePanels) ? visiblePanels : []),
    [visiblePanels]
  );

  const baseAllPanels = useMemo(() => {
    const p = Array.isArray(state?.panels) ? state.panels : [];
    return p.length ? p : basePanels;
  }, [state?.panels, basePanels]);

  const baseContainers = useMemo(
    () => (Array.isArray(state?.containers) ? state.containers : []),
    [state?.containers]
  );

  // ============================================================
  // DRAFT-AWARE GETTERS
  // ============================================================
  const getWorkingPanels = useCallback(() => {
    const s = sessionRef.current;
    return s.dragging && s.draftPanels ? s.draftPanels : basePanels;
  }, [basePanels]);

  const getWorkingAllPanels = useCallback(() => {
    const s = sessionRef.current;
    return s.dragging && s.draftPanels ? s.draftPanels : baseAllPanels;
  }, [baseAllPanels]);

  const getWorkingContainers = useCallback(() => {
    const s = sessionRef.current;
    return s.dragging && s.draftContainers ? s.draftContainers : baseContainers;
  }, [baseContainers]);

  // ============================================================
  // GEOMETRY
  // ============================================================
  const getCellFromPoint = useCallback((x, y) => {
    const el = gridRef?.current;
    if (!el) return null;

    const rect = el.getBoundingClientRect();
    const relX = (x - rect.left) / rect.width;
    const relY = (y - rect.top) / rect.height;

    const totalCols = (colSizes || []).reduce((a, b) => a + b, 0) || 1;
    const totalRows = (rowSizes || []).reduce((a, b) => a + b, 0) || 1;

    let acc = 0, col = 0;
    for (let i = 0; i < colSizes.length; i++) {
      acc += colSizes[i];
      if (relX <= acc / totalCols) { col = i; break; }
    }

    acc = 0;
    let row = 0;
    for (let i = 0; i < rowSizes.length; i++) {
      acc += rowSizes[i];
      if (relY <= acc / totalRows) { row = i; break; }
    }

    return {
      row: clamp(row, 0, rows - 1),
      col: clamp(col, 0, cols - 1),
      cellId: `cell-${clamp(row, 0, rows - 1)}-${clamp(col, 0, cols - 1)}`,
    };
  }, [gridRef, rows, cols, rowSizes, colSizes]);

  // ============================================================
  // HIT TESTING
  // ============================================================
  const getTopmostAttr = useCallback((x, y, attr) => {
    const elements = document.elementsFromPoint(x, y);
    for (const el of elements) {
      const val = el.getAttribute(attr);
      if (val) return val;
    }
    return null;
  }, []);

  const getHoveredPanelId = useCallback(() => getTopmostAttr(pointerRef.current.x, pointerRef.current.y, "data-panel-id"), [getTopmostAttr]);
  const getHoveredContainerId = useCallback(() => getTopmostAttr(pointerRef.current.x, pointerRef.current.y, "data-container-id"), [getTopmostAttr]);
  const getHoveredInstanceId = useCallback(() => getTopmostAttr(pointerRef.current.x, pointerRef.current.y, "data-instance-id"), [getTopmostAttr]);

  // ============================================================
  // SESSION MANAGEMENT
  // ============================================================
  const startSession = useCallback((payload) => {
    const s = sessionRef.current;
    if (s.dragging) return;

    s.dragging = true;
    s.payload = payload;
    s.startPanels = deepClonePanels(basePanels);
    s.startContainers = deepCloneContainers(baseContainers);
    s.draftPanels = deepClonePanels(basePanels);
    s.draftContainers = deepCloneContainers(baseContainers);

    setActivePayload(payload);
  }, [basePanels, baseContainers]);

  const clearSession = useCallback(() => {
    const s = sessionRef.current;
    s.dragging = false;
    s.payload = null;
    s.startPanels = null;
    s.startContainers = null;
    s.draftPanels = null;
    s.draftContainers = null;

    setActivePayload(null);
    setHotTarget(null);
    setPanelOverCellId(null);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;

    onTick?.();
  }, [onTick]);

  // ============================================================
  // PREVIEW MUTATIONS
  // ============================================================
  const previewMoveInstance = useCallback(({ instanceId, toContainerId, toIndex }) => {
    const s = sessionRef.current;
    if (!s.draftContainers) return;

    for (const c of s.draftContainers) {
      c.items = (c.items || []).filter((id) => id !== instanceId);
    }

    const to = s.draftContainers.find((c) => c.id === toContainerId);
    if (!to) return;

    const items = to.items || [];
    if (toIndex != null && toIndex >= 0) {
      items.splice(toIndex, 0, instanceId);
    } else {
      items.push(instanceId);
    }
    to.items = items;
  }, []);

  const previewMoveContainer = useCallback(({ containerId, toPanelId, toIndex }) => {
    const s = sessionRef.current;
    if (!s.draftPanels) return;

    for (const p of s.draftPanels) {
      p.containers = (p.containers || []).filter((id) => id !== containerId);
    }

    const to = s.draftPanels.find((p) => p.id === toPanelId);
    if (!to) return;

    const containers = to.containers || [];
    if (toIndex != null && toIndex >= 0) {
      containers.splice(toIndex, 0, containerId);
    } else {
      containers.push(containerId);
    }
    to.containers = containers;
  }, []);

  // ============================================================
  // DRAG HANDLERS
  // ============================================================
  const handleDragStart = useCallback((payload, clientX, clientY) => {
    pointerRef.current = { x: clientX, y: clientY };
    startSession(payload);

    const cell = getCellFromPoint(clientX, clientY);
    if (payload.type === DragType.PANEL) {
      setPanelOverCellId(cell?.cellId || null);
    }

    setHotTarget({
      role: payload.type,
      cellId: cell?.cellId,
      panelId: getHoveredPanelId(),
      containerId: getHoveredContainerId(),
      overInstanceId: getHoveredInstanceId(),
    });

    onTick?.();
  }, [startSession, getCellFromPoint, getHoveredPanelId, getHoveredContainerId, getHoveredInstanceId, onTick]);

  const handleDragMove = useCallback((clientX, clientY) => {
    const s = sessionRef.current;
    if (!s.dragging) return;

    pointerRef.current = { x: clientX, y: clientY };

    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;

      const panelId = getHoveredPanelId();
      const containerId = getHoveredContainerId();
      const instanceId = getHoveredInstanceId();
      const cell = getCellFromPoint(clientX, clientY);

      setHotTarget({
        role: s.payload?.type || "",
        cellId: cell?.cellId,
        panelId,
        containerId,
        overInstanceId: instanceId,
      });

      if (s.payload?.type === DragType.PANEL) {
        setPanelOverCellId(cell?.cellId || null);
      }

      // Live preview for instance sorting
      if (s.payload?.type === DragType.INSTANCE && containerId) {
        const toC = s.draftContainers?.find((c) => c.id === containerId);
        const idx = instanceId && toC ? (toC.items || []).indexOf(instanceId) : null;
        previewMoveInstance({ instanceId: s.payload.id, toContainerId: containerId, toIndex: idx });
      }

      // Live preview for container sorting
      if (s.payload?.type === DragType.CONTAINER && panelId) {
        previewMoveContainer({ containerId: s.payload.id, toPanelId: panelId, toIndex: null });
      }

      onTick?.();
    });
  }, [getCellFromPoint, getHoveredPanelId, getHoveredContainerId, getHoveredInstanceId, previewMoveInstance, previewMoveContainer, onTick]);

  const handleDragOver = useCallback((target) => {
    // Called by useDroppable on dragover - can use for finer-grained updates
    const s = sessionRef.current;
    if (!s.dragging) return;

    setHotTarget((prev) => ({
      ...prev,
      panelId: target.context?.panelId || prev?.panelId,
      containerId: target.context?.containerId || prev?.containerId,
      overInstanceId: target.context?.instanceId || prev?.overInstanceId,
    }));
  }, []);

  // ============================================================
  // DROP HANDLER - COMMITS CHANGES
  // ============================================================
  const handleDrop = useCallback((dropTarget) => {
    const s = sessionRef.current;
    if (!s.dragging) {
      clearSession();
      return;
    }

    const payload = s.payload;
    const { x, y } = pointerRef.current;
    
    // Resolve targets from hit testing + drop target context
    const panelId = dropTarget.context?.panelId || getHoveredPanelId();
    const containerId = dropTarget.context?.containerId || getHoveredContainerId();
    const instanceId = dropTarget.context?.instanceId || getHoveredInstanceId();

    // ============================================================
    // PANEL → CELL
    // ============================================================
    if (payload?.type === DragType.PANEL) {
      const cell = getCellFromPoint(x, y);
      if (cell) {
        const panel = getWorkingAllPanels().find((p) => p.id === payload.id);
        if (panel && (panel.row !== cell.row || panel.col !== cell.col)) {
          const fromRow = panel.row, fromCol = panel.col;
          const toRow = cell.row, toCol = cell.col;

          CommitHelpers.updatePanel({
            dispatch, socket,
            panel: { ...panel, row: toRow, col: toCol },
            emit: true,
          });

          // Stack visibility management
          const allPanels = getWorkingAllPanels();
          const sourceCellKey = `cell-${fromRow}-${fromCol}`;
          const destCellKey = `cell-${toRow}-${toCol}`;

          const sourceStack = allPanels.filter((p) => p.id !== payload.id && cellKeyFromPanel(p) === sourceCellKey);
          const destStack = allPanels.filter((p) => p.id !== payload.id && cellKeyFromPanel(p) === destCellKey);

          if (sourceStack.length) {
            LayoutHelpers.setPanelStackDisplay({ dispatch, socket, panel: sourceStack[0], display: "block", emit: true });
            sourceStack.slice(1).forEach((p) => {
              LayoutHelpers.setPanelStackDisplay({ dispatch, socket, panel: p, display: "none", emit: true });
            });
          }

          destStack.forEach((p) => {
            LayoutHelpers.setPanelStackDisplay({ dispatch, socket, panel: p, display: "none", emit: true });
          });
        }
      }
    }

    // ============================================================
    // CONTAINER → PANEL
    // ============================================================
    if (payload?.type === DragType.CONTAINER && panelId) {
      const all = getWorkingAllPanels();
      const fromPanel = all.find((p) => p.id === payload.context?.panelId);
      const toPanel = all.find((p) => p.id === panelId);

      if (fromPanel && toPanel && fromPanel.id !== toPanel.id) {
        LayoutHelpers.moveContainerBetweenPanels({
          dispatch, socket, fromPanel, toPanel,
          containerId: payload.id,
          toIndex: null,
          emit: true,
        });
      }
    }

    // ============================================================
    // INSTANCE → CONTAINER
    // ============================================================
    if (payload?.type === DragType.INSTANCE && containerId) {
      const fromC = getWorkingContainers().find((c) => c.id === payload.context?.containerId);
      const toC = getWorkingContainers().find((c) => c.id === containerId);

      if (fromC && toC) {
        const toIndex = instanceId && toC ? (toC.items || []).indexOf(instanceId) : null;
        LayoutHelpers.moveInstanceBetweenContainers({
          dispatch, socket, fromContainer: fromC, toContainer: toC,
          instanceId: payload.id,
          toIndex,
          emit: true,
        });
      }
    }

    // ============================================================
    // EXTERNAL (FILE/TEXT/URL) → CONTAINER
    // ============================================================
    if ([DragType.FILE, DragType.TEXT, DragType.URL, DragType.EXTERNAL].includes(payload?.type)) {
      const targetContainerId = containerId ||
        (panelId ? getWorkingAllPanels().find((p) => p.id === panelId)?.containers?.[0] : null);

      if (targetContainerId) {
        let label = "Untitled";
        if (payload.type === DragType.FILE) label = payload.data?.name || "File";
        else if (payload.type === DragType.TEXT) label = (payload.data?.text || "").slice(0, 80) || "Text";
        else if (payload.type === DragType.URL) label = payload.data?.url || "Link";

        const id = makeUUID();
        LayoutHelpers.createInstanceInContainer({
          dispatch, socket, containerId: targetContainerId,
          instance: { id, label },
          emit: true,
        });
      }
    }

    // ============================================================
    // CROSS-WINDOW DROP
    // ============================================================
    if (dropTarget.dataTransfer) {
      const parsed = parseExternalDrop(dropTarget.dataTransfer);
      if (parsed.isCrossWindow && parsed.data?.meta?.label) {
        const targetContainerId = containerId ||
          (panelId ? getWorkingAllPanels().find((p) => p.id === panelId)?.containers?.[0] : null);

        if (targetContainerId) {
          const id = makeUUID();
          LayoutHelpers.createInstanceInContainer({
            dispatch, socket, containerId: targetContainerId,
            instance: { id, label: parsed.data.meta.label },
            emit: true,
          });
        }
      }
    }

    clearSession();
  }, [dispatch, socket, getCellFromPoint, getHoveredPanelId, getHoveredContainerId, getHoveredInstanceId, getWorkingAllPanels, getWorkingContainers, clearSession]);

  const handleDragEnd = useCallback(() => {
    clearSession();
  }, [clearSession]);

  // ============================================================
  // EXTERNAL DRAG DETECTION (grid-level)
  // ============================================================
  useEffect(() => {
    const el = gridRef?.current;
    if (!el) return;

    const onDragOver = (e) => {
      e.preventDefault();
      const s = sessionRef.current;

      if (!s.dragging) {
        const payload = { type: DragType.EXTERNAL, id: "__external__", data: {}, context: {} };
        handleDragStart(payload, e.clientX, e.clientY);
      } else {
        handleDragMove(e.clientX, e.clientY);
      }
    };

    const onDrop = (e) => {
      e.preventDefault();
      const s = sessionRef.current;

      if (s.dragging && s.payload?.type === DragType.EXTERNAL) {
        const parsed = parseExternalDrop(e.dataTransfer);
        s.payload = { ...s.payload, ...parsed };
      }

      handleDrop({
        type: "grid",
        id: "grid",
        context: {},
        clientX: e.clientX,
        clientY: e.clientY,
        dataTransfer: e.dataTransfer,
      });
    };

    const onDragLeave = (e) => {
      const rect = el.getBoundingClientRect();
      const outside = e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
      if (outside) handleDragEnd();
    };

    el.addEventListener("dragover", onDragOver);
    el.addEventListener("drop", onDrop);
    el.addEventListener("dragleave", onDragLeave);

    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("drop", onDrop);
      el.removeEventListener("dragleave", onDragLeave);
    };
  }, [gridRef, handleDragStart, handleDragMove, handleDrop, handleDragEnd]);

  // ============================================================
  // STACK HELPERS
  // ============================================================
  const getStacksByCell = useCallback(() => {
    const panels = getWorkingPanels();
    const map = new Map();
    for (const p of panels) {
      const key = cellKeyFromPanel(p);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    return map;
  }, [getWorkingPanels]);

  const getStackForPanel = useCallback((panel) => {
    if (!panel) return [];
    return getStacksByCell().get(cellKeyFromPanel(panel)) || [];
  }, [getStacksByCell]);

  const setActivePanelInCell = useCallback((row, col, nextPanelId) => {
    const panels = getWorkingPanels();
    const key = `cell-${row}-${col}`;
    const stack = panels.filter((p) => cellKeyFromPanel(p) === key);
    if (stack.length <= 1) return;

    stack.forEach((p) => {
      LayoutHelpers.setPanelStackDisplay({
        dispatch, socket, panel: p,
        display: p.id === nextPanelId ? "block" : "none",
        emit: true,
      });
    });
  }, [dispatch, socket, getWorkingPanels]);

  const cyclePanelStack = useCallback(({ panelId, dir = 1 }) => {
    const panels = getWorkingPanels();
    const anchor = panels.find((p) => p.id === panelId);
    if (!anchor) return;

    const stack = getStackForPanel(anchor);
    if (stack.length <= 1) return;

    const visibleIdx = stack.findIndex((p) => panelDisplay(p) !== "none");
    const currIdx = visibleIdx >= 0 ? visibleIdx : 0;
    const nextIdx = (currIdx + (dir >= 0 ? 1 : -1) + stack.length) % stack.length;

    stack.forEach((p, idx) => {
      LayoutHelpers.setPanelStackDisplay({
        dispatch, socket, panel: p,
        display: idx === nextIdx ? "block" : "none",
        emit: true,
      });
    });
  }, [dispatch, socket, getWorkingPanels, getStackForPanel]);

  // ============================================================
  // CONTEXT VALUE
  // ============================================================
  const contextValue = useMemo(() => ({
    // Handlers
    handleDragStart,
    handleDragMove,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    getActiveType: () => sessionRef.current.payload?.type || null,

    // State
    activePayload,
    activeType,
    activeId,
    isDragging,
    hotTarget,
    panelOverCellId,

    // Booleans
    isPanelDrag: activeType === DragType.PANEL,
    isContainerDrag: activeType === DragType.CONTAINER,
    isInstanceDrag: activeType === DragType.INSTANCE,
    isExternalDrag: [DragType.EXTERNAL, DragType.FILE, DragType.TEXT, DragType.URL].includes(activeType),

    // Getters
    getWorkingPanels,
    getWorkingAllPanels,
    getWorkingContainers,

    // Stack helpers
    getStacksByCell,
    getStackForPanel,
    setActivePanelInCell,
    cyclePanelStack,

    // Hit testing
    getHoveredPanelId,
    getHoveredContainerId,
  }), [
    handleDragStart, handleDragMove, handleDragOver, handleDrop, handleDragEnd,
    activePayload, activeType, activeId, isDragging, hotTarget, panelOverCellId,
    getWorkingPanels, getWorkingAllPanels, getWorkingContainers,
    getStacksByCell, getStackForPanel, setActivePanelInCell, cyclePanelStack,
    getHoveredPanelId, getHoveredContainerId,
  ]);

  return (
    <DragContext.Provider value={contextValue}>
      {children}
    </DragContext.Provider>
  );
}

export default DragProvider;
