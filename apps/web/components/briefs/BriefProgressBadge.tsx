"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

const STEPS = ["Thinking", "Searching", "Processing"] as const;
const HOLD_MS = 1200;
const FADE_MS = 220;

function useBriefProgress() {
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (step >= STEPS.length - 1) return;
    const hold = window.setTimeout(() => setLeaving(true), HOLD_MS);
    return () => window.clearTimeout(hold);
  }, [step]);

  useEffect(() => {
    if (!leaving) return;
    const swap = window.setTimeout(() => {
      setStep((current) => Math.min(current + 1, STEPS.length - 1));
      setLeaving(false);
    }, FADE_MS);
    return () => window.clearTimeout(swap);
  }, [leaving]);

  return { step, leaving };
}

export function BriefProgressLabel({
  className,
  live = false,
}: {
  className?: string;
  live?: boolean;
}) {
  const { step, leaving } = useBriefProgress();

  return (
    <span
      className={cn("inline-flex overflow-hidden", className)}
      aria-live={live ? "polite" : undefined}
      aria-hidden={live ? undefined : true}
    >
      <span
        key={step}
        className={cn(
          "inline-flex items-center transition-all duration-200 ease-out",
          leaving ? "-translate-y-1.5 opacity-0" : "animate-brief-status",
        )}
      >
        {STEPS[step]}
        <span
          className="ml-1.5 inline-flex items-end gap-[3px] pb-px"
          aria-hidden="true"
        >
          <span className="h-1.5 w-0.5 origin-bottom rounded-full bg-current animate-think-bar" />
          <span className="h-2.5 w-0.5 origin-bottom rounded-full bg-current animate-think-bar [animation-delay:120ms]" />
          <span className="h-2 w-0.5 origin-bottom rounded-full bg-current animate-think-bar [animation-delay:240ms]" />
        </span>
      </span>
    </span>
  );
}

export function BriefProgressBadge() {
  return (
    <Badge tone="primary" className="min-w-[8.25rem] justify-center overflow-hidden">
      <BriefProgressLabel live />
    </Badge>
  );
}

export function BriefThinkingCursor() {
  return (
    <span
      className="inline-block h-4 w-[0.45em] animate-caret bg-ink"
      aria-hidden="true"
    />
  );
}
