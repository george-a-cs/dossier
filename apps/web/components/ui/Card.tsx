import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({
  interactive = false,
  padding = "md",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  padding?: "none" | "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "min-w-0 max-w-full overflow-x-hidden rounded-[16px] bg-surface shadow-md",
        padding === "sm" && "p-3.5 sm:p-4",
        padding === "md" && "p-4 sm:p-5",
        interactive &&
          "transition-shadow hover:shadow-lg",
        className,
      )}
      {...props}
    />
  );
}
