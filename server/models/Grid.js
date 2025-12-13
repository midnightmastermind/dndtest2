import mongoose from "mongoose";

const GridSchema = new mongoose.Schema({
  name: { type: String },
  rows: { type: Number, default: 2 },
  cols: { type: Number, default: 3 },
  colSizes: { type: [Number], default: [] },
  rowSizes: { type: [Number], default: [] },
  userId: { type: String, required: true }
}, { timestamps: true });

export default mongoose.model("Grid", GridSchema);
