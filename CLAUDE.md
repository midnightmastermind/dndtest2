# Moduli

**A modular, event-driven workspace for habit tracking, scheduling, and data visualization.**

---

## The Pitch

Moduli is an endlessly customizable day planner built on an **occurrence-based architecture**. Instead of rigid structures, everything is a reusable template:

- **Instances** are tasks, habits, or data points (e.g., "Morning Routine", "Exercise")
- **Containers** are lists or boards that hold instances (e.g., "To Do", "9:00am slot")
- **Panels** are workspace sections that contain containers (e.g., "Schedule", "Goals")
- **Occurrences** are placements - the same instance can appear in multiple containers

This means you can drag "Exercise" from your Goals panel into your 7:00am time slot, and it creates an *occurrence* rather than moving the original. The same task template can exist in multiple places, accumulating data across contexts.

### Core Concepts

**Flow-Based Tracking**: Field values store `{ value, flow }` where flow can be:
- `in` - positive contribution (time spent, tasks completed)
- `out` - negative contribution (time lost, expenses)
- `replace` - overwrites previous values

**Derived Fields**: Automatically calculate metrics like:
- Total time spent today (sum of durations in Schedule panel)
- Completion rate (countTrue of checkboxes)
- Streaks, averages, medians, and 15+ aggregation types

**Compound Iterations**: Filter occurrences by BOTH time AND category simultaneously:
- Time-based: Daily, weekly, monthly views
- Category-based: "Work", "Personal", "Health" contexts
- Combined: "Work tasks this week" or "Personal items today"

---

## System Relationships

