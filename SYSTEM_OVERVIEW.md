# Moduli — System Overview

**Last updated**: 2026-02-16
**Version**: Phase 5.1 complete (Cascading Styles)

---

## What Moduli Is

A **drag-and-drop daily command center** built on an **occurrence-based architecture**. Everything is a reusable template — tasks, lists, panels — and when you place something, you create an *occurrence* (a placement reference) rather than moving the original. This means the same task can live in multiple places, accumulating data independently per context.

Think: **calendar + to-do list + habit tracker + budget/nutrition/workout tracker + notebook + file manager**, all in one draggable workspace.

The app runs as a **React + Vite** client with a **Node/Express + MongoDB + Socket.io** server. All changes are real-time via websockets with optimistic local updates.

---

## The Core Idea

A normal planner: "I did laundry"

Moduli:
- "I ran **for 25 minutes**" → duration field, flow: in
- "I ate **42g protein**" → number field, flow: in
- "I saved **$20**" → number field, flow: in
- "I studied **2 pomodoros**" → number field, flow: in

Every task can be just a checkbox **or** a checkbox plus any number of typed measurements. Those measurements aggregate automatically across any time window (today, this week, this month) and any category filter (work, personal, health).

---

## The 15 Models

Moduli has 15 database models that compose into a flexible workspace system.

### Hierarchy Models (The Spine)

```
GRID (root workspace)
 │
 ├──→ PANEL (via Occurrence)        — workspace sections
 │     │
 │     ├──→ CONTAINER (via Occurrence) — lists/boards/docs
 │     │     │
 │     │     └──→ INSTANCE (via Occurrence) — tasks/habits/data points
 │     │
 │     └──→ VIEW                     — display configuration
 │
 ├──→ OCCURRENCE                     — the spine connecting everything
 │
 └──→ FIELD                          — grid-level measurement definitions
```

### Content Models (Files & Documents)

```
MANIFEST (root of a file tree)
 │
 └──→ FOLDER (recursive tree nodes)
       │
       ├──→ DOC (rich text documents with pills)
       │
       └──→ ARTIFACT (uploaded files: images, PDFs, etc.)
```

### System Models

```
TRANSACTION    — audit trail (WHO changed WHAT WHERE WHEN)
OPERATION      — visual block programs (Snap!-style calculations)
ITERATION      — time + category filter definitions
```

### Auth

```
USER           — email/password authentication
```

---

## Model Details

### Grid
The root workspace. A user can have multiple grids (e.g., "Work Planner", "Health Tracker").

| Key Fields | Purpose |
|------------|---------|
| rows, cols, colSizes, rowSizes | Grid layout dimensions |
| occurrences[] | Panel occurrence IDs (what panels are placed in this grid) |
| iterations[] | Time filter definitions (daily, weekly, monthly) |
| categoryDimensions[] | Compound iteration categories (work, personal, health) |
| selectedIterationId | Currently active time filter |
| currentIterationValue | Current date/time being viewed |
| selectedCategoryId | Currently active category filter |
| currentCategoryValue | Current category value (or null = all) |
| fieldIds[] | Registry of all fields in this grid |
| templates[] | Saved container content snapshots |

### Panel
A workspace section that contains containers. Positioned in grid cells.

