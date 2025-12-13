// models/Instance.js
import mongoose from "mongoose";
// models/Instance.js
const InstanceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, index: true, unique: true },
    label: { type: String, required: true, trim: true },
    userId: { type: String, required: true }, // ✅ move here
    // ...any other instance props you want persisted
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
