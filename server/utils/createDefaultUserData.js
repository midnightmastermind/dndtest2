// utils/createDefaultUserData.js
// ============================================================
// Creates comprehensive default grid showcasing all field capabilities
//
// LAYOUT (3x2 grid):
// | Daily Toolkit | Schedule/DayPage | Daily Goals |
// | Todo List     | Schedule/DayPage | Accounts    |
//
// Panels:
// 1. Daily Toolkit - 8 wellness dimensions with copy-mode instances
// 2. Todo List - One-off tasks with move-mode instances
// 3. Schedule - 48 time slots (30 min increments)
// 4. Daily Goals - 8 dimensions with derived/aggregate fields (daily targets)
// 5. Accounts - Lifetime aggregations using transactions (no targets)
// 6. Day Page - Notebook panel with daily journal (shares cell with Schedule)
// ============================================================

import { nanoid } from "nanoid";
import Grid from "../models/Grid.js";
import Panel from "../models/Panel.js";
import Container from "../models/Container.js";
import Instance from "../models/Instance.js";
import Occurrence from "../models/Occurrence.js";
import Field from "../models/Field.js";
import Manifest from "../models/Manifest.js";
import View from "../models/View.js";
import Folder from "../models/Folder.js";
import Doc from "../models/Doc.js";
import Operation from "../models/Operation.js";
import Iteration from "../models/Iteration.js";

function uid() {
  return nanoid(12);
}

/**
 * Generates time labels for 24-hour schedule in 30-minute increments
 */
function generateTimeSlots() {
  const slots = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour % 12 || 12;
      const ampm = hour < 12 ? "am" : "pm";
      const m = minute === 0 ? "00" : "30";
      slots.push({
        label: `${h}:${m}${ampm}`,
        hour,
        minute,
      });
    }
  }
  return slots;
}

/**
 * Creates a complete default grid with 4 panels showcasing all capabilities
 */
