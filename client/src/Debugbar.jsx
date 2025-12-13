export default function Debugbar({ containers, containersDraft, activeId, debugEvent }) {
  return (
    <div
      style={{
        display: "none",
        position: "relative",
        top: 0,
        zIndex: 999,
        background: "#0e1116",
        borderBottom: "1px solid #222",
        padding: "8px 12px",
        fontSize: 12,
        fontFamily: "monospace",
        color: "#9aa4b2",
        gap: 16,
        flexWrap: "wrap",
      }}
      className="debugbar"
    >
      <div>
        <strong>activeId:</strong>{" "}
        <span style={{ color: "#fff" }}>{activeId ?? "null"}</span>
      </div>

      <div>
        <strong>debugEvent:</strong>{" "}
        <span style={{ color: "#fff" }}>{debugEvent?.type ?? "null"}</span>
      </div>

      <div>
        <strong>containers (state):</strong> {containers.length}
      </div>

      <div>
        <strong>draftRef:</strong>{" "}
        <span style={{ color: containersDraft ? "#4caf50" : "#f44336" }}>
          {containersDraft ? "ACTIVE" : "null"}
        </span>
      </div>

      <details style={{ cursor: "pointer" }}>
        <summary>event</summary>
        <pre style={{ whiteSpace: "pre-wrap", maxWidth: 700 }}>
          {JSON.stringify(debugEvent, null, 2)}
        </pre>
      </details>

      <details style={{ cursor: "pointer" }}>
        <summary>state</summary>
        <pre style={{ whiteSpace: "pre-wrap", maxWidth: 700 }}>
          {JSON.stringify(containers, null, 2)}
        </pre>
      </details>

      <details style={{ cursor: "pointer" }}>
        <summary>draft</summary>
        <pre style={{ whiteSpace: "pre-wrap", maxWidth: 700 }}>
          {JSON.stringify(containersDraft, null, 2)}
        </pre>
      </details>
    </div>
  );
}