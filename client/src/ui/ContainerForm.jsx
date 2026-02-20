// forms/ContainerForm.jsx
import React from "react";
import { Separator } from "@/components/ui/separator";
import FormInput from "./FormInput";
import { Button } from "@/components/ui/button";
import IterationSettings from "./IterationSettings";
import StyleEditor from "./StyleEditor";

const ITERATION_MODES = [
  { value: "inherit", label: "Inherit from Panel" },
  { value: "own", label: "Use own iteration" },
];

const TIME_FILTER_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const DRAG_MODE_OPTIONS = [
  { value: "move", label: "Move (relocate occurrence)" },
  { value: "copy", label: "Copy (create new occurrence)" },
  { value: "copylink", label: "Copylink (linked occurrence)" },
];

export default function ContainerForm({
  value,             // { label }
  onChange,          // (next) => void
  onCommitLabel,     // () => void
  onDeleteContainer, // () => void
  containerId,
  container,         // Full container object (for style fields)
  onContainerUpdate, // (updates) => void — persist arbitrary container fields
  iteration,         // { mode, timeFilter }
  onIterationChange, // (next) => void
  defaultDragMode,   // "move" | "copy"
  onDragModeChange,  // (mode) => void
  occurrence,        // The occurrence for this container (for persistence settings)
  onOccurrenceUpdate, // (updates) => void
  onSaveAsTemplate,  // () => void — save current items as a template
  onFillFromTemplate, // (templateId) => void — fill from a saved template
  templates,         // Array of available templates
}) {
  const iter = iteration || { mode: "inherit", timeFilter: "daily" };

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

      {/* Drag Behavior */}
      <div className="py-2">
        <h4 className="text-xs font-semibold text-foregroundScale-2 mb-2">Drag Behavior</h4>
        <FormInput
          schema={{
            type: "select",
            key: "__defaultDragMode",
            label: "Default Mode",
            options: DRAG_MODE_OPTIONS,
            description: "Default behavior when dragging this container.",
          }}
          value={{ __defaultDragMode: defaultDragMode || "move" }}
          onChange={(next) => onDragModeChange?.(next?.__defaultDragMode || "move")}
        />
      </div>

      <Separator />

      {/* Persistence Mode (occurrence-level) */}
      {occurrence && (
        <>
          <div className="py-2">
            <h4 className="text-xs font-semibold text-foregroundScale-2 mb-2">Persistence</h4>
            <IterationSettings
              occurrence={occurrence}
              onUpdate={onOccurrenceUpdate}
              entityType="container"
              compact
            />
          </div>
          <Separator />
        </>
      )}

      {/* Iteration Settings */}
      <div className="pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-foregroundScale-2">Iteration</h4>
          <span className="text-[10px] opacity-70">Time-based filtering</span>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-3">
          <FormInput
            schema={{
              type: "select",
              key: "__iterMode",
              label: "Mode",
              options: ITERATION_MODES,
              description: "Inherit uses the panel's iteration. Own sets a specific time filter.",
            }}
            value={{ __iterMode: iter.mode || "inherit" }}
            onChange={(next) => onIterationChange?.({ ...iter, mode: next?.__iterMode || "inherit" })}
          />

          {iter.mode === "own" && (
            <FormInput
              schema={{
                type: "select",
                key: "__iterTimeFilter",
                label: "Time Filter",
                options: TIME_FILTER_OPTIONS,
                description: "How occurrences are grouped for this container.",
              }}
              value={{ __iterTimeFilter: iter.timeFilter || "daily" }}
              onChange={(next) => onIterationChange?.({ ...iter, timeFilter: next?.__iterTimeFilter || "daily" })}
            />
          )}
        </div>

        {iter.mode === "inherit" && (
          <p className="mt-2 text-[10px] text-foregroundScale-2/80">
            This container inherits iteration from its panel.
          </p>
        )}
      </div>

      <Separator />

      {/* Templates */}
      <div className="py-2">
        <h4 className="text-xs font-semibold text-foregroundScale-2 mb-2">Templates</h4>
        <div className="flex flex-col gap-1.5">
          {onSaveAsTemplate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs w-full"
              onClick={onSaveAsTemplate}
            >
              Save Current Items as Template
            </Button>
          )}
          {(templates || []).length > 0 && (
            <div className="space-y-1">
              {templates.map(t => (
                <Button
                  key={t.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs w-full justify-start"
                  onClick={() => onFillFromTemplate?.(t.id)}
                >
                  Fill from: {t.name}
                </Button>
              ))}
            </div>
          )}
          {!(templates || []).length && (
            <p className="text-[10px] text-muted-foreground">No templates saved yet.</p>
          )}
        </div>
      </div>

      <Separator />

      {/* Container Style */}
      <StyleEditor
        styleMode={container?.styleMode || "inherit"}
        ownStyle={container?.ownStyle}
        onStyleModeChange={(mode) => onContainerUpdate?.({ styleMode: mode })}
        onOwnStyleChange={(style) => onContainerUpdate?.({ ownStyle: style })}
        label="Container Style"
        inheritLabel="Panel"
      />

      <Separator />

      {/* Child Instance Style Defaults */}
      <StyleEditor
        styleMode={container?.childInstanceStyle ? "own" : "inherit"}
        ownStyle={container?.childInstanceStyle}
        onStyleModeChange={(mode) => {
          if (mode === "inherit") onContainerUpdate?.({ childInstanceStyle: null });
        }}
        onOwnStyleChange={(style) => onContainerUpdate?.({ childInstanceStyle: style })}
        label="Child Instance Defaults"
        inheritLabel="Panel"
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
