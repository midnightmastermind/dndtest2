import React, { useMemo } from "react";
import FormInput from "./ui/FormInput";
import ButtonPopover from "./ui/ButtonPopover";
import GridLayoutForm from "./ui/GridLayoutForm";
import IterationNav from "./ui/IterationNav";

import { Button } from "./components/ui/button"
import { Settings, PlusSquare } from "lucide-react";

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
  onCommitIterations,
  iterations,
  // Iteration nav props
  selectedIterationId,
  onSelectIteration,
  currentIterationValue,
  onIterationValueChange,
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
    iterations: iterations || [{ id: "default", name: "Daily", timeFilter: "daily" }],
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
          gap: 10,
        }}
      >
        {/* Left: + Grid + Grid Select */}
        <div style={{ display: "flex", alignItems: "end", gap: 6 }}>
          <div className="header-logo" style={{ display: "flex", alignItems: "end"}}><img
            src="/moduli_logo.png"
            alt="Moduli"
            style={{
              height: 18,
              width: "auto",
              display: "block",
            }}
          />
            <div className="site-name text-white pl-1 pr-3 opacity-75">+moduli+</div>
          </div>

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
              onCommitIterations={onCommitIterations}
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

        {/* Center: Iteration Navigation */}
        {iterations?.length > 0 && (
          <IterationNav
            iterations={iterations}
            selectedIterationId={selectedIterationId}
            onSelectIteration={onSelectIteration}
            currentValue={currentIterationValue}
            onValueChange={onIterationValueChange}
          />
        )}

        {/* Right: + Grid */}
        <div style={{ display: "flex", alignItems: "center", marginLeft: "auto", gap: 10 }}>
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