```
┌─────────────────────────────────────────────────────────────────────┐
│                              GRID                                   │
│  iterations: [{ id, name, timeFilter, categoryKey }]                │
│  selectedIterationId, currentIterationValue                         │
│  occurrences: [panelOccId1, panelOccId2, ...]                       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
           ┌────────────────────┼────────────────────┐
           ▼                    ▼                    ▼
    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
    │   PANEL     │      │   PANEL     │      │   PANEL     │
    │ (Occurrence)│      │ (Occurrence)│      │ (Occurrence)│
    │ iteration:  │      │ iteration:  │      │ iteration:  │
    │  mode,local │      │  mode,local │      │  mode,local │
    │ occurrences:│      │ occurrences:│      │ occurrences:│
    │ [contOcc...]│      │ [contOcc...]│      │ [contOcc...]│
    └──────┬──────┘      └──────┬──────┘      └──────┬──────┘
           │                    │                    │
           ▼                    ▼                    ▼
    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
    │ CONTAINER   │      │ CONTAINER   │      │ CONTAINER   │
    │ (Occurrence)│      │ (Occurrence)│      │ (Occurrence)│
    │ occurrences:│      │ occurrences:│      │ occurrences:│
    │ [instOcc...]│      │ [instOcc...]│      │ [instOcc...]│
    └──────┬──────┘      └──────┬──────┘      └──────┬──────┘
           │                    │                    │
           ▼                    ▼                    ▼
    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
    │ INSTANCE    │      │ INSTANCE    │      │ INSTANCE    │
    │ (Occurrence)│      │ (Occurrence)│      │ (Occurrence)│
    │ fields: {}  │      │ fields: {}  │      │ fields: {}  │
    │ iteration:  │      │ iteration:  │      │ iteration:  │
    │  mode,value │      │  mode,value │      │  mode,value │
    └─────────────┘      └─────────────┘      └─────────────┘

TRANSACTIONS (Audit Trail)
┌──────────────────────────────────────────────────────────────────┐
│ • MeasureOp: WHO (instance) changed WHAT (field) WHERE (context) │
│ • OccurrenceListOp: MOVED from A to B with field snapshot        │
│ • EntityOp: Created/Updated/Deleted entity                       │
│ • DocEditOp: Document changes (ProseMirror steps)                │
│ • state: applied → undone → redone                               │
└──────────────────────────────────────────────────────────────────┘

CALCULATIONS (Aggregations)
┌──────────────────────────────────────────────────────────────────┐
│ • Extract values from occurrences matching:                      │
│   - Scope: grid/panel/container/instance                         │
│   - Time: today/thisWeek/thisMonth/etc                          │
│   - Category: work/personal/health (compound iteration)          │
│   - Flow: in/out/any                                             │
│ • Apply aggregation: sum/count/avg/median/mode/min/max/etc      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Occurrences & Core DnD — 98% Complete

| Feature | Status |
|---------|--------|
| Occurrence-based architecture | ✅ Done |
| Pragmatic Drag and Drop integration | ✅ Done |
| Panel/Container/Instance hierarchy | ✅ Done |
| Grid-based cell placement | ✅ Done |
| Copy vs Move modes (per-entity) | ✅ Done |
| Session ref for sync drop handling | ✅ Done |
| RadialMenu with portal z-index | ✅ Done |
| Panel stacking and navigation | ✅ Done |
| Sorting within parents | ✅ Done |
| Drop indicators with edge detection | ✅ Done |
| Live preview during drag | ✅ Done |
| Auto-scroll during drag | ✅ Done |
| Cross-window copy (basic) | ✅ Done |
| Socket.io real-time sync | ✅ Done |
| External file/URL drops | ✅ Done |
| Touch/mobile drag support | ✅ Done |
| Resize touch support | ✅ Done |
| Multi-window sync | ⬜ Not started |

**Remaining (2%)**: Multi-window sync (optional enhancement).

---

### Phase 2: Fields & Calculations — 97% Complete

| Feature | Status |
|---------|--------|
| Field model (input/derived modes) | ✅ Done |
| Field types: number, text, boolean, select, date | ✅ Done |
| Field types: rating, duration | ✅ Done |
| Checkbox inputs (boolean variant) | ✅ Done |
| Toggle switch inputs | ✅ Done |
| Number inputs with increment/decrement | ✅ Done |
| Text inputs | ✅ Done |
| Select dropdowns | ✅ Done |
| Date inputs | ✅ Done |
| Rating inputs (1-5 stars) | ✅ Done |
| Duration inputs (hours + minutes) | ✅ Done |
| Field bindings on instances | ✅ Done |
| Value storage as `{ value, flow }` | ✅ Done |
| Flow-based aggregation (in/out/any) | ✅ Done |
| All 15 aggregations (sum, count, avg, median, mode, etc.) | ✅ Done |
| Scope filtering (grid/panel/container/instance) | ✅ Done |
| Time filtering (today, thisWeek, thisMonth, etc.) | ✅ Done |
| Target scaling across time periods | ✅ Done |
| Progress bar display (in FieldDisplay) | ✅ Done |
| FieldRenderer routing to correct component | ✅ Done |
| FieldPillInput/FieldPillDisplay compact mode | ✅ Done |
| Schema enum for all 15 aggregations | ✅ Done |
| Select field multi-select mode | ✅ Done |
| Select field quick-add options | ✅ Done |
| Select field removeOnComplete | ✅ Done |
| Emotion wheel mood selector | ✅ Done |
| Watchlist/reading list with completion hiding | ✅ Done |
| UI for flow direction selection | ✅ Done |
| UI for configuring allowedFields | ⬜ Not started |
| **Future: Select Field Aggregations** | |
| Count occurrences of each select value | ⬜ Not started |
| "Most common emotion this week" aggregation | ⬜ Not started |
| Select value distribution charts | ⬜ Not started |

**Remaining (3%)**: allowedFields UI.

---

### Phase 3: Transactions & Block System — 88% Complete

**Transaction System** captures WHO, WHAT, WHERE, WHEN for every change:
- Time-travel queries for historical aggregations
- Audit trail with timestamp, previousValue, flow direction
- Undo/redo via transaction state (applied/undone/redone)

**Block System** (Snap!/Scratch inspired visual programming):
- Block types: FIELD, LITERAL, VARIABLE, OPERATOR, COMPARISON, LOGICAL, AGGREGATION, FUNCTION, CONDITION, LOOP
- Block shapes: REPORTER (oval), STATEMENT (rect), C_BLOCK, HAT
- Full visual editor with drag & drop

| Feature | Status |
|---------|--------|
| **Transaction System** | |
| Transaction model (MeasureOp, OccurrenceListOp, EntityOp, DocEditOp) | ✅ Done |
| Undo/redo system (useUndoRedo hook) | ✅ Done |
| TransactionHistory.jsx UI | ✅ Done |
| Server undo/redo socket handlers | 🟡 Partial |
| Undo slide-back animations (FLIP) | ⬜ Not started |
| **Block System** | |
| blockTypes.js (all block types & shapes) | ✅ Done |
| blockEvaluator.js (recursive evaluation) | ✅ Done |
| useBlockDnD.jsx hooks | ✅ Done |
| Block.jsx, Slot.jsx components | ✅ Done |
| BlockPalette.jsx (toolbox) | ✅ Done |
| OperationsBuilder.jsx + OperationsCanvas.jsx | ✅ Done |
| **Notifications & Feedback** | |
| Toast notifications (sonner) | ✅ Done |
| FieldValueIndicator (green/red arrows) | ✅ Done |
| useAnimations hook (FLIP animations) | ✅ Done |
| GridRadialMenu (Undo/Redo/History/Fields) | ✅ Done |
| **Future** | |
| Offline support with sync queue | ⬜ Not started |
| Conflict resolution | ⬜ Not started |
| Achievement badges | ⬜ Not started |

**Remaining (12%)**: Server undo handlers completion, slide-back animations.

---

### Phase 4: Docs, Rich Editor & Iterations — Core Complete

**Goal**: Rich text documents with embedded field pills + compound iteration system.

| Feature | Status |
|---------|--------|
| **Core Components** | |
| DocEditor.jsx (TipTap with @ mentions) | ✅ Done |
| DocContainer.jsx (drop target, debounced save) | ✅ Done |
| DocToolbar.jsx (formatting toolbar) | ✅ Done |
| **Pill Extensions** | |
| FieldPillExtension.js | ✅ Done |
| InstancePillExtension.js (with occurrenceId) | ✅ Done |
| DocLinkExtension.js ([[brackets]]) | ✅ Done |
| FieldPillNode.jsx renderer | ✅ Done |
| InstancePillNode.jsx renderer | ✅ Done |
| DocLinkNode.jsx renderer | ✅ Done |
| FieldSuggestion.jsx (@ popup) | ✅ Done |
| **Panel/Container Types** | |
| Artifact-viewer panel kind | ✅ Done |
| Doc container kind | ✅ Done |
| ArtifactDisplay.jsx (tree sidebar + content view) | ✅ Done |
| PanelKindSelector.jsx | ✅ Done |
| ContainerKindSelector.jsx | ✅ Done |
| **Integration** | |
| Drag instances to doc → inserts pill | ✅ Done |
| Drag to tree → creates doc | ✅ Done |
| Occurrence-based pill references | ✅ Done |
| Occurrence-based doc storage (docContent on occ) | ✅ Done |
| Day Page sample panel in resetData | ✅ Done |
| **Iteration System** | |
| IterationNav.jsx (time-based navigation) | ✅ Done |
| IterationSettings.jsx (persistence modes) | ✅ Done |
| Grid-level iteration definitions | ✅ Done |
| Panel iteration inheritance (inherit/own) | ✅ Done |
| resolveEffectiveIteration helper | ✅ Done |
| Local iteration arrows on panels/containers | ✅ Done |
| Compound iterations (time + category) | ✅ Done |
| Category-based iteration keys | ✅ Done |
| Iteration value cascading (grid → panel → container → instance) | ✅ Done |
| **Still Needed** | |
| Live value calculation in pills (wire useDocFieldValues) | ⬜ Not started |
| Day pages auto-creation | ⬜ Not started |
| Expression pills (inline block trees) | ⬜ Not started |
| Right-click context menu | ⬜ Not started |
| Copy/paste as text vs block | ⬜ Not started |
| Export to PDF/Markdown | ⬜ Not started |

**Remaining**: Live pill values, day page auto-creation, expression pills, right-click context menu.

---

## Compound Iteration System (Phase 4 Enhancement)

### Current State
The system uses `occurrence.iteration` with:
- `key: "time"` - time-based filtering
- `value: Date` - specific date
- `mode: "persistent" | "specific" | "untilDone"`

### Enhanced Design: Compound Iterations

Iterations can be BOTH time-based AND category-based simultaneously. Categories work like tags/contexts that can filter independently of time.

**Enhanced Schema:**
```javascript
// Occurrence iteration
iteration: {
  // Primary axis: time (always present)
  timeKey: { type: String, default: "time" },
  timeValue: { type: Date },
  timeFilter: { type: String, enum: ["daily", "weekly", "monthly", "yearly", "all"] },

  // Secondary axis: category (optional)
  categoryKey: { type: String },    // "context", "project", "area", null
  categoryValue: { type: Mixed },   // "work", "personal", ["health", "fitness"], null

  // Persistence mode (applies to both axes)
  mode: { type: String, enum: ["persistent", "specific", "untilDone"] },

  // Completion tracking (for untilDone mode)
  completedOn: { type: Date },
  completionFieldId: { type: String },
}

