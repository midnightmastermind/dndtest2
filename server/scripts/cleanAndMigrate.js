// scripts/cleanAndMigrate.js
// Cleans stale occurrence references and re-runs migration

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

// UID generator matching client
function uid() {
  return nanoid(12);
}

async function cleanAndMigrate() {
  console.log("🧹 Starting clean and migrate...\n");

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // ===================================================================
    // CLEAN: Delete all existing occurrences and clear occurrence arrays
    // ===================================================================
    console.log("🗑️  Cleaning old occurrences...");

    const deletedOccurrences = await Occurrence.deleteMany({});
    console.log(`   Deleted ${deletedOccurrences.deletedCount} old occurrences`);

    // Clear occurrence arrays from all documents (but keep items/containers for migration)
    await Container.updateMany({}, { $set: { occurrences: [] } });
    await Panel.updateMany({}, { $set: { occurrences: [] } });
    await Grid.updateMany({}, { $set: { occurrences: [] } });
    console.log(`   Cleared all occurrence arrays\n`);

    // ===================================================================
    // STEP 1: Load panels to build container->gridId mapping
    // ===================================================================
    console.log("📋 Loading panels to build container->gridId mapping...");

    const panels = await Panel.find({}).lean();
    console.log(`   Found ${panels.length} panels`);

    // Build a map of containerId -> gridId by looking at which panel contains each container
    const containerToGridId = {};
    for (const panel of panels) {
      if (panel.gridId && Array.isArray(panel.containers)) {
        for (const containerId of panel.containers) {
          containerToGridId[containerId] = panel.gridId;
        }
      }
    }
    console.log(`   Built mapping for ${Object.keys(containerToGridId).length} containers\n`);

    // ===================================================================
    // STEP 2: Migrate Container.items -> Container.occurrences
    // ===================================================================
    console.log("📦 Step 2: Migrating containers...");

    const containers = await Container.find({}).lean();
    console.log(`   Found ${containers.length} containers`);

    let containersMigrated = 0;
    let instanceOccurrencesCreated = 0;

    for (const container of containers) {
      const containerId = container.id || container._id.toString();
      const hasItems = Array.isArray(container.items) && container.items.length > 0;

      // Skip if no items
      if (!hasItems) {
        continue;
      }

      // Get gridId from the panel that contains this container
      const gridId = containerToGridId[containerId] || "unknown";
      if (gridId === "unknown") {
        console.warn(`   ⚠️  Container ${containerId} has no panel, using "unknown" gridId`);
      }

      // Migrate items to occurrences
      const occurrenceIds = [];

      for (const instanceId of container.items) {
        // Check if instance exists
        const instance = await Instance.findOne({ id: instanceId }).lean();
        if (!instance) {
          console.warn(`   ⚠️  Instance ${instanceId} not found, skipping...`);
          continue;
        }

        // Create occurrence for this instance
        const occurrenceId = uid();
        const occurrence = new Occurrence({
          id: occurrenceId,
          userId: container.userId,
          targetType: "instance",
          targetId: instanceId,
          gridId: gridId,
          iteration: { key: "time", value: new Date() },
          timestamp: new Date(),
          fields: {},
          meta: { containerId: containerId },
        });

        await occurrence.save();
        occurrenceIds.push(occurrenceId);
        instanceOccurrencesCreated++;
      }

      // Update container: set occurrences, remove items
      await Container.findOneAndUpdate(
        { _id: container._id },
        {
          $set: { occurrences: occurrenceIds },
          $unset: { items: "" }
        }
      );

      containersMigrated++;
    }

    console.log(`   ✅ Migrated ${containersMigrated} containers`);
    console.log(`   ✅ Created ${instanceOccurrencesCreated} instance occurrences\n`);

    // ===================================================================
    // STEP 3: Migrate Panel.containers -> Panel.occurrences
    // ===================================================================
    console.log("📋 Step 3: Migrating panels...");
    // Reusing panels from Step 1
    console.log(`   Found ${panels.length} panels`);

    let panelsMigrated = 0;
    let containerOccurrencesCreated = 0;

    for (const panel of panels) {
      const hasContainers = Array.isArray(panel.containers) && panel.containers.length > 0;

      // Skip if no containers
      if (!hasContainers) {
        continue;
      }

      // Migrate containers to occurrences
      const occurrenceIds = [];

      for (const containerId of panel.containers) {
        // Check if container exists
        const container = await Container.findOne({ id: containerId }).lean();
        if (!container) {
          console.warn(`   ⚠️  Container ${containerId} not found, skipping...`);
          continue;
        }

        // Create occurrence for this container
        const occurrenceId = uid();
        const occurrence = new Occurrence({
          id: occurrenceId,
          userId: panel.userId,
          targetType: "container",
          targetId: containerId,
          gridId: panel.gridId || "unknown",
          iteration: { key: "time", value: new Date() },
          timestamp: new Date(),
          fields: {},
          meta: { panelId: panel.id },
        });

        await occurrence.save();
        occurrenceIds.push(occurrenceId);
        containerOccurrencesCreated++;
      }

      // Update panel: set occurrences, remove containers
      await Panel.findOneAndUpdate(
        { _id: panel._id },
        {
          $set: { occurrences: occurrenceIds },
          $unset: { containers: "" }
        }
      );

      panelsMigrated++;
    }

    console.log(`   ✅ Migrated ${panelsMigrated} panels`);
    console.log(`   ✅ Created ${containerOccurrencesCreated} container occurrences\n`);

    // ===================================================================
    // STEP 4: Create panel occurrences for grids
    // ===================================================================
    console.log("🗂️  Step 4: Migrating grids (panels)...");

    const grids = await Grid.find({}).lean();
    console.log(`   Found ${grids.length} grids`);

    let gridsMigrated = 0;
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

      gridsMigrated++;
    }

    console.log(`   ✅ Migrated ${gridsMigrated} grids`);
    console.log(`   ✅ Created ${panelOccurrencesCreated} panel occurrences\n`);

    // ===================================================================
    // SUMMARY
    // ===================================================================
    console.log("=".repeat(60));
    console.log("🎉 CLEAN AND MIGRATE COMPLETE!");
    console.log("=".repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   - Containers migrated: ${containersMigrated}`);
    console.log(`   - Panels migrated: ${panelsMigrated}`);
    console.log(`   - Grids migrated: ${gridsMigrated}`);
    console.log(`   - Instance occurrences created: ${instanceOccurrencesCreated}`);
    console.log(`   - Container occurrences created: ${containerOccurrencesCreated}`);
    console.log(`   - Panel occurrences created: ${panelOccurrencesCreated}`);
    console.log(`   - Total occurrences created: ${instanceOccurrencesCreated + containerOccurrencesCreated + panelOccurrencesCreated}`);
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

// Run migration
cleanAndMigrate();