| Key Fields | Purpose |
|------------|---------|
| kind | board, doc, mixed, notebook, artifact-viewer |
| viewId → View | Determines how the panel renders its content |
| occurrences[] | Container occurrence IDs |
| iteration.mode | "inherit" (use grid's) or "own" (independent navigation) |
| defaultDragMode | move, copy, or copylink |
| layout | Display config: grid/flex/columns, gap, scroll, padding |
| siblingLinks[] | Related panel IDs (for future Q&A pairing) |

### Container
A list or board that holds instances. Child of panels.

| Key Fields | Purpose |
|------------|---------|
| kind | list, log, doc, smart |
| occurrences[] | Instance occurrence IDs |
| iteration.mode | inherit or own |
| defaultDragMode | move, copy, or copylink |
| docContent | ProseMirror JSON (for doc containers) |
| defaultTemplateId | Auto-fill template on new iteration |
| siblingLinks[] | Related container IDs |

### Instance
A task, habit, or data point template. Can appear in multiple containers.

| Key Fields | Purpose |
|------------|---------|
| kind | list, doc, file, canvas |
| fieldBindings[] | Which fields this instance uses, with role and order |
| iteration.mode | inherit or own |
| defaultDragMode | move, copy, or copylink |
| meta.autoCheckOnDrop | Auto-check boolean fields when dropped |
| siblingLinks[] | Related instance IDs |

### Occurrence (The Spine)
The most important model. Nothing is placed directly — panels, containers, and instances all exist in their parent's hierarchy via occurrences.

| Key Fields | Purpose |
|------------|---------|
| targetType | "panel", "container", or "instance" |
| targetId | ID of the entity this occurrence wraps |
| placement | { row, col, width, height } — for panels in grid cells |
| fields | { fieldId: { value, flow } } — field value snapshot for this placement |
| docContent | ProseMirror JSON — per-occurrence doc content (e.g., different day pages) |
| iteration.timeValue | What date this occurrence belongs to |
| iteration.timeFilter | daily, weekly, monthly, yearly, all |
| iteration.categoryKey | "context", "project", etc. |
| iteration.categoryValue | "work", "personal", etc. |
| iteration.mode | persistent (always visible), specific (date-locked), untilDone |
| linkedGroupId | For copylink mode — field edits propagate to all siblings |

**Why this matters**: The same instance "Exercise" can have:
- An occurrence in the Morning slot with duration=30min
- An occurrence in the Evening slot with duration=45min
- An occurrence in the Goals panel showing its aggregate
- Each occurrence has its own field values, its own iteration context, its own doc content

### Field
Grid-level measurement definitions. Two modes: input and derived.

**Input fields** (user enters values):
- Types: number, text, boolean, select, date, rating, duration
- Flow direction: in (positive), out (negative), replace (overwrite)
- Select fields support: multi-select, emotion wheel (48 options), removeOnComplete

**Derived fields** (auto-calculated):
- 16 aggregation types: sum, count, countTrue, avg, median, mode, min, max, first, last, range, stdDev, product, concat, unique, random
- Scope: grid, panel, container, custom
- Time window: today, thisWeek, thisMonth, thisYear, all
- allowedFields: which input fields feed into this aggregation
- target: { value, period } for progress bars

### View
Display configuration for panels. Determines how a panel renders.

| viewType | Renders As |
|----------|-----------|
| list | Standard container grid (default board) |
| notebook | Tree sidebar + doc editor |
| artifact-viewer | Content viewer (no tree) |
| doc-viewer | Single document editor |
| file-manager | Tree + folder grid with uploads |
| canvas | (Stub — future whiteboard) |

| Key Fields | Purpose |
|------------|---------|
| manifestId → Manifest | Which file tree to show |
| showTree | Show/hide sidebar |
| activeDocId | Currently open document |
| activeArtifactId | Currently viewed file |
| sortBy, sortDirection | Tree/grid sorting |

### Manifest
Root of a file tree. Each grid can have multiple manifests.

| Key Fields | Purpose |
|------------|---------|
| manifestType | files, day-pages, templates |
| rootFolderId → Folder | Top of the tree |

### Folder
Recursive tree node for organizing content.

| Key Fields | Purpose |
|------------|---------|
| parentId → Folder | null = root level |
| folderType | normal, trash, templates, day-pages |
| isExpanded | UI state for tree |

### Doc
Rich text document with embedded pills.

| Key Fields | Purpose |
|------------|---------|
| content | ProseMirror JSON |
| pills[] | Embedded field/instance/expression/link pills |
| docType | normal, day-page, template, journal |
| dayPageDate | For auto-created daily pages |
| folderId → Folder | Where in the tree |

### Artifact
Uploaded file (image, PDF, video, etc.).

| Key Fields | Purpose |
|------------|---------|
| mimeType, extension, size | File metadata |
| storageType | local, mongodb, s3, url |
| artifactType | file, image, video, audio, pdf, archive |
| folderId → Folder | Where in the tree |

### Transaction
Audit trail capturing every change.

| Key Fields | Purpose |
|------------|---------|
| operations[] | Batched: MeasureOp, OccurrenceListOp, EntityOp, DocEditOp |
| state | applied, undone, redone |
| sequence | Position in undo chain |

**MeasureOp**: WHO (instance) changed WHAT (field) WHERE (container) — with previousValue for undo
**OccurrenceListOp**: MOVED from A to B with field snapshot
**EntityOp**: Created/Updated/Deleted entity with previousData
**DocEditOp**: Document changes (ProseMirror steps)

### Operation
Snap!-style visual block program for calculations.

| Key Fields | Purpose |
|------------|---------|
| blockTree | Recursive block structure (FIELD, LITERAL, OPERATOR, AGGREGATION, etc.) |
| targetFieldId | Which field this operation calculates |
| triggerType | onChange, onDrop, onInterval, manual |

### Iteration
Standalone iteration definition (time + category).

| Key Fields | Purpose |
|------------|---------|
| timeFilter | daily, weekly, monthly, yearly, all |
| categoryKey | "context", "project", etc. |
| categoryOptions[] | Available values for this category |
| mode | persistent, specific, untilDone |

---

## How Drag & Drop Works

### The Three Modes

Every entity has a `defaultDragMode` that determines what happens on drop:

| Mode | What Happens | Use Case |
|------|-------------|----------|
| **Move** | Occurrence transfers from source to destination | Reorganizing your day |
| **Copy** | New occurrence of same entity created (date-specific) | Dragging template task into schedule |
| **Copylink** | New linked occurrence (field edits propagate to all copies) | Task that should sync values everywhere |

Mode cycles: move → copy → copylink → move (via toggle button or Alt key)

### What Can Go Where

| Source | Target | Move | Copy | Copylink |
|--------|--------|------|------|----------|
| **Panel** | Grid Cell | Repositions in grid | Cross-window: deep-copies entire panel tree | — |
| **Container** | Panel | Reorders/moves between panels | Cross-window: clones container + instances | — |
| **Instance** | Container | Reorders/moves between containers | New occurrence (date-specific, copies fields) | Linked occurrence (shared field updates) |
| **Instance** | Doc Editor | — | Inserts instance pill at cursor | — |
| **Instance** | Tree Node | — | Creates new doc with instance pill | — |
| **Field** | Doc Editor | — | Inserts field pill at cursor | — |
| **Field** | Tree Node | — | Creates new doc with field pill | — |
| **Container** | Doc Editor | — | Inserts bolded label + instance list | — |
| **Doc/Folder/Artifact** | Tree Folder | Moves to new folder | — | — |
| **External File/URL/Text** | Container | Creates new instance + occurrence | — | — |

### Live Preview
While dragging, the system uses draft copies (session ref) to show instant visual feedback:
- Instance drags show reorder position in real-time
- Edge detection: cursor above/below midpoint determines insert before/after
- Auto-scroll when dragging near panel edges

### Copylink Propagation
When you update fields on an occurrence with a `linkedGroupId`:
1. Server finds all other occurrences with the same linkedGroupId
2. Applies the same field changes to every sibling
3. Broadcasts updates to all windows

### Panel Stacking
Multiple panels can occupy the same grid cell. Stack navigation arrows in the header let you cycle between them.

---

## Iteration System

### Time-Based
Grid defines iteration types (Daily, Weekly, Monthly). The toolbar shows date navigation for the current iteration. All occurrences are filtered by the current date.

### Category-Based (Compound)
Grid defines category dimensions (e.g., "Context" with values: work, personal, health, finance). Toolbar shows category selector. Occurrences can be filtered by BOTH time AND category simultaneously.

### Persistence Modes

| Mode | Behavior |
|------|----------|
| **persistent** | Always visible regardless of date (templates, containers, structure) |
| **specific** | Only visible on the specific date it was created (schedule items, day pages) |
| **untilDone** | Visible until completed, then locked to completion date (todo items) |

### Inheritance
Each level can inherit or override:
```
Grid: Daily + All Categories
  └─ Panel (inherit): Daily + All Categories
      └─ Container (own: Work only): Daily + Work
          └─ Instance (inherit): Daily + Work
  └─ Panel (own: Weekly): Weekly + All Categories
```

---

## Calculation System

### How It Works
1. Define input fields on a grid (number, boolean, duration, etc.)
2. Bind fields to instances (via fieldBindings)
3. Users fill in values on occurrences
4. Derived fields automatically aggregate: `totalSteps = sum(steps, scope: grid, timeFilter: daily)`

### Flow-Based Aggregation
Values carry a flow direction:
- `in`: positive contribution (time spent, income, calories consumed)
- `out`: negative contribution (expenses, time wasted)
- `replace`: overwrites previous value

Derived fields can filter by flow: "sum all income fields (flow: in) this week"

### 16 Aggregation Types
sum, count, countTrue, avg, median, mode, min, max, first, last, range, stdDev, product, concat, unique, random

---

## Rich Text Editor

### Tiptap-Based
ProseMirror foundation with custom extensions:
- **FieldPill**: Inline display of a field value (live-updating)
- **InstancePill**: Inline reference to an instance (clickable)
- **DocLink**: [[bracket]] links between documents

### @ Mention System
Type `@` to search and insert:
- Fields → inserts FieldPill
- Instances → inserts InstancePill
- Containers → inserts bolded container label with instance list

### Doc Storage
Doc content is stored on the **occurrence**, not the container. This means the same "Daily Journal" container can have different content for each day (each day is a different occurrence with its own docContent).

### Toolbar
Bold, italic, strikethrough, code, H1/H2/H3, bullet/numbered lists, blockquote, horizontal rule, undo/redo, @ field insert, text-to-pill conversion.

---

## File System

### Structure
```
Grid
└── Manifest ("Files", type: files)
    └── Root Folder
        ├── Day Pages/ (folderType: day-pages)
        │   └── Daily Journal - 2026-02-15 (docType: day-page)
        └── Documents/ (folderType: normal)
            └── Welcome to Moduli (docType: normal)
```

### File Upload
- REST endpoint: POST /api/upload (multer)
- Supports: images, videos, audio, PDFs, archives
- Upload buttons in file manager view
- Drag files from desktop into file manager

### Viewing
MediaContainer handles: images (<img>), video (<video>), audio (<audio>), other files (icon + metadata).

---

## Transaction System

### Audit Trail
Every field change creates a Transaction with:
- **MeasureOp**: fieldId, value, previousValue, flow, trigger type
- **OccurrenceListOp**: action (add/remove/move/copy), from/to locations
- **EntityOp**: create/update/delete with previous state
- **DocEditOp**: ProseMirror steps with previous content

### Undo/Redo
- Ctrl+Z / Ctrl+Y keyboard shortcuts
- Toolbar buttons + TransactionHistory modal
- Server-side reversal: restores previousValue, moves occurrences back, un-deletes entities
- Full state sync on undo/redo (all windows updated)

---

## Block System (Visual Programming)

Snap!/Scratch-inspired visual programming for calculations:
- Block types: FIELD, LITERAL, VARIABLE, OPERATOR, COMPARISON, LOGICAL, AGGREGATION, FUNCTION, CONDITION, LOOP
- Block shapes: REPORTER (oval), STATEMENT (rect), C_BLOCK, HAT
- Components: BlockPalette, Block, Slot, OperationsBuilder, OperationsCanvas
- Evaluator: blockEvaluator.js recursively evaluates block trees

Operations are stored on the Operation model and linked to target fields. When triggered, the block tree evaluates and updates the field value.

---

## Template System

### Container Templates
Save a container's current contents as a template (stored on Grid.templates[]):
- Template = { name, items: [{ instanceId, fieldDefaults }] }
- "Fill from Template" creates new occurrences with field defaults
- Use case: "Morning Routine" bundle that creates 6 instances in a container

---

## Real-Time Sync

### Socket.io Architecture
- **Optimistic updates**: Client dispatches locally, emits to server
- **No-echo**: Server broadcasts to all OTHER windows (sender already updated)
- **Exception**: Copylink propagation broadcasts to ALL windows including sender
- **Full sync**: Undo/redo triggers `sync_state` to all windows

### Events
56 action types in the reducer, 35+ socket event listeners, 35+ socket emissions. All 15 models have full CRUD wiring (client state + socket + server handlers + CommitHelpers).

---

## Sample Data Layout

A fresh reset creates a 2x3 grid:

```
┌─────────────────┬──────────────────────┬─────────────────┐
│ Daily Toolkit    │ Schedule (48 slots)  │ Daily Goals     │
│ (copy mode)      │ / Day Page (stacked) │ (8 dimensions)  │
│ 8 wellness dims  │ (spans 2 rows)       │ derived fields  │
│ 35 instances     │                      │ cascading styles│
├─────────────────┤                      ├─────────────────┤
│ Todo List        │                      │ Accounts        │
│ (move mode)      │                      │ (lifetime stats)│
│ 4 categories     │                      │                 │
└─────────────────┴──────────────────────┴─────────────────┘
```

**Totals**: 6 panels, 74 containers, 74 instances, 50 fields (28 input + 22 derived), ~180 occurrences, 1 manifest, 3 folders, 3 docs (Welcome + Daily Journal + Stan lyrics), 5 iterations, 1 operation, 1 template.

### New in Phase 5.1
- **Cascading styles**: Schedule panel → blue container tint, Goals panel → green tint, Morning Workout/Meditation have own style overrides
- **StyleEditor** in ContainerForm, InstanceForm, and LayoutForm for inherit/own mode + color/border/opacity/etc
- **Heading live preview**: # marks only visible when cursor is on that heading (Obsidian-style)
- **Double-click pill editing**: Edit instance/field labels inline in docs
- **Categorized todo containers**: Home & Errands, Finance & Admin, Work Projects, Personal / Fun
- **Combined Reading/Watchlist**: Single "Reading" instance with select+quickAdd for books; same for "Watch Movie"
- **Evening reflection Q&A pills**: What went well / What could be improved / Gratitude as field pill pairs
- **Stan lyrics doc**: Each stanza is an instance pill in a Document

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Client | React 18 + Vite |
| Styling | Tailwind CSS v4 + shadcn/ui components |
| Drag & Drop | @atlaskit/pragmatic-drag-and-drop |
| Rich Text | Tiptap (ProseMirror) |
| State | useReducer + Context (no Redux) |
| Real-time | Socket.io |
| Server | Node.js + Express |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcrypt |
| File Upload | multer |

---

## Running the App

```bash
# Development (runs client + server)
npm run dev

# Reset sample data
cd server && node scripts/resetData.js

# Run data integrity tests
cd server && node scripts/testData.js
```
