// scripts/randomizeTestData.js
// Randomly distributes instances across containers for test data

import mongoose from "mongoose";
import "dotenv/config";
import { nanoid } from "nanoid";

// Import models
import Grid from "../models/Grid.js";
import Panel from "../models/Panel.js";
import Container from "../models/Container.js";
import Instance from "../models/Instance.js";
import Occurrence from "../models/Occurrence.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/dnd_containers";

// UID generator
function uid() {
  return nanoid(12);
}

// Shuffle array helper
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function randomizeTestData() {
  console.log("🎲 Randomizing test data...\n");

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // ===================================================================
    // CLEAN: Delete all occurrences and clear arrays
    // ===================================================================
    console.log("🗑️  Cleaning old data...");

    const deletedOccurrences = await Occurrence.deleteMany({});
    console.log(`   Deleted ${deletedOccurrences.deletedCount} old occurrences`);

    await Container.updateMany({}, { $set: { occurrences: [] }, $unset: { items: "" } });
    await Panel.updateMany({}, { $set: { occurrences: [] }, $unset: { containers: "" } });
    await Grid.updateMany({}, { $set: { occurrences: [] } });
    console.log(`   Cleared all occurrence arrays\n`);

    // ===================================================================
    // RANDOMLY DISTRIBUTE INSTANCES TO CONTAINERS
    // ===================================================================
    console.log("🎲 Randomly distributing instances...");

    const containers = await Container.find({}).lean();
    const instances = await Instance.find({}).lean();
    const panels = await Panel.find({}).lean();

    // Create panel lookup for getting gridIds
    const panelById = {};
    panels.forEach(p => { panelById[p.id] = p; });

    console.log(`   Found ${containers.length} containers`);
    console.log(`   Found ${instances.length} instances`);

    let instanceOccurrencesCreated = 0;
    let containerOccurrencesCreated = 0;

    if (containers.length === 0) {
      console.log("   ⚠️  No containers found, skipping instance distribution");
    } else if (instances.length === 0) {
      console.log("   ⚠️  No instances found, skipping");
    } else {
      // Shuffle instances for randomness
      const shuffledInstances = shuffle(instances);

      for (let i = 0; i < shuffledInstances.length; i++) {
        const instance = shuffledInstances[i];
        // Pick a random container (with weighted distribution - some containers get more)
        const containerIndex = Math.floor(Math.random() * Math.random() * containers.length);
        const container = containers[containerIndex];

        // Find gridId from container's panel
        let gridId = container.gridId;
        if (!gridId && container.panelId) {
          const panel = panelById[container.panelId];
          if (panel) gridId = panel.gridId;
        }
        if (!gridId) gridId = "unknown";

        // Create occurrence
        const occurrenceId = uid();
        const occurrence = new Occurrence({
          id: occurrenceId,
          userId: instance.userId,
          targetType: "instance",
          targetId: instance.id,
          gridId,
          iteration: { key: "time", value: new Date() },
          timestamp: new Date(),
          fields: {},
          meta: { containerId: container.id || container._id.toString() },
        });

        await occurrence.save();

        // Add to container's occurrence array
        await Container.findOneAndUpdate(
          { _id: container._id },
          { $push: { occurrences: occurrenceId } }
        );

        instanceOccurrencesCreated++;
      }

      console.log(`   ✅ Created ${instanceOccurrencesCreated} instance occurrences`);
    }

    // ===================================================================
    // RANDOMLY DISTRIBUTE CONTAINERS TO PANELS
    // ===================================================================
    console.log("\n📋 Randomly distributing containers to panels...");

    console.log(`   Found ${panels.length} panels`);

    if (panels.length === 0) {
      console.log("   ⚠️  No panels found, skipping container distribution");
    } else if (containers.length === 0) {
      console.log("   ⚠️  No containers found, skipping");
    } else {
      const shuffledContainers = shuffle(containers);

      for (let i = 0; i < shuffledContainers.length; i++) {
        const container = shuffledContainers[i];
        // Pick a random panel (with weighted distribution)
        const panelIndex = Math.floor(Math.random() * Math.random() * panels.length);
        const panel = panels[panelIndex];

        // Create occurrence
        const occurrenceId = uid();
        const occurrence = new Occurrence({
          id: occurrenceId,
          userId: container.userId,
          targetType: "container",
          targetId: container.id,
          gridId: panel.gridId || container.gridId || "unknown",
          iteration: { key: "time", value: new Date() },
          timestamp: new Date(),
          fields: {},
          meta: { panelId: panel.id },
        });

        await occurrence.save();

        // Add to panel's occurrence array
        await Panel.findOneAndUpdate(
          { _id: panel._id },
          { $push: { occurrences: occurrenceId } }
        );

        containerOccurrencesCreated++;
      }

      console.log(`   ✅ Created ${containerOccurrencesCreated} container occurrences`);
    }

    // ===================================================================
    // ADD PANELS TO GRIDS
    // ===================================================================
    console.log("\n🗂️  Adding panels to grids...");

    const grids = await Grid.find({}).lean();
    console.log(`   Found ${grids.length} grids`);

    let panelOccurrencesCreated = 0;

    for (const grid of grids) {
      const gridId = grid._id.toString();

      // Find all panels for this grid
      const gridPanels = await Panel.find({ gridId }).lean();

      if (gridPanels.length === 0) {
        continue;
      }

      const occurrenceIds = [];

      for (const panel of gridPanels) {
        // Create occurrence for this panel in the grid
        const occurrenceId = uid();
        const occurrence = new Occurrence({
          id: occurrenceId,
          userId: grid.userId,
          targetType: "panel",
          targetId: panel.id,
          gridId: gridId,
          iteration: { key: "time", value: new Date() },
          timestamp: new Date(),
          placement: { row: panel.row || 0, col: panel.col || 0, width: panel.width || 1, height: panel.height || 1 },
          fields: {},
          meta: {},
        });

        await occurrence.save();
        occurrenceIds.push(occurrenceId);
        panelOccurrencesCreated++;
      }

      // Update grid with panel occurrences
      await Grid.findOneAndUpdate(
        { _id: grid._id },
        { $set: { occurrences: occurrenceIds } }
      );
    }

    console.log(`   ✅ Created ${panelOccurrencesCreated} panel occurrences`);

    // ===================================================================
    // SUMMARY
    // ===================================================================
    console.log("\n" + "=".repeat(60));
    console.log("🎉 RANDOMIZATION COMPLETE!");
    console.log("=".repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   - Instances: ${instances.length}`);
    console.log(`   - Containers: ${containers.length}`);
    console.log(`   - Panels: ${panels.length}`);
    console.log(`   - Grids: ${grids.length}`);
    console.log(`   - Instance occurrences created: ${instanceOccurrencesCreated || 0}`);
    console.log(`   - Container occurrences created: ${containerOccurrencesCreated || 0}`);
    console.log(`   - Panel occurrences created: ${panelOccurrencesCreated}`);
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Randomization failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

// Run randomization
randomizeTestData();
