# Moduli: Phase Implementation Plan

## Overview

Moduli is a visual, event-driven data system built around:
- **Grid** → **Panels** → **Containers** → **Instances** (via Occurrences)
- **Fields** at the grid level that can be bound to instances
- **Transactions** that record every change for history/undo/aggregations
- **Visual block programming** for calculations (Snap!/Scratch inspired)
- **Rich text documents** with embedded live field values

---

## Phase 1: Occurrences & Core DnD — 100% Complete ✓

### Core Data Model
- [x] Grid, Panel, Container, Instance, Occurrence models
- [x] MongoDB schemas with proper indexes

### Drag & Drop System
- [x] Pragmatic Drag and Drop integration
- [x] `dragSystem.js` with `useDraggable`, `useDroppable`, `useDragDrop` hooks
- [x] Cross-window drag support with serialized payloads
- [x] Drop indicators (edge detection)
- [x] Auto-scroll during drag
- [x] Session ref for sync drop handling

### Socket.IO Real-time Sync
- [x] Server socket handlers for all CRUD operations
- [x] Optimistic updates on client
- [x] State reconciliation

### UI Components
- [x] Grid layout with resizable panels
- [x] SortableContainer, SortableInstance
- [x] RadialMenu for entity actions
- [x] Form components (InstanceForm, ContainerForm, PanelForm, GridForm)

### Remaining
- [x] Multi-window sync (BroadcastChannel for same-origin tab sync)

---

## Phase 2: Fields & Calculations — 98% Complete ✓

### Field Model
- [x] Field model with `mode: input | derived`
- [x] Field types: number, text, boolean, select, date, rating, duration
- [x] Checkbox, toggle switch, number increment inputs
- [x] Select dropdowns with multi-select mode
- [x] Emotion wheel mood selector

### Value Storage
- [x] Value storage as `{ value, flow }` - in/out/replace
- [x] Field bindings on instances
- [x] Flow-based aggregation

### Calculations
- [x] All 15 aggregations (sum, count, countTrue, avg, median, mode, min, max, first, last, etc.)
- [x] Scope filtering (grid/panel/container/instance)
- [x] Time filtering (today, thisWeek, thisMonth, etc.)
- [x] Target scaling across time periods
- [x] FieldRenderer routing to correct component
- [x] FieldPillInput/FieldPillDisplay compact mode

### Remaining
- [x] UI for configuring allowedFields
- [x] UI for flow direction selection (FlowToggle popover with In/Out/Replace)
- [x] Multiselect flowFilter for derived fields (array-based, backwards compatible)

---

## Phase 3: Transactions & Block System — 100% Complete ✓

### Transaction System
- [x] Transaction model (MeasureOp, OccurrenceListOp, EntityOp, DocEditOp)
- [x] WHO, WHAT, WHERE, WHEN captured for every change
- [x] Transaction state: applied | undone | redone
- [x] Undo/redo system with useUndoRedo hook
- [x] TransactionHistory.jsx UI

### Block System (Snap!/Scratch Inspired)
- [x] Block types: FIELD, LITERAL, VARIABLE, OPERATOR, COMPARISON, LOGICAL, AGGREGATION, FUNCTION, CONDITION, LOOP
- [x] Block shapes: REPORTER (oval), STATEMENT (rect), C_BLOCK, HAT
- [x] blockTypes.js, blockEvaluator.js
- [x] Block.jsx, Slot.jsx, BlockPalette.jsx
- [x] OperationsBuilder.jsx + OperationsCanvas.jsx

### Visual Feedback
- [x] Toast notifications (sonner)
- [x] FieldValueIndicator (green/red arrows)
- [x] useAnimations hook (FLIP animations)
- [x] GridRadialMenu (Undo/Redo/History/Fields)

---

## Phase 4: Docs, Artifacts & Rich Editor — 100% Complete ✓

### 4.1 Core Doc Components ✓
- [x] DocEditor.jsx (Tiptap with @ mentions, / commands)
- [x] DocContainer.jsx (drop target, debounced save)
- [x] DocToolbar.jsx (formatting toolbar)

### 4.2 Pill Extensions ✓
- [x] FieldPillExtension.js + FieldPillNode.jsx
- [x] InstancePillExtension.js + InstancePillNode.jsx
- [x] DocLinkExtension.js + DocLinkNode.jsx
- [x] FieldSuggestion.jsx (@ popup)

### 4.3 Panel/Container Types ✓
- [x] Notebook panel kind
- [x] Doc container kind
- [x] ArtifactDisplay.jsx (tree sidebar + content view, renamed from NotebookPanel)
- [x] PanelKindSelector.jsx, ContainerKindSelector.jsx

### 4.4 Hooks ✓
- [x] useDocFieldValues.js (live value calculation)
- [x] useFieldValue.js (single field value)

### 4.5 Integration ✓
- [x] Drag instances to doc → inserts pill
- [x] Drag to tree → creates doc
- [x] Occurrence-based pill references
- [x] docContent stored on occurrence

---

### 4.6 Artifact Models & Client State

