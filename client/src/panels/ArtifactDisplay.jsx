// panels/ArtifactDisplay.jsx
// ============================================================
// Artifact display panel with tree sidebar and content view.
// Now reads from real Folder/Doc/Artifact models via context
// instead of building a hardcoded tree from containers.
// ============================================================

import React, { useState, useMemo, useCallback, useContext, useRef, useEffect } from "react";
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, Plus, Calendar, Image, Film, Music, File, Upload, FolderPlus } from "lucide-react";
import { uid } from "../uid";
import { Button } from "@/components/ui/button";
import { GridActionsContext } from "../GridActionsContext";
import DocContainer from "../docs/DocContainer";
import MediaContainer from "./MediaContainer";
import * as CommitHelpers from "../helpers/CommitHelpers";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { attachClosestEdge, extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";

// ============================================================
// ICONS for artifact types
// ============================================================
const artifactIcons = {
  image: Image,
  video: Film,
  audio: Music,
  pdf: FileText,
  file: File,
  other: File,
};

// ============================================================
// TREE NODE — individual node in the sidebar tree
// ============================================================
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

  // Pick the right icon
  let Icon;
  if (item.type === "folder") {
    Icon = expanded ? FolderOpen : Folder;
  } else if (item.type === "doc") {
    Icon = item.docType === "day-page" ? Calendar : FileText;
  } else {
    Icon = artifactIcons[item.artifactType] || File;
  }

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
      {/* Top drop indicator */}
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
        onDoubleClick={() => onSelect?.(item, true)}
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
          <span className="w-4" />
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

      {/* Bottom drop indicator */}
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

// ============================================================
// ARTIFACT SIDEBAR — collapsible tree built from real models
// ============================================================
function ArtifactSidebar({
  items,
  selectedId,
  onSelect,
  onAddDoc,
  collapsed,
  onToggleCollapse,
  onDropOnItem,
}) {
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Auto-expand root-level folders
  useEffect(() => {
    const rootIds = items.map((i) => i.id);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      rootIds.forEach((id) => next.add(id));
      return next;
    });
  }, [items]);

  const isExpanded = useCallback((id) => expandedIds.has(id), [expandedIds]);

  const toggleExpand = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
        <span className="text-xs font-medium text-muted-foreground">Files</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddDoc?.(null)}
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

