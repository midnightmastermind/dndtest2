// scripts/testData.js
// ============================================================
// Data integrity test suite
// Validates all referential integrity, occurrence wiring,
// field references, and model relationships
// ============================================================

import mongoose from "mongoose";
import "dotenv/config";

import Grid from "../models/Grid.js";
import Panel from "../models/Panel.js";
import Container from "../models/Container.js";
import Instance from "../models/Instance.js";
import Occurrence from "../models/Occurrence.js";
import Field from "../models/Field.js";
import Manifest from "../models/Manifest.js";
import View from "../models/View.js";
import Doc from "../models/Doc.js";
import Folder from "../models/Folder.js";
import Artifact from "../models/Artifact.js";
import Operation from "../models/Operation.js";
import Iteration from "../models/Iteration.js";
import User from "../models/User.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/dnd_containers";
const TARGET_USER_EMAIL = "josh@jpoms.com";

let passed = 0;
let failed = 0;
let warnings = 0;

function pass(msg) {
  passed++;
  console.log(`  ✅ ${msg}`);
}

function fail(msg, detail) {
  failed++;
  console.log(`  ❌ FAIL: ${msg}`);
  if (detail) console.log(`     → ${detail}`);
}

function warn(msg) {
  warnings++;
  console.log(`  ⚠️  WARN: ${msg}`);
}

function section(title) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`📋 ${title}`);
  console.log(`${"─".repeat(60)}`);
}

