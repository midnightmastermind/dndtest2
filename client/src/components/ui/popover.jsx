import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { cn } from "@/lib/utils"

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger

export const PopoverContent = React.forwardRef(
  ({ className, align = "start", sideOffset = 4, ...props }, ref) => (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        collisionPadding={0}   // try 0 or 8
        avoidCollisions={true} // default true
        sideOffset={sideOffset}
        className={cn(
          // ✅ no fixed width here
          "z-50  p-3 sm:p-5 rounded border border-borderScale-0 bg-popoverScale-2 text-popover-foreground shadow-md outline-none",
          // ✅ never exceed viewport width
          "max-w-[calc(100vw)]",
          // ✅ nice responsive width behavior
          "w-[min(520px,calc(100vw))]",
          // ✅ optional: prevent tall forms from falling off screen
          "max-h-[calc(100vh-24px)] overflow-auto",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
)