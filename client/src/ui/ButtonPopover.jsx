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
  label = "Layout",          // can now be string OR <Settings />
  buttonVariant = "ghost",
  align = "start",
  side = "bottom",
  className = "",
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={buttonVariant} size="sm" aria-label="Layout">
          {label}
        </Button>
      </PopoverTrigger>

      <PopoverContent align={align} side={side} className={` ${className}`}>
        {children}
      </PopoverContent>
    </Popover>
  );
}
