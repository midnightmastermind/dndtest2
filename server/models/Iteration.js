// models/Iteration.js
import mongoose from "mongoose";

const IterationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, index: true, unique: true },
    userId: { type: String, required: true, index: true },
    gridId: { type: String, required: true, index: true },

    name: { type: String, default: "Daily" },

    // Time axis
    timeFilter: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly", "all"],
      default: "daily",
    },

    // Category axis (optional — for compound iterations)
    categoryKey: { type: String, default: null },
    categoryOptions: [{ type: String }],

    // Persistence mode
    mode: {
      type: String,
      enum: ["persistent", "specific", "untilDone"],
      default: "persistent",
    },

    sortOrder: { type: Number, default: 0 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

IterationSchema.index({ gridId: 1, sortOrder: 1 });

const Iteration = mongoose.model("Iteration", IterationSchema);
export default Iteration;
