// helpers/CommitHelpers.js
import {
  createGridAction,
  updateGridAction,
  deleteGridAction,
  createPanelAction,
  updatePanelAction,
  deletePanelAction,
  createContainerAction,
  updateContainerAction,
  deleteContainerAction,
  createInstanceAction,
  createInstanceInContainerAction,
  updateInstanceAction,
  deleteInstanceAction,
  createOccurrenceAction,
  updateOccurrenceAction,
  deleteOccurrenceAction,
  createFieldAction,
  updateFieldAction,
  deleteFieldAction,
  createManifestAction,
  updateManifestAction,
  deleteManifestAction,
  createViewAction,
  updateViewAction,
  deleteViewAction,
  createDocAction,
  updateDocAction,
  deleteDocAction,
  createFolderAction,
  updateFolderAction,
  deleteFolderAction,
  createArtifactAction,
  updateArtifactAction,
  deleteArtifactAction,
} from "../state/actions";

/**
 * Commit helper contract:
 * - Always safe to call with missing dispatch/socket.
 * - "emit" controls whether we talk to the backend (hard save).
 *   - default: emit = true
 *   - set emit: false for "soft save" (dispatch only)
 */
function shouldEmit(emit) {
  return emit !== false;
}

// ===== GRID =====
export function createGrid({ dispatch, socket, grid, emit = true }) {
  if (!grid) return;
  dispatch?.(createGridAction(grid));
  if (shouldEmit(emit)) socket?.emit("create_grid", { grid });
}

export function updateGrid({ dispatch, socket, gridId, grid, emit = true }) {
  if (!gridId || !grid) return;

  // ✅ action creator now expects { gridId, grid }
  dispatch?.(updateGridAction({ gridId, grid }));

  if (shouldEmit(emit)) socket?.emit("update_grid", { gridId, grid });
}

export function deleteGrid({ dispatch, socket, gridId, emit = true }) {
  if (!gridId) return;
  dispatch?.(deleteGridAction(gridId));
  if (shouldEmit(emit)) socket?.emit("delete_grid", { gridId });
}

// ===== PANEL =====
export function createPanel({ dispatch, socket, panel, emit = true }) {
  if (!panel) return;
  dispatch?.(createPanelAction(panel));
  if (shouldEmit(emit)) socket?.emit("create_panel", { panel });
}

export function updatePanel({ dispatch, socket, panel, emit = true }) {
  if (!panel?.id) return;
  dispatch?.(updatePanelAction(panel));
  if (shouldEmit(emit)) socket?.emit("update_panel", { panel });
}

export function deletePanel({ dispatch, socket, panelId, emit = true }) {
  if (!panelId) return;
  dispatch?.(deletePanelAction(panelId));
  if (shouldEmit(emit)) socket?.emit("delete_panel", { panelId });
}

// ===== CONTAINER =====
export function createContainer({ dispatch, socket, container, emit = true }) {
  if (!container) return;
  dispatch?.(createContainerAction(container));
  if (shouldEmit(emit)) socket?.emit("create_container", { container });
}

export function updateContainer({ dispatch, socket, container, emit = true }) {
  if (!container?.id) return;
  dispatch?.(updateContainerAction(container));
  if (shouldEmit(emit)) socket?.emit("update_container", { container });
}

export function deleteContainer({ dispatch, socket, containerId, emit = true }) {
  if (!containerId) return;
  dispatch?.(deleteContainerAction(containerId));
  if (shouldEmit(emit)) socket?.emit("delete_container", { containerId });
}

// ===== INSTANCE =====
//
// IMPORTANT:
// Your server supports:
// - "create_instance_in_container" (upsert + attach)
// - "update_instance" (upsert)
// - "delete_instance"
//
// It does NOT (in the file you pasted) support "create_instance".
//
export function createInstance({ dispatch, socket, instance, emit = true }) {
  if (!instance) return;

  // local create is still useful for optimistic UI
  dispatch?.(createInstanceAction(instance));

  // ✅ use update_instance as the backend upsert path
  if (shouldEmit(emit)) socket?.emit("update_instance", { instance });
}

// ✅ NEW: preferred path for “add item to a list”
export function createInstanceInContainer({
  dispatch,
  socket,
  containerId,
  instance,
  emit = true,
}) {
  if (!containerId || !instance?.id) return;

  // atomic optimistic state: adds instance (if missing) AND pushes into container.occurrences
  dispatch?.(createInstanceInContainerAction({ containerId, instance }));

  if (shouldEmit(emit)) {
    socket?.emit("create_instance_in_container", { containerId, instance });
  }
}

export function updateInstance({ dispatch, socket, instance, emit = true }) {
  if (!instance?.id) return;
  dispatch?.(updateInstanceAction(instance));
  if (shouldEmit(emit)) socket?.emit("update_instance", { instance });
}

export function deleteInstance({ dispatch, socket, instanceId, emit = true }) {
  if (!instanceId) return;
  dispatch?.(deleteInstanceAction(instanceId));
  if (shouldEmit(emit)) socket?.emit("delete_instance", { instanceId });
}

// ===== OCCURRENCE =====
export function createOccurrence({ dispatch, socket, occurrence, emit = true }) {
  if (!occurrence?.id) return;
  dispatch?.(createOccurrenceAction(occurrence));
  if (shouldEmit(emit)) socket?.emit("create_occurrence", { occurrence });
}

export function updateOccurrence({ dispatch, socket, occurrence, emit = true }) {
  if (!occurrence?.id) return;
  dispatch?.(updateOccurrenceAction(occurrence));
  if (shouldEmit(emit)) socket?.emit("update_occurrence", { occurrence });
}

