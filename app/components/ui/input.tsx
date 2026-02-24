import * as React from "react";

import { cn } from "~/lib/utils";

function Input({
  className,
  type,
  leadingIcon,
  trailingIcon,
  ...props
}: React.ComponentProps<"input"> & {
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}) {
  if (leadingIcon || trailingIcon) {
    return (
      <div
        data-slot="input-wrapper"
        className={cn(
          "border-input dark:bg-input/30 flex h-9 w-full min-w-0 items-center gap-2 rounded-md border bg-transparent px-3 shadow-xs transition-[color,box-shadow] outline-none has-focus-visible:border-ring has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px] has-disabled:cursor-not-allowed has-disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          className,
        )}
      >
        {leadingIcon && (
          <span
            data-slot="input-leading-icon"
            className="shrink-0 text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            {leadingIcon}
          </span>
        )}
        <input
          type={type}
          data-slot="input"
          className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground h-full w-full min-w-0 bg-transparent py-1 text-base outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed md:text-sm"
          {...props}
        />
        {trailingIcon && (
          <span
            data-slot="input-trailing-icon"
            className="shrink-0 text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            {trailingIcon}
          </span>
        )}
      </div>
    );
  }

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
