// =========================================
// server.js — MERGED (Auth + Grids + Panels + Containers/Instances)
// - Keeps your current Mongo connect string
// - Containers + Panels: userId ONLY (gridId ignored)
// - Grids: still keyed by gridId + userId
//
// FIXES MERGED (for grid hydration correctness):
// - full_state always sends grid as a plain JS object (never a mongoose doc)
// - unified full_state emitter used in both new-grid + existing-grid paths
// =========================================

import express from "express";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import { Server } from "socket.io";
import "dotenv/config";

// ========================================================
// MODELS
// ========================================================
import Instance from "./models/Instance.js";
import Container from "./models/Container.js";
import Panel from "./models/Panel.js";
import Grid from "./models/Grid.js";
import User from "./models/User.js";

// ========================================================
// JWT
// ========================================================
import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "SUPER_SECRET";
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ========================================================
// EXPRESS / HTTP / SOCKET.IO BOOTSTRAP
// ========================================================
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ========================================================
// AUTH (same as old)
// ========================================================
io.use(async (socket, next) => {
  console.log("🟦 [AUTH CHECK] Incoming socket:", socket.id);

  const token = socket.handshake.auth?.token;

  if (!token) {
    console.log("🟪 No token → guest allowed");
    socket.userId = null;
    return next();
  }

  console.log("🔐 Token received:", token.substring(0, 12) + "...");

  const decoded = verifyToken(token);
  if (!decoded) {
    console.log("❌ Invalid token");
    return next(new Error("INVALID_TOKEN"));
  }

  const user = await User.findById(decoded.userId);
  if (!user) {
    console.log("❌ Token valid but user not found");
    return next(new Error("USER_NOT_FOUND"));
  }

  console.log("✅ Authenticated user:", user._id.toString());
  socket.userId = user._id.toString();
  next();
});

// ========================================================
// DATABASE (KEEP YOUR CURRENT MONGO STUFF)
// ========================================================
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/dnd_containers"; // change me

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("🟢 MongoDB connected"))
  .catch((err) => console.error("🔴 MongoDB connect error:", err));
console.log("🧪 Using MONGO_URI:", MONGO_URI);

// ========================================================
// CACHE (PER USER)
// ========================================================
// cacheByUser[userId] = {
//   activeGridId,
//   gridsById: { [gridId]: gridObj },
//   panelsById: { [panelId]: panelObj },         // userId-only
//   containersById: { [containerId]: containerObj }, // userId-only
//   instancesById: { [instanceId]: instanceObj },    // userId-only
// };
const cacheByUser = Object.create(null);

function ensureUserCache(userId) {
  if (!cacheByUser[userId]) {
    cacheByUser[userId] = {
      activeGridId: null,
      gridsById: {},
      panelsById: {},
      containersById: {},
      instancesById: {},
    };
  }
  return cacheByUser[userId];
}

async function getAllGridsForUser(userId) {
  const all = await Grid.find({ userId }).sort({ createdAt: 1 }).lean();
  return all.map((g, idx) => ({
    id: g._id.toString(),
    name: g.name,
    createdAt: g.createdAt,
  }));
}

// ========================================================
// LOAD USER DATA INTO CACHE
// - grids are per user
// - panels/containers/instances are userId ONLY (gridId ignored)
// ========================================================
async function loadUserIntoCache(userId) {
  console.log("\n===============================");
  console.log("📥 loadUserIntoCache START", { userId });
  console.log("===============================\n");

  const uc = ensureUserCache(userId);

  const [grids, panels, containers, instances] = await Promise.all([
    Grid.find({ userId }).sort({ createdAt: 1 }),
    Panel.find({ userId }).sort({ createdAt: 1 }),
    Container.find({ userId }).sort({ createdAt: 1 }),
    Instance.find({ userId }).sort({ createdAt: 1 }),
  ]);

  // ---- gridsById
  uc.gridsById = {};
  grids.forEach((g) => {
    const obj = g.toObject();
    const gid = obj._id.toString();
    uc.gridsById[gid] = obj; // plain object
  });

  // ---- panelsById (user only)
  uc.panelsById = {};
  panels.forEach((p) => {
    const obj = p.toObject();
    obj.id = obj.id || obj._id.toString();
    uc.panelsById[obj.id] = obj;
  });

  // ---- containersById (user only, reducer shape)
  uc.containersById = {};
  containers.forEach((c) => {
    const obj = c.toObject();
    const id = obj.id || obj.containerId || obj._id.toString();
    uc.containersById[id] = {
      id,
      label: obj.label ?? "Untitled",
      items: Array.isArray(obj.items) ? obj.items : [],
    };
  });

  // ---- instancesById (user only, reducer shape)
  uc.instancesById = {};
  instances.forEach((i) => {
    const obj = i.toObject();
    const id = obj.id || obj.instanceId || obj._id.toString();
    uc.instancesById[id] = {
      id,
      label: obj.label ?? "Untitled",
      ...obj,
      id, // normalize
    };
  });

  // choose activeGridId if missing
  const gridIds = Object.keys(uc.gridsById);
  if (!uc.activeGridId && gridIds.length) uc.activeGridId = gridIds[0];

  console.log("✅ CACHE READY FOR USER:", userId);
  console.log("   Grids:", Object.keys(uc.gridsById).length);
  console.log("   Panels:", Object.keys(uc.panelsById).length);
  console.log("   Containers:", Object.keys(uc.containersById).length);
  console.log("   Instances:", Object.keys(uc.instancesById).length);
  console.log("===============================\n");

  return uc;
}

