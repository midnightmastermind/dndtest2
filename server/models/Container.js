// models/Container.js
import mongoose from "mongoose";

const ContainerSchema = new mongoose.Schema(
  {
    // Your app uses string ids (uid())
    id: { type: String, required: true, index: true, unique: true },

    label: { type: String, required: true, trim: true },

    // Grid and panel associations
    gridId: { type: String },
    panelId: { type: String },

    userId: { type: String, required: true },

    // Occurrences in this container (array of occurrence IDs)
    occurrences: { type: [String], default: [] },
    kind: { type: String, enum: ["list", "log", "doc", "smart"], default: "list" },

    // Iteration settings (inherit from panel or own)
    iteration: {
      mode: { type: String, enum: ["inherit", "own"], default: "inherit" },
      timeFilter: { type: String, enum: ["daily", "weekly", "monthly", "yearly", "all"], default: "daily" },
    },

    // Default drag mode for this container
    defaultDragMode: { type: String, enum: ["move", "copy", "copylink"], default: "move" },

    // Fields exposed in this container
    fieldIds: { type: [String], default: [] },

    // Filter and layout options
    filter: { type: mongoose.Schema.Types.Mixed },
    layout: { type: mongoose.Schema.Types.Mixed },

    // Doc content (for kind: "doc" containers)
    // Stores Tiptap/ProseMirror JSON document structure
    docContent: { type: mongoose.Schema.Types.Mixed, default: null },

    // Template: when navigating to a new iteration (new day), auto-fill from this template
    defaultTemplateId: { type: String, default: null },

    // Cascading style overrides
    styleMode: { type: String, enum: ["inherit", "own"], default: "inherit" },
    ownStyle: { type: mongoose.Schema.Types.Mixed, default: null },
    childInstanceStyle: { type: mongoose.Schema.Types.Mixed, default: null },

    // Sibling links (for future features like Q&A pairs, linked fields, etc.)
    siblingLinks: { type: [String], default: [] },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

// Optional: hide Mongo internals in API responses
ContainerSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret._id = ret._id?.toString?.() ?? ret._id;
    return ret;
  },
});

export default mongoose.model("Container", ContainerSchema);
