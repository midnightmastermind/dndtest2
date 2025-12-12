// state/masterReducer.js
import { ActionTypes } from "./actions";

export function masterReducer(state, action) {
  switch (action.type) {
    case ActionTypes.ADD_CONTAINER: {
      const { id, label } = action.payload;
      return {
        ...state,
        containers: [...state.containers, { id, label, items: [] }],
      };
    }

    case ActionTypes.ADD_INSTANCE_TO_CONTAINER: {
      const { containerId, instance } = action.payload;

      return {
        ...state,
        instances: [...state.instances, instance],
        containers: state.containers.map((c) =>
          c.id === containerId ? { ...c, items: [...c.items, instance.id] } : c
        ),
      };
    }

    case ActionTypes.SET_ACTIVE_ID: {
      return { ...state, activeId: action.payload.activeId };
    }

    case ActionTypes.SET_ACTIVE_SIZE: {
      return { ...state, activeSize: action.payload.activeSize };
    }

    case ActionTypes.SET_DEBUG_EVENT: {
      return { ...state, debugEvent: action.payload.debugEvent };
    }

    case ActionTypes.SET_CONTAINERS: {
      return { ...state, containers: action.payload.containers };
    }

    case ActionTypes.SOFT_TICK: {
      return { ...state, softTick: state.softTick + 1 };
    }

    default:
      return state;
  }
}
