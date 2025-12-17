// LayoutForm.jsx
import React from "react";
import { Separator } from "@/components/ui/separator";
import FormInput from "./FormInput";

/**
 * value shape:
 * {
 *   name: string,
 *   flow: "row" | "column",
 *   columns: number,
 *   rows: number,   // 0 = auto
 *   gap: number
 * }
 */
export default function LayoutForm({ value, onChange }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h4 className="text-sm font-semibold text-foreground">Layout</h4>
        <p className="text-xs text-muted-foreground">
          Configure grid placement and flow.
        </p>
      </div>

      <Separator />

      {/* Name */}
      <FormInput
        schema={{
          type: "text-input",
          key: "name",
          label: "Name",
          placeholder: "Panel layout name",
        }}
        value={value}
        onChange={onChange}
      />

      <Separator />

      {/* Flow */}
      <FormInput
        schema={{
          type: "select",
          key: "flow",
          label: "Flow direction",
          placeholder: "Pick a flow…",
          options: [
            { value: "row", label: "Row (left → right)" },
            { value: "column", label: "Column (top → bottom)" },
          ],
        }}
        value={value}
        onChange={onChange}
      />

      {/* Columns */}
      <FormInput
        schema={{
          type: "number-input",
          key: "columns",
          label: "Columns",
          min: 1,
          max: 24,
          description: "Number of columns in the grid.",
        }}
        value={value}
        onChange={onChange}
      />

      {/* Rows */}
      <FormInput
        schema={{
          type: "number-input",
          key: "rows",
          label: "Rows",
          min: 0,
          max: 24,
          description: "Set to 0 for automatic rows.",
        }}
        value={value}
        onChange={onChange}
      />

      {/* Gap */}
      <FormInput
        schema={{
          type: "number-input",
          key: "gap",
          label: "Gap (px)",
          min: 0,
          max: 64,
          description: "Space between items.",
        }}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}