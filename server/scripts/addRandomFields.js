// scripts/addRandomFields.js
// ============================================================
// Script to add random fields and attach them to instances
// Creates input fields, derived fields, and populates occurrence values
// Run with: node --experimental-modules scripts/addRandomFields.js
// ============================================================

import mongoose from "mongoose";
import dotenv from "dotenv";
import Grid from "../models/Grid.js";
import Instance from "../models/Instance.js";
import Occurrence from "../models/Occurrence.js";
import Field from "../models/Field.js";

dotenv.config();

// Helper to generate random ID
function uid() {
  return Math.random().toString(36).substring(2, 10);
}

// Sample field configurations
const SAMPLE_FIELDS = [
  // Input fields
  {
    name: "Score",
    type: "number",
    mode: "input",
    meta: { prefix: "", postfix: " pts", increment: 1 },
  },
  {
    name: "Price",
    type: "number",
    mode: "input",
    meta: { prefix: "$", postfix: "", increment: 0.01 },
  },
  {
    name: "Weight",
    type: "number",
    mode: "input",
    meta: { prefix: "", postfix: " kg", increment: 0.1 },
  },
  {
    name: "Progress",
    type: "number",
    mode: "input",
    meta: { prefix: "", postfix: "%", increment: 5 },
  },
  {
    name: "Count",
    type: "number",
    mode: "input",
    meta: { prefix: "", postfix: "x", increment: 1 },
  },
  {
    name: "Hours",
    type: "number",
    mode: "input",
    meta: { prefix: "", postfix: "h", increment: 0.5 },
  },
  {
    name: "Notes",
    type: "text",
    mode: "input",
    meta: {},
  },
  {
    name: "Completed",
    type: "boolean",
    mode: "input",
    meta: {},
  },
];

// Generate a random value based on field type
function generateRandomValue(field) {
  switch (field.type) {
    case "number": {
      const increment = field.meta?.increment || 1;
      const max = increment < 1 ? 100 : 50;
      const value = Math.floor(Math.random() * max / increment) * increment;
      return Math.round(value * 100) / 100; // Avoid floating point issues
    }
    case "text":
      return ["Good", "Needs work", "On track", "Review", "Done"][Math.floor(Math.random() * 5)];
    case "boolean":
      return Math.random() > 0.5;
    case "date":
      return new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return null;
  }
}

async function addRandomFields() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/dndtest";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // Get a grid to work with
    const grid = await Grid.findOne();
    if (!grid) {
      console.log("No grid found. Please create a grid first.");
      process.exit(1);
    }
    const gridId = grid._id.toString();
    const userId = grid.userId || "default-user";
    console.log(`Working with grid: ${gridId}, user: ${userId}`);

    // Get all instances for this user
    const instances = await Instance.find({ userId });
    console.log(`Found ${instances.length} instances`);

    if (instances.length === 0) {
      console.log("No instances found. Please create some instances first.");
      process.exit(1);
    }

    // Create fields
    console.log("\nCreating fields...");
    const createdFields = [];

    for (const fieldConfig of SAMPLE_FIELDS) {
      const fieldId = uid();
      const field = new Field({
        id: fieldId,
        userId,
        ...fieldConfig,
      });
      await field.save();
      createdFields.push(field);
      console.log(`  Created field: ${field.name} (${field.type}, ${field.mode})`);
    }

    // Create derived fields that aggregate from input fields
    const inputNumberFields = createdFields.filter(f => f.type === "number" && f.mode === "input");

    for (const sourceField of inputNumberFields.slice(0, 3)) {
      const fieldId = uid();
      const derivedField = new Field({
        id: fieldId,
        userId,
        name: `Total ${sourceField.name}`,
        type: "number",
        mode: "derived",
        meta: sourceField.meta,
        metric: {
          source: "occurrences",
          fieldId: sourceField.id,
          aggregation: "sum",
          scope: "container",
          window: "all",
        },
      });
      await derivedField.save();
      createdFields.push(derivedField);
      console.log(`  Created derived field: ${derivedField.name} = sum(${sourceField.name})`);
    }

    // Attach random fields to instances
    console.log("\nAttaching fields to instances...");

    for (const instance of instances) {
      // Pick 2-4 random input fields for this instance
      const numFields = 2 + Math.floor(Math.random() * 3);
      const shuffled = [...createdFields.filter(f => f.mode === "input")]
        .sort(() => Math.random() - 0.5)
        .slice(0, numFields);

      // Maybe add a derived field too
      const derivedFields = createdFields.filter(f => f.mode === "derived");
      if (derivedFields.length > 0 && Math.random() > 0.5) {
        shuffled.push(derivedFields[Math.floor(Math.random() * derivedFields.length)]);
      }

      // Create field bindings
      const fieldBindings = shuffled.map((field, order) => ({
        fieldId: field.id,
        role: field.mode === "derived" ? "display" : "input",
        order,
      }));

      instance.fieldBindings = fieldBindings;
      await instance.save();
      console.log(`  Instance "${instance.label}": ${fieldBindings.length} fields`);
    }

    // Populate occurrence field values
    console.log("\nPopulating occurrence field values...");

    const occurrences = await Occurrence.find({
      gridId: gridId,
      targetType: "instance",
    });

    console.log(`Found ${occurrences.length} instance occurrences`);

    for (const occurrence of occurrences) {
      // Find the instance for this occurrence (match by instance.id, not _id)
      const instance = instances.find(i => i.id === occurrence.targetId);
      if (!instance || !instance.fieldBindings) continue;

      // Generate random values for each input field
      const fields = {};
      for (const binding of instance.fieldBindings) {
        const field = createdFields.find(f => f.id === binding.fieldId);
        if (field && field.mode === "input") {
          fields[field.id] = generateRandomValue(field);
        }
      }

      occurrence.fields = fields;
      await occurrence.save();
      console.log(`  Occurrence ${occurrence.id}: ${Object.keys(fields).length} field values`);
    }

    console.log("\nDone! Summary:");
    console.log(`  - Created ${createdFields.length} fields`);
    console.log(`  - Updated ${instances.length} instances with field bindings`);
    console.log(`  - Populated ${occurrences.length} occurrences with field values`);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

// Run the script
addRandomFields();
