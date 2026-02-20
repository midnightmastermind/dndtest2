# Moduli — Future Roadmap

**Last updated**: 2026-02-16

---

## The Vision

Moduli isn't just a planner. It's an **adaptive data surface** — a personal operating system for capturing, organizing, measuring, and displaying anything from anywhere.

Think Jarvis from Iron Man. The scene where Tony hijacks every screen in the room, flicks data between surfaces, pulls files from thin air, and the system just *knows* where things go. That's the north star.

Concretely, this means:
- **Capture from anywhere**: Browser extension clips a webpage → instance with URL field. Voice command adds a task. Phone photo → artifact in file tree. API call from a script → field value update. VR hand gesture → drag item between panels.
- **Display anywhere**: Embed a panel in another app. Project your schedule onto a VR workspace. Push today's goals to a smartwatch. Render a read-only dashboard on a TV.
- **Connect to everything**: Calendar events become schedule items. Health data auto-populates fields. Bank transactions flow into expense tracking. Webhook fires when a habit streak breaks.

The occurrence-based architecture is *designed* for this. Because entities are templates and occurrences are placements, the same data can exist in multiple contexts simultaneously — a browser, a VR headspace, a phone widget, an API response — each with its own view, its own iteration context, its own field values.

---

## Current Status

| Phase | Focus | Status |
|-------|-------|--------|
| Phase 1 | Occurrences & Core DnD | ✅ 100% |
| Phase 2 | Fields & Calculations | ✅ 100% |
| Phase 3 | Transactions & Block System | ✅ 100% |
| Phase 4 | Docs, Artifacts & Rich Editor | ✅ 100% |
| Phase 5.1 | Cascading Style Overrides | ✅ 100% |

**Phases 1-4: 100% complete. Phase 5.1 done.** Core architecture, DnD system, field calculations, rich text editor, file system, copylink mode, templates, iteration system, and cascading style overrides are all working.

---

## Phase 5: CSS Overhaul & Polish

**Goal**: Clean, organized, themeable styling. Tailwind-first. Dark mode.

### 5.1 Cascading Style Overrides ✅ Complete

Implemented a cascading style system (Grid → Panel → Container → Instance) with inherit/own modes, StyleHelpers.js, StyleEditor.jsx, and wired into all forms and display components. Sample styles in resetData (blue-tinted Schedule containers, green-tinted Goals containers, orange/purple instance overrides).

### 5.2 CSS Audit & Cleanup

| Task | What | Why |
|------|------|-----|
| Audit index.css | Extract all custom classes into Tailwind utilities/components | index.css has grown organically; need to identify what's Tailwind, what's custom, what's dead |
| Remove inline styles | Replace `style={{}}` objects in components with Tailwind classes | Components like DragProvider, Panel, Grid use inline styles for dynamic values — keep only truly dynamic ones (grid-column, transform) |
| Create component patterns | `.panel-card`, `.container-card`, `.instance-row` with Tailwind @apply | Currently each component hand-rolls its own border/bg/padding. Standardize. |
| ProseMirror styles | Move to dedicated `doc-editor.css` | Doc styling is scattered between index.css and component-level |
| Remove dead CSS | Delete unused rules | Multiple rounds of iteration left behind orphaned styles |
| Normalize spacing | Consistent gap/padding/radius scale | Currently mix of 2/4/6/8px gaps and sm/md/lg padding |

### 5.3 Theme System

| Task | What | Where |
|------|------|-------|
| Semantic color tokens | surface, border, accent, muted, primary, success, warning, danger | `tailwind.config.js` — use CSS custom properties for runtime switching |
| Dark mode | `dark:` variant classes + `prefers-color-scheme` detection | Every component needs dark variants. shadcn/ui components already support this. |
| Light mode | Clean defaults (current colors are dark-ish) | Decide on a light palette |
| Theme storage | `localStorage.getItem("moduli-theme")` + `grid.meta.theme` | Per-user preference that persists |
| Theme toggle | Button in Toolbar | Simple sun/moon toggle |

### 5.4 Component Style Standards

