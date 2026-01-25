# Drag & Drop System - Functionality Checklist

## ✅ Cleanup Summary
- [x] Deleted legacy `useDnDControlCoordinator.js` (1436 lines of dead code)
- [x] Removed 4 @dnd-kit dependencies from package.json
- [x] Moved `dragSystem.js` and `DragProvider.jsx` to helpers/ folder
- [x] Verified all imports are correct

## 📋 Core Functionality Verification

### 1. Drag System Architecture
- [ ] `dragSystem.js` exports all required hooks:
  - [ ] `useDraggable()` - makes elements draggable
  - [ ] `useDroppable()` - makes elements drop targets
  - [ ] `useDragDrop()` - combined hook for sortable items
- [ ] `DragProvider.jsx` provides context to all components
- [ ] `DragContext` is properly exported and consumed

### 2. Panel Drag & Drop
- [ ] **Panel headers are draggable** (grip icon visible)
- [ ] **Drag panel to different grid cell** works
- [ ] **Grid cells highlight** when panel dragged over them
- [ ] **Panel drops into correct cell** (row/col update)
- [ ] **Stacked panels**: When panel moved away, next panel becomes visible
- [ ] **Stacked panels**: When panel dropped on occupied cell, existing panel(s) hide
- [ ] **Panel drag disabled** when dragging containers/instances (prevents conflicts)

### 3. Container Drag & Drop
- [ ] **Container headers are draggable** (grip icon visible)
- [ ] **Drag container to different panel** works
- [ ] **Panels highlight** when container dragged over them
- [ ] **Container drops into correct panel**
- [ ] **Container removed** from source panel.containers array
- [ ] **Container added** to target panel.containers array
- [ ] **Container drag disabled** when dragging instances (prevents conflicts)

### 4. Instance Drag & Drop
- [ ] **Instances are draggable** (entire element)
- [ ] **Drag instance to different container** works
- [ ] **Containers highlight** when instance dragged over them
- [ ] **Instance drops into correct container**
- [ ] **Instance removed** from source container.items array
- [ ] **Instance added** to target container.items array

### 5. Instance Sorting (within same container)
- [ ] **Drag instance within same container** to reorder
- [ ] **Drop zones appear** between instances during drag
- [ ] **Instance inserted** at correct position in items array
- [ ] **Visual feedback** shows insert position while dragging

### 6. External Drops (Files/Text/URLs)
- [ ] **Drag file from desktop** into container creates new instance
- [ ] **Instance label** shows filename
- [ ] **Drag text** into container creates new instance
- [ ] **Instance label** shows text content (truncated)
- [ ] **Drag URL** into container creates new instance
- [ ] **Instance label** shows URL

### 7. Cross-Window Drag & Drop
- [ ] **Open app in two browser windows**
- [ ] **Drag instance from window A to window B**
- [ ] **New instance created** in target window
- [ ] **Label preserved** across windows
- [ ] **Custom MIME type** (application/x-daytracker-dnd) works

### 8. Live Preview System
- [ ] **Dragging instance** shows live preview in target container
- [ ] **Items reorder** as you drag (preview)
- [ ] **Preview reverts** if drag cancelled (ESC key)
- [ ] **Preview commits** to backend on successful drop
- [ ] **Draft state** maintained during entire drag session

### 9. Highlighting System
- [ ] **Grid cells** highlight with blue background when panel over them
- [ ] **Panels** highlight with blue outline when container/instance over them
- [ ] **Containers** highlight with blue outline when instance over them
- [ ] **Instances** highlight with blue background when instance over them
- [ ] **Z-index aware**: Topmost element highlights (not buried elements)
- [ ] **hotTarget updates** continuously during drag
- [ ] **Dual feedback**: Both `hotTarget` (global) and `isOver` (local) work

### 10. Visual Feedback
- [ ] **Dragging element opacity** reduces to 0.3-0.5
- [ ] **Cursor changes** to grab/grabbing
- [ ] **Drag image** shows while dragging
- [ ] **Transitions smooth** (opacity, outline animations)
- [ ] **No visual glitches** during drag operations

### 11. State Management
- [ ] **Local state updates** immediately (optimistic UI)
- [ ] **Backend saves** via socket.emit()
- [ ] **Redux/state actions** dispatch correctly
- [ ] **Socket.io events** emit for:
  - [ ] update_panel
  - [ ] update_container
  - [ ] create_instance_in_container
  - [ ] update_instance

### 12. Edge Cases
- [ ] **Drag outside grid** cancels drag
- [ ] **ESC key** cancels drag (if implemented)
- [ ] **Drop on invalid target** does nothing
- [ ] **Drag disabled elements** don't start drag
- [ ] **Multiple rapid drags** don't cause issues
- [ ] **RAF throttling** prevents performance issues

### 13. Integration Points
- [ ] **Panel fullscreen** works (drag disabled when fullscreen)
- [ ] **Panel stacking** works (navigate with chevron buttons)
- [ ] **Panel layout settings** persist through drags
- [ ] **Container add/delete** works alongside drag
- [ ] **Instance add/delete** works alongside drag
- [ ] **Grid resize** doesn't break drag system

## 🔧 Technical Verification

### File Structure
```
client/src/
├── helpers/
│   ├── dragSystem.js          ✅ Core hooks & types
│   ├── DragProvider.jsx       ✅ State coordinator
│   ├── CommitHelpers.js       ✅ CRUD operations
│   ├── LayoutHelpers.js       ✅ Complex operations
│   └── nativeDnd.js           ✅ Native drag utilities
├── Grid.jsx                   ✅ Imports ./helpers/DragProvider
├── Panel.jsx                  ✅ Imports ./helpers/dragSystem
├── SortableContainer.jsx      ✅ Imports ./helpers/dragSystem
└── SortableInstance.jsx       ✅ Imports ./helpers/dragSystem
```

### Import Verification
- [x] All components import from `./helpers/dragSystem`
- [x] Grid imports `DragProvider` from `./helpers/DragProvider`
- [x] DragProvider imports from `./dragSystem` (same folder)
- [x] No remaining `@dnd-kit` imports
- [x] No remaining references to `useDnDControlCoordinator`

### Dependencies
- [x] `@dnd-kit/core` removed from package.json
- [x] `@dnd-kit/modifiers` removed from package.json
- [x] `@dnd-kit/sortable` removed from package.json
- [x] `@dnd-kit/utilities` removed from package.json
- [ ] Run `npm install` to update package-lock.json

## 🚀 Testing Instructions

### Quick Test Sequence
1. Start the app: `npm start`
2. Create a grid with 2x2 cells
3. Add 2 panels to different cells
4. Add 2 containers to each panel
5. Add 3 instances to each container
6. Test each drag operation from checklist above
7. Open in second window and test cross-window drag
8. Drag a file from desktop to verify external drops

### Performance Test
1. Create grid with many panels (10+)
2. Add many containers (20+)
3. Add many instances (50+)
4. Verify dragging still smooth (60fps)
5. Check console for errors
6. Monitor memory usage

## 📝 Notes
- The system uses native HTML5 drag events (no library!)
- Z-index aware hit testing via `document.elementsFromPoint()`
- RAF throttling ensures smooth performance
- Draft/commit pattern allows cancellation
- Cross-window support via custom MIME type