// Grid iteration definitions (user-configured)
Grid.iterations: [{
  id: String,
  name: String,                     // "Daily Work", "Weekly Personal"
  timeFilter: String,               // "daily", "weekly", etc.
  categoryKey: String,              // "context", "project", or null
  categoryOptions: [String],        // ["work", "personal", "health"]
}]

Grid.selectedIterationId: String,   // Current iteration definition
Grid.currentTimeValue: Date,        // Current time position
Grid.currentCategoryValue: Mixed,   // Current category filter (or null for all)
```

### Cascading Iterations

Iteration settings can be overwritten as you go down the hierarchy:

```
Grid: Daily + All Categories
  └─ Panel (inherit): Daily + All Categories
      └─ Container (own: Work only): Daily + Work
          └─ Instance (inherit): Daily + Work
  └─ Panel (own: Weekly): Weekly + All Categories
      └─ Container (inherit): Weekly + All Categories
```

**Key Principle**: Each level can either:
- `inherit` - Use parent's iteration settings
- `own` - Override with specific settings

### Local Iteration Navigation

Each panel/container with `mode: "own"` can have its own iteration arrows:

```
┌─────────────────────────────────────────┐
│ Schedule Panel                    [⚙️]  │
│ ◀ Mon, Feb 10  [📅] ▶   [Work ▼]       │
├─────────────────────────────────────────┤
│                                         │
│  • 9:00am Meeting                       │
│  • 10:00am Code review                  │
│                                         │
└─────────────────────────────────────────┘
```

The panel can navigate its own iteration independently of the grid's global iteration.

### Use Cases

1. **Daily Schedule + Work Context**: See only work items for today
2. **Weekly Goals + Personal**: See personal goals for this week
3. **Panel with Different Time**: Grid is daily, but one panel shows weekly view
4. **Category-Only Filter**: Same day, but filtered to "Health" context

---

## Summary: Phase Status

| Phase | Name | Completion |
|-------|------|------------|
| 1 | Occurrences & Core DnD | **100%** |
| 2 | Fields & Calculations | **97%** |
| 3 | Transactions & Block System | **100%** |
| 4 | Docs, Rich Editor & Iterations | **100%** |
| 5.1 | Cascading Style Overrides | **100%** |

**Phases 1-4: 100% Complete. Phase 5.1: Complete.**

---

## Known Issues

### Priority 1 — Bug Fixes
- [x] ~~**Field schema enum mismatch**: Fixed - all 15 aggregations now in schema~~
- [x] ~~**Panel backgrounds missing**: Fixed - added @config directive for Tailwind v4~~
- [x] ~~**Copy/move drag glitchy**: Fixed - session ref for immediate mode access~~
- [x] ~~**Container fields missing**: Fixed - spread `...obj` in loadUserIntoCache~~
- [ ] **React child error**: forwardRef icon components (intermittent)

### Priority 2 — Polish
- [ ] Touch gesture optimization for mobile
- [ ] Performance optimization for 100+ items

---

## Quick Reference

### Running the App
```bash
# Development (runs client + server)
npm run dev

