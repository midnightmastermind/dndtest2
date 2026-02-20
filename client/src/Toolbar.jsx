import React, { useMemo, useState, useRef } from "react";
import FormInput from "./ui/FormInput";
import ButtonPopover from "./ui/ButtonPopover";
import GridLayoutForm from "./ui/GridLayoutForm";
import IterationNav from "./ui/IterationNav";
import PanelKindSelector from "./ui/PanelKindSelector";

import { Button } from "./components/ui/button"
import { Settings, PlusSquare, Undo2, Redo2, History } from "lucide-react";

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
  // Category iteration props
  categoryDimensions,
  selectedCategoryId,
  currentCategoryValue,
  onSelectCategory,
  onCategoryValueChange,
  // Undo/Redo/History props
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onHistory,
}) {
  const [panelSelectorOpen, setPanelSelectorOpen] = useState(false);
  const [panelSelectorPos, setPanelSelectorPos] = useState(null);
  const panelButtonRef = useRef(null);

  const handlePanelButtonClick = () => {
    if (panelButtonRef.current) {
      const rect = panelButtonRef.current.getBoundingClientRect();
      setPanelSelectorPos({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
    setPanelSelectorOpen(true);
  };

  const handlePanelKindSelect = (kind) => {
    onAddPanel?.(kind);
    setPanelSelectorOpen(false);
  };
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
            ref={panelButtonRef}
            size="sm"
            onClick={handlePanelButtonClick}
          >
            <PlusSquare className="h-4 w-4 pr-[2px]" />Panel
          </Button>
        </div>

        {/* Panel Kind Selector Popup */}
        <PanelKindSelector
          open={panelSelectorOpen}
          onClose={() => setPanelSelectorOpen(false)}
          onSelect={handlePanelKindSelect}
          position={panelSelectorPos}
        />

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

        {/* Category Filter (compound iteration) */}
        {categoryDimensions?.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span className="text-[10px] text-muted-foreground">Filter:</span>
            <select
              value={selectedCategoryId || ""}
              onChange={(e) => onSelectCategory?.(e.target.value || null)}
              className="h-7 text-xs bg-background border border-border rounded px-1 text-foreground"
              style={{ fontSize: 11 }}
              title="Filter by category dimension"
            >
              <option value="">No Filter</option>
              {categoryDimensions.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            {selectedCategoryId && (() => {
              const dim = categoryDimensions.find(c => c.id === selectedCategoryId);
              const opts = dim?.options || dim?.categoryOptions || [];
              return opts.length > 0 ? (
                <select
                  value={currentCategoryValue || ""}
                  onChange={(e) => onCategoryValueChange?.(e.target.value || null)}
                  className="h-7 text-xs bg-background border border-border rounded px-1 text-foreground"
                  style={{ fontSize: 11 }}
                  title={`Filter ${dim?.name || "category"} value`}
                >
                  <option value="">All {dim?.name || "Values"}</option>
                  {opts.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : null;
            })()}
          </div>
        )}

        {/* Right: Undo/History/Redo + Grid */}
        <div style={{ display: "flex", alignItems: "center", marginLeft: "auto", gap: 4 }}>
          <Button
            size="sm"
            variant="ghost"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onHistory}
            title="Transaction History"
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>

          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.2)", margin: "0 4px" }} />

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