| Model | Description | Status |
|-------|-------------|--------|
| `Artifact.js` | Files stored in system (image, PDF, etc.) | ✅ Created |
| `Folder.js` | Tree node for organizing content | ✅ Created |
| `Doc.js` | Separate doc model with DocPill sub-schema | ✅ Created |
| `View.js` | View configuration for artifact viewer | ✅ Created |
| `Manifest.js` | Root tree structure linking grids to folder hierarchy | ✅ Created |
| `Operation.js` | Calculation/conditions algorithm model | ✅ Created |
| `Iteration.js` | Separate iteration model with time+category | ✅ Created |
| Client state (reducer, socket, context) for all 5 artifact models | ✅ Done |
| CommitHelpers CRUD for Manifest, View, Doc, Folder, Artifact | ✅ Done |
| Server CRUD handlers for Operation, Iteration | ✅ Done |
| Sample data (Manifest, Folders, Docs, View) in resetData | ✅ Done |

---

### 4.7 Display + ArtifactDisplay Components

**Display** is a view router component inside panels. Based on `view.viewType`, it renders the appropriate viewer.

**ArtifactDisplay** has been rewritten to use real Folder/Doc/Artifact models from context instead of hardcoded container trees.

| Feature | Status |
|---------|--------|
| Display.jsx view router (list/notebook/artifact-viewer/doc-viewer/file-manager/canvas) | ✅ Done |
| ArtifactDisplay rewrite with Manifest/Folder/Doc models | ✅ Done |
| MediaContainer.jsx (image/video/audio/file viewer) | ✅ Done |
| Panel.jsx updated to use Display component with viewId routing | ✅ Done |
| Tree sidebar built from Folder/Doc/Artifact models | ✅ Done |
| Legacy fallback (container-based tree for panels without viewId) | ✅ Done |
| Tree DnD: drop instance → creates Doc with pill content | ✅ Done |
| Tree DnD: "+" button creates Doc/Folder via CommitHelpers | ✅ Done |
| Tree selection updates View.activeDocId/activeArtifactId | ✅ Done |
| View selector dropdown in panel header | ✅ Done |
| Drag/drop reorder within tree (doc/folder/artifact) | ✅ Done |
| Double-click to open in viewer | ✅ Done |

---

### 4.8 View Types

| View Type | Description | Status |
|-----------|-------------|--------|
| `doc` | Rich text editor (Tiptap) | ✅ Done (DocContainer) |
| `file-manager` | Folder grid with upload/create (inline in ArtifactDisplay) | ✅ Done |
| `image` | Image preview (via MediaContainer) | ✅ Done |
| `video` | Video player (via MediaContainer) | ✅ Done |
| `audio` | Audio player (via MediaContainer) | ✅ Done |
| `pdf` | PDF viewer (basic iframe — PDF.js upgrade in Phase 5) | ✅ Done (basic) |

---

### 4.9 File System Integration

| Feature | Status |
|---------|--------|
| Backend file storage (local uploads folder + REST endpoint) | ✅ Done |
| File upload from outside (drag files into file manager) | ✅ Done |
| Upload button in FolderGrid | ✅ Done |
| Each grid has its own Manifest/folder tree structure | ✅ Done |
| Tree layout stored in database (Folder/Doc/Artifact models) | ✅ Done |
| Files become instances when dragged to board | ⬜ Remaining |

---

### 4.10 Model Relationships

```
Grid
├── Tree (root of file system for this grid)
│   ├── Folders (tree nodes)
│   │   ├── Docs (rich text documents)
│   │   ├── Artifacts (files)
│   │   └── Subfolders
│   └── Day Pages folder (auto-created)
│
├── Panels (UI layout)
│   └── kind: "artifact-viewer" → shows Tree + Viewer
│
└── Occurrences (spine linking everything)
```

---

### 4.11 Panel/Container Kind Changes

**OLD** (current):
- Panel kind: `default`, `notebook`
- Container kind: `default`, `doc`

**NEW** (proposed):
- Panel kind: `default`, `artifact-viewer`
- Panel settings for artifact-viewer:
  - `showTree: boolean`
  - `defaultView: "doc" | "file-manager" | ...`
  - `treeRootId: string` (which folder to show)
- Container kind: `default`, `doc`, `artifact`, `folder-view`

---

### 4.12 Key Design Decisions

1. **Doc is separate from Panel** - Docs are stored in the Doc model, not as panel types
2. **Occurrences are the spine** - Everything links through occurrences
3. **Tree is drag-and-drop** - Works with Pragmatic DnD like the rest of the app
4. **One component, many views** - ArtifactViewer handles all file types
5. **Folders ARE containers** - Just with `kind: "folder-view"`
6. **Docs are artifacts** - Treat docs as a type of artifact

---

### 4.13 Iteration & Persistence Fixes (CRITICAL)

| Feature | Status |
|---------|--------|
| Persist settings in Panel/Container/Instance forms | ✅ Done |
| Local iteration arrows for panels/containers | ✅ Done |
| "Inherit" vs "Own" iteration mode in forms | ✅ Done |
| Persistence mode filtering (occurrenceMatchesIteration helper) | ✅ Done |
| getContainerItems filters by iteration date | ✅ Done |
| Compound iterations (time + category) schema + filtering | ✅ Done |
| Compound iterations UI (category selector in toolbar) | ✅ Done |

