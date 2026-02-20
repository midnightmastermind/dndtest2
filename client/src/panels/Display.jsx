// panels/Display.jsx
// ============================================================
// View router component that lives inside panels.
// Reads a View model and renders the appropriate viewer.
//
// viewType mapping:
//   "list"            → standard container grid (default board)
//   "notebook"        → ArtifactDisplay with tree + DocContainer
//   "artifact-viewer" → ArtifactDisplay without tree + content viewer
//   "doc-viewer"      → DocContainer directly (single doc, no tree)
//   "file-manager"    → ArtifactDisplay with tree + folder grid
//   "canvas"          → future stub
// ============================================================

import React, { useContext, useMemo } from "react";
import ArtifactDisplay from "./ArtifactDisplay";
import DocContainer from "../docs/DocContainer";
import { GridActionsContext } from "../GridActionsContext";

/**
 * Display — renders the correct view based on view.viewType
 *
 * Props:
 * - panel: The panel object
 * - view: View model object (or synthetic { viewType } for legacy panels)
 * - containers: Resolved container list for this panel
 * - containerContent: JSX to render for list view (passed from Panel)
 * - dispatch, socket: For state updates
 */
export default function Display({
  panel,
  view,
  containers = [],
  containerContent,
  dispatch,
  socket,
  addContainerToPanel,
}) {
  const {
    manifestsById,
    docsById,
    foldersById,
    artifactsById,
    occurrencesById,
  } = useContext(GridActionsContext);

  const viewType = view?.viewType || "list";
  const manifest = view?.manifestId ? manifestsById[view.manifestId] : null;

  switch (viewType) {
    case "notebook":
    case "artifact-viewer":
    case "file-manager":
      return (
        <ArtifactDisplay
          panel={panel}
          view={view}
          manifest={manifest}
          containers={containers}
          dispatch={dispatch}
          socket={socket}
          addContainerToPanel={addContainerToPanel}
        />
      );

    case "doc-viewer": {
      // Single doc view — find the doc from view.activeDocId
      const doc = view?.activeDocId ? docsById[view.activeDocId] : null;
      // Find occurrence for the doc container if one exists
      const docContainer = containers.find((c) => c.kind === "doc");
      const occurrence = docContainer
        ? Object.values(occurrencesById).find(
            (o) => o.targetType === "container" && o.targetId === docContainer.id
          )
        : null;

      if (doc) {
        // Pass doc content as a synthetic container/occurrence
        return (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
            <DocContainer
              container={docContainer || { id: doc.id, label: doc.title, kind: "doc" }}
              occurrence={occurrence || { id: doc.id, docContent: doc.content }}
              dispatch={dispatch}
              socket={socket}
            />
          </div>
        );
      }
      // Fallback
      return (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No document selected
        </div>
      );
    }

    case "canvas":
      return (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Canvas view coming soon
        </div>
      );

    case "list":
    default:
      // Render the standard container grid — this is passed in from Panel
      return containerContent || null;
  }
}
