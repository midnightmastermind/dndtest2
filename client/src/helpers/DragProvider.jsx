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
  setupAutoScroll,
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
    occurrences: [...(p.occurrences || [])],
  }));
}

function deepCloneContainers(containers = []) {
  return containers.map((c) => ({ ...c, occurrences: [...(c.occurrences || [])] }));
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
  // Copy vs Move mode: 'move' = move occurrence, 'copy' = create new occurrence
  const [dragMode, setDragMode] = useState('move');

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
  const lastDropRef = useRef({ payload: null, containerId: null, timestamp: 0 });

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

  // Build occurrences lookup for finding occurrence IDs by target
  const occurrencesById = useMemo(() => {
    const map = Object.create(null);
    const occs = Array.isArray(state?.occurrences) ? state.occurrences : [];
    for (const occ of occs) {
      if (occ?.id) map[occ.id] = occ;
    }
    return map;
  }, [state?.occurrences]);

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
  const startSession = useCallback((payload, mode = 'move') => {
    const s = sessionRef.current;
    if (s.dragging) return;

    s.dragging = true;
    s.payload = payload;
    s.startPanels = deepClonePanels(basePanels);
    s.startContainers = deepCloneContainers(baseContainers);
    s.draftPanels = deepClonePanels(basePanels);
    s.draftContainers = deepCloneContainers(baseContainers);

    setActivePayload(payload);
    setDragMode(mode); // Set initial drag mode (move or copy)
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
  // Note: Preview mutations work with occurrence IDs now since containers/panels
  // store occurrences arrays. During preview, we track the occurrence being moved.
  const previewMoveInstance = useCallback(({ occurrenceId, toContainerId, toIndex }) => {
    const s = sessionRef.current;
    if (!s.draftContainers || !occurrenceId) return;

    for (const c of s.draftContainers) {
      c.occurrences = (c.occurrences || []).filter((id) => id !== occurrenceId);
    }

    const to = s.draftContainers.find((c) => c.id === toContainerId);
    if (!to) return;

    const occurrences = to.occurrences || [];
    if (toIndex != null && toIndex >= 0) {
      occurrences.splice(toIndex, 0, occurrenceId);
    } else {
      occurrences.push(occurrenceId);
    }
    to.occurrences = occurrences;
  }, []);

  const previewMoveContainer = useCallback(({ occurrenceId, toPanelId, toIndex }) => {
    const s = sessionRef.current;
    if (!s.draftPanels || !occurrenceId) return;

    for (const p of s.draftPanels) {
      p.occurrences = (p.occurrences || []).filter((id) => id !== occurrenceId);
    }

    const to = s.draftPanels.find((p) => p.id === toPanelId);
    if (!to) return;

    const occurrences = to.occurrences || [];
    if (toIndex != null && toIndex >= 0) {
      occurrences.splice(toIndex, 0, occurrenceId);
    } else {
      occurrences.push(occurrenceId);
    }
    to.occurrences = occurrences;
  }, []);

  // ============================================================
  // DRAG HANDLERS
  // ============================================================
  // Toggle drag mode between copy and move
  const toggleDragMode = useCallback(() => {
    setDragMode(prev => prev === 'move' ? 'copy' : 'move');
  }, []);

  const handleDragStart = useCallback((payload, clientX, clientY, options = {}) => {
    pointerRef.current = { x: clientX, y: clientY };

    // Determine initial mode from options or default to 'move'
    // Alt/Option key = copy mode
    const initialMode = options.mode || 'move';
    startSession(payload, initialMode);

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

      // Auto-scroll panel content when dragging instances/containers/external (not panels)
      const isDraggingPanel = s.payload?.type === DragType.PANEL;
      if (panelId && !isDraggingPanel) {
        const panelElement = document.querySelector(`[data-panel-id="${panelId}"]`);
        if (panelElement) {
          const panelRect = panelElement.getBoundingClientRect();
          const panelContent = panelElement.querySelector('.panel-content');

          if (panelContent && panelContent.scrollHeight > panelContent.clientHeight) {
            const scrollZone = 80; // Pixels from top/bottom to trigger scroll
            const scrollSpeed = 10; // Pixels per frame

            // Check if cursor is in top zone (including header)
            if (clientY < panelRect.top + scrollZone) {
              panelContent.scrollTop = Math.max(0, panelContent.scrollTop - scrollSpeed);
            }
            // Check if cursor is in bottom zone
            else if (clientY > panelRect.bottom - scrollZone) {
              panelContent.scrollTop = Math.min(
                panelContent.scrollHeight - panelContent.clientHeight,
                panelContent.scrollTop + scrollSpeed
              );
            }
          }
        }
      }

      // Live preview for instance sorting
      if (s.payload?.type === DragType.INSTANCE && containerId) {
        const toC = s.draftContainers?.find((c) => c.id === containerId);
        const fromC = s.startContainers?.find((c) => c.id === s.payload.context?.containerId);
        let toIndex = null;

        // Find the occurrence ID for the dragged instance
        const draggedOccId = fromC ? LayoutHelpers.findOccurrenceIdByTarget(
          s.payload.id,
          fromC.occurrences || [],
          occurrencesById
        ) : null;

        if (toC && instanceId && instanceId !== s.payload.id && draggedOccId) {
          // Find the index of hovered instance in target container
          const hoveredIndex = LayoutHelpers.getTargetIndexInOccurrences(
            instanceId,
            toC.occurrences || [],
            occurrencesById
          );

          if (hoveredIndex !== -1) {
            // Calculate edge from cursor position
            const instanceEl = document.querySelector(`[data-instance-id="${instanceId}"]`);
            if (instanceEl) {
              const rect = instanceEl.getBoundingClientRect();
              const { x, y } = pointerRef.current;

              // Determine container orientation
              const isHorizontal = toC.layout?.orientation === 'horizontal';

              // Calculate which side of the element we're on
              if (isHorizontal) {
                const midX = rect.left + rect.width / 2;
                const isLeft = x < midX;
                toIndex = isLeft ? hoveredIndex : hoveredIndex + 1;
              } else {
                const midY = rect.top + rect.height / 2;
                const isTop = y < midY;
                toIndex = isTop ? hoveredIndex : hoveredIndex + 1;
              }

              // Adjust if moving within same container
              if (fromC && fromC.id === toC.id) {
                const fromIndex = LayoutHelpers.getTargetIndexInOccurrences(
                  s.payload.id,
                  fromC.occurrences || [],
                  occurrencesById
                );
                if (fromIndex !== -1 && fromIndex < hoveredIndex) {
                  toIndex = Math.max(0, toIndex - 1);
                }
              }
            }
          }
        }

        if (draggedOccId) {
          previewMoveInstance({ occurrenceId: draggedOccId, toContainerId: containerId, toIndex });
        }
      }

      // Live preview for container sorting
      if (s.payload?.type === DragType.CONTAINER && panelId) {
        const toPanel = s.draftPanels?.find((p) => p.id === panelId);
        const fromPanel = s.startPanels?.find((p) => p.id === s.payload.context?.panelId);
        const hoveredContainerId = getHoveredContainerId();
        let toIndex = null;

        // Find the occurrence ID for the dragged container
        const draggedOccId = fromPanel ? LayoutHelpers.findOccurrenceIdByTarget(
          s.payload.id,
          fromPanel.occurrences || [],
          occurrencesById
        ) : null;

        if (toPanel && hoveredContainerId && hoveredContainerId !== s.payload.id && draggedOccId) {
          // Find the index of hovered container in target panel
          const hoveredIndex = LayoutHelpers.getTargetIndexInOccurrences(
            hoveredContainerId,
            toPanel.occurrences || [],
            occurrencesById
          );

          if (hoveredIndex !== -1) {
            // Calculate edge from cursor position - use 4-directional detection
            const containerEl = document.querySelector(`[data-container-id="${hoveredContainerId}"]`);
            if (containerEl) {
              const rect = containerEl.getBoundingClientRect();
              const { x, y } = pointerRef.current;

              // Calculate distances to all four edges
              const distanceToTop = Math.abs(y - rect.top);
              const distanceToBottom = Math.abs(y - rect.bottom);
              const distanceToLeft = Math.abs(x - rect.left);
              const distanceToRight = Math.abs(x - rect.right);

              // Find closest edge
              const minDistance = Math.min(distanceToTop, distanceToBottom, distanceToLeft, distanceToRight);
              let closestEdge;
              if (minDistance === distanceToTop) closestEdge = 'top';
              else if (minDistance === distanceToBottom) closestEdge = 'bottom';
              else if (minDistance === distanceToLeft) closestEdge = 'left';
              else closestEdge = 'right';

              // All edges use sequential insertion - layout determines visual arrangement
              if (closestEdge === 'top' || closestEdge === 'left') {
                toIndex = hoveredIndex;  // Insert before
              } else {
                toIndex = hoveredIndex + 1;  // Insert after
              }

              // Adjust if moving within same panel
              if (fromPanel && fromPanel.id === toPanel.id) {
                const fromIndex = LayoutHelpers.getTargetIndexInOccurrences(
                  s.payload.id,
                  fromPanel.occurrences || [],
                  occurrencesById
                );
                if (fromIndex !== -1 && fromIndex < hoveredIndex) {
                  toIndex = Math.max(0, toIndex - 1);
                }
              }
            }
          }
        }

        if (draggedOccId) {
          previewMoveContainer({ occurrenceId: draggedOccId, toPanelId: panelId, toIndex });
        }
      }

      onTick?.();
    });
  }, [getCellFromPoint, getHoveredPanelId, getHoveredContainerId, getHoveredInstanceId, previewMoveInstance, previewMoveContainer, occurrencesById, onTick]);

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

    // For external drops (files, text, URLs), there's no session, so use the source from dropTarget
    const payload = s?.payload || dropTarget?.source;

    if (!s.dragging && !payload) {
      clearSession();
      return;
    }

    // Update pointer position from drop event if available
    if (dropTarget.clientX !== undefined && dropTarget.clientY !== undefined) {
      pointerRef.current = { x: dropTarget.clientX, y: dropTarget.clientY };
    }

    const { x, y } = pointerRef.current;

    // Resolve targets from hit testing + drop target context
    const panelId = dropTarget.context?.panelId || getHoveredPanelId();
    const containerId = dropTarget.context?.containerId || getHoveredContainerId();
    const instanceId = dropTarget.context?.instanceId || getHoveredInstanceId();

    // ============================================================
    // DEDUPLICATION - Prevent multiple drop zones from handling the same drop
    // ============================================================
    const now = Date.now();
    const last = lastDropRef.current;
    const isDuplicate =
      last.payload === payload?.id &&
      last.containerId === containerId &&
      (now - last.timestamp) < 100; // 100ms window for duplicate detection

    if (isDuplicate) {
      return;
    }

    // Record this drop
    lastDropRef.current = {
      payload: payload?.id,
      containerId,
      timestamp: now,
    };

    // ============================================================
    // PANEL → CELL
    // ============================================================
    if (payload?.type === DragType.PANEL) {
      // Check if this is a cross-window drop
      let isCrossWindow = false;
      if (dropTarget.dataTransfer) {
        const parsed = parseExternalDrop(dropTarget.dataTransfer);
        isCrossWindow = parsed.isCrossWindow;
      }

      // Use grid cell context if available (from grid-cell drop zone), otherwise fall back to getCellFromPoint
      let cell = null;
      if (dropTarget.type === "grid-cell" && dropTarget.context?.row !== undefined && dropTarget.context?.col !== undefined) {
        cell = {
          row: dropTarget.context.row,
          col: dropTarget.context.col,
          cellId: dropTarget.context.cellId,
        };
      } else {
        cell = getCellFromPoint(x, y);
      }

      if (cell && isCrossWindow) {
        // Create a copy of the panel with all its containers and instances
        const sourcePanel = payload.data;
        const newPanelId = makeUUID();
        const newContainerIds = [];

        // Copy all containers and their instances
        const sourceContainers = sourcePanel?.containerObjects || [];
        sourceContainers.forEach(sourceContainer => {
          const newContainerId = makeUUID();
          newContainerIds.push(newContainerId);

          // Copy instances for this container
          const sourceInstances = sourceContainer?.instanceObjects || [];
          const newInstanceIds = [];

          sourceInstances.forEach(sourceInstance => {
            const newInstanceId = makeUUID();
            newInstanceIds.push(newInstanceId);
            const newInstance = {
              id: newInstanceId,
              label: sourceInstance.label || "Instance",
            };
            CommitHelpers.createInstance({ dispatch, socket, instance: newInstance, emit: true });
          });

          // Create the container with copied instances
          const newContainer = {
            id: newContainerId,
            label: sourceContainer.label || "Container",
            items: newInstanceIds,
          };
          CommitHelpers.createContainer({ dispatch, socket, container: newContainer, emit: true });
        });

        // Create the panel with copied containers
        const newPanel = {
          id: newPanelId,
          row: cell.row,
          col: cell.col,
          width: sourcePanel?.width || 1,
          height: sourcePanel?.height || 1,
          containers: newContainerIds,
          layout: sourcePanel?.layout || {},
        };
        CommitHelpers.createPanel({ dispatch, socket, panel: newPanel, emit: true });

        // Handle stack visibility for destination cell
        const destStack = baseAllPanels.filter((p) => p.row === cell.row && p.col === cell.col);
        destStack.forEach((p) => {
          LayoutHelpers.setPanelStackDisplay({ dispatch, socket, panel: p, display: "none", emit: true });
        });
      } else if (cell) {
        const panel = baseAllPanels.find((p) => p.id === payload.id);
        if (panel && (panel.row !== cell.row || panel.col !== cell.col)) {
          const fromRow = panel.row, fromCol = panel.col;
          const toRow = cell.row, toCol = cell.col;

          // Move panel and ensure it's visible in new position
          const movedPanel = {
            ...panel,
            row: toRow,
            col: toCol,
            layout: {
              ...(panel.layout || {}),
              style: {
                ...(panel.layout?.style || {}),
                display: "block",
              },
            },
          };
          CommitHelpers.updatePanel({
            dispatch, socket,
            panel: movedPanel,
            emit: true,
          });

          // Stack visibility management
          const allPanels = baseAllPanels;
          const sourceCellKey = `cell-${fromRow}-${fromCol}`;
          const destCellKey = `cell-${toRow}-${toCol}`;

          const sourceStack = allPanels.filter((p) => p.id !== payload.id && cellKeyFromPanel(p) === sourceCellKey);
          const destStack = allPanels.filter((p) => p.id !== payload.id && cellKeyFromPanel(p) === destCellKey);

          if (sourceStack.length > 0 && sourceStack[0]) {
            // Show the first remaining panel in the source stack
            LayoutHelpers.setPanelStackDisplay({ dispatch, socket, panel: sourceStack[0], display: "block", emit: true });
            // Hide all other panels in the source stack
            sourceStack.slice(1).forEach((p) => {
              if (p) {
                LayoutHelpers.setPanelStackDisplay({ dispatch, socket, panel: p, display: "none", emit: true });
              }
            });
          }

          // Hide all panels in the destination stack (the moved panel will be on top)
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
      // Check if this is a cross-window drop - if so, create a copy instead of moving
      let isCrossWindow = false;
      if (dropTarget.dataTransfer) {
        const parsed = parseExternalDrop(dropTarget.dataTransfer);
        isCrossWindow = parsed.isCrossWindow;
      }

      if (isCrossWindow) {
        // Create a copy of the container in the target panel with all its instances
        const sourceContainer = payload.data;
        const targetPanel = baseAllPanels.find((p) => p.id === panelId);
        if (!targetPanel) {
          clearSession();
          return;
        }

        // Get gridId from state
        const gridId = state?.gridId || state?.grid?._id;

        // Calculate insertion index using occurrences
        let toIndex = null;
        if (dropTarget.context?.insertAt !== undefined) {
          toIndex = dropTarget.context.insertAt;
        } else if (containerId) {
          const hoveredIndex = LayoutHelpers.getTargetIndexInOccurrences(
            containerId,
            targetPanel.occurrences || [],
            occurrencesById
          );
          if (hoveredIndex !== -1) {
            const edge = dropTarget.context?.closestEdge;
            if (edge === 'top' || edge === 'left') {
              toIndex = hoveredIndex;
            } else if (edge === 'bottom' || edge === 'right') {
              toIndex = hoveredIndex + 1;
            }
          }
        }

        // Create new container with occurrences (empty initially, instances will be added)
        const newContainerId = makeUUID();
        const newContainer = {
          id: newContainerId,
          label: sourceContainer?.label || "Container",
          occurrences: [], // Will be populated as instances are added
        };

        // Create the container with its occurrence in the panel
        LayoutHelpers.createContainerInPanel({
          dispatch, socket, gridId,
          panel: targetPanel,
          container: newContainer,
          index: toIndex,
          emit: true,
        });

        // Copy all instances from the source container and add to the new container
        const sourceInstanceObjects = sourceContainer?.instanceObjects || [];
        sourceInstanceObjects.forEach(sourceInstance => {
          const newInstanceId = makeUUID();
          const newInstance = {
            id: newInstanceId,
            label: sourceInstance.label || "Instance",
          };

          // Need to get the updated container from state - but since this is optimistic,
          // we can create the instance and occurrence directly
          LayoutHelpers.createInstanceInContainer({
            dispatch, socket, gridId,
            container: { ...newContainer, id: newContainerId },
            instance: newInstance,
            emit: true,
          });
        });
      } else {
        // Same-window drop - use move behavior
        // Use baseAllPanels (original state) NOT draftPanels (preview state)
        const all = baseAllPanels;
        const fromPanel = all.find((p) => p.id === payload.context?.panelId);
        const toPanel = all.find((p) => p.id === panelId);

        if (fromPanel && toPanel) {
          // Find the occurrence ID for the dragged container
          const draggedContainerId = payload.id;
          const occurrenceId = LayoutHelpers.findOccurrenceIdByTarget(
            draggedContainerId,
            fromPanel.occurrences || [],
            occurrencesById
          );

          if (!occurrenceId) {
            console.warn('[CONTAINER DROP] Could not find occurrence for container:', draggedContainerId);
            clearSession();
            return;
          }

          let toIndex = null;

          // Check for explicit insertion index (e.g., panel header drop = 0)
          if (dropTarget.context?.insertAt !== undefined) {
            toIndex = dropTarget.context.insertAt;
          } else if (containerId) {
            // Dropping over a specific container - calculate insertion based on edge
            const hoveredIndex = LayoutHelpers.getTargetIndexInOccurrences(
              containerId,
              toPanel.occurrences || [],
              occurrencesById
            );

            if (hoveredIndex !== -1) {
              const edge = dropTarget.context?.closestEdge;

              if (edge === 'top' || edge === 'left') {
                toIndex = hoveredIndex;  // Insert before
              } else if (edge === 'bottom' || edge === 'right') {
                toIndex = hoveredIndex + 1;  // Insert after
              }

              // Adjust index if moving within same panel
              if (fromPanel.id === toPanel.id) {
                const fromIndex = LayoutHelpers.getTargetIndexInOccurrences(
                  draggedContainerId,
                  fromPanel.occurrences || [],
                  occurrencesById
                );
                if (fromIndex !== -1 && fromIndex < hoveredIndex) {
                  toIndex = Math.max(0, toIndex - 1);
                }
              }
            }
          }
          // else: toIndex stays null, which means append to end

          // Get gridId for creating new occurrences
          const gridId = state?.gridId || state?.grid?._id;

          // Check if we're in copy mode
          const isCopyMode = dragMode === 'copy';

          if (isCopyMode) {
            // COPY MODE: Create new occurrence for the container in target panel
            // Source occurrence remains intact
            LayoutHelpers.copyContainerToPanel({
              dispatch,
              socket,
              gridId,
              sourceContainerId: draggedContainerId,
              toPanel,
              toIndex,
              emit: true,
            });
          } else if (fromPanel.id === toPanel.id) {
            // MOVE MODE: Same panel - use reorder helper
            const fromIndex = LayoutHelpers.getTargetIndexInOccurrences(
              draggedContainerId,
              fromPanel.occurrences || [],
              occurrencesById
            );

            if (fromIndex !== -1) {
              // If toIndex is null, append to end
              const finalToIndex = toIndex !== null ? toIndex : (fromPanel.occurrences || []).length;

              if (fromIndex !== finalToIndex) {
                LayoutHelpers.reorderContainersInPanel({
                  dispatch, socket, panel: fromPanel,
                  fromIndex,
                  toIndex: finalToIndex,
                  emit: true,
                });
              }
            }
          } else {
            // MOVE MODE: Cross-panel move (pass occurrence ID, not container ID)
            LayoutHelpers.moveContainerBetweenPanels({
              dispatch, socket, fromPanel, toPanel,
              occurrenceId,
              toIndex,  // null = append to end
              emit: true,
            });
          }
        }
      }
    }

    // ============================================================
    // INSTANCE → CONTAINER (MOVE BEHAVIOR - no duplication in same window)
    // ============================================================
    if (payload?.type === DragType.INSTANCE && containerId) {
      // Skip if this is a cross-window drop - let CROSS-WINDOW handler deal with it
      if (dropTarget.dataTransfer) {
        const parsed = parseExternalDrop(dropTarget.dataTransfer);
        if (parsed.isCrossWindow) {
          // Let CROSS-WINDOW handler process this - don't clear session yet
          return;
        }
      }

      // Use baseContainers (original state) NOT draftContainers (preview state)
      const fromC = baseContainers.find((c) => c.id === payload.context?.containerId);
      const toC = baseContainers.find((c) => c.id === containerId);

      if (fromC && toC) {
        // Find the occurrence ID for the dragged instance
        const draggedInstanceId = payload.id;
        const occurrenceId = LayoutHelpers.findOccurrenceIdByTarget(
          draggedInstanceId,
          fromC.occurrences || [],
          occurrencesById
        );

        if (!occurrenceId) {
          console.warn('[INSTANCE DROP] Could not find occurrence for instance:', draggedInstanceId);
          clearSession();
          return;
        }

        let toIndex = null;

        // Check if drop target specifies explicit insertion index (e.g., header drop = 0)
        if (dropTarget.context?.insertAt !== undefined) {
          toIndex = dropTarget.context.insertAt;
        } else if (instanceId && toC) {
          // Find the index of the hovered instance in the target container's occurrences
          const hoveredIndex = LayoutHelpers.getTargetIndexInOccurrences(
            instanceId,
            toC.occurrences || [],
            occurrencesById
          );

          if (hoveredIndex !== -1) {
            // Extract edge from drop target context
            const edge = dropTarget.context?.closestEdge;

            // Determine insertion position based on edge
            if (edge === 'top' || edge === 'left') {
              toIndex = hoveredIndex;  // Insert before
            } else if (edge === 'bottom' || edge === 'right') {
              toIndex = hoveredIndex + 1;  // Insert after
            } else {
              toIndex = hoveredIndex;
            }

            // For same-container drops, adjust for removal of source item
            if (fromC.id === toC.id) {
              const fromIndex = LayoutHelpers.getTargetIndexInOccurrences(
                draggedInstanceId,
                fromC.occurrences || [],
                occurrencesById
              );
              if (fromIndex !== -1 && fromIndex < hoveredIndex) {
                toIndex = Math.max(0, toIndex - 1);
              }
            }
          }
        }

        // Get gridId for creating new occurrences
        const gridId = state?.gridId || state?.grid?._id;

        // Check if we're in copy mode
        const isCopyMode = dragMode === 'copy';

        if (isCopyMode) {
          // COPY MODE: Create a new occurrence in the target container
          // Source occurrence remains intact
          LayoutHelpers.copyInstanceToContainer({
            dispatch,
            socket,
            gridId,
            sourceInstanceId: draggedInstanceId,
            toContainer: toC,
            toIndex,
            emit: true,
          });
        } else if (fromC.id === toC.id) {
          // MOVE MODE: Same container - reorder
          const fromIndex = LayoutHelpers.getTargetIndexInOccurrences(
            draggedInstanceId,
            fromC.occurrences || [],
            occurrencesById
          );
          if (fromIndex !== -1) {
            const finalToIndex = toIndex !== null ? toIndex : (fromC.occurrences || []).length;
            if (fromIndex !== finalToIndex) {
              LayoutHelpers.reorderInstancesInContainer({
                dispatch,
                socket,
                container: fromC,
                fromIndex,
                toIndex: finalToIndex,
                emit: true,
              });
            }
          }
        } else {
          // MOVE MODE: Different containers - move (pass occurrence ID, not instance ID)
          LayoutHelpers.moveInstanceBetweenContainers({
            dispatch,
            socket,
            fromContainer: fromC,
            toContainer: toC,
            occurrenceId,
            toIndex,
            emit: true,
          });
        }
      }
    }

    // ============================================================
    // EXTERNAL (FILE/TEXT/URL) → CONTAINER
    // ============================================================
    if ([DragType.FILE, DragType.TEXT, DragType.URL, DragType.EXTERNAL].includes(payload?.type) && containerId) {
      let label = "Untitled";
      if (payload.type === DragType.FILE) label = payload.data?.name || "File";
      else if (payload.type === DragType.TEXT) label = (payload.data?.text || "").slice(0, 80) || "Text";
      else if (payload.type === DragType.URL) label = payload.data?.url || "Link";

      const id = makeUUID();
      let toIndex = dropTarget.context?.insertAt ?? null;

      const container = baseContainers.find((c) => c.id === containerId);
      if (!container) {
        clearSession();
        return;
      }

      // Find nearest instance based on cursor position using occurrences
      if (toIndex === null) {
        const occurrenceIds = container.occurrences || [];

        if (occurrenceIds.length > 0) {
          let nearestIndex = 0;
          let nearestDistance = Infinity;

          // Find the nearest instance based on cursor position
          occurrenceIds.forEach((occId, index) => {
            const occ = occurrencesById[occId];
            if (occ && occ.targetType === 'instance') {
              const el = document.querySelector(`[data-instance-id="${occ.targetId}"]`);
              if (el) {
                const rect = el.getBoundingClientRect();
                const centerY = rect.top + rect.height / 2;
                const distance = Math.abs(y - centerY);

                if (distance < nearestDistance) {
                  nearestDistance = distance;
                  nearestIndex = index;
                }
              }
            }
          });

          // Determine if cursor is above or below the nearest instance
          const nearestOcc = occurrencesById[occurrenceIds[nearestIndex]];
          if (nearestOcc) {
            const nearestEl = document.querySelector(`[data-instance-id="${nearestOcc.targetId}"]`);
            if (nearestEl) {
              const rect = nearestEl.getBoundingClientRect();
              const centerY = rect.top + rect.height / 2;

              if (y < centerY) {
                toIndex = nearestIndex;  // Insert before
              } else {
                toIndex = nearestIndex + 1;  // Insert after
              }
            }
          }
        }
      }

      // Get gridId from state
      const gridId = state?.gridId || state?.grid?._id;

      LayoutHelpers.createInstanceInContainer({
        dispatch, socket, gridId,
        container,
        instance: { id, label },
        index: toIndex,
        emit: true,
      });
    }

    // ============================================================
    // CROSS-WINDOW DROP
    // ============================================================
    if (dropTarget.dataTransfer && containerId) {
      const parsed = parseExternalDrop(dropTarget.dataTransfer);

      // Handle cross-window instance drops
      if (parsed.isCrossWindow && parsed.type === DragType.INSTANCE) {
        const id = makeUUID();
        let toIndex = dropTarget.context?.insertAt ?? null;

        const container = baseContainers.find((c) => c.id === containerId);
        if (!container) {
          clearSession();
          return;
        }

        // Find nearest instance based on cursor position using occurrences
        if (toIndex === null) {
          const occurrenceIds = container.occurrences || [];

          if (occurrenceIds.length > 0) {
            let nearestIndex = 0;
            let nearestDistance = Infinity;

            // Find the nearest instance based on cursor position
            occurrenceIds.forEach((occId, index) => {
              const occ = occurrencesById[occId];
              if (occ && occ.targetType === 'instance') {
                const el = document.querySelector(`[data-instance-id="${occ.targetId}"]`);
                if (el) {
                  const rect = el.getBoundingClientRect();
                  const centerY = rect.top + rect.height / 2;
                  const distance = Math.abs(y - centerY);

                  if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestIndex = index;
                  }
                }
              }
            });

            // Determine if cursor is above or below the nearest instance
            const nearestOcc = occurrencesById[occurrenceIds[nearestIndex]];
            if (nearestOcc) {
              const nearestEl = document.querySelector(`[data-instance-id="${nearestOcc.targetId}"]`);
              if (nearestEl) {
                const rect = nearestEl.getBoundingClientRect();
                const centerY = rect.top + rect.height / 2;

                if (y < centerY) {
                  toIndex = nearestIndex;  // Insert before
                } else {
                  toIndex = nearestIndex + 1;  // Insert after
                }
              }
            }
          }
        }

        // Get gridId from state
        const gridId = state?.gridId || state?.grid?._id;

        const label = parsed.meta?.label || parsed.data?.label || "Untitled";
        LayoutHelpers.createInstanceInContainer({
          dispatch, socket, gridId,
          container,
          instance: { id, label },
          index: toIndex,
          emit: true,
        });
      }
    }

    clearSession();
  }, [dispatch, socket, getCellFromPoint, getHoveredPanelId, getHoveredContainerId, getHoveredInstanceId, baseAllPanels, baseContainers, occurrencesById, clearSession, state]);

  const handleDragEnd = useCallback(() => {
    clearSession();
  }, [clearSession]);

  // ============================================================
  // EXTERNAL DRAG DETECTION - Removed (handled by Pragmatic)
  // ============================================================
  // Native grid listeners removed - Pragmatic Drag and Drop handles all events
  // External drags (files/text/URLs) are now handled through Pragmatic's
  // dropTargetForElements with dataTransfer passed through nativeEvent

  // ============================================================
  // AUTO SCROLL SETUP (Pragmatic Drag and Drop)
  // ============================================================
  useEffect(() => {
    const cleanup = setupAutoScroll();
    return cleanup;
  }, []);

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

    // Copy/Move mode
    dragMode,
    setDragMode,
    toggleDragMode,
    isCopyMode: dragMode === 'copy',
    isMoveMode: dragMode === 'move',

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
    dragMode, toggleDragMode,
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
