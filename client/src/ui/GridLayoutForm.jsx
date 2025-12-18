import React from "react";
import { Separator } from "@/components/ui/separator";
import FormInput from "./FormInput";

export default function GridLayoutForm({
  value,          // { gridName, rows, cols }
  onChange,       // (next) => void
  onCommitGridName,
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
          className:"",
          type: "text-input",
          key: "gridName",
          label: "Grid Name",
          placeholder: "My grid",
          onKeyDown: (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommitGridName?.();
              e.currentTarget.blur();
            }
          },
        }}
        value={value}
        onChange={onChange}
      />

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
