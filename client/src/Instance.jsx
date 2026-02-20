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

import { Link2, Unlink, Settings, Copy, Move } from "lucide-react";
import * as CommitHelpers from "./helpers/CommitHelpers";
import { useDragContext } from "./helpers/dragSystem";
import { resolveInstanceStyle, styleToCSS } from "./helpers/StyleHelpers";

function InstanceInner({
  id,
  label,
  instance,
  occurrence,
  panel,
  container,
  overlay = false,
  dragAttributes,
  dragListeners,
  onDoubleClick,

  dispatch,
  socket,
}) {
  const { state } = useContext(GridDataContext);
  const { fieldsById, addInstanceToContainer, occurrencesById, instancesById } = useContext(GridActionsContext);
  const isOriginalActive = !overlay && state?.activeId === id;

  // Get drag mode context - we use entity's defaultDragMode, not global
  const dragCtx = useDragContext();
  const { isDragging } = dragCtx;

  // Use entity's defaultDragMode (stored on the instance)
  const entityDragMode = instance?.defaultDragMode || "move";

  const [draft, setDraft] = useState(() => ({ label: label ?? "" }));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [linksPopoverOpen, setLinksPopoverOpen] = useState(false);

  // Find all sibling occurrences sharing the same linkedGroupId
  const linkedSiblings = useMemo(() => {
    if (!occurrence?.linkedGroupId || !occurrencesById) return [];
    return Object.values(occurrencesById).filter(
      o => o.linkedGroupId === occurrence.linkedGroupId && o.id !== occurrence.id
    );
  }, [occurrence?.linkedGroupId, occurrencesById]);

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

  // Resolved cascading style for this instance
  const resolvedInstanceCSS = useMemo(
    () => styleToCSS(resolveInstanceStyle(instance, container, panel)),
    [instance, container, panel]
  );

  // Build radial menu items - include Break Link when occurrence is linked
  const radialItems = useMemo(() => {
    if (!occurrence?.linkedGroupId) return null; // null = use default items
    return [
      {
        icon: Settings,
        label: "Settings",
        onClick: () => setSettingsOpen(true),
        color: "bg-slate-600 hover:bg-slate-500",
      },
      {
        icon: entityDragMode === "move" ? Copy : Move,
        label: entityDragMode === "move" ? "Set to Copy" : "Set to Move",
        onClick: toggleEntityDragMode,
        color: entityDragMode === "move" ? "bg-blue-600 hover:bg-blue-500" : "bg-slate-600 hover:bg-slate-500",
      },
      {
        icon: Unlink,
        label: "Break Link",
        onClick: () => socket?.emit("break_link", { occurrenceId: occurrence.id }),
        color: "bg-orange-600 hover:bg-orange-500",
      },
    ];
  }, [occurrence?.linkedGroupId, occurrence?.id, entityDragMode, toggleEntityDragMode, socket]);

  const hasLabel = !!label;
  const hasFields = instanceFields.length > 0;

  return (
    <div
      role="listitem"
      aria-label={label || "Untitled instance"}
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
        ...resolvedInstanceCSS,
      }}
      onDoubleClick={onDoubleClick}
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
              items={radialItems}
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
            occurrence={occurrence}
            dispatch={dispatch}
            socket={socket}
          />
        </PopoverContent>
      </Popover>
      {/* Right side: label | fields */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
          paddingLeft: 2,
          paddingRight: 8,
        }}
      >
        {hasLabel && (
          <div
            style={{
              // label flexes to fill remaining space
              flex: hasFields ? "1 1 0%" : "1 1 100%",
              minWidth: "55px",
              maxWidth: hasFields ? "50%" : "100%",
              fontSize: 12,
              color: "var(--muted-foreground)",
              overflowWrap: "anywhere",
            }}
          >
            {label}
            {occurrence?.linkedGroupId && (
              <Popover open={linksPopoverOpen} onOpenChange={setLinksPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setLinksPopoverOpen(prev => !prev); }}
                    className="inline-flex items-center ml-1 flex-shrink-0"
                    title={`Linked (${linkedSiblings.length} sibling${linkedSiblings.length !== 1 ? 's' : ''})`}
                  >
                    <Link2 className="w-3 h-3 text-blue-400 opacity-60 hover:opacity-100 transition-opacity" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" side="bottom" className="w-auto min-w-[160px] max-w-[240px] p-2">
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">
                    Linked Occurrences ({linkedSiblings.length})
                  </div>
                  {linkedSiblings.length === 0 ? (
                    <div className="text-xs text-muted-foreground/60 italic">No other linked copies</div>
                  ) : (
                    <ul className="space-y-1">
                      {linkedSiblings.map(sib => {
                        const sibInstance = instancesById?.[sib.targetId];
                        const sibLabel = sibInstance?.label || sib.targetId || "Unknown";
                        const sibContainerId = sib.meta?.containerId;
                        return (
                          <li key={sib.id} className="text-xs text-foreground/80 flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-muted/50">
                            <Link2 className="w-2.5 h-2.5 text-blue-400 flex-shrink-0" />
                            <span className="truncate">{sibLabel}</span>
                            {sibContainerId && (
                              <span className="text-muted-foreground/50 text-[10px] ml-auto flex-shrink-0">
                                {sibContainerId.slice(0, 6)}...
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}

        {hasFields && (
          <div
            className="instance-fields"
            style={{
              // fields stay on same row as long as possible
              flex: "0 1 auto",
              minWidth: 0,

              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              justifyContent: "flex-end",
              marginLeft: "auto", // pushes fields to the right when on same line
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
