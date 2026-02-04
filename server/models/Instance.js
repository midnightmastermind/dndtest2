// models/Instance.js
import mongoose from "mongoose";
// models/Instance.js
const InstanceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, index: true, unique: true },
    label: { type: String, required: true, trim: true },
    userId: { type: String, required: true },

    // Instance type/kind
    kind: { type: String, enum: ["template", "docBlock", "embed"], default: "template" },

    // Fields this instance uses (Phase 2)
    fieldIds: { type: [String], default: [] },
    fieldBindings: [
      {
        fieldId: { type: String },
        role: { type: String, enum: ["input", "display", "both"], default: "input" },
        record: { type: Boolean, default: false },  // Emit measurement transaction?
        display: { type: mongoose.Schema.Types.Mixed },
        order: { type: Number }
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
      timeFilter: { type: String, enum: ["daily", "weekly", "monthly", "yearly"], default: "daily" },
    },

    // Default drag mode for this instance
    defaultDragMode: { type: String, enum: ["move", "copy"], default: "move" },

    // Optional metadata
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
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
