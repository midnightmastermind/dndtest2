// Container.jsx
import React from "react";
import { useDroppable } from "@dnd-kit/core";

export default function Container({ id, label, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const className = isOver
    ? "dnd-container dnd-container--over"
    : "dnd-container";

  return (
    <div ref={setNodeRef} className={className}>
      <div className="dnd-container__label">{label}</div>

      {children || (
        <div
          style={{
            fontSize: 12,
            opacity: 0.5,
            fontStyle: "italic",
          }}
        >
          Drop here
        </div>
      )}
    </div>
  );
}