function userCacheReady(userId) {
  const uc = cacheByUser[userId];
  return !!(
    uc &&
    uc.gridsById &&
    uc.panelsById &&
    uc.containersById &&
    uc.instancesById
  );
}

// ========================================================
// SOCKET EVENTS
// ========================================================
io.on("connection", (socket) => {
  console.log("\n===============================================");
  console.log("🔌 Client connected:", socket.id);
  console.log("   userId:", socket.userId);
  console.log("===============================================\n");

  // ======================================================
  // AUTH EVENTS: REGISTER
  // ======================================================
  socket.on("register", async ({ email, password }) => {
    console.log("🟦 EVENT register:", { email });

    let exists = await User.findOne({ email });
    if (exists) {
      console.log("❌ Register failed: email exists");
      return socket.emit("auth_error", "Email already exists");
    }

    const user = await User.create({ email, password });
    const token = signToken({ userId: user._id });

    console.log("✅ Register success:", user._id.toString());
    socket.emit("auth_success", { token, userId: user._id.toString() });
  });

  // ======================================================
  // AUTH EVENTS: LOGIN
  // ======================================================
  socket.on("login", async ({ email, password }) => {
    console.log("🟦 EVENT login:", { email });

    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ Login failed: no such email");
      return socket.emit("auth_error", "Invalid email or password");
    }

    const match = await user.comparePassword(password);
    if (!match) {
      console.log("❌ Login failed: bad password");
      return socket.emit("auth_error", "Invalid email or password");
    }

    const token = signToken({ userId: user._id });

    console.log("✅ Login success:", user._id.toString());
    socket.emit("auth_success", { token, userId: user._id.toString() });
  });

  // ======================================================
  // FULL STATE REQUEST (merged)
  // - if gridId missing => create a new grid for this user
  // - containers/instances/panels are by userId only (gridId ignored)
  //
  // FIX: full_state always sends grid as a plain object
  // ======================================================
  socket.on("request_full_state", async (payload = {}) => {
    let { gridId } = payload || {}; // payload can be undefined/null

    const userId = socket.userId;
    if (!userId) {
      return socket.emit("server_error", "Not authenticated");
    }

    try {
      if (!userCacheReady(userId)) await loadUserIntoCache(userId);
      const uc = ensureUserCache(userId);


      // helper to keep full_state payload consistent
      const emitFullState = async (gid) => {

        // Helper list for dropdown
        const grids = await getAllGridsForUser(userId);

        const gridObj = uc.gridsById[gid];
        const safeGrid = gridObj?.toObject ? gridObj.toObject() : gridObj; // ✅ always plain

        socket.emit("full_state", {
          gridId: gid,
          grid: safeGrid,
          panels: Object.values(uc.panelsById),
          containers: Object.values(uc.containersById),
          instances: Object.values(uc.instancesById),
          grids,
        });
      };

      // ---------- CREATE NEW GRID IF NONE SPECIFIED ----------
      if (!gridId) {
        console.log("🟨 Creating new grid for user:", userId);

        const newGrid = await Grid.create({
          rows: 2,
          cols: 3,
          rowSizes: [],
          colSizes: [],
          userId,
          name: ""
        });

        gridId = newGrid._id.toString();

        uc.gridsById[gridId] = newGrid.toObject(); // ✅ store plain object
        uc.activeGridId = gridId;

        console.log("✅ New grid created:", gridId);

        emitFullState(gridId);
        return;
      }

      // ---------- LOAD GRID (must belong to user) ----------
      if (!uc.gridsById[gridId]) {
        const g = await Grid.findOne({ _id: gridId, userId }).lean();
        if (!g) {
  console.log("❌ Grid not found or unauthorized:", gridId);

  // ✅ fallback: pick first grid for this user, or create one
  const userGrids = Object.keys(uc.gridsById);
  if (userGrids.length) {
    const fallbackId = userGrids[0];
    uc.activeGridId = fallbackId;
    return emitFullState(fallbackId);
  }

  // no grids at all -> create one
  const newGrid = await Grid.create({
    rows: 2,
    cols: 3,
    rowSizes: [],
    colSizes: [],
    userId,
  });

  const newId = newGrid._id.toString();
  uc.gridsById[newId] = newGrid.toObject();
  uc.activeGridId = newId;
  return emitFullState(newId);
}
        uc.gridsById[gridId] = g; // lean object (already plain)
      }

      uc.activeGridId = gridId;

      console.log("📤 Sending full_state response:", gridId);
      emitFullState(gridId);
    } catch (err) {
      console.error("request_full_state error:", err);
      socket.emit("server_error", "Failed to load state");
    }
  });

  // ======================================================
  // CONTAINERS (userId ONLY - gridId ignored)
  // ======================================================
  socket.on("create_container", async ({ container }) => {
    try {
      const userId = socket.userId;
      if (!userId) return;

      if (!userCacheReady(userId)) await loadUserIntoCache(userId);
      const uc = ensureUserCache(userId);

      const id = container?.id;
      if (!id) return;

      const next = {
        ...(uc.containersById[id] || {}),
        ...(container || {}),
        id,
        userId,
      };

      if (!Array.isArray(next.items)) next.items = [];

      uc.containersById[id] = {
        id,
        label: next.label ?? "Untitled",
        items: next.items,
      };

      await Container.findOneAndUpdate(
        { id, userId },
        {
          id,
          userId,
          label: next.label ?? "Untitled",
          items: next.items,
        },
        { upsert: true }
      );

      io.emit("container_created", {
        container: {
          id,
          label: uc.containersById[id].label,
          items: uc.containersById[id].items,
        },
      });
    } catch (err) {
      console.error("create_container error:", err);
      socket.emit("server_error", "Failed to create container");
    }
  });

  // ======================================================
  // INSTANCES IN CONTAINERS (userId ONLY - gridId ignored)
  // ======================================================
  socket.on("create_instance_in_container", async ({ containerId, instance }) => {
    try {
      const userId = socket.userId;
      if (!userId) return;

      if (!userCacheReady(userId)) await loadUserIntoCache(userId);
      const uc = ensureUserCache(userId);

      if (!containerId || !instance?.id) return;

      const instanceId = instance.id;

      if (!uc.containersById[containerId]) {
        uc.containersById[containerId] = {
          id: containerId,
          label: "Untitled",
          items: [],
        };

        await Container.findOneAndUpdate(
          { id: containerId, userId },
          { id: containerId, userId, label: "Untitled", items: [] },
          { upsert: true }
        );
      }

      const c = uc.containersById[containerId];

      const nextInst = {
        ...(uc.instancesById[instanceId] || {}),
        ...(instance || {}),
        id: instanceId,
        label: instance.label ?? uc.instancesById[instanceId]?.label ?? "Untitled",
        userId,
      };

      uc.instancesById[instanceId] = nextInst;

      if (!c.items.includes(instanceId)) {
        c.items = [...c.items, instanceId];
      }

      await Promise.all([
        Instance.findOneAndUpdate({ id: instanceId, userId }, nextInst, { upsert: true }),
        Container.findOneAndUpdate(
          { id: containerId, userId },
          { items: c.items, label: c.label ?? "Untitled" },
          { upsert: true }
        ),
      ]);

      io.emit("instance_created_in_container", {
        containerId,
        instance: { id: nextInst.id, label: nextInst.label },
      });
    } catch (err) {
      console.error("create_instance_in_container error:", err);
      socket.emit("server_error", "Failed to create instance");
    }
  });

  // ======================================================
  // CONTAINER ITEMS UPDATE (now UPSERTS container if missing)
  // ======================================================
  socket.on("update_container_items", async ({ containerId, items }) => {
    try {
      const userId = socket.userId;
      if (!userId) return;

      if (!userCacheReady(userId)) await loadUserIntoCache(userId);
      const uc = ensureUserCache(userId);

      if (!containerId || !Array.isArray(items)) return;

      if (!uc.containersById[containerId]) {
        uc.containersById[containerId] = {
          id: containerId,
          label: "Untitled",
          items: [],
        };
      }

      const c = uc.containersById[containerId];
      c.items = [...items];

      await Container.findOneAndUpdate(
        { id: containerId, userId },
        {
          id: containerId,
          userId,
          label: c.label ?? "Untitled",
          items: c.items,
        },
        { upsert: true }
      );

      io.emit("container_items_updated", { containerId, items: c.items });
    } catch (err) {
      console.error("update_container_items error:", err);
      socket.emit("server_error", "Failed to update container");
    }
  });

  // ======================================================
  // INSTANCE UPDATE (now UPSERTS instance if missing)
  // ======================================================
  socket.on("update_instance", async ({ instance }) => {
    try {
      const userId = socket.userId;
      if (!userId) return;

      if (!userCacheReady(userId)) await loadUserIntoCache(userId);
      const uc = ensureUserCache(userId);

      if (!instance?.id) return;

      const id = instance.id;

      const next = {
        ...(uc.instancesById[id] || {}),
        ...(instance || {}),
        id,
        userId,
      };

      if (!next.label) next.label = "Untitled";

      uc.instancesById[id] = next;

      await Instance.findOneAndUpdate({ id, userId }, next, { upsert: true });

      io.emit("instance_updated", { instance: next });
    } catch (err) {
      console.error("update_instance error:", err);
      socket.emit("server_error", "Failed to update instance");
    }
  });

  // ======================================================
  // PANELS (userId ONLY - gridId ignored)
  // ======================================================
  socket.on("update_panel", async ({ panel }) => {
    try {
      const userId = socket.userId;
      if (!userId) return;

      if (!userCacheReady(userId)) await loadUserIntoCache(userId);
      const uc = ensureUserCache(userId);

      const panelId = panel?.id;
      if (!panelId) return;

      const next = {
        ...(uc.panelsById[panelId] || {}),
        ...(panel || {}),
        id: panelId,
        userId,
      };

      if (!next.props) next.props = {};
      if (!Array.isArray(next.containers)) next.containers = [];

      uc.panelsById[panelId] = next;

      await Panel.findOneAndUpdate({ id: panelId, userId }, next, { upsert: true });

      io.emit("panel_updated", next);
    } catch (err) {
      console.error("update_panel error:", err);
      socket.emit("server_error", "Failed to update panel");
    }
  });

  socket.on("create_panel", async ({ panel }) => {
    try {
      const userId = socket.userId;
      if (!userId) return;

      if (!userCacheReady(userId)) await loadUserIntoCache(userId);
      const uc = ensureUserCache(userId);

      const panelId = panel?.id;
      if (!panelId) return;

      const next = {
        ...(uc.panelsById[panelId] || {}),
        props: {},
        ...(panel || {}),
        id: panelId,
        userId,
      };

      if (!next.props) next.props = {};
      if (!Array.isArray(next.containers)) next.containers = [];

      uc.panelsById[panelId] = next;

      await Panel.findOneAndUpdate({ id: panelId, userId }, next, { upsert: true });

      io.emit("panel_updated", next);
    } catch (err) {
      console.error("add_panel error:", err);
      socket.emit("server_error", "Failed to add panel");
    }
  });

  // ======================================================
  // GRID UPDATE (grid is gridId + userId) — now UPSERTS
  // ======================================================
  socket.on("update_grid", async (payload) => {
    try {
      const userId = socket.userId;
      if (!userId) return;

      const { gridId } = payload || {};
      if (!gridId) {
        console.log("❌ update_grid missing gridId");
        return;
      }

      if (!userCacheReady(userId)) await loadUserIntoCache(userId);
      const uc = ensureUserCache(userId);

      const { grid: gridPatchFromNested, ...rest } = payload || {};
      const { gridId: _ignored, ...restWithoutId } = rest || {};
      const updatePatch = gridPatchFromNested || restWithoutId || {};

      console.log("🟦 EVENT update_grid:", { gridId, updatePatch });

      if (!uc.gridsById[gridId]) {
        const g = await Grid.findOne({ _id: gridId, userId }).lean();
        if (g) {
          uc.gridsById[gridId] = g;
        } else {
          const created = await Grid.create({
            _id: gridId,
            userId,
            rows: updatePatch.rows ?? 2,
            cols: updatePatch.cols ?? 3,
            rowSizes: updatePatch.rowSizes ?? [],
            colSizes: updatePatch.colSizes ?? [],
            name: updatePatch.name,
          });
          uc.gridsById[gridId] = created.toObject();
        }
      }

      uc.gridsById[gridId] = {
        ...uc.gridsById[gridId],
        ...updatePatch,
      };

      await Grid.findOneAndUpdate({ _id: gridId, userId }, updatePatch, {
        upsert: true,
      });

      // NOTE: leaving your current wire format as-is
      io.emit("grid_updated", { gridId, grid: updatePatch });
    } catch (err) {
      console.error("update_grid error:", err);
      socket.emit("server_error", "Failed to update grid");
    }
  });

  // ======================================================
  // DISCONNECT
  // ======================================================
  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// ========================================================
// SERVER LISTEN
// ========================================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`\n🚀 Server running on port ${PORT}`));