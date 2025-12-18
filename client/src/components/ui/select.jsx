import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;

export const SelectTrigger = React.forwardRef(
  ({ className, children, ...props }, ref) => (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex h-3 w-full items-center justify-between rounded-sm border border-borderScale-0 bg-inputScale-2 px-3 py-2 text-xs text-popover-foreground shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-ring",
        className
      )}
      {...props}
    >
      {children}
    </SelectPrimitive.Trigger>
  )
);

export const SelectValue = SelectPrimitive.Value;

export const SelectContent = React.forwardRef(
  ({ className, children, ...props }, ref) => (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          "z-[99999] min-w-[8rem] font-mono overflow-hidden rounded-sm  bg-inputScale-0 text-popover-foreground shadow-md",
          className
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1 rounded border border-borderScale-0 bg-inputScale-0 text-xs">
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
);

export const SelectItem = React.forwardRef(
  ({ className, children, ...props }, ref) => (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none bg-overlay",
        "focus:bg-accent focus:text-accent-foreground",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="bg-overlay">{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
);