async function runTests() {
  console.log("🧪 Moduli Data Integrity Tests\n");

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const user = await User.findOne({ email: TARGET_USER_EMAIL });
    if (!user) {
      fail("User not found", TARGET_USER_EMAIL);
      return;
    }
    const userId = user._id.toString();
    pass(`User found: ${userId}`);

    // Load all data
    const grids = await Grid.find({ userId }).lean();
    const panels = await Panel.find({ userId }).lean();
    const containers = await Container.find({ userId }).lean();
    const instances = await Instance.find({ userId }).lean();
    const occurrences = await Occurrence.find({ userId }).lean();
    const fields = await Field.find({ userId }).lean();
    const manifests = await Manifest.find({ userId }).lean();
    const views = await View.find({ userId }).lean();
    const docs = await Doc.find({ userId }).lean();
    const folders = await Folder.find({ userId }).lean();
    const artifacts = await Artifact.find({ userId }).lean();
    const operations = await Operation.find({ userId }).lean();
    const iterations = await Iteration.find({ userId }).lean();

    // Build lookup maps
    const byId = (arr) => Object.fromEntries(arr.map(x => [x.id, x]));
    const gridsById = byId(grids);
    const panelsById = byId(panels);
    const containersById = byId(containers);
    const instancesById = byId(instances);
    const occurrencesById = byId(occurrences);
    const fieldsById = byId(fields);
    const manifestsById = byId(manifests);
    const viewsById = byId(views);
    const docsById = byId(docs);
    const foldersById = byId(folders);

    // ─────────────────────────────────────────────────────────
    section("1. ENTITY COUNTS");
    // ─────────────────────────────────────────────────────────
    const counts = {
      grids: grids.length,
      panels: panels.length,
      containers: containers.length,
      instances: instances.length,
      occurrences: occurrences.length,
      fields: fields.length,
      manifests: manifests.length,
      views: views.length,
      docs: docs.length,
      folders: folders.length,
      artifacts: artifacts.length,
      operations: operations.length,
      iterations: iterations.length,
    };

    for (const [model, count] of Object.entries(counts)) {
      if (count > 0) pass(`${model}: ${count}`);
      else warn(`${model}: 0 (none found)`);
    }

    if (grids.length === 0) {
      fail("No grids found — cannot continue tests");
      return;
    }

    const grid = grids[0];
    const gridId = grid._id?.toString() || grid.id;

    // ─────────────────────────────────────────────────────────
    section("2. GRID INTEGRITY");
    // ─────────────────────────────────────────────────────────

    // Grid has occurrences array
    if (grid.occurrences?.length > 0) {
      pass(`Grid has ${grid.occurrences.length} panel occurrences`);
    } else {
      fail("Grid has no occurrences (no panels wired)");
    }

    // Grid has iterations
    if (grid.iterations?.length > 0) {
      pass(`Grid has ${grid.iterations.length} iteration definitions`);
    } else {
      fail("Grid has no iterations defined");
    }

    // Grid has categoryDimensions
    if (grid.categoryDimensions?.length > 0) {
      pass(`Grid has ${grid.categoryDimensions.length} category dimensions`);
      for (const dim of grid.categoryDimensions) {
        if (dim.values?.length > 0) {
          pass(`  Category "${dim.name}": ${dim.values.length} values (${dim.values.join(", ")})`);
        } else {
          warn(`  Category "${dim.name}" has no values`);
        }
      }
    } else {
      warn("Grid has no categoryDimensions (compound iteration won't show in toolbar)");
    }

    // Grid has templates
    if (grid.templates?.length > 0) {
      pass(`Grid has ${grid.templates.length} templates`);
      for (const t of grid.templates) {
        if (t.items?.length > 0) {
          pass(`  Template "${t.name}": ${t.items.length} items`);
        } else {
          warn(`  Template "${t.name}" has no items`);
        }
      }
    } else {
      warn("Grid has no templates saved");
    }

    // Grid has fieldIds
    if (grid.fieldIds?.length > 0) {
      pass(`Grid fieldIds registry: ${grid.fieldIds.length} fields`);
    } else {
      warn("Grid fieldIds is empty (fields exist but not registered on grid)");
    }

    // ─────────────────────────────────────────────────────────
    section("3. OCCURRENCE WIRING (Critical)");
    // ─────────────────────────────────────────────────────────

    // All grid.occurrences point to valid occurrences
    let gridOccBroken = 0;
    for (const occId of grid.occurrences || []) {
      if (!occurrencesById[occId]) {
        fail(`Grid references occurrence "${occId}" but it doesn't exist`);
        gridOccBroken++;
      }
    }
    if (gridOccBroken === 0 && grid.occurrences?.length > 0) {
      pass(`All ${grid.occurrences.length} grid occurrences exist`);
    }

    // All grid occurrences are panel type
    const gridPanelOccs = (grid.occurrences || []).map(id => occurrencesById[id]).filter(Boolean);
    const nonPanelGridOccs = gridPanelOccs.filter(o => o.targetType !== "panel");
    if (nonPanelGridOccs.length === 0) {
      pass("All grid occurrences are targetType=panel");
    } else {
      fail(`${nonPanelGridOccs.length} grid occurrences are NOT panel type`, nonPanelGridOccs.map(o => `${o.id}:${o.targetType}`).join(", "));
    }

    // All panel occurrences point to valid panels
    let panelTargetBroken = 0;
    for (const occ of gridPanelOccs) {
      if (!panelsById[occ.targetId]) {
        fail(`Panel occurrence "${occ.id}" targets panel "${occ.targetId}" but panel doesn't exist`);
        panelTargetBroken++;
      }
    }
    if (panelTargetBroken === 0) {
      pass(`All ${gridPanelOccs.length} panel occurrences point to valid panels`);
    }

    // All panel.occurrences point to valid occurrences with targetType=container
    let containerOccBroken = 0;
    let containerOccTotal = 0;
    for (const panel of panels) {
      for (const occId of panel.occurrences || []) {
        containerOccTotal++;
        const occ = occurrencesById[occId];
        if (!occ) {
          fail(`Panel "${panel.name}" references occurrence "${occId}" but it doesn't exist`);
          containerOccBroken++;
        } else if (occ.targetType !== "container") {
          fail(`Panel "${panel.name}" occurrence "${occId}" is targetType="${occ.targetType}" (expected "container")`);
          containerOccBroken++;
        } else if (!containersById[occ.targetId]) {
          fail(`Panel "${panel.name}" occurrence "${occId}" targets container "${occ.targetId}" but container doesn't exist`);
          containerOccBroken++;
        }
      }
    }
    if (containerOccBroken === 0 && containerOccTotal > 0) {
      pass(`All ${containerOccTotal} panel→container occurrences valid`);
    }

    // All container.occurrences point to valid occurrences with targetType=instance
    let instanceOccBroken = 0;
    let instanceOccTotal = 0;
    for (const container of containers) {
      for (const occId of container.occurrences || []) {
        instanceOccTotal++;
        const occ = occurrencesById[occId];
        if (!occ) {
          fail(`Container "${container.label}" references occurrence "${occId}" but it doesn't exist`);
          instanceOccBroken++;
        } else if (occ.targetType !== "instance") {
          fail(`Container "${container.label}" occurrence "${occId}" is targetType="${occ.targetType}" (expected "instance")`);
          instanceOccBroken++;
        } else if (!instancesById[occ.targetId]) {
          fail(`Container "${container.label}" occurrence "${occId}" targets instance "${occ.targetId}" but instance doesn't exist`);
          instanceOccBroken++;
        }
      }
    }
    if (instanceOccBroken === 0 && instanceOccTotal > 0) {
      pass(`All ${instanceOccTotal} container→instance occurrences valid`);
    }

    // Check for orphaned occurrences (not referenced by any parent)
    const referencedOccIds = new Set();
    for (const occId of grid.occurrences || []) referencedOccIds.add(occId);
    for (const panel of panels) for (const occId of panel.occurrences || []) referencedOccIds.add(occId);
    for (const container of containers) for (const occId of container.occurrences || []) referencedOccIds.add(occId);

    const orphanedOccs = occurrences.filter(o => !referencedOccIds.has(o.id));
    if (orphanedOccs.length === 0) {
      pass("No orphaned occurrences");
    } else {
      warn(`${orphanedOccs.length} orphaned occurrences (not referenced by any parent)`);
    }

    // ─────────────────────────────────────────────────────────
    section("4. FIELD REFERENCES");
    // ─────────────────────────────────────────────────────────

    // All instance fieldBindings reference valid fields
    let fieldBindingBroken = 0;
    let fieldBindingTotal = 0;
    for (const inst of instances) {
      for (const binding of inst.fieldBindings || []) {
        fieldBindingTotal++;
        if (!fieldsById[binding.fieldId]) {
          fail(`Instance "${inst.label}" has fieldBinding to "${binding.fieldId}" but field doesn't exist`);
          fieldBindingBroken++;
        }
      }
    }
    if (fieldBindingBroken === 0 && fieldBindingTotal > 0) {
      pass(`All ${fieldBindingTotal} instance fieldBindings reference valid fields`);
    }

    // All derived fields have allowedFields with valid references
    const derivedFields = fields.filter(f => f.mode === "derived");
    let derivedBroken = 0;
    for (const field of derivedFields) {
      const allowed = field.metric?.allowedFields || [];
      if (allowed.length === 0) {
        warn(`Derived field "${field.name}" (${field.id}) has no allowedFields`);
      }
      for (const af of allowed) {
        if (!fieldsById[af.fieldId]) {
          fail(`Derived field "${field.name}" allowedFields references "${af.fieldId}" but field doesn't exist`);
          derivedBroken++;
        }
      }
    }
    if (derivedBroken === 0 && derivedFields.length > 0) {
      pass(`All ${derivedFields.length} derived fields have valid allowedFields references`);
    }

    // ─────────────────────────────────────────────────────────
    section("5. PANEL PLACEMENTS");
    // ─────────────────────────────────────────────────────────

    // All panel occurrences have valid placement
    let placementBroken = 0;
    for (const occ of gridPanelOccs) {
      if (!occ.placement || occ.placement.row === undefined || occ.placement.col === undefined) {
        fail(`Panel occurrence "${occ.id}" (${panelsById[occ.targetId]?.name || occ.targetId}) has no placement`);
        placementBroken++;
      }
    }
    if (placementBroken === 0) {
      pass(`All ${gridPanelOccs.length} panels have valid placements`);
    }

    // Check placement bounds
    for (const occ of gridPanelOccs) {
      if (!occ.placement) continue;
      const { row, col } = occ.placement;
      if (row >= grid.rows || col >= grid.cols) {
        warn(`Panel "${panelsById[occ.targetId]?.name}" placed at (${row},${col}) but grid is ${grid.rows}x${grid.cols}`);
      }
    }

    // ─────────────────────────────────────────────────────────
    section("6. VIEW / MANIFEST / FOLDER / DOC INTEGRITY");
    // ─────────────────────────────────────────────────────────

    // Views reference valid panels
    for (const view of views) {
      if (view.panelId && !panelsById[view.panelId]) {
        fail(`View "${view.name}" references panel "${view.panelId}" but panel doesn't exist`);
      } else if (view.panelId) {
        pass(`View "${view.name}" → Panel "${panelsById[view.panelId]?.name}"`);
      }
    }

    // Views reference valid manifests
    for (const view of views) {
      if (view.manifestId && !manifestsById[view.manifestId]) {
        fail(`View "${view.name}" references manifest "${view.manifestId}" but manifest doesn't exist`);
      } else if (view.manifestId) {
        pass(`View "${view.name}" → Manifest "${manifestsById[view.manifestId]?.name}"`);
      }
    }

    // Views activeDocId references valid doc
    for (const view of views) {
      if (view.activeDocId && !docsById[view.activeDocId]) {
        fail(`View "${view.name}" activeDocId "${view.activeDocId}" but doc doesn't exist`);
      } else if (view.activeDocId) {
        pass(`View "${view.name}" → Active Doc "${docsById[view.activeDocId]?.title}"`);
      }
    }

    // Panels with viewId reference valid views
    for (const panel of panels) {
      if (panel.viewId && !viewsById[panel.viewId]) {
        fail(`Panel "${panel.name}" has viewId "${panel.viewId}" but view doesn't exist`);
      } else if (panel.viewId) {
        pass(`Panel "${panel.name}" → View "${viewsById[panel.viewId]?.name}"`);
      }
    }

    // Manifest rootFolderId references valid folder
    for (const manifest of manifests) {
      if (manifest.rootFolderId && !foldersById[manifest.rootFolderId]) {
        fail(`Manifest "${manifest.name}" rootFolderId "${manifest.rootFolderId}" but folder doesn't exist`);
      } else if (manifest.rootFolderId) {
        pass(`Manifest "${manifest.name}" → Root Folder "${foldersById[manifest.rootFolderId]?.name}"`);
      }
    }

    // Folder parentId references valid folder (or null for root)
    for (const folder of folders) {
      if (folder.parentId && !foldersById[folder.parentId]) {
        fail(`Folder "${folder.name}" has parentId "${folder.parentId}" but parent folder doesn't exist`);
      }
    }
    pass("All folder parentId references valid");

    // Docs folderId references valid folder
    for (const doc of docs) {
      if (doc.folderId && !foldersById[doc.folderId]) {
        fail(`Doc "${doc.title}" has folderId "${doc.folderId}" but folder doesn't exist`);
      }
    }
    pass("All doc folderId references valid");

    // ─────────────────────────────────────────────────────────
    section("7. FOLDER TREE STRUCTURE");
    // ─────────────────────────────────────────────────────────

    // Build tree from folders
    const rootFolders = folders.filter(f => !f.parentId);
    if (rootFolders.length > 0) {
      pass(`${rootFolders.length} root folder(s)`);
      function printTree(parentId, depth = 0) {
        const indent = "  ".repeat(depth + 1);
        const children = folders.filter(f => f.parentId === parentId);
        const childDocs = docs.filter(d => d.folderId === parentId);
        const childArtifacts = artifacts.filter(a => a.folderId === parentId);
        for (const child of children) {
          console.log(`${indent}📁 ${child.name} (${child.folderType})`);
          printTree(child.id, depth + 1);
        }
        for (const doc of childDocs) {
          console.log(`${indent}📄 ${doc.title} (${doc.docType})`);
        }
        for (const art of childArtifacts) {
          console.log(`${indent}📎 ${art.name} (${art.artifactType})`);
        }
      }
      for (const root of rootFolders) {
        console.log(`  📁 ${root.name} (root)`);
        printTree(root.id, 1);
      }
    } else {
      warn("No root folders found");
    }

    // ─────────────────────────────────────────────────────────
    section("8. OPERATIONS & ITERATIONS");
    // ─────────────────────────────────────────────────────────

    // Operations reference valid target fields
    for (const op of operations) {
      if (op.targetFieldId && !fieldsById[op.targetFieldId]) {
        fail(`Operation "${op.name}" targets field "${op.targetFieldId}" but field doesn't exist`);
      } else if (op.targetFieldId) {
        pass(`Operation "${op.name}" → Field "${fieldsById[op.targetFieldId]?.name}"`);
      }
      if (op.blockTree) {
        pass(`Operation "${op.name}" has blockTree (${op.blockTree.type})`);
      } else {
        warn(`Operation "${op.name}" has no blockTree`);
      }
    }

    // Iterations
    for (const iter of iterations) {
      pass(`Iteration "${iter.name}" (${iter.timeFilter}${iter.categoryKey ? ` + ${iter.categoryKey}` : ""})`);
    }

    // ─────────────────────────────────────────────────────────
    section("9. TEMPLATE INTEGRITY");
    // ─────────────────────────────────────────────────────────

    for (const template of grid.templates || []) {
      let templateBroken = 0;
      for (const item of template.items || []) {
        if (!instancesById[item.instanceId]) {
          fail(`Template "${template.name}" references instance "${item.instanceId}" but it doesn't exist`);
          templateBroken++;
        }
      }
      if (templateBroken === 0) {
        pass(`Template "${template.name}": all ${template.items?.length || 0} instance references valid`);
      }
    }

    // ─────────────────────────────────────────────────────────
    section("10. ITERATION MODE DISTRIBUTION");
    // ─────────────────────────────────────────────────────────

    const modeCount = {};
    for (const occ of occurrences) {
      const mode = occ.iteration?.mode || "unknown";
      modeCount[mode] = (modeCount[mode] || 0) + 1;
    }
    for (const [mode, count] of Object.entries(modeCount)) {
      pass(`iteration.mode="${mode}": ${count} occurrences`);
    }

    // ─────────────────────────────────────────────────────────
    section("11. DRAG MODE DISTRIBUTION");
    // ─────────────────────────────────────────────────────────

    const dragModes = {};
    for (const p of panels) { dragModes[p.defaultDragMode || "move"] = (dragModes[p.defaultDragMode || "move"] || 0) + 1; }
    for (const c of containers) { dragModes[c.defaultDragMode || "move"] = (dragModes[c.defaultDragMode || "move"] || 0) + 1; }
    for (const i of instances) { dragModes[i.defaultDragMode || "move"] = (dragModes[i.defaultDragMode || "move"] || 0) + 1; }
    for (const [mode, count] of Object.entries(dragModes)) {
      pass(`defaultDragMode="${mode}": ${count} entities`);
    }

    // ─────────────────────────────────────────────────────────
    section("RESULTS");
    // ─────────────────────────────────────────────────────────

    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ PASSED: ${passed}`);
    console.log(`❌ FAILED: ${failed}`);
    console.log(`⚠️  WARNINGS: ${warnings}`);
    console.log(`${"=".repeat(60)}`);

    if (failed > 0) {
      console.log("\n💥 DATA INTEGRITY ISSUES FOUND — fix before running the app");
      process.exit(1);
    } else {
      console.log("\n🎉 All integrity checks passed!");
    }

  } catch (error) {
    console.error("❌ Test suite failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

runTests();
