// scripts/resetData.js
// ============================================================
// Resets the database with sample habit/task data to showcase the site
// Uses createDefaultUserData utility for consistency with new user setup
// ============================================================

import mongoose from "mongoose";
import "dotenv/config";

// Import models for cleanup
import Grid from "../models/Grid.js";
import Panel from "../models/Panel.js";
import Container from "../models/Container.js";
import Instance from "../models/Instance.js";
import Occurrence from "../models/Occurrence.js";
import Field from "../models/Field.js";
import User from "../models/User.js";

// Import the reusable utility
import createDefaultUserData from "../utils/createDefaultUserData.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/dnd_containers";

// Target user email for sample data
const TARGET_USER_EMAIL = "josh@jpoms.com";

async function resetData() {
  console.log("🔄 Starting data reset with sample data...\n");

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // ===================================================================
    // STEP 0: Find the target user
    // ===================================================================
    console.log(`🔍 Looking up user: ${TARGET_USER_EMAIL}...`);
    const user = await User.findOne({ email: TARGET_USER_EMAIL });
    if (!user) {
      throw new Error(`User not found with email: ${TARGET_USER_EMAIL}`);
    }
    const userId = user._id.toString();
    console.log(`   ✅ Found user: ${userId}\n`);

    // ===================================================================
    // STEP 1: Clear existing data FOR THIS USER ONLY
    // ===================================================================
    console.log("🗑️  Clearing existing data for user...");

    await Occurrence.deleteMany({ userId });
    await Field.deleteMany({ userId });
    await Instance.deleteMany({ userId });
    await Container.deleteMany({ userId });
    await Panel.deleteMany({ userId });
    await Grid.deleteMany({ userId });

    console.log("   ✅ User data cleared\n");

    // ===================================================================
    // STEP 2: Create default data using the reusable utility
    // ===================================================================
    console.log("📊 Creating sample data for user...\n");

    const { gridId, summary } = await createDefaultUserData(userId);

    // ===================================================================
    // SUMMARY
    // ===================================================================
    console.log("=".repeat(60));
    console.log("🎉 DATA RESET COMPLETE!");
    console.log("=".repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   - User: ${TARGET_USER_EMAIL} (${userId})`);
    console.log(`   - Grid ID: ${gridId}`);
    console.log(`   - Fields: ${summary.fields}`);
    console.log(`   - Instances: ${summary.instances}`);
    console.log(`   - Containers: ${summary.containers}`);
    console.log(`   - Panels: ${summary.panels}`);
    console.log("=".repeat(60));
    console.log("\n📖 Sample data includes:");
    console.log("   - Habits panel: Water tracking, exercise, meditation, reading");
    console.log("   - Tasks panel: Daily tasks, weekly planning");
    console.log("   - Finances panel: Income, expenses with in/out flow demo");
    console.log("   - Derived fields: Totals, targets (8 glasses water, 30 min exercise)");
    console.log("   - Iteration examples: Daily, weekly, monthly filters");
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Reset failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

// Run reset
resetData();