Every component category gets a defined visual spec:

**Panel**: header height 36px, drag handle full-width, action buttons right-aligned, subtle border, background surface color, shadow on hover during drag.

**Container**: 1px border, rounded-md, label text-sm font-medium, hover:bg-muted/50, drag handle left side, collapse/expand animation.

**Instance**: single row, checkbox left, label center, field pills right, hover:bg-accent/10, dragging:opacity-50 + shadow-lg.

**Form dialogs**: consistent label/input/button spacing via shared form classes, max-width constraint, scroll for overflow.

**Tree sidebar**: 16px indentation per level, hover highlight, selected=bg-accent, expand/collapse chevron, drop indicator lines.

**Doc editor**: font-size 13px, line-height 1.6, heading scale (1.5em/1.25em/1.1em), pill inline-flex with rounded-full bg-accent/20.

### 5.5 Responsive Layout

| Breakpoint | Behavior |
|-----------|----------|
| Desktop (>1024px) | Full grid layout as configured |
| Tablet (768-1024px) | Collapse to 2 columns, panels stack vertically |
| Mobile (<768px) | Single column, panels as full-width cards, bottom nav for panel switching |

### 5.6 Remaining Phase 1-4 Nice-to-Haves

Items that weren't critical but should be cleaned up:

| Task | From Phase | Status |
|------|-----------|--------|
| Flow direction UI | P2 | ✅ Done — FlowToggle Popover in FieldInput.jsx |
| Link indicators | P4 | ✅ Done — Chain icon on linked instances |
| Break link UI | P4 | ✅ Done — Break Link + View All Links |
| Q&A field pairing | P4 | ✅ Done — siblingLinks with journalQuestion/Answer |
| Advanced pill UX | P4 | ✅ Done — Drag pills out of doc, backspace behavior, double-click edit |
| Undo FLIP animations | P3 | Not started |
| PDF viewer | P4 | Not started |
| Day page template | P4 | Not started |
| Operations builder DnD | P3 | Not started |
| Markdown extensions | P4 | Not started — Tables, callout blocks, toggle lists |

### 5.7 Architecture Cleanup

| Task | Priority | Detail |
|------|----------|--------|
| Normalize iteration schema | HIGH | ✅ Done — Consolidated to timeValue/timeFilter/categoryKey/categoryValue. Legacy `value` field kept for backward compat. |
| Fix items/occurrences naming | LOW | ✅ Done — Renamed UPDATE_CONTAINER_ITEMS → UPDATE_CONTAINER_OCCURRENCES |
| Derive grid.fieldIds | MED | Not started — `grid.fieldIds` should be computed from `Field.find({gridId})` on demand |
| Standalone Template model | LOW | Not started — Make top-level model for cross-grid sharing |
| JSDoc or TypeScript | LOW | Not started — Add interfaces for all 15 models |

---

## Phase 6: Performance & Data Integrity

**Goal**: Make it fast at scale and resilient to bad data.

### 6.1 Performance

| Task | Priority | Detail |
|------|----------|--------|
| Virtual scrolling | HIGH | Schedule panel has 48 containers. At 100+ items, DOM gets heavy. Use react-window or react-virtuoso for panels with many children. |
| Memoize filtering | HIGH | `getPanelContainers` and `getContainerItems` run on every render. Wrap in useMemo keyed on occurrence/iteration changes. |
| Batch socket emissions | MED | Rapid field edits (typing in a number field) fire individual socket events. Debounce to 200ms batches. |
| Lazy load views | MED | Display, ArtifactDisplay, DocEditor are heavy components. Use React.lazy + Suspense so they only load when a panel uses that view type. |
| Web Worker calculations | LOW | Move CalculationHelpers aggregation loops to a Web Worker. Prevents UI jank when computing 100+ derived fields. |
| IndexedDB cache | LOW | Cache occurrences/fields locally for offline-first startup. Sync delta on reconnect. |

### 6.2 Data Validation

