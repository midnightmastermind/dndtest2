// LayoutForm.jsx
import React from "react";
import { Separator } from "@/components/ui/separator";
import FormInput from "./FormInput";

export default function LayoutForm({ value, onChange }) {
  const display = value?.display ?? "grid";
  const flow = value?.flow ?? "row";

  const isGrid = display === "grid";
  const isFlex = display === "flex";

  const columnsVal = Number(value?.columns ?? 0);

  const columnOptions = [
    { value: "0", label: "Auto" },
    ...Array.from({ length: 12 }, (_, i) => {
      const n = i + 1;
      return { value: String(n), label: String(n) };
    }),
  ];

  const showWrap = isFlex && flow === "row";

  const widthMode = value?.widthMode ?? "auto";   // "auto" | "fixed"
  const heightMode = value?.heightMode ?? "auto"; // ✅ NEW: "auto" | "fixed"

  return (
    <div className="font-mono max-h-[70vh] overflow-y-auto pr-2">
      <div>
        <h4 className="text-sm font-semibold text-white">Panel Settings</h4>
        <p className="text-[11px] pt-[2px] text-foregroundScale-2">
          Configure list layout + scroll behavior.
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

      {/* Display */}
      <FormInput
        schema={{
          type: "select",
          key: "display",
          label: "Display",
          options: [
            { value: "grid", label: "Grid" },
            { value: "flex", label: "Flex" },
          ],
        }}
        value={value}
        onChange={(next) => {
          const nextDisplay = next?.display ?? "grid";

          // nudge sane defaults when switching
          const base = { ...next, display: nextDisplay };

          if (nextDisplay === "grid") {
            onChange?.({
              ...base,
              columns: Number.isFinite(Number(base.columns)) ? Number(base.columns) : 0,
            });
            return;
          }


          // flex
          onChange?.({
            ...base,
            wrap: base.wrap ?? "wrap",
          });
        }}
      />
<FormInput
  schema={{
    type: "select",
    key: "alignItems",
    label: "Align items",
    options: [
      { value: "start", label: "Start" },
      { value: "center", label: "Center" },
      { value: "end", label: "End" },
      { value: "stretch", label: "Stretch" },
      ...(isFlex ? [{ value: "baseline", label: "Baseline" }] : []),
    ],
    description: "align-items (cross-axis alignment of items).",
  }}
  value={value}
  onChange={onChange}
/>
<FormInput
  schema={{
    type: "select",
    key: "alignContent",
    label: "Align content",
    options: [
      { value: "start", label: "Start" },
      { value: "center", label: "Center" },
      { value: "end", label: "End" },
      { value: "between", label: "Space between" },
      { value: "around", label: "Space around" },
      { value: "evenly", label: "Space evenly" },
      { value: "stretch", label: "Stretch" },
    ],
    description:
      "align-content (only matters when there’s extra space: flex-wrap or grid with spare space).",
  }}
  value={value}
  onChange={onChange}
/>

      {/* Flow (both grid+flex use it) */}
      <FormInput
        schema={{
          type: "select",
          key: "flow",
          label: "Flow direction",
          options: [
            { value: "row", label: "Row (left → right)" },
            { value: "col", label: "Column (top → bottom)" },
          ],
        }}
        value={value}
        onChange={onChange}
      />

      {/* Flex-only + Row-only: Wrap */}
      {showWrap && (
        <FormInput
          schema={{
            type: "select",
            key: "wrap",
            label: "Wrap",
            options: [
              { value: "wrap", label: "Wrap" },
              { value: "nowrap", label: "No wrap" },
            ],
            description: "Only applies to Flex + Row flow.",
          }}
          value={value}
          onChange={onChange}
        />
      )}

      {/* Width + Height + Justify */}
      <Separator />

      {/* WIDTH */}
      <div className="grid pt-[5px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <FormInput
          schema={{
            type: "select",
            key: "widthMode",
            label: "Width mode",
            options: [
              { value: "auto", label: "Auto" },
              { value: "fixed", label: "Fixed" },
            ],
          }}
          value={value}
          onChange={onChange}
        />

        {widthMode === "fixed" ? (
          <FormInput
            schema={{
              type: "number-input",
              key: "fixedWidth",
              label: "Fixed width (px)",
              min: 120,
              max: 4000,
              description: "Sets list width directly.",
            }}
            value={value}
            onChange={onChange}
          />
        ) : (
          <FormInput
            schema={{
              type: "number-input",
              key: "minWidthPx",
              label: "Min width (px)",
              min: 0,
              max: 4000,
              description: "0 = none (auto).",
            }}
            value={value}
            onChange={onChange}
          />
        )}

        <FormInput
          schema={{
            type: "number-input",
            key: "maxWidthPx",
            label: "Max width (px)",
            min: 0,
            max: 8000,
            description: widthMode === "fixed" ? "Optional clamp. 0 = none." : "0 = none.",
          }}
          value={value}
          onChange={onChange}
        />
      </div>

      {/* HEIGHT ✅ NEW */}
      <div className="grid pt-[5px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <FormInput
          schema={{
            type: "select",
            key: "heightMode",
            label: "Height mode",
            options: [
              { value: "auto", label: "Auto" },
              { value: "fixed", label: "Fixed" },
            ],
          }}
          value={value}
          onChange={onChange}
        />

        {heightMode === "fixed" ? (
          <FormInput
            schema={{
              type: "number-input",
              key: "fixedHeight",
              label: "Fixed height (px)",
              min: 0,
              max: 8000,
              description: "Sets list height directly. 0 = none.",
            }}
            value={value}
            onChange={onChange}
          />
        ) : (
          <FormInput
            schema={{
              type: "number-input",
              key: "minHeightPx",
              label: "Min height (px)",
              min: 0,
              max: 8000,
              description: "0 = none (auto).",
            }}
            value={value}
            onChange={onChange}
          />
        )}

        <FormInput
          schema={{
            type: "number-input",
            key: "maxHeightPx",
            label: "Max height (px)",
            min: 0,
            max: 8000,
            description: heightMode === "fixed" ? "Optional clamp. 0 = none." : "0 = none.",
          }}
          value={value}
          onChange={onChange}
        />
      </div>

      {/* JUSTIFY */}
      <FormInput
        schema={{
          type: "select",
          key: "justify",
          label: "Justify",
          options: [
            { value: "start", label: "Start" },
            { value: "center", label: "Center" },
            { value: "end", label: "End" },
            { value: "between", label: "Space between" },
            { value: "around", label: "Space around" },
            { value: "evenly", label: "Space evenly" },
          ],
          description: "Applies justify-content to the list container.",
        }}
        value={value}
        onChange={onChange}
      />

      <Separator />

      <div className="grid pt-[5px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Grid-only: Columns */}
        {isGrid && (
          <FormInput
            schema={{
              type: "select",
              key: "columns",
              label: "Columns",
              options: columnOptions,
              description: "Auto = auto-fill by min item width.",
            }}
            value={{
              ...value,
              columns: String(value?.columns ?? 0),
            }}
            onChange={(next) => {
              const raw = next?.columns ?? "0";
              const n = Number(raw);
              onChange?.({
                ...value,
                ...next,
                columns: Number.isFinite(n) ? n : 0,
              });
            }}
          />
        )}

        {/* Gap (slider → snapped preset) */}
        <FormInput
          schema={{
            type: "slider",
            key: "gapPx",
            label: "Gap",
            sliderMin: 0,
            sliderMax: 32,
            sliderStep: 1,
            showValue: true,
            valueSuffix: "px",
            description: "Snaps to none/sm/md/lg internally.",
          }}
          value={value}
          onChange={(next) => {
            const px = next?.gapPx ?? 0;

            const gapPxToPreset = (n) => {
              const v = Number(n) || 0;
              if (v <= 0) return "none";
              if (v <= 8) return "sm";
              if (v <= 16) return "md";
              return "lg";
            };

            onChange?.({
              ...next,
              gapPreset: gapPxToPreset(px),
            });
          }}
        />

        {/* Optional: preset dropdown as override/visibility */}
        <FormInput
          schema={{
            type: "select",
            key: "gapPreset",
            label: "Gap preset",
            options: [
              { value: "none", label: "None" },
              { value: "sm", label: "Small" },
              { value: "md", label: "Medium" },
              { value: "lg", label: "Large" },
            ],
          }}
          value={value}
          onChange={(next) => {
            const preset = next?.gapPreset ?? "md";
            const presetToPx = { none: 0, sm: 8, md: 12, lg: 20 };
            onChange?.({
              ...next,
              gapPx: presetToPx[preset] ?? 12,
            });
          }}
        />

        {/* Rows (kept for later) */}
        <FormInput
          schema={{
            type: "number-input",
            key: "rows",
            label: "Rows",
            min: 0,
            max: 24,
            description: "Reserved for later; 0 = auto.",
          }}
          value={value}
          onChange={onChange}
        />
      </div>

      {/* Align */}
      <FormInput
        schema={{
          type: "select",
          key: "align",
          label: "Align",
          options: [
            { value: "start", label: "Start" },
            { value: "stretch", label: "Stretch" },
          ],
        }}
        value={value}
        onChange={onChange}
      />

      {/* Dense */}
      <FormInput
        schema={{
          type: "toggle",
          key: "dense",
          label: "Dense",
          description: "Tighter list spacing.",
        }}
        value={value}
        onChange={onChange}
      />

      <Separator />

      {/* Insets / Padding / Variant */}
      <div className="grid pt-[5px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <FormInput
          schema={{
            type: "select",
            key: "insetX",
            label: "Inset X",
            options: [
              { value: "panel", label: "Inset" },
              { value: "none", label: "None" },
            ],
          }}
          value={value}
          onChange={onChange}
        />

        <FormInput
          schema={{
            type: "select",
            key: "padding",
            label: "Padding",
            options: [
              { value: "none", label: "None" },
              { value: "sm", label: "Small" },
              { value: "md", label: "Medium" },
            ],
          }}
          value={value}
          onChange={onChange}
        />

        <FormInput
          schema={{
            type: "select",
            key: "variant",
            label: "Variant",
            options: [
              { value: "default", label: "Default" },
              { value: "panel", label: "Panel" },
            ],
          }}
          value={value}
          onChange={onChange}
        />
      </div>

      <Separator />

      {/* Scroll */}
      <div className="grid pt-[5px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <FormInput
          schema={{
            type: "select",
            key: "scrollType",
            label: "Scrollbar UI",
            options: [
              { value: "auto", label: "Auto" },
              { value: "always", label: "Always" },
              { value: "scroll", label: "Scroll" },
              { value: "hover", label: "Hover" },
            ],
          }}
          value={value}
          onChange={onChange}
        />

        <FormInput
          schema={{
            type: "select",
            key: "scrollX",
            label: "Scroll X",
            options: [
              { value: "none", label: "None" },
              { value: "auto", label: "Auto" },
              { value: "always", label: "Always" },
            ],
          }}
          value={value}
          onChange={onChange}
        />

        <FormInput
          schema={{
            type: "select",
            key: "scrollY",
            label: "Scroll Y",
            options: [
              { value: "none", label: "None" },
              { value: "auto", label: "Auto" },
              { value: "always", label: "Always" },
            ],
          }}
          value={value}
          onChange={onChange}
        />

        <FormInput
          schema={{
            type: "number-input",
            key: "scrollHideDelay",
            label: "Hide delay (ms)",
            min: 0,
            max: 5000,
          }}
          value={value}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