export async function createDefaultUserData(userId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  // ===================================================================
  // STEP 0: Create Grid FIRST (to get gridId for all entities)
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
    categoryDimensions: [
      {
        id: "context",
        name: "Context",
        values: ["work", "personal", "health", "finance"],
      },
    ],
    selectedCategoryId: "context",
    currentCategoryValue: null, // null = show all
    templates: [],
    occurrences: [],
  });

  await grid.save();
  const gridId = grid._id.toString();

  // ===================================================================
  // STEP 1: Create Fields (now with gridId)
  // ===================================================================
  const fields = {
    // === INPUT FIELDS ===
    completed: {
      id: uid(),
      name: "Completed",
      type: "boolean",
      mode: "input",
      meta: { variant: "switch" },
    },
    duration: {
      id: uid(),
      name: "Duration",
      type: "duration",
      mode: "input",
      meta: { flow: "in" },
    },
    priority: {
      id: uid(),
      name: "Priority",
      type: "rating",
      mode: "input",
      meta: { max: 5 },
    },
    notes: {
      id: uid(),
      name: "Notes",
      type: "text",
      mode: "input",
      meta: { placeholder: "Add notes..." },
    },
    amount: {
      id: uid(),
      name: "Amount",
      type: "number",
      mode: "input",
      meta: { prefix: "$", postfix: "", increment: 5, flow: "out" },
    },
    income: {
      id: uid(),
      name: "Income",
      type: "number",
      mode: "input",
      meta: { prefix: "$", postfix: "", increment: 10, flow: "in" },
    },
    calories: {
      id: uid(),
      name: "Calories",
      type: "number",
      mode: "input",
      meta: { postfix: " cal", increment: 50, flow: "in" },
    },
    steps: {
      id: uid(),
      name: "Steps",
      type: "number",
      mode: "input",
      meta: { postfix: " steps", increment: 500, flow: "in" },
    },
    water: {
      id: uid(),
      name: "Water",
      type: "number",
      mode: "input",
      meta: { postfix: " oz", increment: 8, flow: "in" },
    },
    mood: {
      id: uid(),
      name: "Mood",
      type: "select",
      mode: "input",
      meta: {
        multiSelect: true,
        options: [
          // Joy family
          { value: "joyful", label: "Joyful" },
          { value: "happy", label: "Happy" },
          { value: "content", label: "Content" },
          { value: "cheerful", label: "Cheerful" },
          { value: "proud", label: "Proud" },
          { value: "optimistic", label: "Optimistic" },
          { value: "playful", label: "Playful" },
          { value: "excited", label: "Excited" },
          // Trust family
          { value: "trusting", label: "Trusting" },
          { value: "accepting", label: "Accepting" },
          { value: "peaceful", label: "Peaceful" },
          { value: "serene", label: "Serene" },
          { value: "grateful", label: "Grateful" },
          // Fear family
          { value: "anxious", label: "Anxious" },
          { value: "scared", label: "Scared" },
          { value: "worried", label: "Worried" },
          { value: "nervous", label: "Nervous" },
          { value: "insecure", label: "Insecure" },
          // Surprise family
          { value: "surprised", label: "Surprised" },
          { value: "amazed", label: "Amazed" },
          { value: "confused", label: "Confused" },
          { value: "stunned", label: "Stunned" },
          // Sadness family
          { value: "sad", label: "Sad" },
          { value: "lonely", label: "Lonely" },
          { value: "disappointed", label: "Disappointed" },
          { value: "depressed", label: "Depressed" },
          { value: "hopeless", label: "Hopeless" },
          { value: "guilty", label: "Guilty" },
          // Disgust family
          { value: "disgusted", label: "Disgusted" },
          { value: "disapproving", label: "Disapproving" },
          { value: "bored", label: "Bored" },
          // Anger family
          { value: "angry", label: "Angry" },
          { value: "frustrated", label: "Frustrated" },
          { value: "irritated", label: "Irritated" },
          { value: "annoyed", label: "Annoyed" },
          { value: "resentful", label: "Resentful" },
          { value: "jealous", label: "Jealous" },
          // Anticipation family
          { value: "anticipating", label: "Anticipating" },
          { value: "interested", label: "Interested" },
          { value: "curious", label: "Curious" },
          { value: "eager", label: "Eager" },
          // Neutral/Other
          { value: "neutral", label: "Neutral" },
          { value: "tired", label: "Tired" },
          { value: "stressed", label: "Stressed" },
          { value: "overwhelmed", label: "Overwhelmed" },
          { value: "calm", label: "Calm" },
          { value: "focused", label: "Focused" },
        ],
      },
    },
    energy: {
      id: uid(),
      name: "Energy",
      type: "rating",
      mode: "input",
      meta: { max: 5 },
    },
    pages: {
      id: uid(),
      name: "Pages",
      type: "number",
      mode: "input",
      meta: { postfix: " pages", increment: 5, flow: "in" },
    },
    dueDate: {
      id: uid(),
      name: "Due",
      type: "date",
      mode: "input",
      meta: {},
    },
    category: {
      id: uid(),
      name: "Category",
      type: "select",
      mode: "input",
      meta: {
        options: [
          { value: "work", label: "Work" },
          { value: "personal", label: "Personal" },
          { value: "health", label: "Health" },
          { value: "finance", label: "Finance" },
        ]
      },
    },

    // === TEXT INPUT FIELDS (for specific tracking) ===
    movieTitle: {
      id: uid(),
      name: "Movie",
      type: "text",
      mode: "input",
      meta: { placeholder: "Movie title..." },
    },
    bookTitle: {
      id: uid(),
      name: "Book",
      type: "text",
      mode: "input",
      meta: { placeholder: "Book title..." },
    },
    podcastTitle: {
      id: uid(),
      name: "Podcast",
      type: "text",
      mode: "input",
      meta: { placeholder: "Podcast name..." },
    },
    workoutType: {
      id: uid(),
      name: "Workout",
      type: "text",
      mode: "input",
      meta: { placeholder: "Workout type..." },
    },
    mealDescription: {
      id: uid(),
      name: "Meal",
      type: "text",
      mode: "input",
      meta: { placeholder: "What did you eat..." },
    },
    activityDescription: {
      id: uid(),
      name: "Activity",
      type: "text",
      mode: "input",
      meta: { placeholder: "Describe activity..." },
    },

    // === SELECT FIELDS (lists with removeOnComplete) ===
    watchlist: {
      id: uid(),
      name: "Movie",
      type: "select",
      mode: "input",
      meta: {
        multiSelect: true,
        quickAdd: true,  // Allows typing a custom movie not in the list
        removeOnComplete: true,
        randomize: true,
        options: [
          { value: "inception", label: "Inception" },
          { value: "interstellar", label: "Interstellar" },
          { value: "the_matrix", label: "The Matrix" },
          { value: "blade_runner", label: "Blade Runner 2049" },
          { value: "dune", label: "Dune" },
          { value: "the_godfather", label: "The Godfather" },
          { value: "parasite", label: "Parasite" },
          { value: "oppenheimer", label: "Oppenheimer" },
        ],
      },
    },
    readingList: {
      id: uid(),
      name: "Book",
      type: "select",
      mode: "input",
      meta: {
        multiSelect: true,
        quickAdd: true,  // Allows typing a custom book not in the list
        removeOnComplete: true,
        randomize: true,
        options: [
          { value: "atomic_habits", label: "Atomic Habits" },
          { value: "deep_work", label: "Deep Work" },
          { value: "thinking_fast_slow", label: "Thinking, Fast and Slow" },
          { value: "4_hour_workweek", label: "The 4-Hour Workweek" },
          { value: "mans_search", label: "Man's Search for Meaning" },
          { value: "meditations", label: "Meditations" },
          { value: "sapiens", label: "Sapiens" },
        ],
      },
    },

    // === JOURNAL Q&A FIELDS ===
    // journalQuestionPool is the select field holding all possible questions.
    // journalQuestion is a derived field that auto-cycles through the pool
    // based on the current iteration date (one question per day).
    journalQuestionPool: {
      id: uid(),
      name: "Question Pool",
      type: "select",
      mode: "input",
      meta: {
        options: [
          { value: "q1", label: "What are you most grateful for today?" },
          { value: "q2", label: "What's one thing you want to accomplish?" },
          { value: "q3", label: "What's been on your mind lately?" },
          { value: "q4", label: "What made you smile today?" },
          { value: "q5", label: "What lesson did you learn recently?" },
          { value: "q6", label: "Who do you want to connect with this week?" },
          { value: "q7", label: "What habit are you trying to build?" },
          { value: "q8", label: "What would make today great?" },
          { value: "q9", label: "What are you avoiding that you should face?" },
          { value: "q10", label: "What's one kind thing you can do for yourself?" },
        ],
      },
    },
    journalQuestion: {
      id: uid(),
      name: "Daily Question",
      type: "text",
      mode: "derived",
      meta: {},
      metric: {
        source: "occurrences",
        aggregation: "first",  // cycles through sibling's options by day-of-year
        scope: "grid",
        timeFilter: "daily",
        allowedFields: [],
      },
      siblingLinks: [], // Will be linked to journalQuestionPool after creation
    },
    journalAnswer: {
      id: uid(),
      name: "Answer",
      type: "text",
      mode: "input",
      meta: { placeholder: "Write your answer..." },
      siblingLinks: [], // Will be linked to journalQuestion after creation
    },

    // === EVENING REFLECTION Q&A FIELDS ===
    wentWellQuestion: {
      id: uid(),
      name: "What went well today?",
      type: "text",
      mode: "derived",
      meta: {},
      metric: { source: "occurrences", aggregation: "first", scope: "grid", timeFilter: "daily", allowedFields: [] },
    },
    wentWellAnswer: {
      id: uid(),
      name: "Went Well",
      type: "text",
      mode: "input",
      meta: { placeholder: "What went well..." },
    },
    improvedQuestion: {
      id: uid(),
      name: "What could be improved?",
      type: "text",
      mode: "derived",
      meta: {},
      metric: { source: "occurrences", aggregation: "first", scope: "grid", timeFilter: "daily", allowedFields: [] },
    },
    improvedAnswer: {
      id: uid(),
      name: "Improvement",
      type: "text",
      mode: "input",
      meta: { placeholder: "What could be improved..." },
    },
    gratitudeQuestion: {
      id: uid(),
      name: "Gratitude:",
      type: "text",
      mode: "derived",
      meta: {},
      metric: { source: "occurrences", aggregation: "first", scope: "grid", timeFilter: "daily", allowedFields: [] },
    },
    gratitudeAnswer: {
      id: uid(),
      name: "Gratitude",
      type: "text",
      mode: "input",
      meta: { placeholder: "What are you grateful for..." },
    },

    // === FINANCIAL: Account select field ===
    accountSelect: {
      id: uid(),
      name: "Account",
      type: "select",
      mode: "input",
      meta: {
        options: [
          { value: "checking", label: "Checking" },
          { value: "savings", label: "Savings" },
          { value: "moms", label: "Mom's Account" },
        ],
      },
    },

    // === DERIVED FIELDS (for Daily Goals) ===
    // Note: allowedFields will be populated after field creation with actual IDs
    // scope: "grid" to aggregate across all panels (including Schedule)
    totalCompleted: {
      id: uid(),
      name: "Completed",
      type: "number",
      mode: "derived",
      meta: { prefix: "", postfix: "" },
      metric: {
        source: "occurrences",
        aggregation: "countTrue",
        scope: "grid",
        timeFilter: "daily",
        // allowedFields populated below after fields are created
      },
    },
    totalDuration: {
      id: uid(),
      name: "Time Spent",
      type: "number",
      mode: "derived",
      meta: { prefix: "", postfix: " min" },
      metric: {
        source: "occurrences",
        aggregation: "sum",
        scope: "grid",
        timeFilter: "daily",
        target: { value: 480, period: "daily" }, // 8 hours target
      },
    },
    totalSpent: {
      id: uid(),
      name: "Spent",
      type: "number",
      mode: "derived",
      meta: { prefix: "$", postfix: "" },
      metric: {
        source: "occurrences",
        aggregation: "sum",
        scope: "grid",
        timeFilter: "daily",
        flowFilter: "out",
      },
    },
    totalIncome: {
      id: uid(),
      name: "Earned",
      type: "number",
      mode: "derived",
      meta: { prefix: "$", postfix: "" },
      metric: {
        source: "occurrences",
        aggregation: "sum",
        scope: "grid",
        timeFilter: "daily",
        flowFilter: "in",
      },
    },
    totalSteps: {
      id: uid(),
      name: "Steps",
      type: "number",
      mode: "derived",
      meta: { postfix: " steps" },
      metric: {
        source: "occurrences",
        aggregation: "sum",
        scope: "grid",
        timeFilter: "daily",
        target: { value: 10000, period: "daily" },
      },
    },
    totalWater: {
      id: uid(),
      name: "Water",
      type: "number",
      mode: "derived",
      meta: { postfix: " oz" },
      metric: {
        source: "occurrences",
        aggregation: "sum",
        scope: "grid",
        timeFilter: "daily",
        target: { value: 64, period: "daily" }, // 64oz target
      },
    },
    lastMood: {
      id: uid(),
      name: "Latest Mood",
      type: "text",  // Text since mood is a select
      mode: "derived",
      meta: {},
      metric: {
        source: "occurrences",
        aggregation: "last",  // Get last mood entry for the day
        scope: "grid",
        timeFilter: "daily",
      },
    },
    totalPages: {
      id: uid(),
      name: "Pages Read",
      type: "number",
      mode: "derived",
      meta: { postfix: " pages" },
      metric: {
        source: "occurrences",
        aggregation: "sum",
        scope: "grid",
        timeFilter: "daily",
        target: { value: 30, period: "daily" },
      },
    },
    taskCount: {
      id: uid(),
      name: "Tasks",
      type: "number",
      mode: "derived",
      meta: { prefix: "", postfix: "" },
      metric: {
        source: "occurrences",
        aggregation: "count",
        scope: "container",
        timeFilter: "daily",
        allowedFields: [],
      },
    },

    // === ACCOUNT AGGREGATIONS (no targets - just totals) ===
    netBalance: {
      id: uid(),
      name: "Net Balance",
      type: "number",
      mode: "derived",
      meta: { prefix: "$", postfix: "" },
      metric: {
        source: "transactions",  // Use transactions for aggregation
        aggregation: "sum",
        scope: "grid",
        timeFilter: "all",  // All-time balance
        // Will aggregate income (flow: in) - expenses (flow: out)
      },
    },
    weeklyIncome: {
      id: uid(),
      name: "This Week",
      type: "number",
      mode: "derived",
      meta: { prefix: "+$", postfix: "" },
      metric: {
        source: "transactions",
        aggregation: "sum",
        scope: "grid",
        timeFilter: "weekly",
        flowFilter: "in",
      },
    },
    weeklyExpenses: {
      id: uid(),
      name: "This Week",
      type: "number",
      mode: "derived",
      meta: { prefix: "-$", postfix: "" },
      metric: {
        source: "transactions",
        aggregation: "sum",
        scope: "grid",
        timeFilter: "weekly",
        flowFilter: "out",
      },
    },
    monthlyIncome: {
      id: uid(),
      name: "This Month",
      type: "number",
      mode: "derived",
      meta: { prefix: "+$", postfix: "" },
      metric: {
        source: "transactions",
        aggregation: "sum",
        scope: "grid",
        timeFilter: "monthly",
        flowFilter: "in",
      },
    },
    monthlyExpenses: {
      id: uid(),
      name: "This Month",
      type: "number",
      mode: "derived",
      meta: { prefix: "-$", postfix: "" },
      metric: {
        source: "transactions",
        aggregation: "sum",
        scope: "grid",
        timeFilter: "monthly",
        flowFilter: "out",
      },
    },
    // Mom's Account — filters by account == "moms" and sums amount
    // NOTE: This ideally uses the Operations/Conditions block system (IF account == "moms" THEN sum amount)
    // For now uses allowedFields with a note that this needs condition blocks
    momsAccountBalance: {
      id: uid(),
      name: "Mom's Account",
      type: "number",
      mode: "derived",
      meta: { prefix: "$", postfix: "" },
      metric: {
        source: "transactions",
        aggregation: "sum",
        scope: "grid",
        timeFilter: "all",
        // TODO: Replace with operation block tree: IF field("account") == "moms" THEN sum(field("amount"))
        // Current flat allowedFields can't express conditional filtering by select value
        allowedFields: [],
      },
    },
    totalWorkouts: {
      id: uid(),
      name: "Workouts",
      type: "number",
      mode: "derived",
      meta: { prefix: "", postfix: " total" },
      metric: {
        source: "transactions",
        aggregation: "count",
        scope: "grid",
        timeFilter: "all",
      },
    },
    totalReadingTime: {
      id: uid(),
      name: "Reading Time",
      type: "number",
      mode: "derived",
      meta: { prefix: "", postfix: " hrs" },
      metric: {
        source: "transactions",
        aggregation: "sum",
        scope: "grid",
        timeFilter: "all",
      },
    },
    completionRate: {
      id: uid(),
      name: "Completion Rate",
      type: "number",
      mode: "derived",
      meta: { prefix: "", postfix: "%" },
      metric: {
        source: "transactions",
        aggregation: "avg",  // Average of completion booleans
        scope: "grid",
        timeFilter: "weekly",
      },
    },
  };

  // Save fields (with gridId)
  for (const key in fields) {
    const field = new Field({
      ...fields[key],
      userId,
      gridId,
    });
    await field.save();
  }

  // Register all field IDs on the grid
  const allFieldIds = Object.values(fields).map(f => f.id);
  await Grid.findByIdAndUpdate(grid._id, { $set: { fieldIds: allFieldIds } });

  // Wire Q&A siblingLinks
  // journalQuestion (derived) -> journalQuestionPool (select with options)
  // This tells the calculation engine to cycle through the pool's options
  await Field.findOneAndUpdate(
    { id: fields.journalQuestion.id },
    { $set: { siblingLinks: [fields.journalQuestionPool.id] } }
  );
  // journalAnswer <-> journalQuestion (for display pairing)
  await Field.findOneAndUpdate(
    { id: fields.journalAnswer.id },
    { $set: { siblingLinks: [fields.journalQuestion.id] } }
  );

  // Update derived fields with allowedFields references
  await Field.findOneAndUpdate(
    { id: fields.totalCompleted.id },
    { $set: { "metric.allowedFields": [{ fieldId: fields.completed.id, flowFilter: "any" }] } }
  );
  await Field.findOneAndUpdate(
    { id: fields.totalDuration.id },
    { $set: { "metric.allowedFields": [{ fieldId: fields.duration.id, flowFilter: "any" }] } }
  );
  await Field.findOneAndUpdate(
    { id: fields.totalSpent.id },
    { $set: { "metric.allowedFields": [{ fieldId: fields.amount.id, flowFilter: "out" }] } }
  );
  await Field.findOneAndUpdate(
    { id: fields.totalIncome.id },
    { $set: { "metric.allowedFields": [{ fieldId: fields.income.id, flowFilter: "in" }] } }
  );
  await Field.findOneAndUpdate(
    { id: fields.totalSteps.id },
    { $set: { "metric.allowedFields": [{ fieldId: fields.steps.id, flowFilter: "any" }] } }
  );
  await Field.findOneAndUpdate(
    { id: fields.totalWater.id },
    { $set: { "metric.allowedFields": [{ fieldId: fields.water.id, flowFilter: "any" }] } }
  );
  await Field.findOneAndUpdate(
    { id: fields.lastMood.id },
    { $set: { "metric.allowedFields": [{ fieldId: fields.mood.id, flowFilter: "any" }] } }
  );
  await Field.findOneAndUpdate(
    { id: fields.totalPages.id },
    { $set: { "metric.allowedFields": [{ fieldId: fields.pages.id, flowFilter: "any" }] } }
  );
  await Field.findOneAndUpdate(
    { id: fields.taskCount.id },
    { $set: { "metric.allowedFields": [{ fieldId: fields.completed.id, flowFilter: "any" }] } }
  );
  // Account aggregation fields
  await Field.findOneAndUpdate(
    { id: fields.netBalance.id },
    { $set: { "metric.allowedFields": [
      { fieldId: fields.income.id, flowFilter: "in" },
      { fieldId: fields.amount.id, flowFilter: "out" }
    ] } }
  );
  await Field.findOneAndUpdate(
    { id: fields.weeklyIncome.id },
    { $set: { "metric.allowedFields": [{ fieldId: fields.income.id, flowFilter: "in" }] } }
  );
  await Field.findOneAndUpdate(
    { id: fields.weeklyExpenses.id },
    { $set: { "metric.allowedFields": [{ fieldId: fields.amount.id, flowFilter: "out" }] } }
  );
  await Field.findOneAndUpdate(
    { id: fields.monthlyIncome.id },
    { $set: { "metric.allowedFields": [{ fieldId: fields.income.id, flowFilter: "in" }] } }
  );
  await Field.findOneAndUpdate(
    { id: fields.monthlyExpenses.id },
    { $set: { "metric.allowedFields": [{ fieldId: fields.amount.id, flowFilter: "out" }] } }
  );
  await Field.findOneAndUpdate(
    { id: fields.momsAccountBalance.id },
    { $set: { "metric.allowedFields": [
      { fieldId: fields.amount.id, flowFilter: "any" },
      { fieldId: fields.accountSelect.id, flowFilter: "any" },
    ] } }
  );
  await Field.findOneAndUpdate(
    { id: fields.totalWorkouts.id },
    { $set: { "metric.allowedFields": [{ fieldId: fields.completed.id, flowFilter: "any" }] } }
  );
  await Field.findOneAndUpdate(
    { id: fields.totalReadingTime.id },
    { $set: { "metric.allowedFields": [{ fieldId: fields.duration.id, flowFilter: "any" }] } }
  );
  await Field.findOneAndUpdate(
    { id: fields.completionRate.id },
    { $set: { "metric.allowedFields": [{ fieldId: fields.completed.id, flowFilter: "any" }] } }
  );

  // ===================================================================
  // STEP 2: Create Instances for Daily Toolkit (8 Dimensions)
  // ===================================================================
  const toolkitInstances = {
    // === PHYSICAL ===
    morningWorkout: {
      id: uid(), label: "Morning Workout", kind: "list",
      styleMode: "own",
      ownStyle: { bg: "rgba(249,115,22,0.12)", textColor: "#fb923c" },
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.workoutType.id, role: "input", order: 1 },
        { fieldId: fields.duration.id, role: "input", order: 2 },
        { fieldId: fields.calories.id, role: "input", order: 3 },
      ],
    },
    eveningRun: {
      id: uid(), label: "Evening Run", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
        { fieldId: fields.steps.id, role: "input", order: 2 },
      ],
    },
    stretching: {
      id: uid(), label: "Stretching", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
      ],
    },
    drinkWater: {
      id: uid(), label: "Drink Water", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.water.id, role: "input", order: 1 },
      ],
    },
    takeMeds: {
      id: uid(), label: "Take Vitamins", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
      ],
    },
    sleepLog: {
      id: uid(), label: "Sleep Log", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
        { fieldId: fields.energy.id, role: "input", order: 2 },
      ],
    },

    // === INTELLECTUAL ===
    reading: {
      id: uid(), label: "Reading", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.readingList.id, role: "input", order: 1 },  // Pick from list OR type custom
        { fieldId: fields.duration.id, role: "input", order: 2 },
        { fieldId: fields.pages.id, role: "input", order: 3 },
      ],
    },
    podcast: {
      id: uid(), label: "Listen to Podcast", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.podcastTitle.id, role: "input", order: 1 },
        { fieldId: fields.duration.id, role: "input", order: 2 },
      ],
    },
    watchMovie: {
      id: uid(), label: "Watch Movie", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.watchlist.id, role: "input", order: 1 },  // Pick from list OR type custom
        { fieldId: fields.duration.id, role: "input", order: 2 },
      ],
    },
    onlineCourse: {
      id: uid(), label: "Online Course", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
      ],
    },
    brainGames: {
      id: uid(), label: "Brain Games", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
      ],
    },
    journaling: {
      id: uid(), label: "Journaling", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
        { fieldId: fields.notes.id, role: "input", order: 2 },
      ],
    },

    // === EMOTIONAL ===
    gratitude: {
      id: uid(), label: "Gratitude Practice", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.mood.id, role: "input", order: 1 },
        { fieldId: fields.notes.id, role: "input", order: 2 },
      ],
    },
    meditation: {
      id: uid(), label: "Meditation", kind: "list",
      styleMode: "own",
      ownStyle: { bg: "rgba(168,85,247,0.12)", textColor: "#c084fc" },
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
        { fieldId: fields.mood.id, role: "input", order: 2 },
      ],
    },
    breathing: {
      id: uid(), label: "Breathing Exercise", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
      ],
    },
    moodCheck: {
      id: uid(), label: "Mood Check-in", kind: "list",
      fieldBindings: [
        { fieldId: fields.mood.id, role: "input", order: 0 },
        { fieldId: fields.energy.id, role: "input", order: 1 },
        { fieldId: fields.notes.id, role: "input", order: 2 },
      ],
    },
    selfCare: {
      id: uid(), label: "Self-Care Activity", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
        { fieldId: fields.notes.id, role: "input", order: 2 },
      ],
    },

    // === SOCIAL ===
    callFriend: {
      id: uid(), label: "Call a Friend", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
        { fieldId: fields.notes.id, role: "input", order: 2 },
      ],
    },
    familyTime: {
      id: uid(), label: "Family Time", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
      ],
    },
    socialEvent: {
      id: uid(), label: "Social Event", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
        { fieldId: fields.notes.id, role: "input", order: 2 },
      ],
    },
    helpSomeone: {
      id: uid(), label: "Help Someone", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.notes.id, role: "input", order: 1 },
      ],
    },

    // === SPIRITUAL ===
    prayer: {
      id: uid(), label: "Prayer/Reflection", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
      ],
    },
    natureWalk: {
      id: uid(), label: "Nature Walk", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
        { fieldId: fields.steps.id, role: "input", order: 2 },
      ],
    },
    spiritualReading: {
      id: uid(), label: "Spiritual Reading", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
        { fieldId: fields.pages.id, role: "input", order: 2 },
      ],
    },
    mindfulness: {
      id: uid(), label: "Mindfulness", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
      ],
    },

    // === OCCUPATIONAL ===
    deepWork: {
      id: uid(), label: "Deep Work Session", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
        { fieldId: fields.priority.id, role: "input", order: 2 },
        { fieldId: fields.notes.id, role: "input", order: 3 },
      ],
    },
    meeting: {
      id: uid(), label: "Meeting", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
        { fieldId: fields.notes.id, role: "input", order: 2 },
      ],
    },
    emailBlock: {
      id: uid(), label: "Email Block", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
      ],
    },
    skillDev: {
      id: uid(), label: "Skill Development", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
        { fieldId: fields.notes.id, role: "input", order: 2 },
      ],
    },
    networking: {
      id: uid(), label: "Networking", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.notes.id, role: "input", order: 1 },
      ],
    },

    // === FINANCIAL ===
    budgetReview: {
      id: uid(), label: "Budget Review", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
      ],
    },
    trackExpense: {
      id: uid(), label: "Track Expense", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.accountSelect.id, role: "input", order: 1 },
        { fieldId: fields.amount.id, role: "input", order: 2 },
        { fieldId: fields.category.id, role: "input", order: 3 },
        { fieldId: fields.notes.id, role: "input", order: 4 },
      ],
    },
    purchase: {
      id: uid(), label: "Purchase", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.accountSelect.id, role: "input", order: 1 },
        { fieldId: fields.amount.id, role: "input", order: 2 },
      ],
    },
    logIncome: {
      id: uid(), label: "Log Income", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.income.id, role: "input", order: 1 },
        { fieldId: fields.notes.id, role: "input", order: 2 },
      ],
    },
    investmentCheck: {
      id: uid(), label: "Check Investments", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.income.id, role: "input", order: 1 },  // Track gains/losses
        { fieldId: fields.notes.id, role: "input", order: 2 },
      ],
    },
    savingsGoal: {
      id: uid(), label: "Savings Goal", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.amount.id, role: "input", order: 1 },
      ],
    },

    // === ENVIRONMENTAL ===
    cleanDesk: {
      id: uid(), label: "Clean Desk", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
      ],
    },
    declutter: {
      id: uid(), label: "Declutter Space", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.duration.id, role: "input", order: 1 },
        { fieldId: fields.notes.id, role: "input", order: 2 },
      ],
    },
    plantCare: {
      id: uid(), label: "Plant Care", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
      ],
    },
    recycling: {
      id: uid(), label: "Recycling", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
      ],
    },
    ecoAction: {
      id: uid(), label: "Eco-Friendly Action", kind: "list",
      fieldBindings: [
        { fieldId: fields.completed.id, role: "input", order: 0 },
        { fieldId: fields.notes.id, role: "input", order: 1 },
      ],
    },
  };

  // === TODO LIST INSTANCES (organized by project/category) ===
  const todoInstances = {
    // --- Home & Errands ---
    buyGroceries: {
      id: uid(), label: "Buy groceries", kind: "list",
      fieldBindings: [
        { fieldId: fields.dueDate.id, role: "input", order: 1 },
      ],
    },
    cleanGarage: {
      id: uid(), label: "Clean out garage", kind: "list",
      fieldBindings: [
        { fieldId: fields.duration.id, role: "input", order: 1 },
      ],
    },
    fixLeakyFaucet: {
      id: uid(), label: "Fix leaky faucet", kind: "list",
      fieldBindings: [
        { fieldId: fields.priority.id, role: "input", order: 1 },
      ],
    },
    returnBooks: {
      id: uid(), label: "Return library books", kind: "list",
      fieldBindings: [
        { fieldId: fields.dueDate.id, role: "input", order: 1 },
      ],
    },
    organizePantry: {
      id: uid(), label: "Organize pantry", kind: "list",
      fieldBindings: [
        { fieldId: fields.duration.id, role: "input", order: 1 },
      ],
    },
    // --- Finance & Admin ---
    payBills: {
      id: uid(), label: "Pay utility bills", kind: "list",
      fieldBindings: [
        { fieldId: fields.amount.id, role: "input", order: 1 },
        { fieldId: fields.dueDate.id, role: "input", order: 2 },
      ],
    },
    cancelSub: {
      id: uid(), label: "Cancel unused subscription", kind: "list",
      fieldBindings: [
        { fieldId: fields.amount.id, role: "input", order: 1 },
      ],
    },
    renewLicense: {
      id: uid(), label: "Renew driver's license", kind: "list",
      fieldBindings: [
        { fieldId: fields.dueDate.id, role: "input", order: 1 },
      ],
    },
    dentistAppt: {
      id: uid(), label: "Schedule dentist appointment", kind: "list",
      fieldBindings: [
        { fieldId: fields.dueDate.id, role: "input", order: 1 },
      ],
    },
    fileInsurance: {
      id: uid(), label: "File insurance claim", kind: "list",
      fieldBindings: [
        { fieldId: fields.dueDate.id, role: "input", order: 1 },
      ],
    },
    // --- Work Projects ---
    orderSupplies: {
      id: uid(), label: "Order office supplies", kind: "list",
      fieldBindings: [
        { fieldId: fields.amount.id, role: "input", order: 1 },
      ],
    },
    backupComputer: {
      id: uid(), label: "Backup computer files", kind: "list",
      fieldBindings: [
      ],
    },
    updatePortfolio: {
      id: uid(), label: "Update portfolio site", kind: "list",
      fieldBindings: [
        { fieldId: fields.duration.id, role: "input", order: 1 },
      ],
    },
    prepPresentation: {
      id: uid(), label: "Prep client presentation", kind: "list",
      fieldBindings: [
        { fieldId: fields.priority.id, role: "input", order: 1 },
        { fieldId: fields.dueDate.id, role: "input", order: 2 },
      ],
    },
    // --- Personal / Fun ---
    callMom: {
      id: uid(), label: "Call mom", kind: "list",
      fieldBindings: [
      ],
    },
    planVacation: {
      id: uid(), label: "Plan summer vacation", kind: "list",
      fieldBindings: [
        { fieldId: fields.notes.id, role: "input", order: 1 },
      ],
    },
    birthdayGift: {
      id: uid(), label: "Buy birthday gift for Sarah", kind: "list",
      fieldBindings: [
        { fieldId: fields.amount.id, role: "input", order: 1 },
        { fieldId: fields.dueDate.id, role: "input", order: 2 },
      ],
    },
    signUpClass: {
      id: uid(), label: "Sign up for cooking class", kind: "list",
      fieldBindings: [
        { fieldId: fields.amount.id, role: "input", order: 1 },
      ],
    },
  };

  // === DAILY GOALS SUMMARY INSTANCES ===
  const goalInstances = {
    physicalSummary: {
      id: uid(), label: "Physical Wellness", kind: "list",
      fieldBindings: [
        { fieldId: fields.totalCompleted.id, role: "display", order: 0 },
        { fieldId: fields.totalSteps.id, role: "display", order: 1 },
        { fieldId: fields.totalWater.id, role: "display", order: 2 },
      ],
    },
    intellectualSummary: {
      id: uid(), label: "Intellectual Growth", kind: "list",
      fieldBindings: [
        { fieldId: fields.totalCompleted.id, role: "display", order: 0 },
        { fieldId: fields.totalPages.id, role: "display", order: 1 },
        { fieldId: fields.totalDuration.id, role: "display", order: 2 },
      ],
    },
    emotionalSummary: {
      id: uid(), label: "Emotional Balance", kind: "list",
      fieldBindings: [
        { fieldId: fields.totalCompleted.id, role: "display", order: 0 },
        { fieldId: fields.lastMood.id, role: "display", order: 1 },
      ],
    },
    socialSummary: {
      id: uid(), label: "Social Connection", kind: "list",
      fieldBindings: [
        { fieldId: fields.totalCompleted.id, role: "display", order: 0 },
        { fieldId: fields.totalDuration.id, role: "display", order: 1 },
      ],
    },
    spiritualSummary: {
      id: uid(), label: "Spiritual Practice", kind: "list",
      fieldBindings: [
        { fieldId: fields.totalCompleted.id, role: "display", order: 0 },
        { fieldId: fields.totalDuration.id, role: "display", order: 1 },
      ],
    },
    occupationalSummary: {
      id: uid(), label: "Work Progress", kind: "list",
      fieldBindings: [
        { fieldId: fields.totalCompleted.id, role: "display", order: 0 },
        { fieldId: fields.totalDuration.id, role: "display", order: 1 },
      ],
    },
    financialSummary: {
      id: uid(), label: "Financial Health", kind: "list",
      fieldBindings: [
        { fieldId: fields.totalSpent.id, role: "display", order: 0 },
        { fieldId: fields.totalIncome.id, role: "display", order: 1 },
      ],
    },
    environmentalSummary: {
      id: uid(), label: "Environment Care", kind: "list",
      fieldBindings: [
        { fieldId: fields.totalCompleted.id, role: "display", order: 0 },
      ],
    },
  };

  // === ACCOUNT AGGREGATION INSTANCES (no targets - lifetime stats) ===
  const accountInstances = {
    bankAccount: {
      id: uid(), label: "Bank Account", kind: "list",
      fieldBindings: [
        { fieldId: fields.netBalance.id, role: "display", order: 0 },
        { fieldId: fields.weeklyIncome.id, role: "display", order: 1 },
        { fieldId: fields.weeklyExpenses.id, role: "display", order: 2 },
      ],
    },
    momsAccount: {
      id: uid(), label: "Mom's Account", kind: "list",
      fieldBindings: [
        { fieldId: fields.momsAccountBalance.id, role: "display", order: 0 },
      ],
    },
    monthlyFinances: {
      id: uid(), label: "Monthly Overview", kind: "list",
      fieldBindings: [
        { fieldId: fields.monthlyIncome.id, role: "display", order: 0 },
        { fieldId: fields.monthlyExpenses.id, role: "display", order: 1 },
      ],
    },
    fitnessAccount: {
      id: uid(), label: "Fitness Stats", kind: "list",
      fieldBindings: [
        { fieldId: fields.totalWorkouts.id, role: "display", order: 0 },
        { fieldId: fields.totalSteps.id, role: "display", order: 1 },
      ],
    },
    readingAccount: {
      id: uid(), label: "Reading Stats", kind: "list",
      fieldBindings: [
        { fieldId: fields.totalReadingTime.id, role: "display", order: 0 },
        { fieldId: fields.totalPages.id, role: "display", order: 1 },
      ],
    },
    productivityAccount: {
      id: uid(), label: "Productivity", kind: "list",
      fieldBindings: [
        { fieldId: fields.completionRate.id, role: "display", order: 0 },
        { fieldId: fields.totalDuration.id, role: "display", order: 1 },
      ],
    },
    wellnessAccount: {
      id: uid(), label: "Wellness Score", kind: "list",
      fieldBindings: [
        { fieldId: fields.lastMood.id, role: "display", order: 0 },
        { fieldId: fields.totalWater.id, role: "display", order: 1 },
      ],
    },
  };

  // Save all instances (with gridId)
  const allInstances = { ...toolkitInstances, ...todoInstances, ...goalInstances, ...accountInstances };
  for (const key in allInstances) {
    // Toolkit instances should default to copy mode (they're templates)
    const isToolkitInstance = Object.keys(toolkitInstances).includes(key);
    const instance = new Instance({
      ...allInstances[key],
      userId,
      gridId,
      iteration: { mode: "inherit", timeFilter: "daily" },
      defaultDragMode: isToolkitInstance ? "copy" : "move",
    });
    await instance.save();
  }

  // ===================================================================
  // STEP 3: Create Containers
  // ===================================================================

  // Daily Toolkit Containers (8 dimensions)
  const toolkitContainers = {
    physical: { id: uid(), label: "Physical", kind: "list", occurrences: [] },
    intellectual: { id: uid(), label: "Intellectual", kind: "list", occurrences: [] },
    emotional: { id: uid(), label: "Emotional", kind: "list", occurrences: [] },
    social: { id: uid(), label: "Social", kind: "list", occurrences: [] },
    spiritual: { id: uid(), label: "Spiritual", kind: "list", occurrences: [] },
    occupational: { id: uid(), label: "Occupational", kind: "list", occurrences: [] },
    financial: { id: uid(), label: "Financial", kind: "list", occurrences: [] },
    environmental: { id: uid(), label: "Environmental", kind: "list", occurrences: [] },
  };

  // Todo List Containers (categorized by project)
  const todoContainers = {
    todoHome: { id: uid(), label: "Home & Errands", kind: "list", occurrences: [] },
    todoFinance: { id: uid(), label: "Finance & Admin", kind: "list", occurrences: [] },
    todoWork: { id: uid(), label: "Work Projects", kind: "list", occurrences: [] },
    todoPersonal: { id: uid(), label: "Personal / Fun", kind: "list", occurrences: [] },
  };

  // Schedule Containers (48 time slots)
  const timeSlots = generateTimeSlots();
  const scheduleContainers = {};
  for (const slot of timeSlots) {
    const key = `slot_${slot.hour}_${slot.minute}`;
    scheduleContainers[key] = {
      id: uid(),
      label: slot.label,
      kind: "list",
      occurrences: [],
    };
  }

  // Daily Goals Containers (8 dimensions)
  const goalContainers = {
    physicalGoal: { id: uid(), label: "Physical", kind: "list", occurrences: [] },
    intellectualGoal: { id: uid(), label: "Intellectual", kind: "list", occurrences: [] },
    emotionalGoal: { id: uid(), label: "Emotional", kind: "list", occurrences: [] },
    socialGoal: { id: uid(), label: "Social", kind: "list", occurrences: [] },
    spiritualGoal: { id: uid(), label: "Spiritual", kind: "list", occurrences: [] },
    occupationalGoal: { id: uid(), label: "Occupational", kind: "list", occurrences: [] },
    financialGoal: { id: uid(), label: "Financial", kind: "list", occurrences: [] },
    environmentalGoal: { id: uid(), label: "Environmental", kind: "list", occurrences: [] },
  };

  // Account Containers (for Accounts panel - lifetime aggregations)
  const accountContainers = {
    financeAccount: { id: uid(), label: "Finances", kind: "list", occurrences: [] },
    fitnessAccount: { id: uid(), label: "Fitness", kind: "list", occurrences: [] },
    learningAccount: { id: uid(), label: "Learning", kind: "list", occurrences: [] },
    productivityAccount: { id: uid(), label: "Productivity", kind: "list", occurrences: [] },
    wellnessAccount: { id: uid(), label: "Wellness", kind: "list", occurrences: [] },
  };

  // Day Page Doc Container (for notebook panel - daily journal)
  const dayPageContainers = {
    dayJournal: {
      id: uid(),
      label: "Daily Journal",
      kind: "doc",  // Doc container for rich text
      occurrences: [],
    },
  };

  // Save all containers (with gridId)
  const allContainers = { ...toolkitContainers, ...todoContainers, ...scheduleContainers, ...goalContainers, ...accountContainers, ...dayPageContainers };
  for (const key in allContainers) {
    const container = new Container({
      ...allContainers[key],
      userId,
      gridId,
      iteration: { mode: "inherit", timeFilter: "daily" },
    });
    await container.save();
  }

  // ===================================================================
  // STEP 4: Create Panels
  // ===================================================================
  const panels = {
    dailyToolkit: {
      id: uid(),
      name: "Daily Toolkit",
      kind: "board",
      defaultDragMode: "copy", // Toolkit items are templates - copy by default
      iteration: { mode: "inherit", timeFilter: "daily" },
      layout: {
        name: "Daily Toolkit",
        display: "flex",
        flow: "column",
        wrap: "nowrap",
        gapPx: 4,
        scrollY: "auto",
        padding: "sm",
      },
      occurrences: [],
    },
    todoList: {
      id: uid(),
      name: "Todo List",
      kind: "board",
      defaultDragMode: "move", // Todo items are one-off - move by default
      iteration: { mode: "own", timeFilter: "all" }, // Tasks are total — no time filter
      layout: {
        name: "Todo List",
        display: "flex",
        flow: "column",
        wrap: "nowrap",
        gapPx: 8,
        scrollY: "auto",
        padding: "sm",
      },
      occurrences: [],
    },
    schedule: {
      id: uid(),
      name: "Schedule",
      kind: "board",
      defaultDragMode: "move",
      iteration: { mode: "inherit", timeFilter: "daily" },
      layout: {
        name: "Schedule",
        display: "flex",
        flow: "column",
        wrap: "nowrap",
        gapPx: 2,
        scrollY: "auto",
        padding: "none",
        alignItems: "stretch",  // Full width containers
        containerWidth: "full",  // Containers take full width
      },
      // Cascading style: containers in this panel get a subtle blue tint
      childContainerStyle: { bg: "rgba(59,130,246,0.08)", borderRadius: "6px" },
      childInstanceStyle: null,
      occurrences: [],
    },
    dailyGoals: {
      id: uid(),
      name: "Daily Goals",
      kind: "board",
      defaultDragMode: "move",
      iteration: { mode: "inherit", timeFilter: "daily" },
      layout: {
        name: "Daily Goals",
        display: "flex",
        flow: "column",
        wrap: "nowrap",
        gapPx: 8,
        scrollY: "auto",
        padding: "sm",
      },
      // Cascading style: containers get a green tint
      childContainerStyle: { bg: "rgba(34,197,94,0.08)", borderRadius: "8px" },
      childInstanceStyle: null,
      occurrences: [],
    },
    accounts: {
      id: uid(),
      name: "Accounts",
      kind: "board",
      defaultDragMode: "move",
      iteration: { mode: "own", timeFilter: "all" },  // Lifetime totals, no time filter
      layout: {
        name: "Accounts",
        display: "flex",
        flow: "column",
        wrap: "nowrap",
        gapPx: 8,
        scrollY: "auto",
        padding: "sm",
      },
      occurrences: [],
    },
    dayPage: {
      id: uid(),
      name: "Day Page",
      kind: "artifact-viewer",  // Artifact viewer panel with tree sidebar + doc editor
      defaultDragMode: "move",
      iteration: { mode: "inherit", timeFilter: "daily" },  // Daily iteration
      layout: {
        name: "Day Page",
        display: "flex",
        flow: "column",
        wrap: "nowrap",
        gapPx: 0,
        scrollY: "auto",
        padding: "none",
      },
      occurrences: [],
    },
  };

  for (const key in panels) {
    const panel = new Panel({
      ...panels[key],
      userId,
      gridId,
    });
    await panel.save();
  }

  // ===================================================================
  // STEP 5: Create Occurrences and wire everything together
  // ===================================================================

  async function createOccurrence({ targetType, targetId, meta = {}, placement = null, iterationMode = "specific", linkedGroupId = null }) {
    const occId = uid();
    const occ = new Occurrence({
      id: occId,
      userId,
      targetType,
      targetId,
      gridId,
      iteration: {
        key: "time",
        value: new Date(),
        timeValue: new Date(),
        timeFilter: "daily",
        mode: iterationMode, // "persistent" | "specific" | "untilDone"
      },
      timestamp: new Date(),
      fields: {},
      meta,
      ...(placement && { placement }),
      ...(linkedGroupId && { linkedGroupId }),
    });
    await occ.save();
    return occId;
  }

  // Wire instances to Toolkit containers
  const toolkitMappings = {
    physical: ["morningWorkout", "eveningRun", "stretching", "drinkWater", "takeMeds", "sleepLog"],
    intellectual: ["reading", "podcast", "watchMovie", "onlineCourse", "brainGames", "journaling"],
    emotional: ["gratitude", "meditation", "breathing", "moodCheck", "selfCare"],
    social: ["callFriend", "familyTime", "socialEvent", "helpSomeone"],
    spiritual: ["prayer", "natureWalk", "spiritualReading", "mindfulness"],
    occupational: ["deepWork", "meeting", "emailBlock", "skillDev", "networking"],
    financial: ["budgetReview", "trackExpense", "purchase", "logIncome", "investmentCheck", "savingsGoal"],
    environmental: ["cleanDesk", "declutter", "plantCare", "recycling", "ecoAction"],
  };

  for (const [containerKey, instanceKeys] of Object.entries(toolkitMappings)) {
    const occIds = [];
    for (const instKey of instanceKeys) {
      const occId = await createOccurrence({
        targetType: "instance",
        targetId: toolkitInstances[instKey].id,
        meta: { containerId: toolkitContainers[containerKey].id },
        iterationMode: "persistent", // Templates always visible for copying
      });
      occIds.push(occId);
    }
    await Container.findOneAndUpdate(
      { id: toolkitContainers[containerKey].id },
      { $set: { occurrences: occIds } }
    );
  }

  // Wire instances to categorized Todo containers
  const todoMappings = {
    todoHome: ["buyGroceries", "cleanGarage", "fixLeakyFaucet", "returnBooks", "organizePantry"],
    todoFinance: ["payBills", "cancelSub", "renewLicense", "dentistAppt", "fileInsurance"],
    todoWork: ["orderSupplies", "backupComputer", "updatePortfolio", "prepPresentation"],
    todoPersonal: ["callMom", "planVacation", "birthdayGift", "signUpClass"],
  };

  for (const [containerKey, instanceKeys] of Object.entries(todoMappings)) {
    const occIds = [];
    for (const instKey of instanceKeys) {
      const occId = await createOccurrence({
        targetType: "instance",
        targetId: todoInstances[instKey].id,
        meta: { containerId: todoContainers[containerKey].id },
        iterationMode: "untilDone", // Shows until completed, then stays on completion date
      });
      occIds.push(occId);
    }
    await Container.findOneAndUpdate(
      { id: todoContainers[containerKey].id },
      { $set: { occurrences: occIds } }
    );
  }

  // Wire summary instances to Goal containers
  const goalMappings = {
    physicalGoal: ["physicalSummary"],
    intellectualGoal: ["intellectualSummary"],
    emotionalGoal: ["emotionalSummary"],
    socialGoal: ["socialSummary"],
    spiritualGoal: ["spiritualSummary"],
    occupationalGoal: ["occupationalSummary"],
    financialGoal: ["financialSummary"],
    environmentalGoal: ["environmentalSummary"],
  };

  for (const [containerKey, instanceKeys] of Object.entries(goalMappings)) {
    const occIds = [];
    for (const instKey of instanceKeys) {
      const occId = await createOccurrence({
        targetType: "instance",
        targetId: goalInstances[instKey].id,
        meta: { containerId: goalContainers[containerKey].id },
        iterationMode: "persistent", // Goal summaries always visible
      });
      occIds.push(occId);
    }
    await Container.findOneAndUpdate(
      { id: goalContainers[containerKey].id },
      { $set: { occurrences: occIds } }
    );
  }

  // Wire account instances to Account containers
  const accountMappings = {
    financeAccount: ["bankAccount", "momsAccount", "monthlyFinances"],
    fitnessAccount: ["fitnessAccount"],  // Uses fitnessAccount instance
    learningAccount: ["readingAccount"],
    productivityAccount: ["productivityAccount"],
    wellnessAccount: ["wellnessAccount"],
  };

  for (const [containerKey, instanceKeys] of Object.entries(accountMappings)) {
    const occIds = [];
    for (const instKey of instanceKeys) {
      const occId = await createOccurrence({
        targetType: "instance",
        targetId: accountInstances[instKey].id,
        meta: { containerId: accountContainers[containerKey].id },
        iterationMode: "persistent", // Account stats always visible
      });
      occIds.push(occId);
    }
    await Container.findOneAndUpdate(
      { id: accountContainers[containerKey].id },
      { $set: { occurrences: occIds } }
    );
  }

  // Wire toolkit containers to Daily Toolkit panel
  const toolkitPanelOccIds = [];
  for (const containerKey of Object.keys(toolkitContainers)) {
    const occId = await createOccurrence({
      targetType: "container",
      targetId: toolkitContainers[containerKey].id,
      meta: { panelId: panels.dailyToolkit.id },
      iterationMode: "persistent", // Toolkit containers always visible
    });
    toolkitPanelOccIds.push(occId);
  }
  await Panel.findOneAndUpdate(
    { id: panels.dailyToolkit.id },
    { $set: { occurrences: toolkitPanelOccIds } }
  );

  // Wire todo containers to Todo panel
  const todoPanelOccIds = [];
  for (const containerKey of Object.keys(todoContainers)) {
    const occId = await createOccurrence({
      targetType: "container",
      targetId: todoContainers[containerKey].id,
      meta: { panelId: panels.todoList.id },
      iterationMode: "persistent", // Todo containers always visible
    });
    todoPanelOccIds.push(occId);
  }
  await Panel.findOneAndUpdate(
    { id: panels.todoList.id },
    { $set: { occurrences: todoPanelOccIds } }
  );

  // Wire time slot containers to Schedule panel
  const scheduleOccIds = [];
  for (const slot of timeSlots) {
    const key = `slot_${slot.hour}_${slot.minute}`;
    const occId = await createOccurrence({
      targetType: "container",
      targetId: scheduleContainers[key].id,
      meta: { panelId: panels.schedule.id },
      iterationMode: "persistent", // Time slots always visible (items inside will be day-specific)
    });
    scheduleOccIds.push(occId);
  }
  await Panel.findOneAndUpdate(
    { id: panels.schedule.id },
    { $set: { occurrences: scheduleOccIds } }
  );

  // Wire sample habits into schedule time slots with linkedGroupIds
  // These create copylinks between schedule occurrences and day page pills
  const scheduleHabitMappings = [
    { instKey: "morningWorkout", slotKey: "slot_7_0",  label: "Morning Workout" },
    { instKey: "stretching",    slotKey: "slot_7_30",  label: "Stretching" },
    { instKey: "reading",       slotKey: "slot_9_0",   label: "Reading" },
    { instKey: "meditation",    slotKey: "slot_12_0",  label: "Meditation" },
    { instKey: "deepWork",      slotKey: "slot_14_0",  label: "Deep Work" },
    { instKey: "drinkWater",    slotKey: "slot_17_0",  label: "Drink Water" },
    { instKey: "eveningRun",    slotKey: "slot_18_30", label: "Evening Run" },
  ];

  const scheduleLinkedGroups = {}; // instKey -> linkedGroupId
  for (const { instKey, slotKey } of scheduleHabitMappings) {
    const linkedGroupId = uid();
    scheduleLinkedGroups[instKey] = linkedGroupId;
    const occId = await createOccurrence({
      targetType: "instance",
      targetId: toolkitInstances[instKey].id,
      meta: { containerId: scheduleContainers[slotKey].id },
      iterationMode: "specific",
      linkedGroupId,
    });
    // Add to the time slot container's occurrences
    await Container.findOneAndUpdate(
      { id: scheduleContainers[slotKey].id },
      { $push: { occurrences: occId } }
    );
  }

  // Wire goal containers to Daily Goals panel
  const goalPanelOccIds = [];
  for (const containerKey of Object.keys(goalContainers)) {
    const occId = await createOccurrence({
      targetType: "container",
      targetId: goalContainers[containerKey].id,
      meta: { panelId: panels.dailyGoals.id },
      iterationMode: "persistent", // Goal containers always visible
    });
    goalPanelOccIds.push(occId);
  }
  await Panel.findOneAndUpdate(
    { id: panels.dailyGoals.id },
    { $set: { occurrences: goalPanelOccIds } }
  );

  // Wire account containers to Accounts panel
  const accountPanelOccIds = [];
  for (const containerKey of Object.keys(accountContainers)) {
    const occId = await createOccurrence({
      targetType: "container",
      targetId: accountContainers[containerKey].id,
      meta: { panelId: panels.accounts.id },
      iterationMode: "persistent", // Account containers always visible
    });
    accountPanelOccIds.push(occId);
  }
  await Panel.findOneAndUpdate(
    { id: panels.accounts.id },
    { $set: { occurrences: accountPanelOccIds } }
  );

  // Wire day journal container to Day Page panel (with sample docContent)
  const today = new Date().toISOString().split("T")[0];
  const sampleJournalContent = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: `${today}` }],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Morning Intentions" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Today I want to focus on: " },
          { type: "text", marks: [{ type: "italic" }], text: "(set your intentions here)" },
        ],
      },
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Complete morning workout" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Review daily goals" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Deep work session before lunch" }] }] },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Daily Reflection" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", marks: [{ type: "bold" }], text: "Today's Question: " },
          {
            type: "fieldPill",
            attrs: {
              fieldId: fields.journalQuestion.id,
              fieldName: "Daily Question",
              fieldType: "text",
              fieldMode: "derived",
              showValue: true,
              showLabel: false,
            },
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", marks: [{ type: "bold" }], text: "Your Answer: " },
          {
            type: "fieldPill",
            attrs: {
              fieldId: fields.journalAnswer.id,
              fieldName: "Answer",
              fieldType: "text",
              fieldMode: "input",
              showValue: true,
              showLabel: false,
            },
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Tasks Completed" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Drag items from your toolkit here when you complete them, or use @ to insert field values." }],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "Physical" }],
      },
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{
            type: "instancePill",
            attrs: { instanceId: toolkitInstances.morningWorkout.id, instanceLabel: "Morning Workout", showIcon: true },
          }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{
            type: "instancePill",
            attrs: { instanceId: toolkitInstances.stretching.id, instanceLabel: "Stretching", showIcon: true },
          }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{
            type: "instancePill",
            attrs: { instanceId: toolkitInstances.drinkWater.id, instanceLabel: "Drink Water", showIcon: true },
          }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{
            type: "instancePill",
            attrs: { instanceId: toolkitInstances.eveningRun.id, instanceLabel: "Evening Run", showIcon: true },
          }] }] },
        ],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "Intellectual" }],
      },
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{
            type: "instancePill",
            attrs: { instanceId: toolkitInstances.reading.id, instanceLabel: "Reading", showIcon: true },
          }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{
            type: "instancePill",
            attrs: { instanceId: toolkitInstances.deepWork.id, instanceLabel: "Deep Work", showIcon: true },
          }] }] },
        ],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "Mindfulness" }],
      },
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{
            type: "instancePill",
            attrs: { instanceId: toolkitInstances.meditation.id, instanceLabel: "Meditation", showIcon: true },
          }] }] },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Evening Reflection" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "fieldPill",
            attrs: {
              fieldId: fields.wentWellQuestion.id,
              fieldName: "What went well today?",
              fieldType: "text",
              fieldMode: "derived",
              showValue: false,
              showLabel: true,
            },
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "fieldPill",
            attrs: {
              fieldId: fields.wentWellAnswer.id,
              fieldName: "Went Well",
              fieldType: "text",
              fieldMode: "input",
              showValue: true,
              showLabel: false,
            },
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "fieldPill",
            attrs: {
              fieldId: fields.improvedQuestion.id,
              fieldName: "What could be improved?",
              fieldType: "text",
              fieldMode: "derived",
              showValue: false,
              showLabel: true,
            },
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "fieldPill",
            attrs: {
              fieldId: fields.improvedAnswer.id,
              fieldName: "Improvement",
              fieldType: "text",
              fieldMode: "input",
              showValue: true,
              showLabel: false,
            },
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "fieldPill",
            attrs: {
              fieldId: fields.gratitudeQuestion.id,
              fieldName: "Gratitude:",
              fieldType: "text",
              fieldMode: "derived",
              showValue: false,
              showLabel: true,
            },
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "fieldPill",
            attrs: {
              fieldId: fields.gratitudeAnswer.id,
              fieldName: "Gratitude",
              fieldType: "text",
              fieldMode: "input",
              showValue: true,
              showLabel: false,
            },
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Daily Stats" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Use " },
          { type: "text", marks: [{ type: "code" }], text: "@" },
          { type: "text", text: " to insert live field values like Total Steps, Water, or Time Spent." },
        ],
      },
    ],
  };

  // Create doc container occurrence with docContent stored on the occurrence
  const dayJournalOccId = uid();
  const dayJournalOcc = new Occurrence({
    id: dayJournalOccId,
    userId,
    targetType: "container",
    targetId: dayPageContainers.dayJournal.id,
    gridId,
    iteration: {
      key: "time",
      value: new Date(),
      mode: "specific",  // Day pages are day-specific
    },
    timestamp: new Date(),
    fields: {},
    docContent: sampleJournalContent,  // Doc content stored on occurrence!
    meta: { panelId: panels.dayPage.id },
  });
  await dayJournalOcc.save();

  await Panel.findOneAndUpdate(
    { id: panels.dayPage.id },
    { $set: { occurrences: [dayJournalOccId] } }
  );

  // ===================================================================
  // STEP 6: Create Manifest, Folders, Docs, and View for Day Page panel
  // ===================================================================

  // Root folder for this grid's file tree
  const rootFolderId = uid();
  const rootFolder = new Folder({
    id: rootFolderId,
    userId,
    gridId,
    parentId: null,
    name: "Root",
    folderType: "normal",
    sortOrder: 0,
    isExpanded: true,
  });
  await rootFolder.save();

  // Day Pages folder
  const dayPagesFolderId = uid();
  const dayPagesFolder = new Folder({
    id: dayPagesFolderId,
    userId,
    gridId,
    parentId: rootFolderId,
    name: "Day Pages",
    folderType: "day-pages",
    sortOrder: 0,
    isExpanded: true,
  });
  await dayPagesFolder.save();

  // Documents folder
  const docsFolderId = uid();
  const docsFolder = new Folder({
    id: docsFolderId,
    userId,
    gridId,
    parentId: rootFolderId,
    name: "Documents",
    folderType: "normal",
    sortOrder: 1,
    isExpanded: true,
  });
  await docsFolder.save();

  // Create a sample doc in the Documents folder (reuse journal content)
  const sampleDocId = uid();
  const sampleDoc = new Doc({
    id: sampleDocId,
    userId,
    gridId,
    folderId: docsFolderId,
    title: "Welcome to Moduli",
    docType: "normal",
    sortOrder: 0,
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Welcome to Moduli" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "This is a sample document. You can edit it, add field pills with @, or drag instances from your panels." }],
        },
      ],
    },
  });
  await sampleDoc.save();

  // Create real occurrence for Welcome doc
  const sampleDocOccId = await createOccurrence({
    targetType: "doc",
    targetId: sampleDocId,
    meta: { folderId: docsFolderId },
    iterationMode: "persistent",
  });
  await Occurrence.findOneAndUpdate(
    { id: sampleDocOccId },
    { $set: { docContent: sampleDoc.content } }
  );

  // Create today's day page doc
  const dayPageDocId = uid();
  const dayPageDoc = new Doc({
    id: dayPageDocId,
    userId,
    gridId,
    folderId: dayPagesFolderId,
    title: `${today}`,
    docType: "day-page",
    dayPageDate: new Date(),
    sortOrder: 0,
    content: sampleJournalContent,
  });
  await dayPageDoc.save();

  // Create real occurrence for day page doc
  const dayPageDocOccId = await createOccurrence({
    targetType: "doc",
    targetId: dayPageDocId,
    meta: { folderId: dayPagesFolderId },
    iterationMode: "persistent",
  });
  await Occurrence.findOneAndUpdate(
    { id: dayPageDocOccId },
    { $set: { docContent: sampleJournalContent } }
  );

  // Manifest — root tree for this grid
  const manifestId = uid();
  const manifest = new Manifest({
    id: manifestId,
    userId,
    gridId,
    name: "Files",
    manifestType: "files",
    rootFolderId,
  });
  await manifest.save();

  // View for the Day Page panel — notebook view with tree sidebar
  const dayPageViewId = uid();
  const dayPageView = new View({
    id: dayPageViewId,
    userId,
    gridId,
    panelId: panels.dayPage.id,
    name: "Day Page View",
    viewType: "notebook",
    manifestId,
    showTree: true,
    sidebarWidth: 192,
    activeDocId: dayPageDocId,
  });
  await dayPageView.save();

  // Update the Day Page panel to reference the view
  await Panel.findOneAndUpdate(
    { id: panels.dayPage.id },
    { $set: { viewId: dayPageViewId } }
  );

  // ===================================================================
  // STEP 6b: Stan Lyrics Doc — each stanza is an instance pill
  // ===================================================================
  const stanStanzas = {
    intro: {
      id: uid(), label: "[Intro: Dido]", kind: "list",
      fieldBindings: [{ fieldId: fields.notes.id, role: "input", order: 0 }],
    },
    chorus: {
      id: uid(), label: "[Chorus: Dido]", kind: "list",
      fieldBindings: [{ fieldId: fields.notes.id, role: "input", order: 0 }],
    },
    verse1: {
      id: uid(), label: "[Verse 1: Eminem]", kind: "list",
      fieldBindings: [{ fieldId: fields.notes.id, role: "input", order: 0 }],
    },
    verse2: {
      id: uid(), label: "[Verse 2: Eminem]", kind: "list",
      fieldBindings: [{ fieldId: fields.notes.id, role: "input", order: 0 }],
    },
    verse3: {
      id: uid(), label: "[Verse 3: Eminem]", kind: "list",
      fieldBindings: [{ fieldId: fields.notes.id, role: "input", order: 0 }],
    },
    verse4: {
      id: uid(), label: "[Verse 4: Eminem]", kind: "list",
      fieldBindings: [{ fieldId: fields.notes.id, role: "input", order: 0 }],
    },
  };

  // Save Stan stanza instances
  for (const key in stanStanzas) {
    const inst = new Instance({
      ...stanStanzas[key],
      userId,
      gridId,
      iteration: { mode: "inherit", timeFilter: "daily" },
      defaultDragMode: "copy",
    });
    await inst.save();
  }

  // Stan lyrics stanza text (used for doc body)
  const stanStanzaText = {
    intro: "My tea's gone cold, I'm wonderin' why I\nGot out of bed at all\nThe morning rain clouds up my window\nAnd I can't see at all\nAnd even if I could, it'd all be grey\nBut your picture on my wall\nIt reminds me that it's not so bad, it's not so bad",
    chorus: "My tea's gone cold, I'm wonderin' why I\nGot out of bed at all\nThe morning rain clouds up my window\nAnd I can't see at all\nAnd even if I could, it'd all be grey\nBut your picture on my wall\nIt reminds me that it's not so bad, it's not so bad",
    verse1: "Dear Slim, I wrote you, but you still ain't callin'\nI left my cell, my pager, and my home phone at the bottom\nI sent two letters back in autumn, you must not've got 'em\nThere probably was a problem at the post office or somethin'\nSometimes I scribble addresses too sloppy when I jot 'em\nBut anyways, fuck it, what's been up, man? How's your daughter?\nMy girlfriend's pregnant too, I'm 'bout to be a father\nIf I have a daughter, guess what I'ma call her? I'ma name her Bonnie\nI read about your Uncle Ronnie too, I'm sorry\nI had a friend kill himself over some bitch who didn't want him\nI know you probably hear this every day, but I'm your biggest fan\nI even got the underground shit that you did with Skam\nI got a room full of your posters and your pictures, man\nI like the shit you did with Rawkus too, that shit was phat\nAnyways, I hope you get this, man, hit me back\nJust to chat, truly yours, your biggest fan, this is Stan",
    verse2: "Dear Slim, you still ain't called or wrote, I hope you have a chance\nI ain't mad, I just think it's fucked up you don't answer fans\nIf you didn't want to talk to me outside your concert, you didn't have to\nBut you coulda signed an autograph for Matthew\nThat's my little brother, man, he's only six years old\nWe waited in the blisterin' cold for you, for four hours, and you just said, \"No\"\nThat's pretty shitty, man, you're like his fuckin' idol\nHe wants to be just like you, man, he likes you more than I do\nI ain't that mad, though I just don't like bein' lied to\nRemember when we met in Denver? You said if I'd write you, you would write back\nSee, I'm just like you in a way: I never knew my father neither\nHe used to always cheat on my mom and beat her\nI can relate to what you're sayin' in your songs\nSo when I have a shitty day, I drift away and put 'em on\n'Cause I don't really got shit else, so that shit helps when I'm depressed\nI even got a tattoo with your name across the chest\nSometimes I even cut myself to see how much it bleeds\nIt's like adrenaline, the pain is such a sudden rush for me\nSee, everything you say is real, and I respect you 'cause you tell it\nMy girlfriend's jealous 'cause I talk about you 24/7\nBut she don't know you like I know you, Slim, no one does\nShe don't know what it was like for people like us growin' up\nYou gotta call me, man, I'll be the biggest fan you'll ever lose\nSincerely yours, Stan, PS: We should be together too",
    verse3: "Dear Mr. I'm Too Good to Call or Write My Fans\nThis'll be the last package I ever send your ass\nIt's been six months, and still no word, I don't deserve it?\nI know you got my last two letters, I wrote the addresses on 'em perfect\nSo this is my cassette I'm sendin' you, I hope you hear it\nI'm in the car right now, I'm doin' ninety on the freeway\nHey, Slim, I drank a fifth of vodka, you dare me to drive?\nYou know the song by Phil Collins, \"In the Air of the Night\"\nAbout that guy who coulda saved that other guy from drownin'\nBut didn't, then Phil saw it all, then at a show he found him?\nThat's kinda how this is: You coulda rescued me from drownin'\nNow it's too late, I'm on a thousand downers now, I'm drowsy\nAnd all I wanted was a lousy letter or a call\nI hope you know I ripped all of your pictures off the wall\nI loved you, Slim, we coulda been together, think about it\nYou ruined it now, I hope you can't sleep and you dream about it\nAnd when you dream, I hope you can't sleep and you scream about it\nI hope your conscience eats at you, and you can't breathe without me\nSee, Slim? Shut up, bitch, I'm tryna talk\nHey, Slim, that's my girlfriend screamin' in the trunk\nBut I didn't slit her throat, I just tied her up, see? I ain't like you\n'Cause if she suffocates she'll suffer more and then she'll die too\nWell, gotta go, I'm almost at the bridge now\nOh, shit, I forgot, how am I supposed to send this shit out?",
    verse4: "Dear Stan, I meant to write you sooner, but I just been busy\nYou said your girlfriend's pregnant now, how far along is she?\nLook, I'm really flattered you would call your daughter that\nAnd here's an autograph for your brother, I wrote it on a Starter cap\nI'm sorry I didn't see you at the show, I must've missed you\nDon't think I did that shit intentionally just to diss you\nBut what's this shit you said about you like to cut your wrists too?\nI say that shit just clownin', dawg, come on, how fucked up is you?\nYou got some issues, Stan, I think you need some counselin'\nTo help your ass from bouncin' off the walls when you get down some\nAnd what's this shit about us meant to be together?\nThat type of shit'll make me not want us to meet each other\nI really think you and your girlfriend need each other\nOr maybe you just need to treat her better\nI hope you get to read this letter, I just hope it reaches you in time\nBefore you hurt yourself, I think that you'll be doin' just fine\nIf you relax a little, I'm glad I inspire you, but, Stan\nWhy are you so mad? Try to understand that I do want you as a fan\nI just don't want you to do some crazy shit\nI seen this one shit on the news a couple weeks ago that made me sick\nSome dude was drunk and drove his car over a bridge\nAnd had his girlfriend in the trunk, and she was pregnant with his kid\nAnd in the car, they found a tape, but they didn't say who it was to\nCome to think about it, his name was, it was you\nDamn",
  };

  // Helper to create a block pill node
  function blockPill(stanzaKey, label) {
    return {
      type: "paragraph",
      content: [{
        type: "instancePill",
        attrs: {
          instanceId: stanStanzas[stanzaKey].id,
          instanceLabel: label,
          showIcon: true,
          pillDisplay: "block",
          bodyContent: stanStanzaText[stanzaKey],
        },
      }],
    };
  }

  // Build Stan doc content with block pills (header + lyrics inside each pill)
  const stanDocContent = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Stan — Eminem" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", marks: [{ type: "italic" }], text: "Produced by Eminem & DJ Mark the 45 King" }],
      },
      blockPill("intro", "[Intro: Dido]"),
      blockPill("chorus", "[Chorus: Dido]"),
      blockPill("verse1", "[Verse 1: Eminem]"),
      blockPill("chorus", "[Chorus: Dido]"),
      blockPill("verse2", "[Verse 2: Eminem]"),
      blockPill("chorus", "[Chorus: Dido]"),
      blockPill("verse3", "[Verse 3: Eminem]"),
      blockPill("chorus", "[Chorus: Dido]"),
      blockPill("verse4", "[Verse 4: Eminem]"),
    ],
  };

  // Save Stan doc
  const stanDocId = uid();
  const stanDoc = new Doc({
    id: stanDocId,
    userId,
    gridId,
    folderId: docsFolderId,
    title: "Stan — Eminem",
    docType: "normal",
    sortOrder: 1,
    content: stanDocContent,
  });
  await stanDoc.save();

  // Create real occurrence for Stan doc
  const stanDocOccId = await createOccurrence({
    targetType: "doc",
    targetId: stanDocId,
    meta: { folderId: docsFolderId },
    iterationMode: "persistent",
  });
  await Occurrence.findOneAndUpdate(
    { id: stanDocOccId },
    { $set: { docContent: stanDocContent } }
  );

  // ===================================================================
  // STEP 7: Create standalone Iteration and Operation models
  // ===================================================================

  // Standalone Iteration definitions (mirror grid.iterations but as separate model)
  const iterationDefs = [
    { id: uid(), name: "Daily", timeFilter: "daily", mode: "persistent", sortOrder: 0 },
    { id: uid(), name: "Weekly", timeFilter: "weekly", mode: "persistent", sortOrder: 1 },
    { id: uid(), name: "Monthly", timeFilter: "monthly", mode: "persistent", sortOrder: 2 },
    { id: uid(), name: "Daily Work", timeFilter: "daily", categoryKey: "context", categoryOptions: ["work"], mode: "persistent", sortOrder: 3 },
    { id: uid(), name: "Daily Personal", timeFilter: "daily", categoryKey: "context", categoryOptions: ["personal"], mode: "persistent", sortOrder: 4 },
  ];

  for (const iter of iterationDefs) {
    const iteration = new Iteration({ ...iter, userId, gridId });
    await iteration.save();
  }

  // Sample Operation — auto-sum completed tasks
  const sampleOperationId = uid();
  const sampleOperation = new Operation({
    id: sampleOperationId,
    userId,
    gridId,
    name: "Count Completed Tasks",
    description: "Counts all checked-off tasks for today",
    targetFieldId: fields.totalCompleted.id,
    triggerType: "onChange",
    enabled: true,
    blockTree: {
      type: "CONDITION",
      shape: "C_BLOCK",
      condition: {
        type: "FIELD",
        shape: "REPORTER",
        fieldId: fields.completed.id,
      },
      body: {
        type: "AGGREGATION",
        shape: "REPORTER",
        aggregation: "countTrue",
        fieldId: fields.completed.id,
        scope: "grid",
        timeFilter: "daily",
      },
    },
    sortOrder: 0,
  });
  await sampleOperation.save();

  // ===================================================================
  // STEP 8: Save a sample template (Morning Routine bundle)
  // ===================================================================
  const morningRoutineTemplate = {
    id: uid(),
    name: "Morning Routine",
    items: [
      { instanceId: toolkitInstances.morningWorkout.id, fieldDefaults: {} },
      { instanceId: toolkitInstances.stretching.id, fieldDefaults: {} },
      { instanceId: toolkitInstances.drinkWater.id, fieldDefaults: {} },
      { instanceId: toolkitInstances.takeMeds.id, fieldDefaults: {} },
      { instanceId: toolkitInstances.meditation.id, fieldDefaults: {} },
      { instanceId: toolkitInstances.moodCheck.id, fieldDefaults: {} },
    ],
    createdAt: new Date(),
  };

  await Grid.findByIdAndUpdate(grid._id, { $push: { templates: morningRoutineTemplate } });

  // Wire panels to grid with placement
  // Layout:
  // | Toolkit(0,0) | Schedule/DayPage(0,1 h=2) | Goals(0,2)    |
  // | Todo(1,0)    | Schedule/DayPage cont.    | Accounts(1,2) |
  const panelPlacements = [
    { key: "dailyToolkit", row: 0, col: 0, width: 1, height: 1 },
    { key: "todoList", row: 1, col: 0, width: 1, height: 1 },
    { key: "schedule", row: 0, col: 1, width: 1, height: 2 },
    { key: "dailyGoals", row: 0, col: 2, width: 1, height: 1 },
    { key: "accounts", row: 1, col: 2, width: 1, height: 1 },
    { key: "dayPage", row: 0, col: 1, width: 1, height: 2 },  // Same position as Schedule - user toggles
  ];

  const gridOccs = [];
  for (const { key, row, col, width, height } of panelPlacements) {
    const occId = await createOccurrence({
      targetType: "panel",
      targetId: panels[key].id,
      meta: {},
      placement: { row, col, width, height },
      iterationMode: "persistent", // Panels always visible
    });
    gridOccs.push(occId);
  }

  await Grid.findByIdAndUpdate(grid._id, { $set: { occurrences: gridOccs } });

  // Return summary
  return {
    gridId,
    summary: {
      fields: Object.keys(fields).length,
      instances: Object.keys(allInstances).length,
      containers: Object.keys(allContainers).length,
      panels: Object.keys(panels).length,
      manifests: 1,
      views: 1,
      folders: 3,
      docs: 3,  // Welcome + Daily Journal + Stan lyrics
      iterations: iterationDefs.length,
      operations: 1,
      templates: 1,
    },
  };
}

/**
 * Checks if a user already has data
 */
export async function userHasData(userId) {
  const gridCount = await Grid.countDocuments({ userId });
  return gridCount > 0;
}

export default createDefaultUserData;