| Task | Priority | Detail |
|------|----------|--------|
| Server-side validation | HIGH | Currently socket handlers trust client data. Add Joi/Zod schema validation on every handler — reject malformed payloads. |
| Optimistic rollback | HIGH | If server rejects an update, client should revert the optimistic change. Currently it just stays wrong. |
| Orphan cleanup | MED | Occurrences can become orphaned (parent deleted but occurrence survives). Add a cleanup pass on `request_full_state`. |
| Conflict resolution | MED | Two windows editing the same field simultaneously = last write wins. Better: merge strategy or operational transform for docs. |
| Error boundaries | HIGH | A single bad component render crashes everything. Wrap Panel, Container, Instance in error boundaries with "retry" buttons. |
| Migration scripts | MED | Schema changes (like adding fields to Occurrence) need migration scripts that backfill existing documents. |

### 6.3 Architecture Cleanup

| Task | Priority | Detail |
|------|----------|--------|
| Split DragProvider | MED | DragProvider.jsx is ~1300 lines. Extract into `usePanelDrag`, `useContainerDrag`, `useInstanceDrag` hooks. |

> **Note**: Other architecture items moved to **Phase 5.7**. Iteration schema normalization and items/occurrences naming are done.

---

## Phase 7: Import/Export & Sharing

**Goal**: Get data in and out. Backups. Sharing.

| Task | Priority | Detail |
|------|----------|--------|
| JSON export | HIGH | Full grid snapshot (all 15 model types) as a single JSON file. Include version number for forward compatibility. |
| JSON import | HIGH | Restore from snapshot. Remap all IDs to prevent collisions. Validate referential integrity before writing. |
| Markdown export | MED | Export docs as .md files. Convert pills to `{{field:name}}` or `[[instance:label]]` syntax. |
| CSV export | MED | Export field values as spreadsheet. Rows = occurrences, columns = fields. Filter by iteration. |
| PDF export | LOW | Day page → printable PDF. Use puppeteer or react-pdf for server-side rendering. |
| Share via link | MED | Generate a read-only public URL for a grid/panel. No auth required. Useful for dashboards. |
| Grid duplication | MED | Clone an entire grid (all entities + occurrences). For templates ("Starter: Health Tracker"). |
| Panel/Container export | LOW | Export individual panels or containers as portable units that can be imported into other grids. |

---

## Phase 8: Whiteboard & Canvas Mode

**Goal**: Free-form spatial thinking. Mind maps. Visual planning.

### 8.1 Canvas View Type

The `canvas` viewType is already stubbed in Display.jsx. This phase makes it real.

| Task | Priority | Detail |
|------|----------|--------|
| Infinite canvas | HIGH | Pan/zoom with mouse/touch. Use react-flow, fabric.js, or custom canvas. Items have absolute x,y coordinates. |
| Drag items onto canvas | HIGH | Drag instances/containers from board view → drop on canvas at x,y position. |
| Connector lines | MED | Draw lines between items. Arrows, labels, colors. Think: mind map connections. |
| Snap-to-grid toggle | MED | Optional grid alignment for tidy layouts. |
| Grouping | MED | Select multiple items, create a named group. Collapse/expand. |
| Freehand drawing | LOW | SVG overlay for sketching. Pressure sensitivity for stylus. |

### 8.2 Advanced Grid Layout

| Task | Priority | Detail |
|------|----------|--------|
| Nested grids | MED | A panel can contain a sub-grid (grid-within-grid dashboards). |
| Container grids | MED | Containers can lay out instances in rows/columns (not just vertical list). |
| Grid templates | LOW | Preset layouts: "Planner" (3-col schedule), "Kanban" (horizontal swim lanes), "Dashboard" (mixed sizes). |

---

## Phase 9: Integrations & API

**Goal**: Moduli as a hub, not a silo. Data flows in and out automatically.

### 9.1 REST API

