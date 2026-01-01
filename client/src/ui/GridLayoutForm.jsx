import React from "react";
import { Separator } from "@/components/ui/separator";
import FormInput from "./FormInput";
import { Button } from "../components/ui/button";
export default function GridLayoutForm({
  value,          // { gridName, rows, cols }
  onChange,       // (next) => void
  onCommitGridName,
  onDeleteGrid,
  gridId
}) {
  return (
    <div className="font-mono">
      <div>
        <h4 className="text-sm font-semibold text-white">Grid settings</h4>
        <p className="text-[11px] pt-[2px] text-foregroundScale-2">
          Edit grid name and dimensions.
        </p>
      </div>

      <Separator />

      <FormInput
        schema={{
          type: "text-input",
          key: "gridName",
          label: "Grid Name",
          placeholder: "My grid",
          onKeyDown: (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommitGridName?.(e.currentTarget.value); // ✅ use real input value
              e.currentTarget.blur();
            }
          },
          onBlur: (e) => {
            onCommitGridName?.(e.currentTarget.value); // ✅ use real input value
          },
        }}
        value={value}
        onChange={onChange}
      />


      <Separator />

      <div className="pt-2">
        <h4 className="text-xs font-semibold text-red-400">Danger zone</h4>
        <p className="text-[10px] text-foregroundScale-2/80 mt-1">
          This deletes the panel and all UI inside it (containers/instances will be orphaned unless your backend cascades).
        </p>

        <div className="mt-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              const ok = window.confirm(
                `Delete this grid${gridId ? ` (${gridId})` : ""}? This cannot be undone.`
              );
              if (!ok) return;
              onDeleteGrid?.();
            }}
            disabled={!onDeleteGrid}
          >
            Delete Grid
          </Button>
        </div>
      </div>
      <Separator />

      <div className="grid pt-[5px] grid-cols-2 gap-3">
        <FormInput
          schema={{
            type: "number-input",
            key: "rows",
            label: "Rows",
            min: 1,
            max: 24,
          }}
          value={value}
          onChange={onChange}
        />

        <FormInput
          schema={{
            type: "number-input",
            key: "cols",
            label: "Cols",
            min: 1,
            max: 24,
          }}
          value={value}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
