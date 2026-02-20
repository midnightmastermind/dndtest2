// models/Instance.js
import mongoose from "mongoose";
// models/Instance.js
const InstanceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, index: true, unique: true },
    label: { type: String, required: true, trim: true },
    userId: { type: String, required: true },

    // Instance type/kind
    kind: { type: String, enum: ["list", "doc", "file", "canvas"], default: "list" },

    // Fields to display on this instance (references grid-level fields)
    // The actual field config (type, mode, calculations) is in the Field model
    fieldBindings: [
      {
        fieldId: { type: String, required: true },
        // Optional display overrides (inherits from Field.display by default)
        order: { type: Number },          // Override display order
        hidden: { type: Boolean },        // Hide this field on this instance
      }
    ],

    // Editor content for doc blocks (Phase 4)
    doc: {
      type: { type: String },  // "prosemirror" | "md" | etc
      content: { type: mongoose.Schema.Types.Mixed }
    },

    // Iteration settings (inherit from container or own)
    iteration: {
      mode: { type: String, enum: ["inherit", "own"], default: "inherit" },
      timeFilter: { type: String, enum: ["daily", "weekly", "monthly", "yearly", "all"], default: "daily" },
    },

    // Default drag mode for this instance
    defaultDragMode: { type: String, enum: ["move", "copy", "copylink"], default: "move" },

    // Optional metadata
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Cascading style overrides
    styleMode: { type: String, enum: ["inherit", "own"], default: "inherit" },
    ownStyle: { type: mongoose.Schema.Types.Mixed, default: null },

    // Sibling links (for future features like Q&A pairs, linked fields, etc.)
    siblingLinks: { type: [String], default: [] },
  },
  { timestamps: true, minimize: false }
);

InstanceSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret._id = ret._id?.toString?.() ?? ret._id;
    return ret;
  },
});

export default mongoose.model("Instance", InstanceSchema);
