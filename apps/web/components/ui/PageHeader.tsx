import Link from "next/link";
import type { ReactNode } from "react";
import { IconArrowLeft } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Tooltip } from "@/components/ui/Tooltip";

export function PageHeader({
  title,
  count,
  countLabel,
  tooltip,
  actions,
  backHref,
  backLabel = "Back",
}: {
  title: string;
  count?: number;
  countLabel?: string;
  tooltip?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-1">
        {backHref ? (
          <Link
            href={backHref}
            aria-label={backLabel}
            className="-ml-2 inline-flex h-9 w-10 shrink-0 items-center justify-center rounded-[10px] text-ink transition-colors hover:bg-bg"
          >
            <IconArrowLeft className="h-6 w-6" strokeWidth={2.25} />
          </Link>
        ) : null}
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="m-0 min-w-0 truncate text-[24px] leading-7 font-semibold tracking-tight sm:text-[28px] sm:leading-8">
            {title}
          </h1>
          {count != null ? (
            <Badge
              tone="primary"
              className="px-2.5 tabular-nums"
              aria-label={countLabel ?? String(count)}
            >
              {count}
            </Badge>
          ) : null}
          {tooltip ? <Tooltip content={tooltip} /> : null}
        </div>
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto sm:justify-end [&>*]:max-sm:flex-1">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
