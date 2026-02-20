// models/View.js
// ============================================================
// VIEW: Display configuration for panels
// Determines how a panel renders its content
// Referenced by Panel via viewId
// ============================================================

import mongoose from "mongoose";

const ViewSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, index: true, unique: true },

    userId: { type: String, required: true, index: true },

    gridId: { type: String, required: true, index: true },

    // Which panel uses this view
    panelId: { type: String, default: null, index: true },

    name: { type: String, default: "Default View" },

    // View type determines what component renders in the panel
    // list = board/grid of containers (default)
    // artifact-viewer = generic viewer for any artifact type
    // doc-viewer = Tiptap rich text editor
    // file-manager = artifact-viewer + manifest (tree sidebar)
    // notebook = doc-viewer + manifest (tree sidebar)
    // canvas = freeform canvas (future)
    viewType: {
      type: String,
      enum: ["list", "artifact-viewer", "doc-viewer", "file-manager", "notebook", "canvas"],
      default: "list",
    },

    // Reference to Manifest (tree sidebar) - used by file-manager and notebook views
    manifestId: { type: String, default: null },

    // Sidebar settings (for views with manifest/tree)
    showTree: { type: Boolean, default: true },
    sidebarWidth: { type: Number, default: 192 },
    sidebarCollapsed: { type: Boolean, default: false },

    // Currently active items in the viewer
    activeDocId: { type: String, default: null },
    activeArtifactId: { type: String, default: null },
    activeFolderId: { type: String, default: null },

    // File manager display settings
    sortBy: {
      type: String,
      enum: ["name", "date", "type", "sortOrder"],
      default: "sortOrder",
    },
    sortDirection: {
      type: String,
      enum: ["asc", "desc"],
      default: "asc",
    },
    displayMode: {
      type: String,
      enum: ["grid", "list"],
      default: "list",
    },

    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

ViewSchema.index({ gridId: 1, panelId: 1 });

ViewSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret._id = ret._id?.toString?.() ?? ret._id;
    return ret;
  },
});

export default mongoose.model("View", ViewSchema);