| Endpoint | Method | Detail |
|----------|--------|--------|
| `/api/grids/:id` | GET | Full grid state (like socket full_state but REST) |
| `/api/occurrences` | POST | Create occurrence (place an instance in a container) |
| `/api/occurrences/:id/fields` | PATCH | Update field values on an occurrence |
| `/api/fields/:id/aggregate` | GET | Compute aggregation on demand (sum, count, etc.) |
| `/api/docs/:id` | GET/PUT | Read/write doc content |
| `/api/upload` | POST | Upload file → artifact (already exists) |

**Auth**: Bearer token (JWT). Same tokens as socket auth.

### 9.2 Webhooks

| Event | Fires When | Payload |
|-------|-----------|---------|
| `field.changed` | Any field value updated | { occurrenceId, fieldId, value, previousValue, flow } |
| `occurrence.moved` | Instance moved between containers | { occurrenceId, from, to } |
| `occurrence.created` | New occurrence placed | { occurrence } |
| `streak.broken` | Consecutive-day habit streak ends | { instanceId, streakLength, lastDate } |
| `target.reached` | Derived field hits its target value | { fieldId, value, target } |

Users configure webhooks in grid settings. Moduli POSTs JSON to their URL.

### 9.3 Calendar Sync

| Task | Priority | Detail |
|------|----------|--------|
| Google Calendar → Moduli | HIGH | Pull events, create instances in schedule time slots. 2-way: completing in Moduli marks event done in GCal. |
| Moduli → iCal feed | MED | Export schedule panel as subscribable .ics URL. Any calendar app can subscribe. |
| Apple/Outlook Calendar | MED | Same as Google but via CalDAV/Graph API. |

### 9.4 Health & Fitness

| Task | Priority | Detail |
|------|----------|--------|
| Apple Health / Google Fit | MED | Auto-populate steps, water, sleep duration, heart rate fields. User maps health metrics → Moduli fields. |
| Strava/Garmin | LOW | Import workouts with duration, distance, calories. |

### 9.5 Productivity Tools

| Task | Priority | Detail |
|------|----------|--------|
| Todoist import | MED | Map Todoist tasks → Moduli instances. One-time or sync. |
| Notion import | MED | Map Notion pages → Moduli docs. Notion databases → containers with instances. |
| Bank/Finance | LOW | Plaid integration for auto expense tracking. Transactions → occurrences with amount field. |

---

## Phase 10: AI & Automation

**Goal**: Moduli learns from your patterns and helps you plan.

| Task | Priority | Detail |
|------|----------|--------|
| Natural language input | HIGH | "Add 30 min workout at 7am" → creates instance with duration=30 in 7:00am slot. Parser maps to: create occurrence + set field values. Works in toolbar, doc editor, or API. |
| Smart scheduling | HIGH | AI analyzes your completion patterns: "You complete workouts 90% of the time when scheduled before 8am. Move to 6:30am?" Suggests optimal time slots based on historical field data. |
| Auto-categorization | MED | Classify new instances into dimensions (physical/intellectual/etc.) based on label + field bindings. |
| Habit insights | MED | "Your meditation streak is 12 days. Longest ever was 15. You tend to break on Fridays." Generated from transaction history. |
| Predictive analytics | LOW | "At your current pace, you'll hit your monthly reading goal by the 22nd." Extrapolate from daily aggregations. |
| AI journal prompts | LOW | "You logged 3 emotional entries today (anxious, stressed, focused). Reflection prompt: What shifted your state from anxious to focused?" Generated from mood field data + day timeline. |
| Block program suggestions | LOW | User describes a calculation in natural language → AI generates the block tree. "Count how many times I exercised this week" → AGGREGATION(countTrue, completed, scope: grid, timeFilter: weekly, instanceIds: [workout IDs]) |

---

## Phase 11: Collaboration & Teams

**Goal**: Shared workspaces with permissions.

| Task | Priority | Detail |
|------|----------|--------|
| Multi-user grids | HIGH | Share a grid with other users. Each user sees their own iteration view but shared structure. |
| Permissions | HIGH | Owner (full control), Editor (CRUD items), Viewer (read-only). Per-grid roles. |
| Real-time collab | MED | CRDT-based collaborative editing for docs. Two users editing same doc = both changes merge. Yjs or Automerge. |
| Comments | MED | @mention users in docs. Comment threads on instances ("@josh can you do this today?"). |
| Activity feed | LOW | "Josh completed Morning Workout. Sarah added 3 items to Schedule." Per-grid feed. |
| Team dashboards | LOW | Aggregate fields across users: "Team total: 45 tasks completed this week." |

