// utils/createDefaultUserData.js
// ============================================================
// Creates default grid with sample habit/task data for a user
// Used for:
// 1. New user registration (automatic setup)
// 2. Reset data migration script (one-time bulk reset)
// ============================================================

import { nanoid } from "nanoid";
import Grid from "../models/Grid.js";
import Panel from "../models/Panel.js";
import Container from "../models/Container.js";
import Instance from "../models/Instance.js";
import Occurrence from "../models/Occurrence.js";
import Field from "../models/Field.js";

// UID generator matching client
function uid() {
  return nanoid(12);
}

/**
 * Creates a complete default grid with sample data for a user
 *
 * @param {string} userId - The user ID to create data for
 * @returns {Promise<{gridId: string, summary: object}>} - The created grid ID and summary
 */
export async function createDefaultUserData(userId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  // ===================================================================
  // STEP 1: Create Fields
  // ===================================================================
  const fields = {
    // Input fields
    waterGlasses: {
      id: uid(),
      name: "Water",
      type: "number",
      mode: "input",
      meta: { prefix: "", postfix: " glasses", increment: 1, flow: "in" },
    },
    exerciseMinutes: {
      id: uid(),
      name: "Exercise",
      type: "number",
      mode: "input",
      meta: { prefix: "", postfix: " min", increment: 15, flow: "in" },
    },
    completed: {
      id: uid(),
      name: "Done",
      type: "boolean",
      mode: "input",
      meta: {},
    },
    priority: {
      id: uid(),
      name: "Priority",
      type: "number",
      mode: "input",
      meta: { prefix: "P", postfix: "", increment: 1, min: 1, max: 5 },
    },
    notes: {
      id: uid(),
      name: "Notes",
      type: "text",
      mode: "input",
      meta: {},
    },
    moneySpent: {
      id: uid(),
      name: "Spent",
      type: "number",
      mode: "input",
      meta: { prefix: "$", postfix: "", increment: 1, flow: "out" },
    },
    moneyEarned: {
      id: uid(),
      name: "Earned",
      type: "number",
      mode: "input",
      meta: { prefix: "$", postfix: "", increment: 1, flow: "in" },
    },

    // Derived fields
    totalWater: {
      id: uid(),
      name: "Total Water",
      type: "number",
      mode: "derived",
      meta: { prefix: "", postfix: " glasses" },
      metric: {
        source: "occurrences",
        aggregation: "sum",
        scope: "container",
        timeFilter: "daily",
        target: { value: 8, op: ">=", timeFilter: "daily" },
        allowedFields: [],
      },
    },
    totalExercise: {
      id: uid(),
      name: "Total Exercise",
      type: "number",
      mode: "derived",
      meta: { prefix: "", postfix: " min" },
      metric: {
        source: "occurrences",
        aggregation: "sum",
        scope: "container",
        timeFilter: "daily",
        target: { value: 30, op: ">=", timeFilter: "daily" },
        allowedFields: [],
      },
    },
    tasksCompleted: {
      id: uid(),
      name: "Tasks Done",
      type: "number",
      mode: "derived",
      meta: { prefix: "", postfix: "" },
      metric: {
        source: "occurrences",
        aggregation: "countTrue",
        scope: "container",
        timeFilter: "daily",
        allowedFields: [],
      },
    },
    netMoney: {
      id: uid(),
      name: "Net",
      type: "number",
      mode: "derived",
      meta: { prefix: "$", postfix: "" },
      metric: {
        source: "occurrences",
        aggregation: "sum",
        scope: "container",
        timeFilter: "daily",
        allowedFields: [],
      },
    },
  };

  // Save fields
  for (const key in fields) {
    const field = new Field({
      ...fields[key],
      userId,
    });
    await field.save();
  }

  // Update derived fields with allowedFields references
  await Field.findOneAndUpdate(
    { id: fields.totalWater.id },
    { $set: { "metric.allowedFields": [{ fieldId: fields.waterGlasses.id, flowFilter: "any" }] } }
  );
  await Field.findOneAndUpdate(
    { id: fields.totalExercise.id },
    { $set: { "metric.allowedFields": [{ fieldId: fields.exerciseMinutes.id, flowFilter: "any" }] } }
  );
  await Field.findOneAndUpdate(
    { id: fields.tasksCompleted.id },
    { $set: { "metric.allowedFields": [{ fieldId: fields.completed.id, flowFilter: "any" }] } }
  );
  await Field.findOneAndUpdate(
    { id: fields.netMoney.id },
    { $set: { "metric.allowedFields": [
      { fieldId: fields.moneyEarned.id, flowFilter: "in" },
      { fieldId: fields.moneySpent.id, flowFilter: "out" }
    ] } }
  );

  // ===================================================================
  // STEP 2: Create Instances
  // ===================================================================
  const instances = {
    drinkWater: {
      id: uid(),
      label: "Drink Water",
      kind: "template",
      fieldBindings: [
        { fieldId: fields.waterGlasses.id, role: "input", order: 0 },
      ],
      iteration: { mode: "inherit", timeFilter: "daily" },
    },
    exercise: {
      id: uid(),
      label: "Exercise",
      kind: "template",
      fieldBindings: [
        { fieldId: fields.exerciseMinutes.id, role: "input", order: 0 },
      ],
      iteration: { mode: "inherit", timeFilter: "daily" },
    },
    meditate: {
      id: uid(),
      label: "Meditate",
      kind: "template",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
      ],
      iteration: { mode: "inherit", timeFilter: "daily" },
    },
    readBook: {
      id: uid(),
      label: "Read 30 min",
      kind: "template",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
      ],
      iteration: { mode: "inherit", timeFilter: "daily" },
    },
    emailInbox: {
      id: uid(),
      label: "Clear email inbox",
      kind: "template",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.priority.id, role: "input", order: 1 },
      ],
      iteration: { mode: "inherit", timeFilter: "daily" },
    },
    reviewPR: {
      id: uid(),
      label: "Review pull requests",
      kind: "template",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.priority.id, role: "input", order: 1 },
      ],
      iteration: { mode: "inherit", timeFilter: "daily" },
    },
    planWeek: {
      id: uid(),
      label: "Plan next week",
      kind: "template",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.notes.id, role: "input", order: 1 },
      ],
      iteration: { mode: "own", timeFilter: "weekly" },
    },
    habitSummary: {
      id: uid(),
      label: "Daily Summary",
      kind: "template",
      fieldBindings: [
        { fieldId: fields.totalWater.id, role: "display", order: 0 },
        { fieldId: fields.totalExercise.id, role: "display", order: 1 },
      ],
      iteration: { mode: "inherit", timeFilter: "daily" },
    },
    taskSummary: {
      id: uid(),
      label: "Tasks Summary",
      kind: "template",
      fieldBindings: [
        { fieldId: fields.tasksCompleted.id, role: "display", order: 0 },
      ],
      iteration: { mode: "inherit", timeFilter: "daily" },
    },
    salary: {
      id: uid(),
      label: "Salary",
      kind: "template",
      fieldBindings: [
        { fieldId: fields.moneyEarned.id, role: "input", order: 0 },
      ],
      iteration: { mode: "own", timeFilter: "monthly" },
    },
    groceries: {
      id: uid(),
      label: "Groceries",
      kind: "template",
      fieldBindings: [
        { fieldId: fields.moneySpent.id, role: "input", order: 0 },
      ],
      iteration: { mode: "inherit", timeFilter: "weekly" },
    },
    financeSummary: {
      id: uid(),
      label: "Balance",
      kind: "template",
      fieldBindings: [
        { fieldId: fields.netMoney.id, role: "display", order: 0 },
      ],
      iteration: { mode: "inherit", timeFilter: "monthly" },
    },
  };

  for (const key in instances) {
    const instance = new Instance({
      ...instances[key],
      userId,
    });
    await instance.save();
  }

  // ===================================================================
  // STEP 3: Create Containers
  // ===================================================================
  const containers = {
    dailyHabits: {
      id: uid(),
      label: "Daily Habits",
      kind: "list",
      iteration: { mode: "inherit", timeFilter: "daily" },
      occurrences: [],
    },
    todaysTasks: {
      id: uid(),
      label: "Today's Tasks",
      kind: "list",
      iteration: { mode: "inherit", timeFilter: "daily" },
      occurrences: [],
    },
    weeklyTasks: {
      id: uid(),
      label: "Weekly Tasks",
      kind: "list",
      iteration: { mode: "own", timeFilter: "weekly" },
      occurrences: [],
    },
    summaries: {
      id: uid(),
      label: "Summaries",
      kind: "list",
      iteration: { mode: "inherit", timeFilter: "daily" },
      occurrences: [],
    },
    income: {
      id: uid(),
      label: "Income",
      kind: "list",
      iteration: { mode: "own", timeFilter: "monthly" },
      occurrences: [],
    },
    expenses: {
      id: uid(),
      label: "Expenses",
      kind: "list",
      iteration: { mode: "own", timeFilter: "monthly" },
      occurrences: [],
    },
    balanceSummary: {
      id: uid(),
      label: "Balance",
      kind: "list",
      iteration: { mode: "own", timeFilter: "monthly" },
      occurrences: [],
    },
  };

  for (const key in containers) {
    const container = new Container({
      ...containers[key],
      userId,
    });
    await container.save();
  }

  // ===================================================================
  // STEP 4: Create Panels
  // ===================================================================
  const panels = {
    habits: {
      id: uid(),
      name: "Habits",
      kind: "board",
      iteration: { mode: "inherit", timeFilter: "daily" },
      layout: { display: "flex", flow: "col", gapPx: 12 },
      occurrences: [],
    },
    tasks: {
      id: uid(),
      name: "Tasks",
      kind: "board",
      iteration: { mode: "inherit", timeFilter: "daily" },
      layout: { display: "flex", flow: "col", gapPx: 12 },
      occurrences: [],
    },
    finances: {
      id: uid(),
      name: "Finances",
      kind: "board",
      iteration: { mode: "own", timeFilter: "monthly" },
      layout: { display: "grid", columns: 3, gapPx: 12 },
      occurrences: [],
    },
  };

  for (const key in panels) {
    const panel = new Panel({
      ...panels[key],
      userId,
    });
    await panel.save();
  }

  // ===================================================================
  // STEP 5: Create Grid
  // ===================================================================
  const grid = new Grid({
    userId,
    rows: 2,
    cols: 3,
    iterations: [
      { id: "daily", label: "Daily", timeFilter: "daily", currentDate: new Date().toISOString() },
      { id: "weekly", label: "Weekly", timeFilter: "weekly", currentDate: new Date().toISOString() },
      { id: "monthly", label: "Monthly", timeFilter: "monthly", currentDate: new Date().toISOString() },
    ],
    selectedIterationId: "daily",
    occurrences: [],
  });

  await grid.save();
  const gridId = grid._id.toString();

  // Update panels and containers with gridId
  await Panel.updateMany({ userId, gridId: { $exists: false } }, { $set: { gridId } });
  await Container.updateMany({ userId, gridId: { $exists: false } }, { $set: { gridId } });

  // ===================================================================
  // STEP 6: Create Occurrences and wire everything together
  // ===================================================================

  // Helper to create and save an occurrence
  async function createOccurrence({ targetType, targetId, meta = {}, placement = null }) {
    const occId = uid();
    const occ = new Occurrence({
      id: occId,
      userId,
      targetType,
      targetId,
      gridId,
      iteration: { key: "time", value: new Date() },
      timestamp: new Date(),
      fields: {},
      meta,
      ...(placement && { placement }),
    });
    await occ.save();
    return occId;
  }

  // Wire instances to containers
  const containerInstanceMappings = {
    dailyHabits: ["drinkWater", "exercise", "meditate", "readBook"],
    todaysTasks: ["emailInbox", "reviewPR"],
    weeklyTasks: ["planWeek"],
    summaries: ["habitSummary", "taskSummary"],
    income: ["salary"],
    expenses: ["groceries"],
    balanceSummary: ["financeSummary"],
  };

  for (const [containerKey, instanceKeys] of Object.entries(containerInstanceMappings)) {
    const occIds = [];
    for (const instKey of instanceKeys) {
      const occId = await createOccurrence({
        targetType: "instance",
        targetId: instances[instKey].id,
        meta: { containerId: containers[containerKey].id },
      });
      occIds.push(occId);
    }
    await Container.findOneAndUpdate(
      { id: containers[containerKey].id },
      { $set: { occurrences: occIds } }
    );
  }

  // Wire containers to panels
  const panelContainerMappings = {
    habits: ["dailyHabits", "summaries"],
    tasks: ["todaysTasks", "weeklyTasks"],
    finances: ["income", "expenses", "balanceSummary"],
  };

  for (const [panelKey, containerKeys] of Object.entries(panelContainerMappings)) {
    const occIds = [];
    for (const contKey of containerKeys) {
      const occId = await createOccurrence({
        targetType: "container",
        targetId: containers[contKey].id,
        meta: { panelId: panels[panelKey].id },
      });
      occIds.push(occId);
    }
    await Panel.findOneAndUpdate(
      { id: panels[panelKey].id },
      { $set: { occurrences: occIds } }
    );
  }

  // Wire panels to grid
  const panelPlacements = [
    { key: "habits", row: 0, col: 0, width: 1, height: 2 },
    { key: "tasks", row: 0, col: 1, width: 1, height: 2 },
    { key: "finances", row: 0, col: 2, width: 1, height: 2 },
  ];

  const gridOccs = [];
  for (const { key, row, col, width, height } of panelPlacements) {
    const occId = await createOccurrence({
      targetType: "panel",
      targetId: panels[key].id,
      meta: {},
      placement: { row, col, width, height },
    });
    gridOccs.push(occId);
  }

  await Grid.findByIdAndUpdate(grid._id, { $set: { occurrences: gridOccs } });

  // Return summary
  return {
    gridId,
    summary: {
      fields: Object.keys(fields).length,
      instances: Object.keys(instances).length,
      containers: Object.keys(containers).length,
      panels: Object.keys(panels).length,
    },
  };
}

/**
 * Checks if a user already has data (to avoid duplicate setup)
 *
 * @param {string} userId - The user ID to check
 * @returns {Promise<boolean>} - True if user has existing data
 */
export async function userHasData(userId) {
  const gridCount = await Grid.countDocuments({ userId });
  return gridCount > 0;
}

export default createDefaultUserData;
