// panels/NotebookPanel.jsx
// ============================================================
// Notebook panel with tree sidebar and doc view
// Uses Pragmatic DnD hitbox for tree drag-and-drop
// Blue line hover indicators consistent with rest of app
// ============================================================

import React, { useState, useMemo, useCallback, useContext, useRef, useEffect } from "react";
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GridActionsContext } from "../GridActionsContext";
import DocContainer from "../docs/DocContainer";
import * as CommitHelpers from "../helpers/CommitHelpers";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { attachClosestEdge, extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";

// Tree node component with expand/collapse and drop target
function TreeNode({
  item,
  level = 0,
  selectedId,
  onSelect,
  onAddChild,
  isExpanded,
  onToggleExpand,
  onDropOnItem,
}) {
  const nodeRef = useRef(null);
  const [closestEdge, setClosestEdge] = useState(null);
  const [isOver, setIsOver] = useState(false);

  const hasChildren = item.children && item.children.length > 0;
  const isSelected = selectedId === item.id;
  const expanded = isExpanded?.(item.id);

  const Icon = item.type === "folder"
    ? (expanded ? FolderOpen : Folder)
    : FileText;

  // Set up drop target with edge detection
  useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;

    return dropTargetForElements({
      element: el,
      getData: ({ input, element }) => {
        const data = { itemId: item.id, itemType: item.type };
        return attachClosestEdge(data, {
          element,
          input,
          allowedEdges: ["top", "bottom"],
        });
      },
      onDragEnter: ({ self }) => {
        setIsOver(true);
        setClosestEdge(extractClosestEdge(self.data));
      },
      onDrag: ({ self }) => {
        setClosestEdge(extractClosestEdge(self.data));
      },
      onDragLeave: () => {
        setIsOver(false);
        setClosestEdge(null);
      },
      onDrop: ({ source, self }) => {
        setIsOver(false);
        setClosestEdge(null);
        const edge = extractClosestEdge(self.data);
        onDropOnItem?.(source.data, item, edge);
      },
    });
  }, [item, onDropOnItem]);

  return (
    <div className="relative">
      {/* Top drop indicator - blue line */}
      {isOver && closestEdge === "top" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: level * 12 + 8,
            right: 4,
            height: 2,
            backgroundColor: "rgb(50, 150, 255)",
            borderRadius: 1,
            zIndex: 10,
          }}
        />
      )}

      <div
        ref={nodeRef}
        className={`
          flex items-center gap-1 px-2 py-1 cursor-pointer rounded-md
          hover:bg-accent/50 transition-colors group
          ${isSelected ? "bg-accent" : ""}
          ${isOver ? "bg-blue-500/10" : ""}
        `}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onSelect?.(item)}
      >
        {/* Expand/collapse chevron */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand?.(item.id);
            }}
            className="p-0.5 hover:bg-muted rounded"
          >
            {expanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-4" /> // Spacer
        )}

        {/* Icon */}
        <Icon className={`w-4 h-4 ${item.type === "folder" ? "text-amber-500" : "text-blue-400"}`} />

        {/* Label */}
        <span className="text-sm truncate flex-1">{item.label}</span>

        {/* Add button for folders */}
        {item.type === "folder" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddChild?.(item.id);
            }}
            className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-muted rounded"
          >
            <Plus className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Bottom drop indicator - blue line */}
      {isOver && closestEdge === "bottom" && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: level * 12 + 8,
            right: 4,
            height: 2,
            backgroundColor: "rgb(50, 150, 255)",
            borderRadius: 1,
            zIndex: 10,
          }}
        />
      )}

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {item.children.map((child) => (
            <TreeNode
              key={child.id}
              item={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddChild={onAddChild}
              isExpanded={isExpanded}
              onToggleExpand={onToggleExpand}
              onDropOnItem={onDropOnItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * NotebookSidebar - Collapsible tree view of docs
 */
function NotebookSidebar({
  items,
  selectedId,
  onSelect,
  onAddDoc,
  collapsed,
  onToggleCollapse,
  onDropOnItem,
}) {
  const [expandedIds, setExpandedIds] = useState(new Set(["day-pages", "docs"]));

  const isExpanded = useCallback((id) => expandedIds.has(id), [expandedIds]);

  const toggleExpand = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  if (collapsed) {
    return (
      <div
        className="w-8 border-r border-border bg-muted/30 flex flex-col items-center py-2 cursor-pointer hover:bg-muted/50"
        onClick={onToggleCollapse}
        title="Expand sidebar"
      >
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-48 border-r border-border bg-muted/30 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">Notebook</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddDoc}
            className="h-5 w-5 p-0"
            title="New Document"
          >
            <Plus className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="h-5 w-5 p-0"
            title="Collapse sidebar"
          >
            <ChevronDown className="w-3 h-3 rotate-90" />
          </Button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto py-1">
        {items.map((item) => (
          <TreeNode
            key={item.id}
            item={item}
            selectedId={selectedId}
            onSelect={onSelect}
            onAddChild={onAddDoc}
            isExpanded={isExpanded}
            onToggleExpand={toggleExpand}
            onDropOnItem={onDropOnItem}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * NotebookPanel - Panel with tree sidebar and doc editor
 *
 * Props:
 * - panel: The panel object
 * - containers: Doc containers in this panel
 * - dispatch, socket: For state updates
 */
export default function NotebookPanel({
  panel,
  containers = [],
  dispatch,
  socket,
  addContainerToPanel,
}) {
  const { occurrencesById, containersById } = useContext(GridActionsContext) || {};
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState(null);

  // Find occurrence for a container (within this panel)
  const findOccurrenceForContainer = useCallback((containerId) => {
    if (!occurrencesById || !panel.occurrences) return null;
    for (const occId of panel.occurrences) {
      const occ = occurrencesById[occId];
      if (occ && occ.targetType === "container" && occ.targetId === containerId) {
        return occ;
      }
    }
    return null;
  }, [occurrencesById, panel.occurrences]);

  // Build tree structure from containers
  // For now, flat list - can add folder hierarchy later
  const treeItems = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];

    // Day pages folder
    const dayPages = {
      id: "day-pages",
      type: "folder",
      label: "Day Pages",
      children: [
        { id: `day-${today}`, type: "doc", label: today },
      ],
    };

    // Docs folder with actual containers + their occurrences
    const docItems = containers
      .filter((c) => c.kind === "doc")
      .map((c) => {
        const occurrence = findOccurrenceForContainer(c.id);
        return {
          id: c.id,
          type: "doc",
          label: c.label || "Untitled",
          container: c,
          occurrence,
        };
      });

    const docsFolder = {
      id: "docs",
      type: "folder",
      label: "Documents",
      children: docItems,
    };

    return [dayPages, docsFolder];
  }, [containers, findOccurrenceForContainer]);

  // Get selected container and its occurrence
  const selectedContainer = useMemo(() => {
    if (!selectedDocId) return null;
    return containers.find((c) => c.id === selectedDocId);
  }, [selectedDocId, containers]);

  const selectedOccurrence = useMemo(() => {
    if (!selectedDocId) return null;
    return findOccurrenceForContainer(selectedDocId);
  }, [selectedDocId, findOccurrenceForContainer]);

  // Auto-select first doc if none selected
  React.useEffect(() => {
    if (!selectedDocId && containers.length > 0) {
      const firstDoc = containers.find((c) => c.kind === "doc");
      if (firstDoc) {
        setSelectedDocId(firstDoc.id);
      }
    }
  }, [selectedDocId, containers]);

  const handleSelect = useCallback((item) => {
    if (item.type === "doc" && item.container) {
      setSelectedDocId(item.container.id);
    }
  }, []);

  const handleAddDoc = useCallback(() => {
    // Add a new doc container to this panel
    addContainerToPanel?.(panel.id, "doc");
  }, [addContainerToPanel, panel.id]);

  // Create initial Tiptap doc content with a pill
  const createDocWithPill = useCallback((pillType, pillData) => {
    if (pillType === "instance") {
      return {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "instancePill",
                attrs: {
                  instanceId: pillData.instanceId,
                  instanceLabel: pillData.instanceLabel,
                  occurrenceId: pillData.occurrenceId || null,
                  containerId: pillData.containerId || null,
                  showIcon: true,
                },
              },
            ],
          },
        ],
      };
    } else if (pillType === "field") {
      return {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "fieldPill",
                attrs: {
                  fieldId: pillData.fieldId,
                  fieldName: pillData.fieldName,
                  fieldType: pillData.fieldType || "text",
                  fieldMode: pillData.fieldMode || "input",
                  showValue: true,
                  showLabel: true,
                },
              },
            ],
          },
        ],
      };
    }
    return null;
  }, []);

  // Handle drops on tree items (from docs, instances, etc.)
  const handleDropOnItem = useCallback((sourceData, targetItem, edge) => {
    console.log("Drop on tree:", { sourceData, targetItem, edge });

    // Check for instance drop - create new doc with instance pill
    if (sourceData.type === "instance") {
      const instance = sourceData.data || {};
      const instanceId = sourceData.id || instance.id;
      const instanceLabel = instance.label || "Item";
      const containerId = sourceData.context?.containerId;
      // Get occurrenceId from context (set by SortableInstance drag)
      const occurrenceId = sourceData.context?.occurrenceId || instance.occurrence?.id || null;

      // Create doc content with instance pill
      const docContent = createDocWithPill("instance", {
        instanceId,
        instanceLabel,
        occurrenceId,
        containerId,
      });

      // Create new doc container with this content
      // We need to extend addContainerToPanel to accept initial content
      // For now, create the container with a label based on the instance
      if (addContainerToPanel) {
        // Create a custom container with docContent
        const id = crypto.randomUUID();
        const container = {
          id,
          label: instanceLabel,
          kind: "doc",
          occurrences: [],
          docContent,
        };

        // Use dispatch/socket to create the container directly
        // This bypasses addContainerToPanel to set docContent
        CommitHelpers.createContainer({ dispatch, socket, container, emit: true });

        // Create occurrence and add to panel
        const occurrenceId = crypto.randomUUID();
        const occurrence = {
          id: occurrenceId,
          targetType: "container",
          targetId: container.id,
          parentId: panel.id,
          parentType: "panel",
          gridId: panel.gridId,
          persistent: true,
          createdAt: new Date().toISOString(),
        };

        dispatch({ type: "CREATE_OCCURRENCE", payload: { occurrence } });
        socket?.emit?.("create_occurrence", { occurrence });

        dispatch({
          type: "ADD_TO_PARENT",
          payload: { parentId: panel.id, parentType: "panel", occurrenceId },
        });
        socket?.emit?.("add_to_parent", {
          parentId: panel.id,
          parentType: "panel",
          occurrenceId,
        });

        // Select the new doc
        setSelectedDocId(container.id);
      }
    }

    // Check for field drop - similar handling
    if (sourceData.type === "field") {
      const field = sourceData.data || {};
      const fieldId = sourceData.id || field.id;
      const fieldName = field.name || "Field";

      const docContent = createDocWithPill("field", {
        fieldId,
        fieldName,
        fieldType: field.type,
        fieldMode: field.mode,
      });

      if (addContainerToPanel) {
        const id = crypto.randomUUID();
        const container = {
          id,
          label: fieldName,
          kind: "doc",
          occurrences: [],
          docContent,
        };

        CommitHelpers.createContainer({ dispatch, socket, container, emit: true });

        const occurrenceId = crypto.randomUUID();
        const occurrence = {
          id: occurrenceId,
          targetType: "container",
          targetId: container.id,
          parentId: panel.id,
          parentType: "panel",
          gridId: panel.gridId,
          persistent: true,
          createdAt: new Date().toISOString(),
        };

        dispatch({ type: "CREATE_OCCURRENCE", payload: { occurrence } });
        socket?.emit?.("create_occurrence", { occurrence });

        dispatch({
          type: "ADD_TO_PARENT",
          payload: { parentId: panel.id, parentType: "panel", occurrenceId },
        });
        socket?.emit?.("add_to_parent", {
          parentId: panel.id,
          parentType: "panel",
          occurrenceId,
        });

        setSelectedDocId(container.id);
      }
    }

    // TODO: Handle doc reordering in tree
  }, [addContainerToPanel, panel, dispatch, socket, createDocWithPill]);

  return (
    <div className="notebook-panel flex flex-1 min-h-0 overflow-hidden">
      {/* Sidebar */}
      <NotebookSidebar
        items={treeItems}
        selectedId={selectedDocId}
        onSelect={handleSelect}
        onAddDoc={handleAddDoc}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        onDropOnItem={handleDropOnItem}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
        {selectedContainer ? (
          <DocContainer
            container={selectedContainer}
            occurrence={selectedOccurrence}
            dispatch={dispatch}
            socket={socket}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a document or create a new one
          </div>
        )}
      </div>
    </div>
  );
}