---

## Phase 12: Mobile & Cross-Platform

**Goal**: Moduli on every device.

| Task | Priority | Detail |
|------|----------|--------|
| PWA | HIGH | Service worker + manifest.json. Installable from browser. Offline-capable with IndexedDB sync queue. Cheapest path to "app on phone." |
| Mobile layout | HIGH | Single-column panel view. Swipe between panels. Bottom tab bar for quick nav. Touch-optimized drag (already partially supported). |
| Capacitor wrapper | MED | iOS/Android app shell around the PWA. Access to native features: camera (photo → artifact), notifications, health kit. |
| Home widgets | MED | iOS/Android widget showing today's schedule or quick-add button. Requires native code. |
| Push notifications | MED | "Reminder: Morning Workout at 7am." "Streak alert: You haven't logged water today." Server-sent via FCM/APNs. |
| Wearable | LOW | Apple Watch / Wear OS companion. Checklist of today's tasks. Tap to complete. Very minimal UI. |

---

## Phase 13: Data & Privacy

**Goal**: Users own their data. Self-hostable. Encrypted.

| Task | Priority | Detail |
|------|----------|--------|
| Docker compose | HIGH | `docker-compose up` runs MongoDB + server + client. One-command self-hosting. |
| Auto backups | HIGH | Daily MongoDB dump to local volume or S3. Configurable retention. |
| Restore UI | MED | Upload a backup JSON/dump → restore to a grid or full account. |
| E2E encryption | MED | Client-side encryption for field values marked "sensitive" (passwords, financial data). Server stores ciphertext only. |
| GDPR compliance | MED | "Export all my data" button (JSON). "Delete my account" button (cascading delete of all models). |
| Audit log | LOW | Who accessed what, when. For team/enterprise use cases. |

---

## The Adaptability Mission

### Core Principle

Moduli's deepest architectural decision is the **occurrence-based spine**. This isn't just a database pattern — it's a protocol for putting anything anywhere.

An occurrence says: "This entity exists here, with these values, at this time, in this context."

That sentence works regardless of WHERE "here" is:
- A panel in a browser
- A cell in a VR workspace
- A row in an API response
- A card on a smartwatch
- A node on an AR surface
- A block in a Slack message

The entity (instance, container, panel) is the **what**. The occurrence is the **where/when/how**.

### Input Adaptability (Capture From Anywhere)

Every way data enters the system creates the same primitives: instances, occurrences, field values.

| Source | How It Works | Creates |
|--------|-------------|---------|
| **Web app** | Drag and drop, forms, keyboard | Occurrences with field values |
| **REST API** | POST /api/occurrences | Same occurrence, programmatic |
| **Webhooks (inbound)** | External service POSTs to Moduli | Instance + occurrence + fields |
| **Browser extension** | Clip webpage → sends to API | Instance with URL/title fields, artifact with screenshot |
| **Voice command** | "Add workout at 7am" → NLP parser → API | Occurrence in schedule slot |
| **Email forwarding** | Forward email to moduli@... → parser | Instance with email content as doc |
| **Mobile camera** | Photo → upload → artifact | Artifact in file tree |
| **Health APIs** | Apple Health/Google Fit sync | Field value updates on occurrences |
| **Calendar sync** | Google Calendar event → instance | Occurrence in schedule time slot |
| **CLI tool** | `moduli add "Buy groceries" --due tomorrow` | Instance + occurrence |
| **Zapier/Make** | Any trigger → webhook → Moduli | Whatever the automation sends |
| **File drop** | Drag file from desktop | Artifact + instance occurrence |
| **VR gesture** | Grab → place in spatial panel | Occurrence with placement in VR coordinates |

### Output Adaptability (Display Anywhere)

