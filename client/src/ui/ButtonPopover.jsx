import React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Reusable popover wrapper.
 *
 * Usage:
 * <ButtonPopover>
 *   <LayoutForm value={layout} onChange={setLayout} />
 * </ButtonPopover>
 */
export default function ButtonPopover({
  children,
  label = "Layout",
  buttonVariant = "ghost",
  align = "start",
  side = "bottom",
  className = "",
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={buttonVariant} size="sm" aria-label={label}>
          {label}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        side={side}
        className={`w-80 p-3 ${className}`}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
