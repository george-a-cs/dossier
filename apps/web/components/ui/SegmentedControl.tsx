import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex max-w-full rounded-[10px] bg-bg p-0.5 ring-1 ring-line",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] text-[13px] font-medium transition-colors",
              size === "sm" ? "h-8 px-2.5 lg:h-9 lg:px-3" : "h-9 px-3",
              active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
