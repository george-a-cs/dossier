import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-base text-ink placeholder:text-muted focus:border-primary lg:text-sm",
        className,
      )}
      {...props}
    />
  );
}
