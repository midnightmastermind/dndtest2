import React from "react";

export default function PanelClone({ panel }) {
  return (
    <div
      style={{
        width: 280,
        height: 180,
        background: "rgba(30,35,42,0.92)",
        border: "1px solid rgba(255,255,255,0.25)",
        borderRadius: 10,
        color: "white",
        padding: 10,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Panel</div>
      <div style={{ opacity: 0.8, fontSize: 12 }}>id: {panel?.id}</div>
    </div>
  );
}
