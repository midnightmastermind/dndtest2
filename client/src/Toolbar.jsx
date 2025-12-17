export default function Toolbar({
  gridId,
  availableGrids,

  gridName,
  setGridName,
  rowInput,
  setRowInput,
  colInput,
  setColInput,

  onGridChange,
  onCreateNewGrid,
  onCommitGridName,
  onUpdateRows,
  onUpdateCols,
  onAddPanel,
}) {
  const inputBaseStyle = {
    background: "#0b0f14",
    color: "white",
    border: "1px solid #222",
    borderRadius: 4,
    padding: "4px 8px",
    fontSize: 12,
    fontFamily: "monospace",
    height: 14,
    outline: "none",
  };

  const buttonStyle = {
    background: "#161b22",
    color: "white",
    border: "1px solid #222",
    borderRadius: 4,
    padding: "4px 10px",
    fontSize: 12,
    fontFamily: "monospace",
    cursor: "pointer",
  };

  const labelStyle = { color: "#9aa4b2", fontSize: 11 };
  return (
    <div
      style={{
        position: "relative",
        zIndex: 998,
        flex: 1,
        background: "#0e1116",
        borderBottom: "1px solid #222",
        padding: "1px 5px",
        fontSize: 12,
        fontFamily: "monospace",
        color: "#9aa4b2",
        display: "flex",
        width: "100%"
      }}
      className="toolbar"
    >
      <div
        style={{
          display: "flex",
          alignItems: "end",
          width: "100%",
          maxWidth: "700px",
          margin: "0 auto",
          justifyContent: "space-between"
        }}
      >

        {/* Grid select + New Grid */}
        <div style={{ display: "flex", alignItems: "end", gap: 4 }}>
  <button type="button" style={buttonStyle} onClick={onCreateNewGrid}>
            + Grid
          </button>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label htmlFor="grid_select" style={labelStyle}>
              Grid
            </label>
            <select
              id="grid_select"
              value={gridId || ""}
              onChange={onGridChange}
              style={{
                ...inputBaseStyle,
                padding: "4px 8px",
                width: 70,
                height: "100%"
              }}
            >
              {(availableGrids || []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name || `Grid ${String(g.id).slice(-4)}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid name + rows/cols */}
        <div style={{ display: "flex", flex: 1, alignItems: "end", justifyContent: "start"}}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label htmlFor="grid_name" style={labelStyle}>
              Grid Name
            </label>
            <input
              id="grid_name"
              value={gridName|| `Grid ${String(gridId).slice(-4)}`}
              onChange={(e) => setGridName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onCommitGridName?.();
                  e.currentTarget.blur();
                }
              }}
              type="text"
              style={{
                ...inputBaseStyle,
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column"}}>
            <label htmlFor="grid_row" style={labelStyle}>
              Rows
            </label>
            <input
              id="grid_row"
              type="number"
              value={rowInput}
              onChange={(e) => {
                const val = e.target.value;
                setRowInput(val);
                if (val === "") return;
                onUpdateRows?.(val);
              }}
              onBlur={() => {
                if (rowInput === "") {
                  setRowInput("1");
                  onUpdateRows?.("1");
                }
              }}
              style={inputBaseStyle}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <label htmlFor="grid_col" style={labelStyle}>
              Cols
            </label>
            <input
              id="grid_col"
              type="number"
              value={colInput}
              onChange={(e) => {
                const val = e.target.value;
                setColInput(val);
                if (val === "") return;
                onUpdateCols?.(val);
              }}
              onBlur={() => {
                if (colInput === "") {
                  setColInput("1");
                  onUpdateCols?.("1");
                }
              }}
              style={inputBaseStyle}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 10 }}>
          <button type="button" style={buttonStyle} onClick={onAddPanel}>
            + Panel
          </button>
        </div>
      </div>
    </div>
  );
}