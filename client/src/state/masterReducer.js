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
                occurrences = [],
                fields = [],
            } = action.payload || {};

            return {
                ...state,
                gridId: gridId ?? state.gridId,
                grid,
                panels: panels || [],
                availableGrids: availableGrids || [],
                containers: containers || [],
                instances: instances || [],
                occurrences: occurrences || [],
                fields: fields || [],
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
                occurrences: [],
                fields: [],
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
            const { gridId, grid } = action.payload || {};
            if (!gridId || !grid) return state;

            // only apply patch to the currently active grid
            const activeId = state.gridId || state.grid?._id;
            if (activeId && gridId !== activeId) {
                // still update dropdown list name if present
                const nextAvailable = (state.availableGrids || []).map((g) =>
                    (g.id || g._id) === gridId ? { ...g, ...grid } : g
                );
                return { ...state, availableGrids: nextAvailable };
            }

            // merge patch into grid
            const nextGrid = { ...(state.grid || {}), ...grid };

            // also keep dropdown list in sync
            const nextAvailable = (state.availableGrids || []).map((g) =>
                (g.id || g._id) === gridId ? { ...g, ...grid } : g
            );

            return { ...state, grid: nextGrid, availableGrids: nextAvailable };
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
                    ? state.panels.map((p) => (p.id === panel.id ? { ...p, ...panel } : p))
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
                        occurrences: Array.isArray(container.occurrences) ? container.occurrences : [],
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
            // Note: "items" is backward compat - actually contains occurrence IDs
            const containerId = action.payload?.containerId;
            const items = action.payload?.items; // Actually occurrence IDs
            if (!containerId || !Array.isArray(items)) return state;

            return {
                ...state,
                containers: (state.containers || []).map((c) =>
                    c.id === containerId ? { ...c, occurrences: [...items] } : c
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
            // Note: With occurrences, this only creates the instance entity
            // Container occurrence management happens separately via occurrence actions
            const { instance } = action.payload || {};
            if (!instance?.id) return state;

            const instanceExists = (state.instances || []).some((i) => i.id === instance.id);
            const nextInstances = instanceExists ? state.instances : [...(state.instances || []), instance];

            return {
                ...state,
                instances: nextInstances,
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

            // Note: With occurrences, the server handles deleting occurrences
            // and updating containers. We just delete the instance entity here.
            return {
                ...state,
                instances: (state.instances || []).filter((i) => i.id !== instanceId),
            };
        }

        // ======================================================
        // OCCURRENCES
        // ======================================================
        case ActionTypes.SET_OCCURRENCES: {
            const occurrences = action.payload?.occurrences ?? [];
            return { ...state, occurrences };
        }

        case ActionTypes.CREATE_OCCURRENCE:
        case ActionTypes.UPDATE_OCCURRENCE: {
            const occurrence = action.payload?.occurrence ?? action.payload;
            if (!occurrence?.id) return state;

            const exists = (state.occurrences || []).some((o) => o.id === occurrence.id);

            return {
                ...state,
                occurrences: exists
                    ? state.occurrences.map((o) => (o.id === occurrence.id ? { ...o, ...occurrence } : o))
                    : [...(state.occurrences || []), occurrence],
            };
        }

        case ActionTypes.DELETE_OCCURRENCE: {
            const occurrenceId = action.payload?.occurrenceId ?? action.payload;
            if (!occurrenceId) return state;

            return {
                ...state,
                occurrences: (state.occurrences || []).filter((o) => o.id !== occurrenceId),
            };
        }

        // ======================================================
        // FIELDS
        // ======================================================
        case ActionTypes.SET_FIELDS: {
            const fields = action.payload?.fields ?? [];
            return { ...state, fields };
        }

        case ActionTypes.CREATE_FIELD:
        case ActionTypes.UPDATE_FIELD: {
            const field = action.payload?.field ?? action.payload;
            if (!field?.id) return state;

            const exists = (state.fields || []).some((f) => f.id === field.id);

            return {
                ...state,
                fields: exists
                    ? state.fields.map((f) => (f.id === field.id ? { ...f, ...field } : f))
                    : [...(state.fields || []), field],
            };
        }

        case ActionTypes.DELETE_FIELD: {
            const fieldId = action.payload?.fieldId ?? action.payload;
            if (!fieldId) return state;

            return {
                ...state,
                fields: (state.fields || []).filter((f) => f.id !== fieldId),
            };
        }

        // ======================================================
        // DND
        // ======================================================
        case ActionTypes.SET_ACTIVE_ID:
            return { ...state, activeId: action.payload?.activeId };

        case ActionTypes.SET_ACTIVE_SIZE:
            return { ...state, activeSize: action.payload?.activeSize };


        case ActionTypes.SOFT_TICK:
            return { ...state, softTick: (state.softTick || 0) + 1 };

        // ======================================================
        default:
            return state;
    }
}
