import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"
import { cn } from "@/lib/utils"

export function Separator({ className, ...props }) {
  return (
    <SeparatorPrimitive.Root
      className={cn("my-4 h-px w-full bg-border", className)}
      {...props}
    />
  )
}