---

### 4.14 Field & Calculation Fixes (CRITICAL)

| Feature | Status |
|---------|--------|
| Input field VALUES copied with instance (deep-clone from sourceOccurrence) | ✅ Done |
| DragProvider passes sourceOccurrence when copying | ✅ Done |
| Calculations reading from occ.fields (verified working) | ✅ Done |
| allowedFields UI configuration panel | ✅ Done |
| Multiselect inputs working (FieldRenderer routes select to FieldInput in compact mode) | ✅ Done |
| Mood field has multiSelect: true in resetData | ✅ Done |
| Flow direction UI (in/out/replace selector) | ✅ Done |
| Autocheck on drop setting (toggle in InstanceForm) | ✅ Done |

---

### 4.15 Doc Drag & Drop System (CRITICAL)

| Feature | Status |
|---------|--------|
| Drag container into doc → bolded title + bullet list of instance pills | ✅ Done |
| Drag instance into doc → instance pill at cursor | ✅ Done |
| @ popup searches containers, instances, AND fields | ✅ Done |
| Copy vs Copylink option in @ popup for containers/instances | ✅ Done |
| Turn highlighted text into instance pill (Pill button in toolbar) | ✅ Done |
| Smaller text size in docs (CSS styling) | ✅ Done |
| Field via @ creates instance pill with that field attached | ⬜ Remaining |
| Drag pill OUT of doc → creates instance elsewhere | ⬜ Remaining |
| Drag files/text from outside → becomes instance pill | ⬜ Remaining |
| Backspace into pill → converts to editable text | ⬜ Remaining |
| Backspace on non-text pill → soft delete | ⬜ Remaining |
| Text pill visual distinction (plain text vs fields/artifacts) | ⬜ Remaining |
| Every word → instance pill on space press (Snap-style) | → Phase 5 |
| Markdown pills snap onto left of text pills | → Phase 5 |

---

### 4.16 Doc Formatting & Navigation (HIGH)

