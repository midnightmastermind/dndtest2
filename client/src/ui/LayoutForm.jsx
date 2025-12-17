import React from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

/**
 * value shape:
 * {
 *   flow: "row" | "column",
 *   columns: number,
 *   rows: number,   // 0 = auto
 *   gap: number
 * }
 */
export default function LayoutForm({ value, onChange }) {
  const update = (patch) => {
    onChange({ ...value, ...patch });
  };

  const safeNum = (raw, fallback) => {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h4 className="text-sm font-semibold">Layout</h4>
        <p className="text-xs text-muted-foreground">
          Configure grid placement and flow.
        </p>
      </div>

      <Separator />

      {/* Auto-flow */}
      <div className="space-y-1.5">
        <Label>Flow direction</Label>
        <Select
          value={value.flow}
          onValueChange={(v) => update({ flow: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="row">Row (left → right)</SelectItem>
            <SelectItem value="column">Column (top → bottom)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Columns */}
      <div className="space-y-1.5">
        <Label>Columns</Label>
        <Input
          type="number"
          min={1}
          max={24}
          value={value.columns}
          onChange={(e) =>
            update({ columns: Math.max(1, safeNum(e.target.value, 1)) })
          }
        />
        <p className="text-xs text-muted-foreground">
          Number of columns in the grid.
        </p>
      </div>

      {/* Rows */}
      <div className="space-y-1.5">
        <Label>Rows</Label>
        <Input
          type="number"
          min={0}
          max={24}
          value={value.rows}
          onChange={(e) =>
            update({ rows: Math.max(0, safeNum(e.target.value, 0)) })
          }
        />
        <p className="text-xs text-muted-foreground">
          Set to <strong>0</strong> for automatic rows.
        </p>
      </div>

      {/* Gap */}
      <div className="space-y-1.5">
        <Label>Gap (px)</Label>
        <Input
          type="number"
          min={0}
          max={64}
          value={value.gap}
          onChange={(e) =>
            update({ gap: Math.max(0, safeNum(e.target.value, 0)) })
          }
        />
        <p className="text-xs text-muted-foreground">
          Space between items.
        </p>
      </div>
    </div>
  );
}
