// scripts/migrateToOccurrences.js
// Migrates existing data from items/containers arrays to occurrence system

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

async function migrateToOccurrences() {
  console.log("🚀 Starting migration to occurrence system...\n");

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // ===================================================================
    // STEP 1: Migrate Container.items -> Container.occurrences
    // ===================================================================
    console.log("📦 Step 1: Migrating containers...");

    const containers = await Container.find({}).lean();
    console.log(`   Found ${containers.length} containers`);

    let containersMigrated = 0;
    let instanceOccurrencesCreated = 0;

    for (const container of containers) {
      const hasOldItems = Array.isArray(container.items) && container.items.length > 0;
      const hasNewOccurrences = Array.isArray(container.occurrences) && container.occurrences.length > 0;

      // Skip if already migrated (has occurrences but no items)
      if (hasNewOccurrences && !hasOldItems) {
        continue;
      }

      // Skip if no items to migrate
      if (!hasOldItems) {
        // Ensure occurrences array exists
        await Container.findOneAndUpdate(
          { _id: container._id },
          { $set: { occurrences: [] }, $unset: { items: "" } }
        );
        continue;
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
          gridId: container.gridId || "unknown",
          iteration: { key: "time", value: new Date() },
          timestamp: new Date(),
          fields: {},
          meta: { containerId: container.id || container._id.toString() },
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
    // STEP 2: Migrate Panel.containers -> Panel.occurrences
    // ===================================================================
    console.log("📋 Step 2: Migrating panels...");

    const panels = await Panel.find({}).lean();
    console.log(`   Found ${panels.length} panels`);

    let panelsMigrated = 0;
    let containerOccurrencesCreated = 0;

    for (const panel of panels) {
      const hasOldContainers = Array.isArray(panel.containers) && panel.containers.length > 0;
      const hasNewOccurrences = Array.isArray(panel.occurrences) && panel.occurrences.length > 0;

      // Skip if already migrated
      if (hasNewOccurrences && !hasOldContainers) {
        continue;
      }

      // Skip if no containers to migrate
      if (!hasOldContainers) {
        // Ensure occurrences array exists
        await Panel.findOneAndUpdate(
          { _id: panel._id },
          { $set: { occurrences: [] }, $unset: { containers: "" } }
        );
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
    // STEP 3: Create panel occurrences for grids
    // ===================================================================
    console.log("🗂️  Step 3: Migrating grids (panels)...");

    const grids = await Grid.find({}).lean();
    console.log(`   Found ${grids.length} grids`);

    let gridsMigrated = 0;
    let panelOccurrencesCreated = 0;

    for (const grid of grids) {
      const gridId = grid._id.toString();

      // Find all panels for this grid
      const gridPanels = await Panel.find({ gridId }).lean();

      if (gridPanels.length === 0) {
        // Ensure grid has empty occurrences array
        await Grid.findOneAndUpdate(
          { _id: grid._id },
          { $set: { occurrences: [] } }
        );
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
          placement: { row: 0, col: 0, width: 1, height: 1 }, // Default placement
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
    console.log("=" .repeat(60));
    console.log("🎉 MIGRATION COMPLETE!");
    console.log("=" .repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   - Containers migrated: ${containersMigrated}`);
    console.log(`   - Panels migrated: ${panelsMigrated}`);
    console.log(`   - Grids migrated: ${gridsMigrated}`);
    console.log(`   - Instance occurrences created: ${instanceOccurrencesCreated}`);
    console.log(`   - Container occurrences created: ${containerOccurrencesCreated}`);
    console.log(`   - Panel occurrences created: ${panelOccurrencesCreated}`);
    console.log(`   - Total occurrences created: ${instanceOccurrencesCreated + containerOccurrencesCreated + panelOccurrencesCreated}`);
    console.log("=" .repeat(60));

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

// Run migration
migrateToOccurrences();
