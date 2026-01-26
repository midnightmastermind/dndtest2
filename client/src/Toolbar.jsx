import React, { useMemo } from "react";
import FormInput from "./ui/FormInput";
import ButtonPopover from "./ui/ButtonPopover";
import GridLayoutForm from "./ui/GridLayoutForm";

import { Button } from "./components/ui/button"
import { Settings, Maximize, Minimize, PlusSquare, GripVertical } from "lucide-react";

export default function Toolbar({
  gridId,
  availableGrids,

  gridName,
  setGridName,
  rowInput,
  setRowInput,
  colInput,
  setColInput,
  onDeleteGrid,
  onGridChange,
  onCreateNewGrid,
  onCommitGridName,
  onUpdateRows,
  onUpdateCols,
  onAddPanel,
}) {
const gridOptions = useMemo(
  () =>
    (availableGrids || []).map((g) => {
      const id = g.id || g._id;
      const name = g.name || g.gridName || "";
      return {
        value: id,
        label: name || `Grid ${String(id).slice(-4)}`,
      };
    }),
  [availableGrids]
);

  const formValue = {
    gridName: gridName || `Grid ${String(gridId || "").slice(-4)}`,
    rows: rowInput,
    cols: colInput,
  };

  const onFormChange = (next) => {
    // name
    if (typeof next.gridName === "string") setGridName(next.gridName);

    // rows (keep your “empty allowed while typing” behavior)
    if (next.rows !== undefined) {
      const val = String(next.rows);
      setRowInput(val);
      if (val !== "") onUpdateRows?.(val);
    }

    // cols
    if (next.cols !== undefined) {
      const val = String(next.cols);
      setColInput(val);
      if (val !== "") onUpdateCols?.(val);
    }
  };

  return (
    <div
      className="toolbar shadow-md"
      style={{
        position: "relative",
        zIndex: 998,
        flex: 1,
        backgroundColor: "#041225f1",
        borderBottom: "3px solid rgb(143, 150, 158)",
        padding: "1px 5px",
        fontSize: 12,
        fontFamily: "monospace",
        display: "flex",
        width: "100%",
        marginBottom: "2px"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "end",
          width: "100%",
          margin: "0 auto",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        {/* Left: + Grid + Grid Select */}
        <div style={{ display: "flex", alignItems: "end", gap: 6 }}>
          <div className="site-name text-white bg-black pl-5 pr-5 opacity-75">+Moduli+</div>
          <ButtonPopover
            label={<Settings className="h-4 w-4" />}
            align="start"
            side="bottom"
            className="w-[340px]"
          >
            <GridLayoutForm
              value={formValue}
              onChange={onFormChange}
  onCommitGridName={(name) => onCommitGridName?.(name)}
              onDeleteGrid={onDeleteGrid}
              gridId={gridId}
            />
          </ButtonPopover>


          <div style={{ minWidth: 130 }}>
            <FormInput
              schema={{
                type: "select",
                className: "flex content-end grid-select",
                key: "gridId",
                label: "",
                options: gridOptions,
                placeholder: "Select grid…",
              }}
              value={{ gridId: gridId || "" }}
              onChange={(next) => {
                const val = next?.gridId ?? "";
                onGridChange?.({ target: { value: val } });
              }}
            />
          </div>
          <Button
            size="sm"
            onClick={() => onAddPanel?.()}
          >

            <PlusSquare className="h-4 w-4 pr-[2px]" />Panel
          </Button>
        </div>

        {/* Right: + Grid */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Button
            size="sm"
            onClick={() => onCreateNewGrid?.()}
          >

            <PlusSquare className="h-4 w-4 pr-[2px]" />Grid
          </Button>
        </div>
      </div>
    </div>
  );
}



