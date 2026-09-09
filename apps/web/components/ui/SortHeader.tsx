import { IconChevronDown, IconChevronUp } from "@/components/icons";
import { cn } from "@/lib/cn";

export type SortDir = "asc" | "desc";

export function SortHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDir;
  onClick: () => void;
}) {
  const Icon = direction === "asc" ? IconChevronUp : IconChevronDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 font-medium transition-colors",
        active ? "text-ink" : "text-muted hover:text-ink",
      )}
    >
      {label}
      {active ? <Icon className="h-3.5 w-3.5" strokeWidth={2.15} /> : null}
    </button>
  );
}
