import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full resize-y rounded-[12px] border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-primary lg:text-sm",
        className,
      )}
      {...props}
    />
  );
}
