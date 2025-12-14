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
        outline: "none",
        marginBottom: 1,
        flex: 1,
        maxWidth: 90
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
        height: 25,
        alignSelf: "end",
        marginBottom: 1
    };

    const labelStyle = { color: "#9aa4b2", fontSize: 11 };
    console.log(gridName);
    console.log(gridId);
    console.log(availableGrids);
    return (
        <div
            style={{
                position: "sticky",
                top: 0,
                zIndex: 998,
                background: "#0e1116",
                borderBottom: "1px solid #222",
                padding: "1px 10px",
                fontSize: 12,
                fontFamily: "monospace",
                color: "#9aa4b2",
                display: "flex",
                alignItems: "center",
                width: "100vw",
                maxWidth: "500px",
                margin: "0 auto",
                display: "flex",
                gap: 8,
                alignItems: "start"
            }}
            className="toolbar"
        >
            {/* Grid select + New Grid */}
            <div style={{ display: "flex", flex: 1, gap: 8 }}>
                <button type="button" style={buttonStyle} onClick={onCreateNewGrid}>
                    New Grid
                </button>
                <div style={{ display: "flex", flexDirection: "column"}}>
                    <label htmlFor="grid_select" style={labelStyle}>
                        Grid
                    </label>
                    <select
                        id="grid_select"
                        value={gridId || ""}
                        onChange={onGridChange}
                        style={{
                            ...inputBaseStyle,
                            padding: "4px 8px"
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
            <div style={{ display: "flex", flex: 1, gap: 8, alignItems: "end" }}>
                <div style={{ display: "flex", flexDirection: "column", maxWidth: 130}}>
                    <label htmlFor="grid_name" style={labelStyle}>
                        Grid Name
                    </label>
                    <input
                        id="grid_name"
                        value={gridName || `Grid ${String(gridId).slice(-4)}`}
                        onChange={(e) => setGridName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                onCommitGridName();
                                e.currentTarget.blur();
                            }
                        }}
                        style={{
                            ...inputBaseStyle                        }}
                    />
                </div>

                <div style={{ display: "flex", flexDirection: "column", maxWidth: 50 }}>
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

                <div style={{ display: "flex", flexDirection: "column", maxWidth: 50 }}>
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
            <div style={{ display: "flex", flex: 1, alignSelf: "end", justifyContent: "end", maxWidth: 82}}>
                <button type="button" style={buttonStyle} onClick={onAddPanel}>
                    Add Panel
                </button>
            </div>
        </div>
    );
}