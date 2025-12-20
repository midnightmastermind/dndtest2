/**
 * scripts/seedModuli.js
 *
 * Usage:
 *   node scripts/seedModuli.js
 *   node scripts/seedModuli.js --reset
 *
 * Expects:
 *   MONGO_URI in process.env (use dotenv or export it)
 *
 * What it does:
 * - Picks the first user in the DB
 * - Creates 1 grid
 * - Creates 2 panels on that grid
 * - Creates 4 todo containers (with instances) in panel 1
 * - Creates 48 empty time containers in panel 2 (00am -> 23:30pm)
 */

import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import mongoose from "mongoose";
import crypto from "crypto";

import User from "../models/User.js";
import Grid from "../models/Grid.js";
import Panel from "../models/Panel.js";
import Container from "../models/Container.js";
import Instance from "../models/Instance.js";

const argSet = new Set(process.argv.slice(2));
const RESET = argSet.has("--reset");

const uid = () => crypto.randomUUID();

function buildTimeLabels30Min() {
  const out = [];
  for (let h = 0; h < 24; h++) {
    for (let m of [0, 30]) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const suffix = h < 12 ? "am" : "pm";
      // Format requested: 00am, 00:30am, 01am, ...
      out.push(m === 0 ? `${hh}${suffix}` : `${hh}:${mm}${suffix}`);
    }
  }
  return out; // 48
}

function sampleTodos() {
  // 4 example lists, each with a handful of tasks
  return [
    {
      listName: "Groceries",
      tasks: ["Eggs", "Greek yogurt", "Olive oil", "Chicken thighs", "Spinach", "Coffee beans"],
    },
    {
      listName: "DayTracker Bugs",
      tasks: [
        "Fix drag overlay snapback",
        "Verify full_state hydration",
        "Ensure panel.layout persists",
        "Tighten memo guards in Panel",
      ],
    },
    {
      listName: "Project Firefly",
      tasks: ["Draft landing page sections", "Add media uploader", "Plan theme tokens", "Write README outline"],
    },
    {
      listName: "Errands",
      tasks: ["Laundry", "Call bank", "Refill water", "Clean desk", "Back up laptop"],
    },
  ];
}

async function maybeResetForUser(userId) {
  // WARNING: This deletes *all* grids/panels/containers/instances for this user.
  const grids = await Grid.find({ userId }).select("_id").lean();
  const gridIds = grids.map((g) => String(g._id));

  await Panel.deleteMany({ userId, gridId: { $in: gridIds } });
  await Container.deleteMany({ userId });
  await Instance.deleteMany({ userId });
  await Grid.deleteMany({ userId });
}

async function main() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    throw new Error("Missing MONGO_URI in environment. Put it in .env or export it before running.");
  }

  await mongoose.connect(MONGO_URI);
  console.log("[seed] connected");

  const user = await User.findOne().lean();
  if (!user) throw new Error("No users found in DB. Create a user first, then rerun seed.");
  const userId = user._id;
  console.log("[seed] using user:", String(userId));

  if (RESET) {
    console.log("[seed] --reset detected: clearing user data (grids/panels/containers/instances)...");
    await maybeResetForUser(userId);
  }

  // ----------------------------
  // 1) Create Grid
  // ----------------------------
  const grid = await Grid.create({
    userId,
    name: "Default Grid",
    cols: 3,
    rows: 2,
    colSizes: [1, 1, 1],
    rowSizes: [1, 1],
  });

  const gridId = String(grid._id);
  console.log("[seed] created grid:", gridId);

  // ----------------------------
  // 2) Create Panels
  // ----------------------------
  const todoPanelId = uid();
  const schedulePanelId = uid();

  const todoPanel = await Panel.create({
    id: todoPanelId,
    userId,
    gridId,
    row: 0,
    col: 0,
    width: 1,
    height: 2,
    containers: [],
    layout: {
      // optional starter layout; your Panel.jsx mergeLayout() will backfill defaults safely
      display: "grid",
      columns: 1,
      gapPx: 12,
      scrollY: "auto",
    },
  });

  const schedulePanel = await Panel.create({
    id: schedulePanelId,
    userId,
    gridId,
    row: 0,
    col: 1,
    width: 2,
    height: 2,
    containers: [],
    layout: {
      display: "grid",
      columns: 4, // nice grid for 48 blocks; change to taste
      gapPx: 8,
      scrollY: "auto",
    },
  });

  console.log("[seed] created panels:", todoPanelId, schedulePanelId);

  // ----------------------------
  // 3) Create 4 todo Containers + Instances
  // ----------------------------
  const todoLists = sampleTodos();
  const todoContainerIds = [];

  for (const list of todoLists) {
    const containerId = uid();

    // create instances first
    const instanceIds = [];
    for (const label of list.tasks) {
      const instanceId = uid();
      await Instance.create({
        id: instanceId,
        userId,
        label,
        children: [],
        childrenSortable: false,
        originalContainerId: containerId,
      });
      instanceIds.push(instanceId);
    }

    await Container.create({
      id: containerId,
      userId,
      label: list.listName,
      items: instanceIds, // container.items holds instance ids
    });

    todoContainerIds.push(containerId);
  }

  // attach to todo panel (preserve order)
  await Panel.updateOne(
    { userId, gridId, id: todoPanelId },
    { $set: { containers: todoContainerIds } }
  );

  console.log("[seed] created todo containers:", todoContainerIds.length);

  // ----------------------------
  // 4) Create 48 empty time Containers
  // ----------------------------
  const timeLabels = buildTimeLabels30Min(); // 48
  const scheduleContainerIds = [];

  for (const label of timeLabels) {
    const containerId = uid();
    await Container.create({
      id: containerId,
      userId,
      label,
      items: [],
    });
    scheduleContainerIds.push(containerId);
  }

  // attach to schedule panel
  await Panel.updateOne(
    { userId, gridId, id: schedulePanelId },
    { $set: { containers: scheduleContainerIds } }
  );

  console.log("[seed] created schedule containers:", scheduleContainerIds.length);

  console.log("[seed] done ✅");
  console.log("[seed] gridId:", gridId);
  console.log("[seed] todoPanelId:", todoPanelId);
  console.log("[seed] schedulePanelId:", schedulePanelId);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[seed] error:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});