export function deleteOccurrence({ dispatch, socket, occurrenceId, emit = true }) {
  if (!occurrenceId) return;
  dispatch?.(deleteOccurrenceAction(occurrenceId));
  if (shouldEmit(emit)) socket?.emit("delete_occurrence", { occurrenceId });
}

// ===== FIELD =====
export function createField({ dispatch, socket, field, emit = true }) {
  if (!field?.id) return;
  dispatch?.(createFieldAction(field));
  if (shouldEmit(emit)) socket?.emit("create_field", { field });
}

export function updateField({ dispatch, socket, field, emit = true }) {
  if (!field?.id) return;
  dispatch?.(updateFieldAction(field));
  if (shouldEmit(emit)) socket?.emit("update_field", { field });
}

export function deleteField({ dispatch, socket, fieldId, emit = true }) {
  if (!fieldId) return;
  dispatch?.(deleteFieldAction(fieldId));
  if (shouldEmit(emit)) socket?.emit("delete_field", { fieldId });
}

// ===== MANIFEST =====
export function createManifest({ dispatch, socket, manifest, emit = true }) {
  if (!manifest?.id) return;
  dispatch?.(createManifestAction(manifest));
  if (shouldEmit(emit)) socket?.emit("create_manifest", { manifest });
}
export function updateManifest({ dispatch, socket, manifest, emit = true }) {
  if (!manifest?.id) return;
  dispatch?.(updateManifestAction(manifest));
  if (shouldEmit(emit)) socket?.emit("update_manifest", { manifest });
}
export function deleteManifest({ dispatch, socket, manifestId, emit = true }) {
  if (!manifestId) return;
  dispatch?.(deleteManifestAction(manifestId));
  if (shouldEmit(emit)) socket?.emit("delete_manifest", { manifestId });
}

// ===== VIEW =====
export function createView({ dispatch, socket, view, emit = true }) {
  if (!view?.id) return;
  dispatch?.(createViewAction(view));
  if (shouldEmit(emit)) socket?.emit("create_view", { view });
}
export function updateView({ dispatch, socket, view, emit = true }) {
  if (!view?.id) return;
  dispatch?.(updateViewAction(view));
  if (shouldEmit(emit)) socket?.emit("update_view", { view });
}
export function deleteView({ dispatch, socket, viewId, emit = true }) {
  if (!viewId) return;
  dispatch?.(deleteViewAction(viewId));
  if (shouldEmit(emit)) socket?.emit("delete_view", { viewId });
}

// ===== DOC =====
export function createDoc({ dispatch, socket, doc, emit = true }) {
  if (!doc?.id) return;
  dispatch?.(createDocAction(doc));
  if (shouldEmit(emit)) socket?.emit("create_doc", { doc });
}
export function updateDoc({ dispatch, socket, doc, emit = true }) {
  if (!doc?.id) return;
  dispatch?.(updateDocAction(doc));
  if (shouldEmit(emit)) socket?.emit("update_doc", { doc });
}
export function deleteDoc({ dispatch, socket, docId, emit = true }) {
  if (!docId) return;
  dispatch?.(deleteDocAction(docId));
  if (shouldEmit(emit)) socket?.emit("delete_doc", { docId });
}

// ===== FOLDER =====
export function createFolder({ dispatch, socket, folder, emit = true }) {
  if (!folder?.id) return;
  dispatch?.(createFolderAction(folder));
  if (shouldEmit(emit)) socket?.emit("create_folder", { folder });
}
export function updateFolder({ dispatch, socket, folder, emit = true }) {
  if (!folder?.id) return;
  dispatch?.(updateFolderAction(folder));
  if (shouldEmit(emit)) socket?.emit("update_folder", { folder });
}
export function deleteFolder({ dispatch, socket, folderId, emit = true }) {
  if (!folderId) return;
  dispatch?.(deleteFolderAction(folderId));
  if (shouldEmit(emit)) socket?.emit("delete_folder", { folderId });
}

// ===== ARTIFACT =====
export function createArtifact({ dispatch, socket, artifact, emit = true }) {
  if (!artifact?.id) return;
  dispatch?.(createArtifactAction(artifact));
  if (shouldEmit(emit)) socket?.emit("create_artifact", { artifact });
}
export function updateArtifact({ dispatch, socket, artifact, emit = true }) {
  if (!artifact?.id) return;
  dispatch?.(updateArtifactAction(artifact));
  if (shouldEmit(emit)) socket?.emit("update_artifact", { artifact });
}
export function deleteArtifact({ dispatch, socket, artifactId, emit = true }) {
  if (!artifactId) return;
  dispatch?.(deleteArtifactAction(artifactId));
  if (shouldEmit(emit)) socket?.emit("delete_artifact", { artifactId });
}

// ---- templates ----
export function saveTemplate({ socket, gridId, template }) {
  if (!gridId || !template?.id) return;
  socket?.emit("save_template", { gridId, template });
}

export function fillFromTemplate({ socket, gridId, templateId, containerId, iterationValue }) {
  if (!gridId || !templateId || !containerId) return;
  socket?.emit("fill_from_template", { gridId, templateId, containerId, iterationValue });
}

// ---- file upload ----
export async function uploadFile({ file, userId, gridId, folderId, manifestId, dispatch }) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("userId", userId);
  if (gridId) formData.append("gridId", gridId);
  if (folderId) formData.append("folderId", folderId);
  if (manifestId) formData.append("manifestId", manifestId);

  try {
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.artifact && dispatch) {
      dispatch(createArtifactAction(data.artifact));
    }
    return data.artifact;
  } catch (err) {
    console.error("Upload failed:", err);
    return null;
  }
}