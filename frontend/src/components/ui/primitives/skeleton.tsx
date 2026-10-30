// Adapted from https://ui.shadcn.com/r/styles/new-york-v4/skeleton.json (MUI icons, existing Radix packages).
import type * as React from "react"
import { cn } from "../../../lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-accent motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export { Skeleton }
