import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <Card className="flex items-start justify-between gap-2 sm:gap-3">
      <div className="min-w-0">
        <p className="m-0 text-[13px] font-medium text-muted">{label}</p>
        <p className="mt-2 mb-0 text-[24px] leading-none font-semibold sm:text-[28px]">{value}</p>
        <p className="mt-2 mb-0 text-[12px] leading-4 text-muted sm:text-[13px] sm:leading-5">
          {hint}
        </p>
      </div>
      <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary min-[400px]:inline-flex sm:h-10 sm:w-10">
        {icon}
      </span>
    </Card>
  );
}
