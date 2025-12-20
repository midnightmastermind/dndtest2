// forms/InstanceForm.jsx
import React from "react";
import { Separator } from "@/components/ui/separator";
import FormInput from "./FormInput";
import { Button } from "@/components/ui/button";

export default function InstanceForm({
  value,            // { label }
  onChange,         // (next) => void
  onCommitLabel,    // () => void
  onDeleteInstance, // () => void
  instanceId,
}) {
  return (
    <div className="font-mono">
      <div>
        <h4 className="text-sm font-semibold text-white">Instance settings</h4>
        <p className="text-[11px] pt-[2px] text-foregroundScale-2">
          Edit instance label.
        </p>
      </div>

      <Separator />

      <FormInput
        schema={{
          className: "",
          type: "text-input",
          key: "label",
          label: "Label",
          placeholder: "Untitled",
          onKeyDown: (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommitLabel?.();
              e.currentTarget.blur();
            }
          },
        }}
        value={value}
        onChange={onChange}
      />

      <Separator />

      <div className="pt-2">
        <h4 className="text-xs font-semibold text-red-400">Danger zone</h4>
        <p className="text-[10px] text-foregroundScale-2/80 mt-1">
          Deletes this instance and removes it from any containers that reference it.
        </p>

        <div className="mt-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              const ok = window.confirm(
                `Delete this instance${instanceId ? ` (${instanceId})` : ""}? This cannot be undone.`
              );
              if (!ok) return;
              onDeleteInstance?.();
            }}
            disabled={!onDeleteInstance}
          >
            Delete Instance
          </Button>
        </div>
      </div>
    </div>
  );
}
