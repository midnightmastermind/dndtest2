import Textfield from "@atlaskit/textfield";
import Button from "@atlaskit/button";
import { Label } from "@atlaskit/form";

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
                gap: 16,
                flexWrap: "wrap",
                alignItems: "center",
            }}
            className="toolbar"
        >
            {/* Grid select + New Grid */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong style={{ color: "#fff" }}>Grid</strong>

                <select
                    value={gridId || ""}
                    onChange={onGridChange}
                    style={{
                        background: "#0b0f14",
                        color: "white",
                        border: "1px solid #222",
                        borderRadius: 4,
                        padding: "4px 8px",
                        fontSize: 12,
                        fontFamily: "monospace",
                    }}
                >
                    {(availableGrids || []).map((g) => (
                        <option key={g.id} value={g.id}>
                            {g.name || `Grid ${String(g.id).slice(-4)}`}
                        </option>
                    ))}
                </select>

                <Button appearance="default" onClick={onCreateNewGrid}>
                    New Grid
                </Button>
            </div>

            {/* Grid name + rows/cols */}
            <div style={{ display: "flex", alignItems: "end", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <Label htmlFor="grid_name" style={{ color: "#9aa4b2", fontSize: 11 }}>
                        Grid Name
                    </Label>
                    <Textfield
                        id="grid_name"
                        value={gridName ?? ""}
                        onChange={(e) => setGridName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                onCommitGridName?.();
                                e.currentTarget.blur();
                            }
                        }}
                        style={{
                            background: "#0b0f14",
                            color: "white",
                            border: "1px solid #222",
                            minWidth: 220,
                            fontFamily: "monospace",
                            height: 24
                        }}
                    />
                </div>

                <div style={{ display: "flex", flexDirection: "column", width: 72 }}>
                    <Label htmlFor="grid_row" style={{ color: "#9aa4b2", fontSize: 11 }}>
                        Rows
                    </Label>
                    <Textfield
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
                        style={{
                            background: "#0b0f14",
                            color: "white",
                            border: "1px solid #222",
                            fontFamily: "monospace",
                            height: 24

                        }}
                    />
                </div>

                <div style={{ display: "flex", flexDirection: "column", width: 72 }}>
                    <Label htmlFor="grid_col" style={{ color: "#9aa4b2", fontSize: 11 }}>
                        Cols
                    </Label>
                    <Textfield
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
                        style={{
                            background: "#0b0f14",
                            color: "white",
                            border: "1px solid #222",
                            fontFamily: "monospace",
                            height: 24

                        }}
                    />
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Button appearance="default" onClick={onAddPanel}>
                    Add Panel
                </Button>

            </div>
        </div>
    );
}