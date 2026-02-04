import React, { useCallback } from "react";
import { Separator } from "@/components/ui/separator";
import FormInput from "./FormInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { uid } from "../uid";

// Time filter options for iterations
const TIME_FILTER_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export default function GridLayoutForm({
  value,          // { gridName, rows, cols, iterations }
  onChange,       // (next) => void
  onCommitGridName,
  onCommitIterations, // (iterations) => void - saves iterations to server
  onDeleteGrid,
  gridId
}) {
  // Get iterations from value or default
  const iterations = value?.iterations || [{ id: "default", name: "Daily", timeFilter: "daily" }];

  // Add a new iteration
  const addIteration = useCallback(() => {
    const newIteration = {
      id: uid(),
      name: "",
      timeFilter: "daily"
    };
    const newIterations = [...iterations, newIteration];
    onChange?.({ ...value, iterations: newIterations });
    onCommitIterations?.(newIterations);
  }, [iterations, value, onChange, onCommitIterations]);

  // Update an iteration
  const updateIteration = useCallback((id, field, fieldValue) => {
    const newIterations = iterations.map(iter =>
      iter.id === id ? { ...iter, [field]: fieldValue } : iter
    );
    onChange?.({ ...value, iterations: newIterations });
    onCommitIterations?.(newIterations);
  }, [iterations, value, onChange, onCommitIterations]);

  // Delete an iteration
  const deleteIteration = useCallback((id) => {
    if (iterations.length <= 1) return; // Keep at least one
    const newIterations = iterations.filter(iter => iter.id !== id);
    onChange?.({ ...value, iterations: newIterations });
    onCommitIterations?.(newIterations);
  }, [iterations, value, onChange, onCommitIterations]);
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

      <Separator />

      {/* Iterations Section */}
      <div className="py-2">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-white">Iterations</h4>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px]"
            onClick={addIteration}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Iteration
          </Button>
        </div>
        <p className="text-[10px] text-foregroundScale-2/80 mb-2">
          Define time-based iterations for tracking and filtering data.
        </p>

        {/* Iterations List */}
        <div className="space-y-2">
          {iterations.map((iteration) => (
            <div
              key={iteration.id}
              className="flex items-center gap-2 p-2 bg-muted/20 rounded border border-border"
            >
              {/* Name input */}
              <Input
                type="text"
                value={iteration.name || ""}
                onChange={(e) => updateIteration(iteration.id, "name", e.target.value)}
                placeholder="Iteration name"
                className="h-7 text-xs flex-1"
              />

              {/* Time filter selector */}
              <Select
                value={iteration.timeFilter || "daily"}
                onValueChange={(v) => updateIteration(iteration.id, "timeFilter", v)}
              >
                <SelectTrigger className="h-7 text-xs w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_FILTER_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Delete button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => deleteIteration(iteration.id)}
                disabled={iterations.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-400" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
