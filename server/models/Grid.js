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

  // Iteration definitions (time-based)
  iterations: {
    type: [{
      id: { type: String, required: true },
      name: { type: String, default: "" },
      timeFilter: { type: String, enum: ["daily", "weekly", "monthly", "yearly", "all"], default: "daily" },
    }],
    default: [{
      id: "default",
      name: "Daily",
      timeFilter: "daily"
    }]
  },

  // Category dimensions (for compound filtering: time + category)
  // Examples: "Project", "Context", "Tag"
  categoryDimensions: {
    type: [{
      id: { type: String, required: true },
      name: { type: String, default: "" },
      // Available values in this dimension
      values: { type: [String], default: [] },
    }],
    default: []
  },

  // Currently selected time iteration
  selectedIterationId: { type: String, default: "default" },

  // Current time value (the date/period being viewed)
  currentIterationValue: { type: Date, default: Date.now },

  // Currently selected category dimension (null = no category filtering)
  selectedCategoryId: { type: String, default: null },

  // Current category value (null = show all)
  currentCategoryValue: { type: String, default: null },

  // Global field registry
  fieldIds: { type: [String], default: [] },

  // Templates: saved snapshots of container contents that can be re-applied
  // Each template stores which instances go in which container with field defaults
  templates: {
    type: [{
      id: { type: String, required: true },
      name: { type: String, default: "Untitled Template" },
      // Array of { containerId, instanceId, fieldDefaults: {} }
      items: { type: mongoose.Schema.Types.Mixed, default: [] },
      createdAt: { type: Date, default: Date.now },
    }],
    default: []
  },

  // Default template for auto-created day pages (matches a template.id in templates[])
  defaultDayPageTemplateId: { type: String, default: null },
}, { timestamps: true });

export default mongoose.model("Grid", GridSchema);