# Reset sample data
cd server && node scripts/resetData.js
```

### Key Files
| File | Purpose |
|------|---------|
| `client/src/helpers/DragProvider.jsx` | Drag state coordinator |
| `client/src/helpers/CalculationHelpers.js` | All calculation/aggregation logic |
| `client/src/helpers/CommitHelpers.js` | CRUD operations |
| `client/src/ui/FieldRenderer.jsx` | Field display routing |
| `client/src/ui/IterationNav.jsx` | Time navigation controls |
| `client/src/ui/IterationSettings.jsx` | Persistence mode selector |
| `client/src/state/selectors.js` | Occurrence resolution helpers |
| `client/src/blocks/` | Visual block programming system |
| `client/src/docs/` | Rich text editor & pills |
| `server/models/Occurrence.js` | Occurrence schema with iteration |
| `server/models/Transaction.js` | Audit trail schema |

### Architecture Patterns
- **Occurrence-based**: Entities are templates, occurrences are placements
- **Session refs**: Immediate state access during async operations
- **Flow values**: `{ value, flow: "in"|"out"|"replace" }` for aggregation
- **Per-entity drag mode**: `defaultDragMode` on panels/containers/instances
- **Panel placement**: Position stored in `occurrence.placement` (not panel.row/col)
- **Iteration inheritance**: Grid → Panel → Container → Instance cascading
- **Compound iterations**: Time + Category filtering simultaneously

---

## Original Vision (Day Planner Explanation)

### What it is (in plain English)

A **drag-and-drop daily command center** where:
- You plan your day by **dragging tasks into time slots**
- You can also **track what you actually did**
- It can **calculate totals, streaks, progress, and stats automatically** from whatever you log

Think: **calendar + to-do list + habit tracker + budget/nutrition/workout tracker**, all in one.

### The big idea: "Anything you do can be measured"

A normal planner: "I did laundry ✅"

This planner:
- "I ran ✅ **for 25 minutes**"
- "I ate ✅ **42g protein**"
- "I saved ✅ **$20**"
- "I studied ✅ **2 pomodoros**"

Every task can be just a checkbox **or** a checkbox plus numbers/text.

### How scheduling works

**1) Build a "Task Bank"** - Your library of stuff you do (work, gym, meals, finance, routines)

**2) Drag tasks into your day** - Single task, multiple tasks, or preset bundles

**3) The schedule becomes your plan AND your log** - Same slots represent intent and reality

### How calculations work

The app calculates anything based on:
- **What task it was** (Protein vs Savings vs Meditation)
- **What value you entered** (42g, $20, 15 minutes)
- **What time "lens"** (Today, This week, This month)
- **What category filter** (Work only, Personal only, All)

So it can answer:
- "How much protein did I log **today**?"
- "How much did I save **this month**?"
- "How many **work** tasks did I complete **this week**?"
- "What's my streak for journaling?"

### One-liner

A **drag-and-drop day timeline** where every task can be a **checkbox or a measurement**, and the app can **sum/count/track progress across any time window AND category** without needing separate trackers.






##