Every way data leaves the system reads the same primitives: occurrences filtered by iteration/view.

| Destination | How It Works | Reads |
|------------|-------------|-------|
| **Web app** | Panel → View → Display component | Occurrences filtered by viewType + iteration |
| **REST API** | GET /api/grids/:id | Full state or filtered query |
| **Webhooks (outbound)** | field.changed, target.reached events | Occurrence + field delta |
| **iCal feed** | Subscribe URL → calendar app | Schedule occurrences as events |
| **JSON export** | Download full grid snapshot | All 15 models serialized |
| **CSV export** | Download field values as spreadsheet | Occurrence fields flattened |
| **PDF export** | Day page → printable document | Doc content rendered |
| **Embed widget** | iframe or web component | Single panel rendered standalone |
| **Dashboard TV** | Read-only shared link on big screen | Grid with no edit controls |
| **Smartwatch** | Companion app reads today's schedule | Filtered occurrences for today |
| **VR/AR workspace** | Spatial panels rendered in 3D | Same occurrence data, different renderer |
| **Slack/Teams bot** | "What's on my schedule?" → bot responds | Query occurrences for today |
| **Home screen widget** | iOS/Android widget | Today's tasks + quick check-off |

### The VR/AR Vision

The drag-and-drop system already works with touch and multi-monitor. Extending to VR/AR means:

1. **Spatial panels**: Instead of a 2D grid, panels float in 3D space. Same View model, same occurrence data, different renderer (Three.js / WebXR).
2. **Gesture-based drag**: Hand tracking replaces mouse. Grab an instance → move between spatial containers. The DragProvider already abstracts input → payload → drop target.
3. **Multi-surface**: Pull a panel from your headset onto a physical monitor. The occurrence's placement just changes from VR coordinates to screen coordinates.
4. **Voice + gesture**: "Show me last week's goals" → iteration changes → panels update. "Move this to tomorrow" → occurrence gets new timeValue.

The key insight: **the data model doesn't change**. Occurrences, fields, iterations — they're surface-agnostic. Only the renderer changes.

### The Iron Man 2 Scene

Tony walks into a room, points at a screen, and his data appears. He flicks files between surfaces. He pulls up holograms and interacts with them mid-conversation.

In Moduli terms:
- The **grid** is the room
- **Panels** are the screens/surfaces
- **Occurrences** are the files/data he's moving around
- **Views** determine how each surface shows data
- **Fields** are the measurements he's analyzing
- **Iterations** are the time filters he's applying ("show me last month")
- **The API** is how external systems push data in (SHIELD intel, JARVIS analysis)

The architecture is already built for this. The occurrence spine, the view routing, the iteration filtering — they compose the same way whether the renderer is a browser div, a VR panel, or a holographic surface.

What changes per platform is just the **renderer** and the **input method**. The data, the logic, the relationships — those are universal.

---

## Priority Rationale

| Phase | Why This Order |
|-------|---------------|
| **5 (CSS)** | Immediate: the app needs to look professional and be maintainable before adding features |
| **6 (Performance)** | Must-have before scaling: virtual scrolling, error boundaries, validation prevent breakage |
| **7 (Import/Export)** | Users need data portability: backups, onboarding, migration |
| **8 (Canvas)** | Unlocks mind-mapping and visual planning — the "canvas" viewType is already stubbed |
| **9 (Integrations)** | Makes Moduli part of existing workflows, not a standalone tool |
| **10 (AI)** | Killer differentiator: NLP input + smart scheduling. Requires stable data layer. |
| **11 (Collaboration)** | Business requirement but architecturally complex. Socket.io foundation helps. |
| **12 (Mobile)** | PWA first (cheapest), native later. Touch support already exists. |
| **13 (Privacy)** | Self-hosting and encryption for enterprise/privacy users. Important but not blocking. |

After Phase 13, the platform is a **complete, multi-surface, AI-assisted, collaborative personal operating system**. Every feature after that is an integration, a new renderer, or a new AI capability — all plugging into the same occurrence-based spine.
