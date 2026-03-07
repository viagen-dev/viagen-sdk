import * as React from "react"
import { cn } from "~/lib/utils"

/**
 * CSS-only tooltip — no Radix, no provider, no hydration issues.
 * Same API shape so existing usage stays unchanged.
 */

function TooltipProvider({ children }: { children: React.ReactNode; delayDuration?: number }) {
  return <>{children}</>
}

function Tooltip({ children }: { children: React.ReactNode; delayDuration?: number; open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void }) {
  return <span className="relative inline-flex group/tooltip">{children}</span>
}

function TooltipTrigger({ children, asChild, ...props }: { children: React.ReactNode; asChild?: boolean } & React.HTMLAttributes<HTMLElement>) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, props)
  }
  return <span {...props}>{children}</span>
}

function TooltipContent({
  className,
  children,
  side = "top",
  sideOffset = 4,
  ...props
}: {
  className?: string
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
} & React.HTMLAttributes<HTMLDivElement>) {
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }

  return (
    <span
      role="tooltip"
      className={cn(
        "pointer-events-none absolute z-50 hidden group-hover/tooltip:block whitespace-nowrap rounded-md bg-foreground px-3 py-1.5 text-xs text-background",
        positionClasses[side],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
