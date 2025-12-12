import React, { useContext, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { GridDataContext } from "./GridDataContext";
import { GridActionsContext } from "./GridActionsContext";
import SortableContainer from "./SortableContainer";
import Instance from "./Instance";

function GridInner() {
  const { containersRender, instances, activeId, activeSize } =
    useContext(GridDataContext);

  const {
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    useRenderCount,
  } = useContext(GridActionsContext);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const containerIds = useMemo(
    () => containersRender.map((c) => c.id),
    [containersRender]
  );

  const activeInstance = useMemo(() => {
    if (!activeId) return null;
    return instances.find((x) => x.id === activeId) || null;
  }, [activeId, instances]);

  useRenderCount("Grid");

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="containers-col">
        <SortableContext items={containerIds} strategy={rectSortingStrategy}>
          {containersRender.map((c) => (
            <SortableContainer key={c.id} container={c} />
          ))}
        </SortableContext>
      </div>

      <DragOverlay adjustScale={false}>
        {activeId ? (
          <div style={{ width: activeSize?.width, height: activeSize?.height }}>
            <Instance
              id={`overlay-${activeId}`}
              label={activeInstance?.label ?? "Dragging"}
              overlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default React.memo(GridInner);