| Feature | Status |
|---------|--------|
| Header buttons working in DocToolbar | ✅ Done |
| Switching between documents (tree navigation) | ✅ Done (ArtifactDisplay rewrite) |
| Bullets and numbered lists with instance pills | ✅ Done |
| Instance pills respect markdown formatting (header size, etc.) | ✅ Done |
| Day page auto-creation (on iteration date change) | ✅ Done |
| Obsidian-style headings (# prefix visible) | ✅ Done |

---

### 4.17 Copylink Mode (HIGH)

| Feature | Status |
|---------|--------|
| Copylink mode in drag system (editing one updates all linked) | ✅ Done |
| linkedGroupId on Occurrence model | ✅ Done |
| Server-side field propagation to linked siblings | ✅ Done |
| Three-way drag cycle (move → copy → copylink) | ✅ Done |
| Copylink in all model enums (Instance, Container, Panel) | ✅ Done |
| Copylink for iteration (values linked, iteration control NOT linked) | ✅ Done |
| Link indicator (chain icon) on linked items | ⬜ Remaining |
| "Break Link" functionality | ⬜ Remaining |
| View all links UI | ⬜ Remaining |

---

### 4.18 Templates

| Feature | Status |
|---------|--------|
| Template storage on Grid model (templates array) | ✅ Done |
| "Save as Template" button in ContainerForm | ✅ Done |
| "Fill from Template" buttons in ContainerForm | ✅ Done |
| Server handlers (save_template, fill_from_template) | ✅ Done |
| CommitHelpers for saveTemplate/fillFromTemplate | ✅ Done |
| Default template for day pages (auto-fill on date change) | ⬜ Remaining |
| Day page auto-creation (create doc if missing for date) | ⬜ Remaining |
| Copylink to daypage template workflow | ⬜ Remaining |

---

### 4.19 UI/UX Fixes

| Feature | Status |
|---------|--------|
| Grid radial menu (cog button) opens DOWNWARD | ✅ Done (forceDirection="down") |
| Fields Bank in grid radial menu | ✅ Done |
| Undo/Redo buttons in Toolbar (global) | ✅ Done (lifted useUndoRedo to App.jsx) |
| History popup button in toolbar (between undo/redo) | ✅ Done |
| Toast notifications (Toaster/Sonner in App.jsx) | ✅ Done |
| Global fields list UI (GridFieldsBank in Grid.jsx) | ✅ Done |
| Keyboard shortcuts for undo/redo (Ctrl+Z/Y) | ✅ Done |
| Add Panel in toolbar (with panel type selection) | ✅ Done |
| Pill radial menu on hover (cog → copy/copylink/move/remove) | ✅ Done |
| Operations builder drag/drop working | ⬜ Remaining |

---

### 4.20 Field Linking & Sibling Fields

| Feature | Status |
|---------|--------|
| siblingLinks field on Field, Instance, Panel, Container models | ✅ Done |
| Sibling Links UI in InstanceForm (chip display + add/remove) | ✅ Done |
| Random aggregation (pick random from list) | ✅ Done |
| First-in-list aggregation (first value) | ✅ Done |
| Question/Answer paired fields (siblinglink UI) | ✅ Done (journalQuestion/journalAnswer in resetData) |
| Question cycling from sibling list (auto-rotate on date change) | ⬜ Remaining |

---

### 4.21 Animations & Polish

| Feature | Status |
|---------|--------|
| ARIA labels (Instance, SortableContainer, Panel) | ✅ Done |
| Keyboard navigation (tabIndex on SortableInstance) | ✅ Done |
| Undo slide-back animations (FLIP hook exists, needs wiring) | ⬜ Remaining |

---

## Phase 5: Cascading Styles, Snap-Style Editor & Polish — Not Started ⬜

**Goal**: Cascading style/behavior system for entities, Snap-style doc editing, CSS overhaul with theming, and architecture cleanup.

### 5.1 Cascading Style Overrides ✅ Complete

Panels set default styling for child containers/instances. Each level can inherit or override — same pattern as iteration inheritance.

| Task | Status |
|------|--------|
| Style schema on Panel/Container/Instance: padding, gap, borderRadius, bgColor, textColor, fontSize | ✅ Done |
| `resolveEffectiveStyle(entity, parent)` helper — merges parent defaults with entity overrides | ✅ Done (StyleHelpers.js) |
| Panel form: "Default Container Style" + "Default Instance Style" sections | ✅ Done (LayoutForm.jsx) |
| Container form: "Container Style" + "Default Instance Style" sections | ✅ Done (ContainerForm.jsx) |
| Instance form: "Style Override" section | ✅ Done (InstanceForm.jsx) |
| Fix update_container handler to save all fields (was dropping styleMode, ownStyle, etc.) | ✅ Done (server.js) |
| Sample styles in resetData (Schedule blue tint, Goals green tint, Workout/Meditation own styles) | ✅ Done |

### 5.1b Doc Occurrences, Pill Polish & UI — Complete ✅

Implemented in Feb 16 session:

| Task | Status |
|------|--------|
| Real occurrences for docs (targetType: "doc" in Occurrence enum) | ✅ Done |
| resetData creates real occurrences for Welcome/DayPage/Stan docs | ✅ Done |
| ArtifactDisplay looks up real doc occurrence first, falls back to legacy | ✅ Done |
| All doc creation paths create doc occurrences (handleAddDoc, day page auto-create, drop-to-tree) | ✅ Done |
| Copylink dedup — intra-doc pill moves no longer duplicate (fromDoc check) | ✅ Done |
| Multiselect + randomize button on watchlist/readingList fields | ✅ Done |
| Shuffle button on both single-select and multi-select when meta.randomize is true | ✅ Done |

---

### 5.1c Next Steps — Queued for Future Sessions

These items are ready to pick up but were deferred to avoid rushing. Ordered by impact:

**Doc & Pill System**
| # | Task | Priority | Notes |
|---|------|----------|-------|
| 1 | Raw markdown pill editing | HIGH | Pill label is part of raw content — editing inline requires TipTap node view with contenteditable |
| 2 | Live value calculation in pills | HIGH | Wire `useDocFieldValues` so field pills show live computed values instead of static text |
| 3 | Pill cursor integration | MED | Backspace into pill, typing around pills, arrow key nav between pills |
| 4 | Expression pills (inline block trees) | LOW | Computed expressions rendered inline in docs |

**Editor Features**
| # | Task | Priority | Notes |
|---|------|----------|-------|
| 5 | Right-click context menu | MED | On instances, containers, pills — copy, delete, edit, break link |
| 6 | Copy/paste as text vs block | MED | Clipboard handling — paste as plain text or as structured pills |
| 7 | Export to PDF/Markdown | LOW | Day pages → printable format, docs → .md files |

**Data & Architecture**
| # | Task | Priority | Notes |
|---|------|----------|-------|
| 8 | Operations editor — wire block system to derived fields | HIGH | Move to Phase 6 — the Snap/Scratch blocks exist but aren't connected to CalculationHelpers |
| 9 | Multi-window sync — BroadcastChannel | LOW | Same-origin tab sync for real-time updates across windows |
| 10 | Server undo/redo handler completion | MED | Some undo handlers are partial |

**Media & Files**
| # | Task | Priority | Notes |
|---|------|----------|-------|
| 11 | File uploads + media display in pills/instances | MED | Upload infra exists (multer + Artifact), need inline image preview in pills and instance cards |
| 12 | Pomodoro timer in toolbar | LOW | Countdown timer widget for focus sessions |

---

### 5.2 Cascading Sortable/Draggable/Droppable Toggles

Same cascading pattern — parent sets defaults, children can override.

| Task | Status |
|------|--------|
| Behavior schema on Panel/Container/Instance: `sortable`, `draggable`, `droppable` booleans | ⬜ |
| `resolveEffectiveBehavior(entity, parent)` helper | ⬜ |
| Panel form: "Default Behavior" section (sortable/draggable/droppable for children) | ⬜ |
| Container/Instance form: "Behavior Override" section | ⬜ |
| DragProvider respects resolved behavior flags (skip drag setup if `draggable: false`) | ⬜ |
| SortableContainer respects `sortable` flag | ⬜ |

### 5.3 Snap-Style Doc Editor (from Phase 4 deferred)

Every word becomes a pill on space. Markdown formatting pills snap onto left of text pills.

| Task | Status |
|------|--------|
| Space key handler: turn last typed word into a text instance pill | ⬜ |
| Backspace into text pill → converts back to editable text | ⬜ |
| Markdown pills (# / ## / - / 1.) snap onto left of text pills | ⬜ |
| Visual distinction: text-only pills (subtle) vs field/artifact pills (colored) | ⬜ |
| Drag pill off doc → creates instance on board | ⬜ |

### 5.4 CSS Audit & Cleanup

| Task | Status |
|------|--------|
| Audit index.css — extract custom classes into Tailwind utilities/components | ⬜ |
| Remove inline style objects from components (replace with Tailwind classes) | ⬜ |
| Create shared component class patterns (`.panel-card`, `.container-card`, `.instance-row`) | ⬜ |
| Consolidate ProseMirror/Tiptap styles into a dedicated `doc-editor.css` | ⬜ |
| Remove unused CSS rules | ⬜ |
| Normalize spacing, font sizes, border radii across all components | ⬜ |

### 5.5 Tailwind Theme System

| Task | Status |
|------|--------|
| Define semantic color tokens in tailwind.config.js (surface, border, accent, muted, etc.) | ⬜ |
| Dark mode support (`dark:` variants, CSS variables for theme switching) | ⬜ |
| Light mode support (clean, minimal defaults) | ⬜ |
| User theme preference stored in localStorage + grid.meta | ⬜ |
| Theme toggle in Toolbar or Settings | ⬜ |

### 5.6 Component Style Patterns

| Task | Status |
|------|--------|
| Panel header: consistent height, drag handle area, action buttons alignment | ⬜ |
| Container card: uniform border, hover states, drag feedback | ⬜ |
| Instance row: compact mode vs expanded mode, field pill alignment | ⬜ |
| Form components: consistent label/input/button spacing | ⬜ |
| Radial menu: consistent sizing, animation curves | ⬜ |
| Tree sidebar: proper indentation, hover/selected states | ⬜ |
| Doc editor: heading sizes, list indentation, pill inline spacing | ⬜ |

### 5.7 Responsive & Layout

| Task | Status |
|------|--------|
| Grid breakpoints for mobile (collapse to single column) | ⬜ |
| Panel minimum widths to prevent content overflow | ⬜ |
| Touch-friendly tap targets (44px minimum) | ⬜ |
| Scrollbar styling (thin, themed) | ⬜ |

### 5.8 More Markdown / Doc Options (Obsidian-level)

| Task | Status |
|------|--------|
| Tables (Tiptap Table extension) | ⬜ |
| Callout/admonition blocks | ⬜ |
| Toggle/collapsible sections | ⬜ |
| Improved PDF viewer (PDF.js with page navigation) | ⬜ |

### 5.9 Architecture Cleanup

| Task | Priority | Status |
|------|----------|--------|
| Move `grid.fieldIds` to derived state (compute from Field.find({gridId})) | MED | ⬜ |
| Type system: add JSDoc or TypeScript interfaces for all models | LOW | ⬜ |
| Replace `grid.templates[]` with standalone Template model (for cross-grid sharing) | LOW | ⬜ |
| Normalize iteration handling consistency audit | LOW | ✅ Done |
| Consolidate `container.occurrences` naming | LOW | ✅ Done |

---

## Phase 6: Operations Editor, Drill-Down & Performance — Not Started ⬜

**Goal**: Wire block system into derived field evaluation, add recursive drill-down, optimize for scale.

### 6.1 Operations Editor for Derived Fields (from BUGS #14)

The Snap!/Scratch block system is built but not wired into derived field evaluation. This makes it THE way to define complex derived field logic with conditions.

| Task | Priority | Status |
|------|----------|--------|
| Wire `blockEvaluator.evaluateBlockTree()` into `CalculationHelpers.calculateDerivedField()` | HIGH | ⬜ |
| Derived field has `operationTree` (block tree) OR `allowedFields` (simple mode) | HIGH | ⬜ |
| IF/condition blocks: `IF field("account") == "checking" THEN sum(field("amount"))` | HIGH | ⬜ |
| AND/OR combinator blocks for grouping conditions | HIGH | ⬜ |
| "Include value" / "Execute operation" action blocks | HIGH | ⬜ |
| Operations editor accessible from derived field settings (FieldBindingEditor) | HIGH | ⬜ |
| allowedFields remains as shortcut/simple mode for basic aggregations | MED | ⬜ |
| Test: Mom's Account derived field uses IF account == "moms" condition | MED | ⬜ |

### 6.2 Recursive Drill-Down / Zoom

Instances can contain sub-instances. Zoomed out = pills inside instance. Expanding = zooms in to show full instances.

| Task | Priority | Status |
|------|----------|--------|
| Instance can have child occurrences (nested instance hierarchy) | HIGH | ⬜ |
| Collapsed view: child instances shown as pills inside parent | HIGH | ⬜ |
| Expanded view: drill into instance shows children as full instances | HIGH | ⬜ |
| Breadcrumb navigation for drill-down levels | MED | ⬜ |
| Drag between zoom levels | MED | ⬜ |

### 6.3 Performance

| Task | Priority | Status |
|------|----------|--------|
| Virtual scrolling for panels with 100+ containers (react-window) | HIGH | ⬜ |
| Memoize occurrence filtering (useMemo for getPanelContainers/getContainerItems) | HIGH | ⬜ |
| Batch socket emissions (debounce rapid field edits) | MED | ⬜ |
| Lazy load Display/ArtifactDisplay components (React.lazy) | MED | ⬜ |
| Web Worker for calculation aggregations (offload from UI thread) | LOW | ⬜ |
| IndexedDB offline cache for occurrences/fields | LOW | ⬜ |

### 6.4 Data Validation & Error Recovery

| Task | Priority | Status |
|------|----------|--------|
| Server-side schema validation on all socket handlers (reject invalid data) | HIGH | ⬜ |
| Client-side optimistic update rollback on server error | HIGH | ⬜ |
| Orphaned occurrence cleanup (server cron or on-load audit) | MED | ⬜ |
| Conflict resolution for multi-window edits (last-write-wins → merge) | MED | ⬜ |
| Data migration scripts for schema changes | MED | ⬜ |
| Client error boundary with recovery (don't crash whole app) | HIGH | ⬜ |

### 6.5 Architecture Improvements

| Task | Priority | Status |
|------|----------|--------|
| Extract DragProvider into smaller hooks (usePanelDrag, useContainerDrag, useInstanceDrag) | MED | ⬜ |

---

## Phase 7: Import/Export & Sharing — Not Started ⬜

| Task | Priority | Status |
|------|----------|--------|
| JSON export (full grid snapshot with all models) | HIGH | ⬜ |
| JSON import (restore from snapshot) | HIGH | ⬜ |
| Markdown export (docs → .md files) | MED | ⬜ |
| CSV export (field values → spreadsheet) | MED | ⬜ |
| PDF export (day page → printable format) | LOW | ⬜ |
| Share grid via link (read-only public view) | MED | ⬜ |
| Grid duplicating (clone grid for templates/backup) | MED | ⬜ |
| Panel/Container templates as separate shareable entities | LOW | ⬜ |

---

## Phase 8: Whiteboard & Canvas Mode — Not Started ⬜

### 8.1 Canvas View Type

| Task | Priority | Status |
|------|----------|--------|
| Infinite canvas with pan/zoom (react-flow or custom) | HIGH | ⬜ |
| Arbitrary x,y positioning for items | HIGH | ⬜ |
| Snap-to-grid toggle | MED | ⬜ |
| Connector lines between items | MED | ⬜ |
| Grouping and multi-select | MED | ⬜ |
| Freehand drawing overlay | LOW | ⬜ |

### 8.2 Advanced Grid Layout

| Task | Priority | Status |
|------|----------|--------|
| Nested grids (panel contains sub-grid) | MED | ⬜ |
| Container grids (row/col layout within container) | MED | ⬜ |
| Responsive breakpoints (mobile collapse) | MED | ⬜ |
| Grid templates (preset layouts: planner, kanban, dashboard) | LOW | ⬜ |

---

## Phase 9: Integrations & API — Not Started ⬜

| Task | Priority | Status |
|------|----------|--------|
| REST API for external access (CRUD endpoints) | HIGH | ⬜ |
| Webhooks (fire on field change, occurrence move, etc.) | HIGH | ⬜ |
| Google Calendar sync (2-way: events ↔ schedule slots) | HIGH | ⬜ |
| Apple/Outlook Calendar sync | MED | ⬜ |
| Todoist/Notion import (map tasks to instances) | MED | ⬜ |
| Apple Health / Google Fit (auto-populate steps, water, etc.) | MED | ⬜ |
| Zapier/Make integration (via webhooks + API) | MED | ⬜ |
| iCal feed export (schedule panel → subscribable calendar) | LOW | ⬜ |

---

## Phase 10: AI & Automation — Not Started ⬜

| Task | Priority | Status |
|------|----------|--------|
| Smart scheduling (AI suggests optimal time slots based on habits) | HIGH | ⬜ |
| Natural language input ("Add 30 min workout at 7am") | HIGH | ⬜ |
| Auto-categorization (classify instances into dimensions) | MED | ⬜ |
| Habit recommendations (ML-based insights from field data) | MED | ⬜ |
| Predictive analytics (streak predictions, burnout detection) | LOW | ⬜ |
| AI journal prompts (generate reflection questions from day data) | LOW | ⬜ |
| Block program suggestions (auto-generate operations from user intent) | LOW | ⬜ |

---

## Phase 11: Collaboration & Teams — Not Started ⬜

| Task | Priority | Status |
|------|----------|--------|
| Multi-user grids (share workspace) | HIGH | ⬜ |
| Role-based permissions (owner, editor, viewer) | HIGH | ⬜ |
| Real-time collaborative editing (CRDT for docs) | MED | ⬜ |
| Comments & @mentions in docs and instances | MED | ⬜ |
| Activity feed (who changed what, when) | LOW | ⬜ |
| Team dashboards (aggregate across users) | LOW | ⬜ |

---

## Phase 12: Mobile & Cross-Platform — Not Started ⬜

| Task | Priority | Status |
|------|----------|--------|
| PWA (installable, offline-capable) | HIGH | ⬜ |
| Mobile-optimized layout (touch-first panels) | HIGH | ⬜ |
| Native iOS/Android wrapper (Capacitor or React Native) | MED | ⬜ |
| Home screen widgets (today's schedule, quick-add) | MED | ⬜ |
| Push notifications (reminders, streak alerts) | MED | ⬜ |
| Apple Watch / Wear OS (quick check-off) | LOW | ⬜ |

---

## Phase 13: Data & Privacy — Not Started ⬜

| Task | Priority | Status |
|------|----------|--------|
| Self-hosting option (Docker compose) | HIGH | ⬜ |
| Automatic backups (daily MongoDB dump) | HIGH | ⬜ |
| Backup restore UI | MED | ⬜ |
| End-to-end encryption (client-side encryption for sensitive fields) | MED | ⬜ |
| GDPR compliance (data export, right to deletion) | MED | ⬜ |
| Audit log viewer (who accessed what) | LOW | ⬜ |

---

## Summary

| Phase | Focus | Status |
|-------|-------|--------|
| Phase 1 | Occurrences & Core DnD | ✅ 100% |
| Phase 2 | Fields & Calculations | ✅ 100% |
| Phase 3 | Transactions & Block System | ✅ 100% |
| Phase 4 | Docs, Artifacts & Rich Editor | ✅ 100% |
| **Phase 5** | **Cascading Styles, Snap Editor & Polish** | 🟡 5.1 Done — continuing |
| Phase 6 | Operations Editor, Drill-Down & Performance | ⬜ |
| Phase 7 | Import/Export & Sharing | ⬜ |
| Phase 8 | Whiteboard & Canvas Mode | ⬜ |
| Phase 9 | Integrations & API | ⬜ |
| Phase 10 | AI & Automation | ⬜ |
| Phase 11 | Collaboration & Teams | ⬜ |
| Phase 12 | Mobile & Cross-Platform | ⬜ |
| Phase 13 | Data & Privacy | ⬜ |

**Phases 1-4: 100% Complete. Phase 5.1 (Cascading Styles): Complete.**

### Phase 4 Completed Items

- [x] Day page auto-creation (create missing day page doc on date change)
- [x] Default template for day pages (auto-fill new day pages from template)
- [x] Copylink to daypage template workflow
- [x] Link indicator (chain icon) on copylinked items
- [x] Break Link functionality + View all links UI (popover on chain icon)
- [x] Field via @ creates instance pill with that field attached
- [x] Drag pill OUT of doc → creates instance elsewhere (pragmatic DnD on pills)
- [x] Drag files/text from outside → becomes instance pill in doc
- [x] Backspace into pill → converts to editable text (PillBackspaceExtension)
- [x] Backspace on non-text pill → soft delete
- [x] Text pill visual distinction (gray vs emerald styling)
- [x] Files become instances when dragged from file manager to board (ARTIFACT DragType)
- [x] Question cycling from sibling list (getDayOfYear + seededRandom)
- [x] Undo slide-back FLIP animations (already wired via socket → animateUndoMoves)
- [x] Operations builder drag/drop working (verified block DnD in OperationsBuilder)
- [x] Radial menu on doc pills (hover cog with Copy/CopyLink/Remove actions)

### Priority Rationale (Post-Phase 5)

1. **Phase 6 (Operations + Performance)** — Wire block system to derived fields (enables condition-based calculations like IF account == "moms"), add recursive drill-down, then optimize for scale.
2. **Phase 7 (Import/Export)** — Users need to get data in and out. JSON export/import is essential for backups and onboarding.
3. **Phase 8 (Canvas)** — The "canvas" viewType is already stubbed. This unlocks mind-mapping and visual planning use cases (sketch.io style with radial menu).
4. **Phase 9 (Integrations)** — Calendar sync and webhooks make Moduli part of an existing workflow.
5. **Phase 10 (AI)** — Natural language input and smart scheduling. Requires stable data layer first.
6. **Phase 11 (Collaboration)** — Multi-user. Socket.io foundation helps.
7. **Phase 12 (Mobile)** — PWA first, native later. Touch support already exists.
8. **Phase 13 (Privacy)** — Self-hosting, encryption, GDPR.

---

## Quick Reference

### Running the App
```bash
# Development (runs client + server)
npm run dev

# Reset sample data (WSL)
wsl -d Ubuntu-24.04 -e bash -c "cd ~/dndtest2/server && ~/.nvm/versions/node/v22.21.1/bin/node scripts/resetData.js"
```

### Key Files
| File | Purpose |
|------|---------|
| `client/src/helpers/DragProvider.jsx` | Drag state coordinator |
| `client/src/helpers/CalculationHelpers.js` | All calculation/aggregation logic |
| `client/src/helpers/CommitHelpers.js` | CRUD operations (incl. Manifest/View/Doc/Folder/Artifact) |
| `client/src/helpers/LayoutHelpers.js` | Layout + occurrence filtering (occurrenceMatchesIteration) |
| `client/src/docs/DocEditor.jsx` | Tiptap rich text editor |
| `client/src/docs/DocContainer.jsx` | Doc container with occurrence-based storage |
| `client/src/panels/Display.jsx` | View router (list/notebook/artifact-viewer/doc-viewer/file-manager) |
| `client/src/panels/ArtifactDisplay.jsx` | Artifact display with tree sidebar (uses real Folder/Doc models) |
| `client/src/panels/MediaContainer.jsx` | Basic media viewer (image/video/audio/file) |
| `client/src/ui/GridRadialMenu.jsx` | Grid cog menu (undo/redo/fields bank) |
| `client/src/ui/GridFieldsBank.jsx` | Global field management dialog |
| `client/src/ui/TransactionHistory.jsx` | Transaction history dialog |
| `server/models/Manifest.js` | Root tree structure for folder hierarchy |
| `server/models/View.js` | View configuration (viewType, manifestId, showTree) |
| `server/models/Operation.js` | Calculation/conditions algorithm |
| `server/models/Iteration.js` | Separate iteration model |
| `server/models/Occurrence.js` | Occurrence schema with docContent + iteration |
| `server/utils/createDefaultUserData.js` | Sample data generator |

### Architecture Patterns
- **Occurrence-based storage**: Entities are templates, occurrences store placement + data
- **docContent on Occurrence**: Each occurrence has its own doc content (e.g., different day pages)
- **View routing**: Panel.viewId → View model → Display component → viewType-based rendering
- **Manifest/Folder tree**: Manifest.rootFolderId → recursive Folder hierarchy → Docs/Artifacts
- **Session refs**: Immediate state access during async drag operations
- **Flow values**: `{ value, flow: "in"|"out"|"replace" }` for aggregations
- **Per-entity drag mode**: `defaultDragMode` on panels/containers/instances
- **siblingLinks**: Array of linked entity IDs on Field, Instance, Panel, Container








also i dont see the bullet points in the doc (not showing up)
also make sure that the input fields in the docs can change the value. we should be able to do a copylink from a daypages doc and a field in the schedule. so if i set something to do on the daypage, it changes the one in schedule to that (through copylink), that way we can have a template/iteration category for the schedule where we put a plan in place already. like add it to the schedule but dont mark it as done yet. (also we need to have the done field in reset data be "no" for default. and not empty. we should also have that be a switch or a button that changes from no to yes


also quickly add in that we should check the resetData if the goals are good with the tasks and habits. i see
  duplicate fields and id like multiple bank accounts. idk if the system reflects this yet (it should) that if i
  have a purchase block, that has 2 fields, account and the amount of the purchase, it should reflect that account.
   im hoping that the multiselect works for that. put in the resetData to add a moms account (derived field) and
  both the bank account and moms account should reflect that the allowed fields are looking for both the account to
   match up with it and the amount and flow. so it should be checking both. thats why the operation type editor we
  were making is important. we have conditions in place that handles that. the snap system we were building. i was
  hoping it has conditions as well. I think we had like a operations hiarchy at one point where conditions came
  first. i think we have what i wanted backwards for the allowed fields thing. id like that to be part of a
  condition block in the derived fields operation editor. like an "if" block that you can drag in and select what
  the conditions are based on diff fields and such. like

if (select incoming fields) is (select or enter values) in (select iterations), (select flows) (select values or counts or maths)

something like that. 

id like the if block to be like the first part and then the action can attach to that. id like it so those if conditions can be grouped with one outcome. ik this is a complicated system but im looking to make sure we have a solid system here that doesnt limit the user. like it should still work as code syntax in a way, going top to bottom. maybe have "and" "or" blocks as well where you can drag and attach other if blocks together and then attach the action after that. But its kinda combinging snap drag and drop, with top to bottom code exection, and like predefined blocks where we can change the things inside, like an if field is this block (so i can select a field). maybe actually. just have a if block thats just "if (select field/or iteration/or instance/or whatever) is/isn't (select or enter value)" and thats the block that you can drag in, with "and" and "or" blocks to combine conditions. then have like a execute this operation block to attach to it, or an include value block or whatever. this should be flushed out more. but add it to phase 6 cause i think the allowed fields is fine now. we just need to make sure i can check for both. 

also add in phase 5, the ability to style instances/containers (with padding and such) and have the overwrite system where you can set it on the parent for the children (like iteration but what we set for each). like panel should have the option to have default container and instance styling. and container should do the same for instance. but it can be overwritten granularly. i think we have that same methology in the rest of the system. also do the same for setting if things are sortable/draggable/droppable and then the granular overwrite with the parent and children relationship. that should mostly be the same method everywhere in the system or at least it should be. im not sure what thats called. ik css does it when applying rules.

also add in in the future how we can make this data recursive so i can zoom in and expand projects from instances. like drill down. so like zoomed out, it looks like pills inside of the instance. but then expanding the instance. like zooms in and shows them as instances. but put that in the future of course. phase 6. 

