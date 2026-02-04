// hooks/useOccurrenceData.js
// Hook to autofill occurrences with their target entities

import { useMemo } from "react";
import * as Selectors from "../state/selectors";

/**
 * Autofills panels with their container occurrences
 */
export function usePanelWithOccurrences(panel, state) {
  return useMemo(() => {
    if (!panel) return null;
    return Selectors.autofillPanel(panel, state);
  }, [panel, state.occurrences, state.containers, state.instances]);
}

/**
 * Autofills container with its instance occurrences
 */
export function useContainerWithOccurrences(container, state) {
  return useMemo(() => {
    if (!container) return null;
    return Selectors.autofillContainer(container, state);
  }, [container, state.occurrences, state.instances]);
}

/**
 * Gets all containers for a panel (autofilled with instances)
 */
export function usePanelContainers(panelId, state) {
  return useMemo(() => {
    return Selectors.getPanelContainers(state, panelId);
  }, [panelId, state.panels, state.occurrences, state.containers, state.instances]);
}

/**
 * Gets all instances for a container
 */
export function useContainerInstances(containerId, state) {
  return useMemo(() => {
    return Selectors.getContainerInstances(state, containerId);
  }, [containerId, state.occurrences, state.instances]);
}

/**
 * Creates lookup maps from occurrences
 */
export function useOccurrenceLookups(state) {
  return useMemo(() => {
    const occurrencesById = {};
    const instancesByContainer = {};
    const containersByPanel = {};

    (state.occurrences || []).forEach(occ => {
      occurrencesById[occ.id] = occ;

      if (occ.targetType === "instance" && occ.meta?.containerId) {
        if (!instancesByContainer[occ.meta.containerId]) {
          instancesByContainer[occ.meta.containerId] = [];
        }
        instancesByContainer[occ.meta.containerId].push(occ);
      }

      if (occ.targetType === "container" && occ.meta?.panelId) {
        if (!containersByPanel[occ.meta.panelId]) {
          containersByPanel[occ.meta.panelId] = [];
        }
        containersByPanel[occ.meta.panelId].push(occ);
      }
    });

    return { occurrencesById, instancesByContainer, containersByPanel };
  }, [state.occurrences]);
}
