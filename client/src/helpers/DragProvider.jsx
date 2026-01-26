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
        let toIndex = null;

        if (toC && instanceId && instanceId !== s.payload.id) {
          const items = toC.items || [];
          const hoveredIndex = items.indexOf(instanceId);

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
              const fromC = s.startContainers?.find((c) => c.id === s.payload.context?.containerId);
              if (fromC && fromC.id === toC.id) {
                const fromIndex = items.indexOf(s.payload.id);
                if (fromIndex !== -1 && fromIndex < hoveredIndex) {
                  toIndex = Math.max(0, toIndex - 1);
                }
              }
            }
          }
        }

        previewMoveInstance({ instanceId: s.payload.id, toContainerId: containerId, toIndex });
      }

      // Live preview for container sorting
      if (s.payload?.type === DragType.CONTAINER && panelId) {
        const toPanel = s.draftPanels?.find((p) => p.id === panelId);
        const hoveredContainerId = getHoveredContainerId();
        let toIndex = null;

        if (toPanel && hoveredContainerId && hoveredContainerId !== s.payload.id) {
          const containerList = toPanel.containers || [];
          const hoveredIndex = containerList.indexOf(hoveredContainerId);

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
              const fromPanel = s.startPanels?.find((p) => p.id === s.payload.context?.panelId);
              if (fromPanel && fromPanel.id === toPanel.id) {
                const fromIndex = containerList.indexOf(s.payload.id);
                if (fromIndex !== -1 && fromIndex < hoveredIndex) {
                  toIndex = Math.max(0, toIndex - 1);
                }
              }
            }
          }
        }

        previewMoveContainer({ containerId: s.payload.id, toPanelId: panelId, toIndex });
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
        const newContainerId = makeUUID();

        // Copy all instances from the source container
        const sourceInstanceObjects = sourceContainer?.instanceObjects || [];
        const newInstanceIds = [];

        // Create new instances
        sourceInstanceObjects.forEach(sourceInstance => {
          const newInstanceId = makeUUID();
          newInstanceIds.push(newInstanceId);
          const newInstance = {
            id: newInstanceId,
            label: sourceInstance.label || "Instance",
          };
          CommitHelpers.createInstance({ dispatch, socket, instance: newInstance, emit: true });
        });

        const newContainer = {
          id: newContainerId,
          label: sourceContainer?.label || "Container",
          items: newInstanceIds,
        };

        // Calculate insertion index
        let toIndex = null;
        if (dropTarget.context?.insertAt !== undefined) {
          toIndex = dropTarget.context.insertAt;
        } else if (containerId) {
          const toPanel = baseAllPanels.find((p) => p.id === panelId);
          if (toPanel) {
            const containerList = toPanel.containers || [];
            const hoveredIndex = containerList.indexOf(containerId);
            if (hoveredIndex !== -1) {
              const edge = dropTarget.context?.closestEdge;
              if (edge === 'top' || edge === 'left') {
                toIndex = hoveredIndex;
              } else if (edge === 'bottom' || edge === 'right') {
                toIndex = hoveredIndex + 1;
              }
            }
          }
        }

        // Create the container and add it to the panel
        CommitHelpers.createContainer({ dispatch, socket, container: newContainer, emit: true });
        const targetPanel = baseAllPanels.find((p) => p.id === panelId);
        if (targetPanel) {
          LayoutHelpers.addContainerToPanel({
            dispatch, socket,
            panel: targetPanel,
            containerId: newContainerId,
            index: toIndex,
            emit: true,
          });
        }
      } else {
        // Same-window drop - use move behavior
        // Use baseAllPanels (original state) NOT draftPanels (preview state)
        const all = baseAllPanels;
        const fromPanel = all.find((p) => p.id === payload.context?.panelId);
        const toPanel = all.find((p) => p.id === panelId);

        if (fromPanel && toPanel) {
          let toIndex = null;

          // Check for explicit insertion index (e.g., panel header drop = 0)
          if (dropTarget.context?.insertAt !== undefined) {
            toIndex = dropTarget.context.insertAt;
          } else if (containerId) {
            // Dropping over a specific container - calculate insertion based on edge
            const containerList = toPanel.containers || [];
            const hoveredIndex = containerList.indexOf(containerId);

            if (hoveredIndex !== -1) {
              const edge = dropTarget.context?.closestEdge;

              if (edge === 'top' || edge === 'left') {
                toIndex = hoveredIndex;  // Insert before
              } else if (edge === 'bottom' || edge === 'right') {
                toIndex = hoveredIndex + 1;  // Insert after
              }

              // Adjust index if moving within same panel
              if (fromPanel.id === toPanel.id) {
                const fromIndex = containerList.indexOf(payload.id);
                if (fromIndex !== -1 && fromIndex < hoveredIndex) {
                  toIndex = Math.max(0, toIndex - 1);
                }
              }
            }
          }
          // else: toIndex stays null, which means append to end

          // Execute the move
          if (fromPanel.id === toPanel.id) {
            // Same panel - use reorder helper
            const containerList = fromPanel.containers || [];
            const fromIndex = containerList.indexOf(payload.id);

            if (fromIndex !== -1) {
              // If toIndex is null, append to end
              const finalToIndex = toIndex !== null ? toIndex : containerList.length;

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
            // Cross-panel move
            LayoutHelpers.moveContainerBetweenPanels({
              dispatch, socket, fromPanel, toPanel,
              containerId: payload.id,
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
        let toIndex = null;

        // Check if drop target specifies explicit insertion index (e.g., header drop = 0)
        if (dropTarget.context?.insertAt !== undefined) {
          toIndex = dropTarget.context.insertAt;
        } else if (instanceId && toC) {
          const items = toC.items || [];
          const hoveredIndex = items.indexOf(instanceId);

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
              const fromIndex = items.indexOf(payload.id);
              if (fromIndex !== -1 && fromIndex < hoveredIndex) {
                toIndex = Math.max(0, toIndex - 1);
              }
            }
          }
        }

        // MOVE BEHAVIOR: Move the instance (no duplication in same window)
        if (fromC.id === toC.id) {
          // Same container - reorder
          const items = fromC.items || [];
          const fromIndex = items.indexOf(payload.id);
          if (fromIndex !== -1) {
            const finalToIndex = toIndex !== null ? toIndex : items.length;
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
          // Different containers - move
          LayoutHelpers.moveInstanceBetweenContainers({
            dispatch,
            socket,
            fromContainer: fromC,
            toContainer: toC,
            instanceId: payload.id,
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

      console.log('[EXTERNAL DROP] Starting calculation:', { x, y, containerId, insertAt: dropTarget.context?.insertAt });

      // Always find nearest instance based on cursor position (more reliable than hover detection)
      if (toIndex === null) {
        const container = baseContainers.find((c) => c.id === containerId);
        if (container) {
          const items = container.items || [];
          console.log('[EXTERNAL DROP] Found container with items:', items);

          if (items.length > 0) {
            let nearestIndex = 0;
            let nearestDistance = Infinity;

            // Find the nearest instance based on cursor position
            items.forEach((itemId, index) => {
              const el = document.querySelector(`[data-instance-id="${itemId}"]`);
              if (el) {
                const rect = el.getBoundingClientRect();
                const centerY = rect.top + rect.height / 2;
                const distance = Math.abs(y - centerY);

                console.log(`[EXTERNAL DROP] Instance ${index} (${itemId}):`, {
                  top: rect.top,
                  bottom: rect.bottom,
                  centerY,
                  cursorY: y,
                  distance
                });

                if (distance < nearestDistance) {
                  nearestDistance = distance;
                  nearestIndex = index;
                }
              }
            });

            console.log('[EXTERNAL DROP] Nearest instance:', { nearestIndex, nearestDistance });

            // Determine if cursor is above or below the nearest instance
            const nearestEl = document.querySelector(`[data-instance-id="${items[nearestIndex]}"]`);
            if (nearestEl) {
              const rect = nearestEl.getBoundingClientRect();
              const centerY = rect.top + rect.height / 2;

              if (y < centerY) {
                toIndex = nearestIndex;  // Insert before
                console.log('[EXTERNAL DROP] Cursor above center, inserting before:', toIndex);
              } else {
                toIndex = nearestIndex + 1;  // Insert after
                console.log('[EXTERNAL DROP] Cursor below center, inserting after:', toIndex);
              }
            }
          }
        }
      }

      console.log('[EXTERNAL DROP] Final toIndex:', toIndex);

      LayoutHelpers.createInstanceInContainer({
        dispatch, socket, containerId,
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

        console.log('[CROSS-WINDOW DROP] Starting calculation:', { x, y, containerId, insertAt: dropTarget.context?.insertAt });

        // Always find nearest instance based on cursor position (more reliable than hover detection)
        if (toIndex === null) {
          const container = baseContainers.find((c) => c.id === containerId);
          if (container) {
            const items = container.items || [];
            console.log('[CROSS-WINDOW DROP] Found container with items:', items);

            if (items.length > 0) {
              let nearestIndex = 0;
              let nearestDistance = Infinity;

              // Find the nearest instance based on cursor position
              items.forEach((itemId, index) => {
                const el = document.querySelector(`[data-instance-id="${itemId}"]`);
                if (el) {
                  const rect = el.getBoundingClientRect();
                  const centerY = rect.top + rect.height / 2;
                  const distance = Math.abs(y - centerY);

                  console.log(`[CROSS-WINDOW DROP] Instance ${index} (${itemId}):`, {
                    top: rect.top,
                    bottom: rect.bottom,
                    centerY,
                    cursorY: y,
                    distance
                  });

                  if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestIndex = index;
                  }
                }
              });

              console.log('[CROSS-WINDOW DROP] Nearest instance:', { nearestIndex, nearestDistance });

              // Determine if cursor is above or below the nearest instance
              const nearestEl = document.querySelector(`[data-instance-id="${items[nearestIndex]}"]`);
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

        const label = parsed.meta?.label || parsed.data?.label || "Untitled";
        LayoutHelpers.createInstanceInContainer({
          dispatch, socket, containerId,
          instance: { id, label },
          index: toIndex,
          emit: true,
        });
      }
    }

    clearSession();
  }, [dispatch, socket, getCellFromPoint, getHoveredPanelId, getHoveredContainerId, getHoveredInstanceId, baseAllPanels, baseContainers, clearSession, state]);

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
