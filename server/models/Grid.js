import mongoose from "mongoose";

const GridSchema = new mongoose.Schema({
  name: { type: String },
  rows: { type: Number, default: 2 },
  cols: { type: Number, default: 3 },
  colSizes: { type: [Number], default: [] },
  rowSizes: { type: [Number], default: [] },
  userId: { type: String, required: true },

  // Phase 1: Occurrences (array of occurrence IDs)
  occurrences: { type: [String], default: [] },  // Panel occurrences in this grid

  // Iteration definitions
  iterations: {
    type: [{
      id: { type: String, required: true },
      name: { type: String, default: "" },
      timeFilter: { type: String, enum: ["daily", "weekly", "monthly", "yearly"], default: "daily" },
    }],
    default: [{
      id: "default",
      name: "Daily",
      timeFilter: "daily"
    }]
  },

  // Currently selected iteration
  selectedIterationId: { type: String, default: "default" },

  // Current iteration value (the date/period being viewed)
  currentIterationValue: { type: Date, default: Date.now },

  // Global field registry
  fieldIds: { type: [String], default: [] }
}, { timestamps: true });

export default mongoose.model("Grid", GridSchema);
