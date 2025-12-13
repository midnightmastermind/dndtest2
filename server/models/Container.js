// models/Container.js
import mongoose from "mongoose";

const ContainerSchema = new mongoose.Schema(
  {
    // Your app uses string ids (uid())
    id: { type: String, required: true, index: true, unique: true },

    label: { type: String, required: true, trim: true },

    // Array of Instance ids (strings), in-order
    items: { type: [String], default: [] },
    userId: { type: String, required: true },

    // Optional: if you have users
    // userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
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
