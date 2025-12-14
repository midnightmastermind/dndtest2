// state/masterReducer.js
// =========================================
// masterReducer.js — UPDATED to match new ActionTypes
// Aligned with:
// - state/actions.js (single ActionTypes object)
// - bindSocketToStore.js (once you swap dispatch types)
// - server.js events
//
// Notes:
// - FULL_STATE stays the same.
// - Removed legacy HYDRATE + PATCH_* + ADD_* cases.
// - Added CREATE/UPDATE/DELETE for grid/panel/container/instance.
// - Kept list-based container/items + instances store behavior.
// =========================================

import { ActionTypes } from "./actions";

export function masterReducer(state, action) {
    switch (action.type) {
        // ======================================================
        // FULL STATE HYDRATE
        // ======================================================
        case ActionTypes.FULL_STATE: {
            const {
                gridId = null,
                grid = null,
                panels = [],
                grids: availableGrids = [],

                // server sends these (user-scoped)
                containers = [],
                instances = [],
            } = action.payload || {};

            return {
                ...state,
                gridId: gridId ?? state.gridId,
                grid,
                panels: panels || [],
                availableGrids: availableGrids || [],
                containers: containers || [],
                instances: instances || [],
                hydrated: true,
            };
        }

        // ======================================================
        // AUTH / SELECTION
        // ======================================================
        case ActionTypes.SET_GRID_ID: {
            // bindSocketToStore currently passes payload: payload.gridId (string)
            // actions.js creator passes { gridId }
            const gridId = typeof action.payload === "string" ? action.payload : action.payload?.gridId;
            return { ...state, gridId: gridId ?? state.gridId };
        }

        case ActionTypes.SET_USER_ID: {
            // allow either shape
            const userId = typeof action.payload === "string" ? action.payload : action.payload?.userId;
            return { ...state, userId: userId ?? state.userId };
        }
        case ActionTypes.LOGOUT: {
            return {
                ...state,
                userId: null,
                gridId: null,
                grid: null,
                panels: [],
                availableGrids: [],
                containers: [],
                instances: [],
                hydrated: false,
            };
        }
        // ======================================================
        // GRIDS
        // ======================================================
        case ActionTypes.SET_AVAILABLE_GRIDS: {
            const availableGrids =
                action.payload?.availableGrids ??
                action.payload?.grids ??
                [];
            return { ...state, availableGrids };
        }

        case ActionTypes.SET_GRID: {
            const grid = action.payload?.grid ?? null;
            return { ...state, grid };
        }

        case ActionTypes.CREATE_GRID: {
            const grid = action.payload?.grid;
            if (!grid) return state;

            // if it includes an id, optionally set it
            const nextGridId = grid._id?.toString?.() || grid.id || state.gridId;

            // ensure available grids list includes it if you track that here
            // (server currently provides grids list on FULL_STATE, so this is optional)
            return {
                ...state,
                gridId: nextGridId,
                grid,
            };
        }

        case ActionTypes.UPDATE_GRID: {
            const gridId =
                action.payload?.gridId ||
                action.payload?.grid?._id ||
                action.payload?.grid?.id ||
                state.gridId;

            const patch =
                action.payload?.grid ?? action.payload?.gridPatch ?? action.payload ?? null;

            if (!patch) return state;

            const nextGrid = { ...(state.grid || {}), ...patch };

            const nextAvailable = (state.availableGrids || []).map((g) =>
                g.id === gridId
                    ? { ...g, name: patch.name ?? g.name }
                    : g
            );

            return {
                ...state,
                grid: nextGrid,
                availableGrids: nextAvailable,
            };
        }


        case ActionTypes.DELETE_GRID: {
            // minimal: if deleting current grid, clear
            const gridId = action.payload?.gridId ?? action.payload;
            if (!gridId) return state;

            if (state.gridId !== gridId) return state;

            return {
                ...state,
                gridId: null,
                grid: null,
                panels: [],
                // containers/instances are user-scoped in your server,
                // so we DO NOT wipe them on grid delete unless you change that model.
            };
        }

        // ======================================================
        // PANELS
        // ======================================================
        case ActionTypes.SET_PANELS: {
            const panels = action.payload?.panels ?? [];
            return { ...state, panels };
        }

        case ActionTypes.CREATE_PANEL:
        case ActionTypes.UPDATE_PANEL: {
            // bindSocketToStore should dispatch payload: { panel }
            const panel = action.payload?.panel ?? action.payload;
            if (!panel?.id) return state;

            const exists = (state.panels || []).some((p) => p.id === panel.id);

            return {
                ...state,
                panels: exists
                    ? state.panels.map((p) => (p.id === panel.id ? panel : p))
                    : [...(state.panels || []), panel],
            };
        }

        case ActionTypes.DELETE_PANEL: {
            const panelId = action.payload?.panelId ?? action.payload;
            if (!panelId) return state;

            return {
                ...state,
                panels: (state.panels || []).filter((p) => p.id !== panelId),
            };
        }

        // ======================================================
        // CONTAINERS
        // ======================================================
        case ActionTypes.SET_CONTAINERS: {
            const containers = action.payload?.containers ?? [];
            return { ...state, containers };
        }

        case ActionTypes.CREATE_CONTAINER: {
            // bindSocketToStore should dispatch payload: { container }
            const container = action.payload?.container ?? action.payload;
            const id = container?.id;
            if (!id) return state;

            const exists = (state.containers || []).some((c) => c.id === id);
            if (exists) return state;

            return {
                ...state,
                containers: [
                    ...(state.containers || []),
                    {
                        id,
                        label: container.label ?? "Untitled",
                        items: Array.isArray(container.items) ? container.items : [],
                    },
                ],
            };
        }

        case ActionTypes.UPDATE_CONTAINER: {
            // generic container update (label/items/etc)
            const container = action.payload?.container ?? action.payload;
            if (!container?.id) return state;

            return {
                ...state,
                containers: (state.containers || []).map((c) =>
                    c.id === container.id ? { ...c, ...container } : c
                ),
            };
        }

        case ActionTypes.UPDATE_CONTAINER_ITEMS: {
            // bindSocketToStore dispatches { containerId, items }
            const containerId = action.payload?.containerId;
            const items = action.payload?.items;
            if (!containerId || !Array.isArray(items)) return state;

            return {
                ...state,
                containers: (state.containers || []).map((c) =>
                    c.id === containerId ? { ...c, items: [...items] } : c
                ),
            };
        }

        case ActionTypes.DELETE_CONTAINER: {
            const containerId = action.payload?.containerId ?? action.payload;
            if (!containerId) return state;

            return {
                ...state,
                containers: (state.containers || []).filter((c) => c.id !== containerId),
            };
        }

        // ======================================================
        // INSTANCES
        // ======================================================
        case ActionTypes.SET_INSTANCES: {
            const instances = action.payload?.instances ?? [];
            return { ...state, instances };
        }

        case ActionTypes.CREATE_INSTANCE_IN_CONTAINER: {
            // payload: { containerId, instance }
            const { containerId, instance } = action.payload || {};
            if (!containerId || !instance?.id) return state;

            const instanceExists = (state.instances || []).some((i) => i.id === instance.id);
            const nextInstances = instanceExists ? state.instances : [...(state.instances || []), instance];

            return {
                ...state,
                instances: nextInstances,
                containers: (state.containers || []).map((c) => {
                    if (c.id !== containerId) return c;
                    if ((c.items || []).includes(instance.id)) return c;
                    return { ...c, items: [...(c.items || []), instance.id] };
                }),
            };
        }

        case ActionTypes.CREATE_INSTANCE: {
            // generic create instance (not tied to container)
            const instance = action.payload?.instance ?? action.payload;
            if (!instance?.id) return state;

            const exists = (state.instances || []).some((i) => i.id === instance.id);
            if (exists) return state;

            return { ...state, instances: [...(state.instances || []), instance] };
        }

        case ActionTypes.UPDATE_INSTANCE: {
            // bindSocketToStore dispatches payload: { instance }
            const instance = action.payload?.instance ?? action.payload;
            if (!instance?.id) return state;

            const exists = (state.instances || []).some((i) => i.id === instance.id);

            return {
                ...state,
                instances: exists
                    ? state.instances.map((i) => (i.id === instance.id ? { ...i, ...instance } : i))
                    : [...(state.instances || []), instance],
            };
        }

        case ActionTypes.DELETE_INSTANCE: {
            const instanceId = action.payload?.instanceId ?? action.payload;
            if (!instanceId) return state;

            return {
                ...state,
                instances: (state.instances || []).filter((i) => i.id !== instanceId),
                containers: (state.containers || []).map((c) => ({
                    ...c,
                    items: (c.items || []).filter((id) => id !== instanceId),
                })),
            };
        }

        // ======================================================
        // DND / UI DEBUG
        // ======================================================
        case ActionTypes.SET_ACTIVE_ID:
            return { ...state, activeId: action.payload?.activeId };

        case ActionTypes.SET_ACTIVE_SIZE:
            return { ...state, activeSize: action.payload?.activeSize };

        case ActionTypes.SET_DEBUG_EVENT:
            return { ...state, debugEvent: action.payload?.debugEvent };

        case ActionTypes.SOFT_TICK:
            return { ...state, softTick: (state.softTick || 0) + 1 };

        // ======================================================
        default:
            return state;
    }
}
