"use client";

import type { ReactNode } from "react";
import { IconFilter } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function FilterButton({
  open,
  onClick,
  activeCount = 0,
  controlsId,
}: {
  open: boolean;
  onClick: () => void;
  activeCount?: number;
  controlsId?: string;
}) {
  return (
    <Button
      variant="secondary"
      icon={<IconFilter className="h-4 w-4" />}
      aria-expanded={open}
      aria-controls={controlsId}
      className={cn(open && "bg-bg")}
      onClick={onClick}
    >
      Filters
      {activeCount > 0 ? (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-soft px-1.5 text-[11px] font-semibold text-primary">
          {activeCount}
        </span>
      ) : null}
    </Button>
  );
}

export function FilterPanel({
  id,
  open,
  children,
}: {
  id?: string;
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      aria-hidden={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out",
        open ? "mb-5 grid-rows-[1fr] opacity-100" : "mb-0 grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0 overflow-hidden" inert={!open || undefined}>
        <div className="flex min-w-0 flex-col gap-3 p-px sm:flex-row sm:items-center sm:justify-between">
          {children}
        </div>
      </div>
    </div>
  );
}
