import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        "flex h-3 w-full rounded-sm border border-borderScale-0 bg-inputScale-2 px-3 py-2 text-xs text-foreground shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed text-white disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
