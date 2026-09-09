import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  icon,
  title,
  description,
  actions,
  embedded = false,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  actions?: ReactNode;
  embedded?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-4 py-10 text-center sm:px-6 sm:py-12",
        !embedded && "rounded-[16px] border border-dashed border-line bg-surface",
      )}
    >
      {icon ? <div className="text-primary">{icon}</div> : null}
      <div className="max-w-md">
        <h3 className="m-0 text-base font-semibold">{title}</h3>
        <p className="mt-1 mb-0 text-sm text-muted">{description}</p>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
