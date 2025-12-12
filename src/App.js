// App.js
import React, { useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import Container from "./Container";
import Instance from "./Instance";

export default function App() {
  const [instanceContainer, setInstanceContainer] = useState("left");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  function handleDragEnd({ active, over }) {
    if (!over) return;
    // over.id will be "left" or "right"
    setInstanceContainer(over.id);
  }

  return (
    <div className="app-root">
      <div className="dnd-page">
        <h2 style={{ marginBottom: 16 }}>Basic dnd-kit Example</h2>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="containers-row">
            <Container id="left" label="Left">
              {instanceContainer === "left" && (
                <Instance id="item-1" label="Drag me" />
              )}
            </Container>

            <Container id="right" label="Right">
              {instanceContainer === "right" && (
                <Instance id="item-1" label="Drag me" />
              )}
            </Container>
          </div>
        </DndContext>
      </div>
    </div>
  );
}