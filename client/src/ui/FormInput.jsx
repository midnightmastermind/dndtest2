import React from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * schema:
 * {
 *   type: "button" | "text-input" | "number-input" | "select",
 *   label?: React.ReactNode,
 *   key?: string, // required for inputs/select
 *   description?: React.ReactNode,
 *   placeholder?: string,
 *   disabled?: boolean,
 *
 *   // number input options
 *   min?: number, max?: number, step?: number,
 *
 *   // select options
 *   options?: Array<{ value: string; label: React.ReactNode }>,
 *
 *   // button options
 *   buttonText?: React.ReactNode,
 *   buttonVariant?: string,
 *   buttonSize?: string,
 *   onAction?: (ctx: { value: any }) => void,
 *
 *   className?: string,
 * }
 *
 * props:
 *  - schema: object above
 *  - value: object (all form values)
 *  - onChange: (nextValueObj) => void
 */
export default function FormInput({ schema, value, onChange }) {
  const s = schema ?? {};
  const type = s.type;

  const update = (k, next) => {
    onChange?.({ ...value, [k]: next });
  };

  const safeNum = (raw, fallback = 0) => {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  // BUTTON
  if (type === "button") {
    return (
      <div className={s.className}>
        <Button
          type="button"
          variant={s.buttonVariant ?? "default"}
          size={s.buttonSize ?? "sm"}
          disabled={s.disabled}
          onClick={() => s.onAction?.({ value })}
        >
          {s.label ?? "Action"}
        </Button>
        {s.description && (
          <p className="flex justify-end text-[10px] pt-[2px] text-foregroundScale-2">{s.description}</p>
        )}
      </div>
    );
  }

  // everything else needs a key
  if (!s.key) {
    return (
      <div className="text-xs text-red-500">
        FormInput schema missing <code>key</code>
      </div>
    );
  }

  const current = value?.[s.key];

  // TEXT
  if (type === "text-input") {
    return (
      <div className={`${s.className ?? ""} text-xs`}>
        {s.label && <Label>{s.label}</Label>}
        <Input
          type="text"
          value={current ?? ""}
          placeholder={s.placeholder}
          disabled={s.disabled}
          onChange={(e) => update(s.key, e.target.value)}
        />
        {s.description && (
          <p className="flex justify-end text-[10px] pt-[2px] text-foregroundScale-2">{s.description}</p>
        )}
      </div>
    );
  }

  // NUMBER
  if (type === "number-input") {
    return (
      <div className={`${s.className ?? ""}`}>
        {s.label && <Label>{s.label}</Label>}
        <Input
          type="number"
          value={current ?? 0}
          min={s.min}
          max={s.max}
          step={s.step}
          placeholder={s.placeholder}
          disabled={s.disabled}
          onChange={(e) => update(s.key, safeNum(e.target.value, current ?? 0))}
        />
        {s.description && (
          <p className="flex justify-end text-[10px] pt-[2px] text-foregroundScale-2">{s.description}</p>
        )}
      </div>
    );
  }

  // SELECT
  if (type === "select") {
    const opts = s.options ?? [];
    return (
      <div className={`${s.className ?? ""}`}>
        {s.label && <Label>{s.label}</Label>}
        <Select
          value={current ?? ""}
          onValueChange={(v) => update(s.key, v)}
          disabled={s.disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={s.placeholder ?? "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {opts.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {s.description && (
          <p className="flex justify-end text-[10px] pt-[2px] text-foregroundScale-2">{s.description}</p>
        )}
      </div>
    );
  }

  return (
    <div className="text-xs text-red-500">
      Unknown FormInput type: <code>{String(type)}</code>
    </div>
  );
}