// ============================================================
// FOLDER GRID — file-manager grid view for folder contents
// ============================================================
function FolderGrid({ folder, items, onSelect, onUpload, onCreateFolder, onCreateDoc }) {
  const handleFileInput = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => onUpload?.(f));
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("bg-primary/5");
    const files = Array.from(e.dataTransfer?.files || []);
    files.forEach(f => onUpload?.(f));
  };

  const getItemIcon = (item) => {
    if (item._type === "folder") return <Folder className="h-10 w-10 text-amber-500" />;
    if (item._type === "doc") return <FileText className="h-10 w-10 text-blue-400" />;
    if (item.artifactType === "image" && item.storagePath) {
      return <img src={item.storagePath} className="h-10 w-10 object-cover rounded" alt="" />;
    }
    if (item.artifactType === "video") return <Film className="h-10 w-10 text-purple-400" />;
    if (item.artifactType === "audio") return <Music className="h-10 w-10 text-green-400" />;
    return <File className="h-10 w-10 text-muted-foreground" />;
  };

  return (
    <div
      className="flex-1 flex flex-col min-h-0 overflow-hidden"
      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("bg-primary/5"); }}
      onDragLeave={(e) => { e.currentTarget.classList.remove("bg-primary/5"); }}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20 shrink-0">
        <span className="text-sm font-medium truncate flex-1">{folder?.name || "Files"}</span>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCreateFolder}>
          <FolderPlus className="h-3 w-3 mr-1" /> Folder
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCreateDoc}>
          <FileText className="h-3 w-3 mr-1" /> Doc
        </Button>
        <label className="cursor-pointer">
          <input type="file" className="hidden" multiple onChange={handleFileInput} />
          <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
            <span><Upload className="h-3 w-3 mr-1" /> Upload</span>
          </Button>
        </label>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              onDoubleClick={() => onSelect(item, true)}
              className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors text-center"
            >
              {getItemIcon(item)}
              <span className="text-[11px] truncate w-full">{item.name || item.title || "Untitled"}</span>
            </button>
          ))}
          {items.length === 0 && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-8">
              Drop files here or click Upload
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ARTIFACT DISPLAY — main component
// ============================================================
export default function ArtifactDisplay({
  panel,
  view,
  manifest,
  containers = [],
  dispatch,
  socket,
  addContainerToPanel,
}) {
  const {
    occurrencesById,
    docsById,
    foldersById,
    artifactsById,
    state,
  } = useContext(GridActionsContext);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(view?.sidebarCollapsed || false);
  const [selectedItemId, setSelectedItemId] = useState(view?.activeDocId || view?.activeArtifactId || null);
  const [selectedItemType, setSelectedItemType] = useState(view?.activeDocId ? "doc" : view?.activeArtifactId ? "artifact" : null);
  const [selectedFolderId, setSelectedFolderId] = useState(manifest?.rootFolderId || null);

  const gridId = state?.gridId;
  const userId = state?.userId;
  const showTree = view?.showTree !== false; // default true
  const isFileManager = view?.viewType === "file-manager";

  // ============================================================
  // BUILD TREE from real Folder/Doc/Artifact models
  // ============================================================
  const treeItems = useMemo(() => {
    const rootFolderId = manifest?.rootFolderId;

    // Get all folders, docs, artifacts for this grid
    const allFolders = Object.values(foldersById);
    const allDocs = Object.values(docsById);
    const allArtifacts = Object.values(artifactsById);

    // Recursive tree builder
    function buildNode(folderId) {
      const folder = foldersById[folderId];
      if (!folder) return null;

      // Child folders
      const childFolders = allFolders
        .filter((f) => f.parentId === folderId)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      // Docs in this folder
      const childDocs = allDocs
        .filter((d) => d.folderId === folderId && !d.isDeleted)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      // Artifacts in this folder
      const childArtifacts = allArtifacts
        .filter((a) => a.folderId === folderId && !a.isDeleted)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      const children = [
        ...childFolders.map((f) => buildNode(f.id)).filter(Boolean),
        ...childDocs.map((d) => ({
          id: d.id,
          type: "doc",
          label: d.title || "Untitled",
          docType: d.docType,
          doc: d,
        })),
        ...childArtifacts.map((a) => ({
          id: a.id,
          type: "artifact",
          label: a.name || "Unnamed",
          artifactType: a.artifactType,
          artifact: a,
        })),
      ];

      return {
        id: folder.id,
        type: "folder",
        label: folder.name || "Folder",
        folderType: folder.folderType,
        folder,
        children,
      };
    }

    // If we have a manifest with a root folder, build from that
    if (rootFolderId && foldersById[rootFolderId]) {
      const rootNode = buildNode(rootFolderId);
      // Return the root's children (don't show root itself)
      return rootNode?.children || [];
    }

    // Fallback: if no manifest/folders, build from containers (legacy)
    if (allFolders.length === 0 && allDocs.length === 0) {
      const today = new Date().toISOString().split("T")[0];
      const docItems = containers
        .filter((c) => c.kind === "doc")
        .map((c) => ({
          id: c.id,
          type: "doc",
          label: c.label || "Untitled",
          docType: "normal",
          container: c,
        }));

      return [
        {
          id: "day-pages",
          type: "folder",
          label: "Day Pages",
          folderType: "day-pages",
          children: [{ id: `day-${today}`, type: "doc", label: today, docType: "day-page" }],
        },
        {
          id: "docs",
          type: "folder",
          label: "Documents",
          folderType: "normal",
          children: docItems,
        },
      ];
    }

    // If folders exist but no manifest, show top-level folders (parentId === null)
    const topFolders = allFolders
      .filter((f) => !f.parentId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    if (topFolders.length > 0) {
      return topFolders.map((f) => buildNode(f.id)).filter(Boolean);
    }

    // Last resort: show all docs flat
    return allDocs.map((d) => ({
      id: d.id,
      type: "doc",
      label: d.title || "Untitled",
      docType: d.docType,
      doc: d,
    }));
  }, [manifest, foldersById, docsById, artifactsById, containers]);

  // ============================================================
  // SELECTED ITEM — resolve doc or artifact for content viewer
  // ============================================================
  const selectedDoc = useMemo(() => {
    if (selectedItemType === "doc" && selectedItemId) {
      return docsById[selectedItemId] || null;
    }
    return null;
  }, [selectedItemId, selectedItemType, docsById]);

  const selectedArtifact = useMemo(() => {
    if (selectedItemType === "artifact" && selectedItemId) {
      return artifactsById[selectedItemId] || null;
    }
    return null;
  }, [selectedItemId, selectedItemType, artifactsById]);

  // Find real occurrence for selected doc (targetType: "doc")
  const docOccurrence = useMemo(() => {
    if (!selectedDoc) return null;
    return Object.values(occurrencesById).find(
      (o) => o.targetType === "doc" && o.targetId === selectedDoc.id
    ) || null;
  }, [selectedDoc, occurrencesById]);

  // Legacy: find container + occurrence for selected doc (if using container-based docs)
  const selectedContainer = useMemo(() => {
    if (!selectedDoc || docOccurrence) return null; // skip if we have a real doc occurrence
    // Check if there's a container backing this doc
    return containers.find((c) => c.id === selectedItemId) || null;
  }, [selectedDoc, selectedItemId, containers, docOccurrence]);

  const selectedOccurrence = useMemo(() => {
    if (!selectedContainer) return null;
    return Object.values(occurrencesById).find(
      (o) => o.targetType === "container" && o.targetId === selectedContainer.id
    ) || null;
  }, [selectedContainer, occurrencesById]);

  // ============================================================
  // FOLDER ITEMS — for FolderGrid in file-manager mode
  // ============================================================
  const effectiveFolderId = selectedFolderId || manifest?.rootFolderId;

  const folderItems = useMemo(() => {
    if (!isFileManager) return [];
    const items = [];
    // Get child folders
    Object.values(foldersById).forEach(f => {
      if (f.parentId === effectiveFolderId) {
        items.push({ ...f, _type: "folder" });
      }
    });
    // Get docs in this folder
    Object.values(docsById).forEach(d => {
      if (d.folderId === effectiveFolderId && !d.isDeleted) {
        items.push({ ...d, _type: "doc" });
      }
    });
    // Get artifacts in this folder
    Object.values(artifactsById).forEach(a => {
      if (a.folderId === effectiveFolderId && !a.isDeleted) {
        items.push({ ...a, _type: "artifact" });
      }
    });
    return items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [isFileManager, foldersById, docsById, artifactsById, effectiveFolderId]);

  const selectedFolder = useMemo(() => {
    return effectiveFolderId ? foldersById[effectiveFolderId] : null;
  }, [effectiveFolderId, foldersById]);

  // Auto-select first item if none selected
  useEffect(() => {
    if (selectedItemId) return;
    // Try to find first doc in tree
    function findFirstDoc(nodes) {
      for (const node of nodes) {
        if (node.type === "doc") return node;
        if (node.children) {
          const found = findFirstDoc(node.children);
          if (found) return found;
        }
      }
      return null;
    }
    const first = findFirstDoc(treeItems);
    if (first) {
      setSelectedItemId(first.id);
      setSelectedItemType(first.type);
    }
  }, [selectedItemId, treeItems]);

  // Auto-switch (and auto-create) day page when grid iteration date changes
  // If this panel shows a notebook/day-pages view, find or create the doc matching the current date
  const currentIterationValue = state?.grid?.currentIterationValue;
  const creatingDayPageRef = useRef(null); // prevent duplicate creation
  useEffect(() => {
    if (!currentIterationValue) return;
    // Only auto-switch for notebook views (which contain day pages)
    if (view?.viewType !== "notebook" && panel?.kind !== "notebook") return;

    const dateStr = new Date(currentIterationValue).toISOString().slice(0, 10);

    // Find a day-page doc matching this date
    const matchingDoc = Object.values(docsById).find(
      d => d.docType === "day-page" && d.title === dateStr
    );

    if (matchingDoc) {
      if (matchingDoc.id !== selectedItemId) {
        setSelectedItemId(matchingDoc.id);
        setSelectedItemType("doc");
        if (view?.id) {
          CommitHelpers.updateView({
            dispatch, socket,
            view: { id: view.id, activeDocId: matchingDoc.id, activeArtifactId: null },
            emit: true,
          });
        }
      }
      return;
    }

    // No day page exists for this date — auto-create one
    if (creatingDayPageRef.current === dateStr) return; // already creating
    creatingDayPageRef.current = dateStr;

    // Find the Day Pages folder (folderType: "day-pages")
    const dayPagesFolder = Object.values(foldersById).find(
      f => f.folderType === "day-pages"
    );
    const targetFolderId = dayPagesFolder?.id || manifest?.rootFolderId;
    if (!targetFolderId || !gridId || !userId) {
      creatingDayPageRef.current = null;
      return;
    }

    // Look up default day page template content
    const grid = state?.grid;
    const templateId = grid?.defaultDayPageTemplateId;
    const template = templateId
      ? grid?.templates?.find(t => t.id === templateId)
      : null;
    // Template items may contain a `docContent` string for pre-filling
    const templateContent = template?.docContent || "";

    const newDocId = uid();
    const newDoc = {
      id: newDocId,
      userId,
      gridId,
      folderId: targetFolderId,
      title: dateStr,
      docType: "day-page",
      dayPageDate: new Date(currentIterationValue),
      sortOrder: Date.now(),
      content: templateContent,
    };

    CommitHelpers.createDoc({ dispatch, socket, doc: newDoc, emit: true });

    // Create real occurrence for the day page doc
    const dayPageOccId = uid();
    CommitHelpers.createOccurrence({
      dispatch, socket,
      occurrence: {
        id: dayPageOccId,
        userId,
        gridId,
        targetType: "doc",
        targetId: newDocId,
        iteration: { key: "time", mode: "persistent", timeFilter: "daily" },
        fields: {},
        meta: { folderId: targetFolderId },
        docContent: templateContent || { type: "doc", content: [{ type: "paragraph" }] },
      },
      emit: true,
    });

    setSelectedItemId(newDocId);
    setSelectedItemType("doc");

    if (view?.id) {
      CommitHelpers.updateView({
        dispatch, socket,
        view: { id: view.id, activeDocId: newDocId, activeArtifactId: null },
        emit: true,
      });
    }

    // Reset guard after a short delay to allow reducer to process
    setTimeout(() => { creatingDayPageRef.current = null; }, 500);
  }, [currentIterationValue, view?.viewType, view?.id, panel?.kind, docsById, foldersById, manifest, gridId, userId, dispatch, socket]);

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleSelect = useCallback((item, isDoubleClick) => {
    if (item.type === "folder") {
      if (isFileManager) {
        // In file-manager mode, clicking a folder navigates into it
        setSelectedFolderId(item.id);
        setSelectedItemId(null);
        setSelectedItemType("folder");
      }
      // In tree mode, clicking folder just toggles expand — don't select
      return;
    }
    setSelectedItemId(item.id);
    setSelectedItemType(item.type);

    // Double-click: collapse sidebar to focus on content
    if (isDoubleClick) {
      setSidebarCollapsed(true);
    }

    // Update view's active item
    if (view?.id) {
      const updates = {};
      if (item.type === "doc") {
        updates.activeDocId = item.id;
        updates.activeArtifactId = null;
      } else if (item.type === "artifact") {
        updates.activeArtifactId = item.id;
        updates.activeDocId = null;
      }
      CommitHelpers.updateView({
        dispatch,
        socket,
        view: { id: view.id, ...updates },
        emit: true,
      });
    }
  }, [view, dispatch, socket, isFileManager]);

  // Handle item selection from FolderGrid
  const handleFolderItemSelect = useCallback((item, isDoubleClick) => {
    if (item._type === "folder") {
      // Navigate into the folder
      setSelectedFolderId(item.id);
      setSelectedItemId(null);
      setSelectedItemType("folder");
      return;
    }
    // Select the doc or artifact
    setSelectedItemId(item.id);
    setSelectedItemType(item._type === "doc" ? "doc" : "artifact");

    // Double-click: collapse sidebar to focus on content
    if (isDoubleClick) {
      setSidebarCollapsed(true);
    }

    if (view?.id) {
      const updates = {};
      if (item._type === "doc") {
        updates.activeDocId = item.id;
        updates.activeArtifactId = null;
      } else {
        updates.activeArtifactId = item.id;
        updates.activeDocId = null;
      }
      CommitHelpers.updateView({
        dispatch,
        socket,
        view: { id: view.id, ...updates },
        emit: true,
      });
    }
  }, [view, dispatch, socket]);

  const handleAddDoc = useCallback((parentFolderId) => {
    if (!gridId || !userId) return;

    // Determine target folder
    let folderId = parentFolderId;
    if (!folderId) {
      // Default to root folder or first "normal" folder
      const rootId = manifest?.rootFolderId;
      if (rootId) {
        // Find "Documents" folder under root
        const docsFolder = Object.values(foldersById).find(
          (f) => f.parentId === rootId && f.folderType === "normal"
        );
        folderId = docsFolder?.id || rootId;
      }
    }

    const docId = crypto.randomUUID();
    const doc = {
      id: docId,
      userId,
      gridId,
      folderId: folderId || null,
      title: "Untitled Document",
      docType: "normal",
      sortOrder: Object.values(docsById).length,
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [] }],
      },
    };

    CommitHelpers.createDoc({ dispatch, socket, doc, emit: true });

    // Create real occurrence for the doc
    const docOccId = uid();
    CommitHelpers.createOccurrence({
      dispatch, socket,
      occurrence: {
        id: docOccId,
        userId,
        gridId,
        targetType: "doc",
        targetId: docId,
        iteration: { key: "time", mode: "persistent", timeFilter: "daily" },
        fields: {},
        meta: { folderId: folderId || null },
        docContent: doc.content,
      },
      emit: true,
    });

    setSelectedItemId(docId);
    setSelectedItemType("doc");
  }, [gridId, userId, manifest, foldersById, docsById, dispatch, socket]);

  // Handle drops on tree items
  const handleDropOnItem = useCallback((sourceData, targetItem, edge) => {
    if (!gridId || !userId) return;

    // Instance drop → create doc with instance pill
    if (sourceData.type === "instance") {
      const instance = sourceData.data || {};
      const instanceId = sourceData.id || instance.id;
      const instanceLabel = instance.label || "Item";
      const occurrenceId = sourceData.context?.occurrenceId || null;
      const containerId = sourceData.context?.containerId || null;

      // Determine target folder
      let folderId = null;
      if (targetItem.type === "folder") {
        folderId = targetItem.id;
      } else if (targetItem.doc?.folderId) {
        folderId = targetItem.doc.folderId;
      }

      const docId = crypto.randomUUID();
      const doc = {
        id: docId,
        userId,
        gridId,
        folderId,
        title: instanceLabel,
        docType: "normal",
        sortOrder: Object.values(docsById).length,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "instancePill",
                  attrs: {
                    instanceId,
                    instanceLabel,
                    occurrenceId,
                    containerId,
                    showIcon: true,
                  },
                },
              ],
            },
          ],
        },
      };

      CommitHelpers.createDoc({ dispatch, socket, doc, emit: true });

      // Create real occurrence for the doc
      CommitHelpers.createOccurrence({
        dispatch, socket,
        occurrence: {
          id: uid(),
          userId,
          gridId,
          targetType: "doc",
          targetId: docId,
          iteration: { key: "time", mode: "persistent", timeFilter: "daily" },
          fields: {},
          meta: { folderId },
          docContent: doc.content,
        },
        emit: true,
      });

      setSelectedItemId(docId);
      setSelectedItemType("doc");
    }

    // Field drop → create doc with field pill
    if (sourceData.type === "field") {
      const field = sourceData.data || {};
      const fieldId = sourceData.id || field.id;
      const fieldName = field.name || "Field";

      let folderId = null;
      if (targetItem.type === "folder") {
        folderId = targetItem.id;
      } else if (targetItem.doc?.folderId) {
        folderId = targetItem.doc.folderId;
      }

      const docId = crypto.randomUUID();
      const doc = {
        id: docId,
        userId,
        gridId,
        folderId,
        title: fieldName,
        docType: "normal",
        sortOrder: Object.values(docsById).length,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "fieldPill",
                  attrs: {
                    fieldId,
                    fieldName,
                    fieldType: field.type || "text",
                    fieldMode: field.mode || "input",
                    showValue: true,
                    showLabel: true,
                  },
                },
              ],
            },
          ],
        },
      };

      CommitHelpers.createDoc({ dispatch, socket, doc, emit: true });

      // Create real occurrence for the doc
      CommitHelpers.createOccurrence({
        dispatch, socket,
        occurrence: {
          id: uid(),
          userId,
          gridId,
          targetType: "doc",
          targetId: docId,
          iteration: { key: "time", mode: "persistent", timeFilter: "daily" },
          fields: {},
          meta: { folderId },
          docContent: doc.content,
        },
        emit: true,
      });

      setSelectedItemId(docId);
      setSelectedItemType("doc");
    }

    // Tree reorder: move doc to a different folder
    if (sourceData._treeItemType === "doc" && sourceData._treeItemId) {
      const targetFolderId = targetItem.type === "folder" ? targetItem.id : targetItem.doc?.folderId || null;
      CommitHelpers.updateDoc({
        dispatch,
        socket,
        doc: { id: sourceData._treeItemId, folderId: targetFolderId, sortOrder: Date.now() },
        emit: true,
      });
    }

    // Tree reorder: move folder to a different parent
    if (sourceData._treeItemType === "folder" && sourceData._treeItemId) {
      const targetFolderId = targetItem.type === "folder" ? targetItem.id : null;
      // Prevent moving a folder into itself
      if (targetFolderId !== sourceData._treeItemId) {
        CommitHelpers.updateFolder({
          dispatch,
          socket,
          folder: { id: sourceData._treeItemId, parentId: targetFolderId, sortOrder: Date.now() },
          emit: true,
        });
      }
    }

    // Tree reorder: move artifact to a different folder
    if (sourceData._treeItemType === "artifact" && sourceData._treeItemId) {
      const targetFolderId = targetItem.type === "folder" ? targetItem.id : null;
      CommitHelpers.updateArtifact({
        dispatch,
        socket,
        artifact: { id: sourceData._treeItemId, folderId: targetFolderId, sortOrder: Date.now() },
        emit: true,
      });
    }
  }, [gridId, userId, docsById, dispatch, socket]);

  // ============================================================
  // FILE-MANAGER HANDLERS — upload, create folder, create doc
  // ============================================================
  const handleUploadFile = useCallback(async (file) => {
    await CommitHelpers.uploadFile({
      file,
      userId,
      gridId,
      folderId: effectiveFolderId,
      manifestId: manifest?.id,
      dispatch,
    });
  }, [userId, gridId, effectiveFolderId, manifest, dispatch]);

  const handleCreateSubfolder = useCallback(() => {
    const newFolder = {
      id: uid(),
      userId,
      gridId,
      manifestId: manifest?.id,
      parentId: effectiveFolderId,
      name: "New Folder",
      folderType: "normal",
      sortOrder: Date.now(),
    };
    CommitHelpers.createFolder({ dispatch, socket, folder: newFolder });
  }, [userId, gridId, manifest, effectiveFolderId, dispatch, socket]);

  const handleCreateDocInFolder = useCallback(() => {
    const newDoc = {
      id: uid(),
      userId,
      gridId,
      manifestId: manifest?.id,
      folderId: effectiveFolderId,
      title: "Untitled Document",
      content: { type: "doc", content: [{ type: "paragraph" }] },
      sortOrder: Date.now(),
    };
    CommitHelpers.createDoc({ dispatch, socket, doc: newDoc });

    // Create real occurrence for the doc
    CommitHelpers.createOccurrence({
      dispatch, socket,
      occurrence: {
        id: uid(),
        userId,
        gridId,
        targetType: "doc",
        targetId: newDoc.id,
        iteration: { key: "time", mode: "persistent", timeFilter: "daily" },
        fields: {},
        meta: { folderId: effectiveFolderId },
        docContent: newDoc.content,
      },
    });

    setSelectedItemId(newDoc.id);
    setSelectedItemType("doc");
  }, [userId, gridId, manifest, effectiveFolderId, dispatch, socket]);

  // ============================================================
  // RENDER — content area based on selected item type
  // ============================================================
  const renderContent = () => {
    // File-manager mode: show FolderGrid when viewing a folder (no specific doc/artifact selected)
    if (isFileManager && (!selectedItemId || selectedItemType === "folder")) {
      return (
        <FolderGrid
          folder={selectedFolder}
          items={folderItems}
          onSelect={handleFolderItemSelect}
          onUpload={handleUploadFile}
          onCreateFolder={handleCreateSubfolder}
          onCreateDoc={handleCreateDocInFolder}
        />
      );
    }

    if (selectedDoc) {
      // If we have a real doc occurrence, use it directly
      if (docOccurrence) {
        return (
          <DocContainer
            container={{ id: selectedDoc.id, label: selectedDoc.title, kind: "doc" }}
            occurrence={docOccurrence}
            dispatch={dispatch}
            socket={socket}
          />
        );
      }

      // Legacy: backing container + occurrence
      if (selectedContainer && selectedOccurrence) {
        return (
          <DocContainer
            container={selectedContainer}
            occurrence={selectedOccurrence}
            dispatch={dispatch}
            socket={socket}
          />
        );
      }

      // Fallback: create occurrence on-the-fly for docs without one (pre-migration)
      return (
        <DocContainer
          container={{ id: selectedDoc.id, label: selectedDoc.title, kind: "doc" }}
          occurrence={{
            id: selectedDoc.id,
            docContent: selectedDoc.content,
            targetType: "doc",
            targetId: selectedDoc.id,
          }}
          dispatch={dispatch}
          socket={socket}
          docModel={selectedDoc}
        />
      );
    }

    if (selectedArtifact) {
      return <MediaContainer artifact={selectedArtifact} />;
    }

    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Select a document or create a new one
      </div>
    );
  };

  // ============================================================
  // MAIN LAYOUT
  // ============================================================
  return (
    <div className="artifact-display flex flex-1 min-h-0 overflow-hidden">
      {/* Sidebar (tree) — shown based on view.showTree */}
      {showTree && (
        <ArtifactSidebar
          items={treeItems}
          selectedId={selectedItemId}
          onSelect={handleSelect}
          onAddDoc={handleAddDoc}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          onDropOnItem={handleDropOnItem}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
        {renderContent()}
      </div>
    </div>
  );
}
