// InstanceInner.jsx
import React, { useContext, useEffect, useState, useCallback, useMemo } from "react";
import { GridDataContext } from "./GridDataContext";
import { GridActionsContext } from "./GridActionsContext";

import InstanceForm from "./ui/InstanceForm";
import FieldRenderer from "./ui/FieldRenderer";
import RadialMenu from "./ui/RadialMenu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import * as CommitHelpers from "./helpers/CommitHelpers";
import { useDragContext } from "./helpers/dragSystem";

function InstanceInner({
  id,
  label,
  instance,
  occurrence,
  overlay = false,
  dragAttributes,
  dragListeners,

  dispatch,
  socket,
}) {
  const { state } = useContext(GridDataContext);
  const { fieldsById, addInstanceToContainer } = useContext(GridActionsContext);
  const isOriginalActive = !overlay && state?.activeId === id;

  // Get drag mode context - we use entity's defaultDragMode, not global
  const dragCtx = useDragContext();
  const { isDragging } = dragCtx;

  // Use entity's defaultDragMode (stored on the instance)
  const entityDragMode = instance?.defaultDragMode || "move";

  const [draft, setDraft] = useState(() => ({ label: label ?? "" }));
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setDraft({ label: label ?? "" });
  }, [label, id]);

  const commitLabel = useCallback(() => {
    const next = (draft?.label ?? "").trim();
    // Allow empty labels

    CommitHelpers.updateInstance({
      dispatch,
      socket,
      instance: { id, label: next },
      emit: true
    });
  }, [draft?.label, id, dispatch, socket]);

  const deleteMe = useCallback(() => {
    CommitHelpers.deleteInstance({
      dispatch,
      socket,
      instanceId: id,
      emit: true
    });
  }, [id, dispatch, socket]);

  // Toggle this entity's drag mode (updates defaultDragMode on the instance)
  const toggleEntityDragMode = useCallback(() => {
    const newMode = entityDragMode === "move" ? "copy" : "move";
    CommitHelpers.updateInstance({
      dispatch,
      socket,
      instance: { id, defaultDragMode: newMode },
      emit: true
    });
  }, [id, entityDragMode, dispatch, socket]);

  // Get fields for this instance based on fieldBindings
  const instanceFields = useMemo(() => {
    if (!instance?.fieldBindings || !fieldsById) return [];

    return (instance.fieldBindings || [])
      .map(binding => {
        const field = fieldsById[binding.fieldId];
        if (!field) return null;
        return { field, binding };
      })
      .filter(Boolean)
      .sort((a, b) => (a.binding.order || 0) - (b.binding.order || 0));
  }, [instance?.fieldBindings, fieldsById]);

  // Context for derived field calculations (includes iteration info for target scaling)
  const fieldContext = useMemo(() => {
    // Get current iteration from grid
    const grid = state?.grid;
    const iterations = grid?.iterations || [];
    const selectedIterationId = grid?.selectedIterationId || "default";
    const currentIteration = iterations.find(i => i.id === selectedIterationId) || iterations[0];

    return {
      gridId: occurrence?.gridId,
      containerId: occurrence?.meta?.containerId,
      currentIteration: currentIteration?.timeFilter || "daily",
      iterationDate: currentIteration?.currentDate || new Date().toISOString(),
    };
  }, [occurrence?.gridId, occurrence?.meta?.containerId, state?.grid]);

  const hasLabel = !!label;
  const hasFields = instanceFields.length > 0;

  return (
    <div
      className={"font-mono dnd-instance" + (isOriginalActive ? " hidden" : "")}
      style={{
        touchAction: "manipulation",
        WebkitUserSelect: "none",
        userSelect: "none",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        position: "relative",
      }}
      {...(!overlay ? dragAttributes : {})}
      {...(!overlay ? dragListeners : {})}
    >
      {/* RadialMenu - positioned with center flush at left edge */}
      <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
        <PopoverTrigger asChild>
          <div style={{
            position: "relative",
            alignSelf: "stretch",
            display: "flex"
          }}>
            <RadialMenu
              dragMode={entityDragMode}
              onToggleDragMode={toggleEntityDragMode}
              onSettings={() => setSettingsOpen(true)}
              addLabel="Item"
              size="sm"
            />
          </div>
        </PopoverTrigger>
        <PopoverContent align="start" side="right" className="w-auto">
          <InstanceForm
            value={draft}
            onChange={setDraft}
            onCommitLabel={commitLabel}
            onDeleteInstance={deleteMe}
            instanceId={id}
            instance={instance}
            dispatch={dispatch}
            socket={socket}
          />
        </PopoverContent>
      </Popover>

      {/* Right side: label | fields */}
      <div style={{ flex: 1, display: "flex", flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0, paddingLeft: 2, paddingRight: 8 }}>
        {/* Label section - shrink to fit, max 50% */}
        {hasLabel && (
          <div style={{
            flexShrink: 1,
            flexGrow: hasFields ? 0 : 1,
            maxWidth: hasFields ? "50%" : "100%",
            minWidth: 0,
            fontSize: 12,
            color: "var(--muted-foreground)",
            display: "flex",
            flexWrap: "wrap",
            whiteSpace: "nowrap",
          }}>
            {label}
          </div>
        )}

        {/* Fields section - takes remaining space */}
        {hasFields && (
          <div
            className="instance-fields"
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              justifyContent: "flex-end",
            }}
          >
            {instanceFields.map(({ field, binding }) => (
              <FieldRenderer
                key={field.id}
                field={field}
                binding={binding}
                occurrence={occurrence}
                instance={instance}
                context={fieldContext}
                state={state}
                dispatch={dispatch}
                socket={socket}
                compact={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(InstanceInner);
