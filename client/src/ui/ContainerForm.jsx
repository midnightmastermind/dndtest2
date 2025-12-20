// forms/ContainerForm.jsx
import React from "react";
import { Separator } from "@/components/ui/separator";
import FormInput from "./FormInput";
import { Button } from "@/components/ui/button";

export default function ContainerForm({
  value,             // { label }
  onChange,          // (next) => void
  onCommitLabel,     // () => void
  onDeleteContainer, // () => void
  containerId,
}) {
  return (
    <div className="font-mono">
      <div>
        <h4 className="text-sm font-semibold text-white">Container settings</h4>
        <p className="text-[11px] pt-[2px] text-foregroundScale-2">
          Edit container label.
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
          Deletes this container. (Instances may be deleted too if your backend cascades on
          container delete.)
        </p>

        <div className="mt-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              const ok = window.confirm(
                `Delete this container${containerId ? ` (${containerId})` : ""}? This cannot be undone.`
              );
              if (!ok) return;
              onDeleteContainer?.();
            }}
            disabled={!onDeleteContainer}
          >
            Delete Container
          </Button>
        </div>
      </div>
    </div>
  );
}
