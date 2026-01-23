// =========================================
// server.js — MERGED (Auth + Grids + Panels + Containers/Instances + Rooms)
// - Keeps your current Mongo connect string
// - Containers + Panels: userId ONLY (gridId ignored)
// - Grids: still keyed by gridId + userId
//
// ✅ ROOMS MERGED (cross-window/grid safe):
// - Join per-user room on connect: user:{userId}
// - (Optional) Join per-grid room on request_full_state: user:{userId}:grid:{gridId}
// - Replace ALL io.emit(...) with socket.to(userRoom(userId)).emit(...)
//   (no echo back to sender; sender already optimistically dispatches)
//
// ✅ MULTI-WINDOW FIX:
// - Stop using uc.activeGridId as global truth
// - Track active grid per socket via socket.data.activeGridId
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
// ROOMS
// ========================================================
function userRoom(userId) {
  return `user:${userId}`;
}
function gridRoom(userId, gridId) {
  return `user:${userId}:grid:${gridId}`;
}

// ========================================================
// AUTH (same as old)
// ========================================================
io.use(async (socket, next) => {
  console.log("🟦 [AUTH CHECK] Incoming socket:", socket.id);

  const token = socket.handshake.auth?.token;

  if (!token) {
    console.log("🟪 No token → guest allowed");
    socket.userId = null;
    socket.data.userId = null;
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
  socket.data.userId = socket.userId;
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
//   gridsById: { [gridId]: gridObj },
//   panelsById: { [panelId]: panelObj },             // userId-only
//   containersById: { [containerId]: containerObj }, // userId-only
//   instancesById: { [instanceId]: instanceObj },    // userId-only
// };
const cacheByUser = Object.create(null);

function ensureUserCache(userId) {
  if (!cacheByUser[userId]) {
    cacheByUser[userId] = {
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
  return all.map((g) => ({
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
      ...obj,
      id, // normalize
      label: obj.label ?? "Untitled",
    };
  });

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
  return !!(uc && uc.gridsById && uc.panelsById && uc.containersById && uc.instancesById);
}

// ========================================================
// SOCKET EVENTS
// ========================================================
io.on("connection", (socket) => {
  console.log("\n===============================================");
  console.log("🔌 Client connected:", socket.id);
  console.log("   userId:", socket.userId);
  console.log("===============================================\n");

  // ✅ Join per-user room so cross-window works + no cross-user bleed
  const userId = socket.userId;
  if (userId) {
    socket.join(userRoom(userId));
    console.log("🏠 joined", userRoom(userId));
  }

  // Track active grid PER SOCKET (multi-window safe)
  socket.data.activeGridId = socket.data.activeGridId || null;

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
  // ======================================================
  socket.on("request_full_state", async (payload = {}) => {
    let { gridId } = payload || {};

    const userId = socket.userId;
    if (!userId) {
      return socket.emit("server_error", "Not authenticated");
    }

    try {
      if (!userCacheReady(userId)) await loadUserIntoCache(userId);
      const uc = ensureUserCache(userId);

      const emitFullState = async (gid) => {
        const grids = await getAllGridsForUser(userId);
        const gridObj = uc.gridsById[gid];
        const safeGrid = gridObj?.toObject ? gridObj.toObject() : gridObj;

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
          name: "",
        });

        gridId = newGrid._id.toString();
        uc.gridsById[gridId] = newGrid.toObject();
        console.log("✅ New grid created:", gridId);

        // ✅ per-socket active grid
        const prev = socket.data.activeGridId;
        if (prev && prev !== gridId) socket.leave(gridRoom(userId, prev));
        socket.join(gridRoom(userId, gridId));
        socket.data.activeGridId = gridId;

        emitFullState(gridId);
        return;
      }

      // ---------- LOAD GRID (must belong to user) ----------
      if (!uc.gridsById[gridId]) {
        const g = await Grid.findOne({ _id: gridId, userId }).lean();
        if (!g) {
          console.log("❌ Grid not found or unauthorized:", gridId);

          const userGrids = Object.keys(uc.gridsById);
          if (userGrids.length) {
            const fallbackId = userGrids[0];

            const prev = socket.data.activeGridId;
            if (prev && prev !== fallbackId) socket.leave(gridRoom(userId, prev));
            socket.join(gridRoom(userId, fallbackId));
            socket.data.activeGridId = fallbackId;

            return emitFullState(fallbackId);
          }

          const newGrid = await Grid.create({
            rows: 2,
            cols: 3,
            rowSizes: [],
            colSizes: [],
            userId,
            name: "",
          });

          const newId = newGrid._id.toString();
          uc.gridsById[newId] = newGrid.toObject();

          const prev = socket.data.activeGridId;
          if (prev && prev !== newId) socket.leave(gridRoom(userId, prev));
          socket.join(gridRoom(userId, newId));
          socket.data.activeGridId = newId;

          return emitFullState(newId);
        }
        uc.gridsById[gridId] = g;
      }

      // ✅ per-socket active grid + optional grid room
      {
        const prev = socket.data.activeGridId;
        if (prev && prev !== gridId) socket.leave(gridRoom(userId, prev));
        socket.join(gridRoom(userId, gridId));
        socket.data.activeGridId = gridId;
      }

      console.log("📤 Sending full_state response:", gridId);
      emitFullState(gridId);
    } catch (err) {
      console.error("request_full_state error:", err);
      socket.emit("server_error", "Failed to load state");
    }
  });
  // ======================================================
  // GRID CREATE (grid is gridId + userId)
  // emits: grid_created  (no echo)
  // ======================================================
  socket.on("create_grid", async ({ grid } = {}) => {
    try {
      const userId = socket.userId;
      if (!userId) return;

      if (!grid) return;

      if (!userCacheReady(userId)) await loadUserIntoCache(userId);
      const uc = ensureUserCache(userId);

      // Accept either id or _id coming from client
      const gridId = grid.id || grid._id;
      if (!gridId) {
        socket.emit("server_error", "create_grid missing grid id");
        return;
      }

      const next = {
        rows: grid.rows ?? 2,
        cols: grid.cols ?? 3,
        rowSizes: Array.isArray(grid.rowSizes) ? grid.rowSizes : [],
        colSizes: Array.isArray(grid.colSizes) ? grid.colSizes : [],
        name: grid.name ?? "",
        userId,
      };

      // Upsert with _id = gridId to keep your existing Grid schema usage
      const saved = await Grid.findOneAndUpdate(
        { _id: gridId, userId },
        { _id: gridId, ...next },
        { upsert: true, new: true }
      ).lean();

      uc.gridsById[gridId] = saved;

      socket.to(userRoom(userId)).emit("grid_created", {
        grid: {
          id: gridId,
          _id: gridId,
          ...saved,
        },
      });
    } catch (err) {
      console.error("create_grid error:", err);
      socket.emit("server_error", "Failed to create grid");
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
        { id, userId, label: next.label ?? "Untitled", items: next.items },
        { upsert: true }
      );

      socket.to(userRoom(userId)).emit("container_created", {
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
        uc.containersById[containerId] = { id: containerId, label: "Untitled", items: [] };

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

      if (!c.items.includes(instanceId)) c.items = [...c.items, instanceId];

      await Promise.all([
        Instance.findOneAndUpdate({ id: instanceId, userId }, nextInst, { upsert: true }),
        Container.findOneAndUpdate(
          { id: containerId, userId },
          { items: c.items, label: c.label ?? "Untitled" },
          { upsert: true }
        ),
      ]);

      socket.to(userRoom(userId)).emit("instance_created_in_container", {
        containerId,
        instance: { id: nextInst.id, label: nextInst.label },
      });
    } catch (err) {
      console.error("create_instance_in_container error:", err);
      socket.emit("server_error", "Failed to create instance");
    }
  });

  // ======================================================
  // CONTAINER ITEMS UPDATE (UPSERTS container if missing)
  // ======================================================
  socket.on("update_container_items", async ({ containerId, items }) => {
    try {
      const userId = socket.userId;
      if (!userId) return;

      if (!userCacheReady(userId)) await loadUserIntoCache(userId);
      const uc = ensureUserCache(userId);

      if (!containerId || !Array.isArray(items)) return;

      if (!uc.containersById[containerId]) {
        uc.containersById[containerId] = { id: containerId, label: "Untitled", items: [] };
      }

      const c = uc.containersById[containerId];
      c.items = [...items];

      await Container.findOneAndUpdate(
        { id: containerId, userId },
        { id: containerId, userId, label: c.label ?? "Untitled", items: c.items },
        { upsert: true }
      );

      socket.to(userRoom(userId)).emit("container_items_updated", { containerId, items: c.items });
    } catch (err) {
      console.error("update_container_items error:", err);
      socket.emit("server_error", "Failed to update container");
    }
  });

  // ======================================================
  // CONTAINER UPDATE — UPSERT
  // emits: container_updated
  // ======================================================
  socket.on("update_container", async ({ container } = {}) => {
    try {
      const userId = socket.userId;
      if (!userId) return;

      if (!userCacheReady(userId)) await loadUserIntoCache(userId);
      const uc = ensureUserCache(userId);

      const id = container?.id;
      if (!id) return;

      const prev = uc.containersById[id] || { id, label: "Untitled", items: [] };

      const next = {
        id,
        label: container.label ?? prev.label ?? "Untitled",
        items: Array.isArray(container.items) ? container.items : prev.items ?? [],
      };

      uc.containersById[id] = next;

      await Container.findOneAndUpdate({ id, userId }, { ...next, userId }, { upsert: true });

      socket.to(userRoom(userId)).emit("container_updated", { container: next });
    } catch (err) {
      console.error("update_container error:", err);
      socket.emit("server_error", "Failed to update container");
    }
  });

  // ======================================================
  // INSTANCE UPDATE — UPSERT
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

      socket.to(userRoom(userId)).emit("instance_updated", { instance: next });
    } catch (err) {
      console.error("update_instance error:", err);
      socket.emit("server_error", "Failed to update instance");
    }
  });

  // ======================================================
  // INSTANCE DELETE — cascade:
  // - delete instance
  // - pull instanceId out of ALL containers.items
  // - emit instance_deleted + container_items_updated for affected containers
  // ======================================================
  socket.on("delete_instance", async ({ instanceId } = {}) => {
    try {
      const userId = socket.userId;
      if (!userId) return;
      if (!instanceId) return;

      if (!userCacheReady(userId)) await loadUserIntoCache(userId);
      const uc = ensureUserCache(userId);

      if (uc.instancesById?.[instanceId]) delete uc.instancesById[instanceId];
      await Instance.findOneAndDelete({ id: instanceId, userId });

      const affectedContainers = [];
      for (const c of Object.values(uc.containersById || {})) {
        if (!Array.isArray(c.items)) continue;
        if (!c.items.includes(instanceId)) continue;

        const nextItems = c.items.filter((iid) => iid !== instanceId);
        c.items = nextItems;
        affectedContainers.push({ containerId: c.id, items: nextItems });
      }

      await Container.updateMany({ userId, items: instanceId }, { $pull: { items: instanceId } });

      for (const { containerId, items } of affectedContainers) {
        socket.to(userRoom(userId)).emit("container_items_updated", { containerId, items });
      }

      socket.to(userRoom(userId)).emit("instance_deleted", { instanceId });
    } catch (err) {
      console.error("delete_instance error:", err);
      socket.emit("server_error", "Failed to delete instance");
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

      socket.to(userRoom(userId)).emit("panel_updated", next);
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

      socket.to(userRoom(userId)).emit("panel_created", next);
    } catch (err) {
      console.error("add_panel error:", err);
      socket.emit("server_error", "Failed to add panel");
    }
  });

  // ======================================================
  // PANEL DELETE (userId ONLY - gridId ignored)
  // ======================================================
  socket.on("delete_panel", async ({ panelId } = {}) => {
    try {
      const userId = socket.userId;
      if (!userId) return;
      if (!panelId) return;

      if (!userCacheReady(userId)) await loadUserIntoCache(userId);
      const uc = ensureUserCache(userId);

      if (uc.panelsById?.[panelId]) delete uc.panelsById[panelId];
      await Panel.findOneAndDelete({ id: panelId, userId });

      socket.to(userRoom(userId)).emit("panel_deleted", { panelId });
    } catch (err) {
      console.error("delete_panel error:", err);
      socket.emit("server_error", "Failed to delete panel");
    }
  });

  // ======================================================
  // CONTAINER DELETE — removes container + pulls from ALL panels.containers
  // ======================================================
  socket.on("delete_container", async ({ containerId } = {}) => {
    try {
      const userId = socket.userId;
      if (!userId) return;
      if (!containerId) return;

      if (!userCacheReady(userId)) await loadUserIntoCache(userId);
      const uc = ensureUserCache(userId);

      if (uc.containersById?.[containerId]) delete uc.containersById[containerId];
      await Container.findOneAndDelete({ id: containerId, userId });

      const affectedPanels = [];

      for (const p of Object.values(uc.panelsById || {})) {
        if (!Array.isArray(p.containers)) continue;
        if (!p.containers.includes(containerId)) continue;

        const next = { ...p, containers: p.containers.filter((cid) => cid !== containerId) };
        uc.panelsById[next.id] = next;
        affectedPanels.push(next);
      }

      await Panel.updateMany({ userId, containers: containerId }, { $pull: { containers: containerId } });

      for (const panel of affectedPanels) {
        socket.to(userRoom(userId)).emit("panel_updated", panel);
      }

      socket.to(userRoom(userId)).emit("container_deleted", { containerId });
    } catch (err) {
      console.error("delete_container error:", err);
      socket.emit("server_error", "Failed to delete container");
    }
  });

  // ======================================================
  // GRID UPDATE (grid is gridId + userId) — UPSERT
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

      uc.gridsById[gridId] = { ...uc.gridsById[gridId], ...updatePatch };

      await Grid.findOneAndUpdate({ _id: gridId, userId }, updatePatch, { upsert: true });

      socket.to(userRoom(userId)).emit("grid_updated", { gridId, grid: updatePatch });
    } catch (err) {
      console.error("update_grid error:", err);
      socket.emit("server_error", "Failed to update grid");
    }
  });

  // ======================================================
  // GRID DELETE (grid is gridId + userId)
  // ======================================================
  socket.on("delete_grid", async ({ gridId } = {}) => {
    try {
      const userId = socket.userId;
      if (!userId) return;
      if (!gridId) return;

      if (!userCacheReady(userId)) await loadUserIntoCache(userId);
      const uc = ensureUserCache(userId);

      await Grid.findOneAndDelete({ _id: gridId, userId });
      if (uc.gridsById?.[gridId]) delete uc.gridsById[gridId];

      if (socket.data.activeGridId === gridId) {
        const remaining = Object.keys(uc.gridsById);

        let nextId = null;
        if (remaining.length) {
          nextId = remaining[0];
        } else {
          const newGrid = await Grid.create({
            rows: 2,
            cols: 3,
            rowSizes: [],
            colSizes: [],
            userId,
            name: "",
          });

          nextId = newGrid._id.toString();
          uc.gridsById[nextId] = newGrid.toObject();
        }

        socket.leave(gridRoom(userId, gridId));
        socket.join(gridRoom(userId, nextId));
        socket.data.activeGridId = nextId;

        const grids = await getAllGridsForUser(userId);
        const safeGrid = uc.gridsById[nextId];

        socket.emit("full_state", {
          gridId: nextId,
          grid: safeGrid,
          panels: Object.values(uc.panelsById),
          containers: Object.values(uc.containersById),
          instances: Object.values(uc.instancesById),
          grids,
        });
      }

      socket.to(userRoom(userId)).emit("grid_deleted", { gridId });
    } catch (err) {
      console.error("delete_grid error:", err);
      socket.emit("server_error", "Failed to delete grid");
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
