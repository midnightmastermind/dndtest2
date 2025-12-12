// state/useBoardState.js
import { useReducer } from "react";
import { masterReducer } from "./masterReducer";
import { initialState } from "./initialState";

export function useBoardState() {
  const [state, dispatch] = useReducer(masterReducer, initialState);
  return { state, dispatch };
}
