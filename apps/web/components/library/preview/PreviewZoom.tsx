"use client";

import { useEffect, useState } from "react";
import { IconMinus, IconPlus } from "@/components/icons";
import { cn } from "@/lib/cn";

export const ZOOM_MIN = 25;
export const ZOOM_MAX = 400;
export const ZOOM_STEP = 25;

export function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value)));
}

export function parseZoom(raw: string): number | null {
  const parsed = Number.parseInt(raw.replace(/%/g, "").trim(), 10);
  return Number.isFinite(parsed) ? clampZoom(parsed) : null;
}

export function PreviewZoom({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(`${value}%`);

  useEffect(() => {
    setDraft(`${value}%`);
  }, [value]);

  function commit(raw: string) {
    const next = parseZoom(raw);
    if (next == null) {
      setDraft(`${value}%`);
      return;
    }
    onChange(next);
    setDraft(`${next}%`);
  }

  const btn =
    "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[8px] text-muted transition-colors hover:text-ink disabled:cursor-default disabled:opacity-40 lg:h-9 lg:w-9";

  return (
    <div
      role="group"
      aria-label="Zoom"
      className="inline-flex shrink-0 items-center rounded-[10px] bg-bg p-0.5 ring-1 ring-line"
    >
      <button
        type="button"
        aria-label="Zoom out"
        className={btn}
        disabled={value <= ZOOM_MIN}
        onClick={() => onChange(clampZoom(value - ZOOM_STEP))}
      >
        <IconMinus className="h-4 w-4" />
      </button>
      <input
        aria-label="Zoom percent"
        inputMode="numeric"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit(draft)}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            onChange(clampZoom(value + ZOOM_STEP));
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onChange(clampZoom(value - ZOOM_STEP));
          }
        }}
        className={cn(
          "h-8 w-[3rem] rounded-[8px] border-0 bg-surface text-center text-[13px] font-medium text-ink shadow-sm lg:h-9 lg:w-[3.4rem]",
          "outline-none focus-visible:ring-2 focus-visible:ring-primary",
        )}
      />
      <button
        type="button"
        aria-label="Zoom in"
        className={btn}
        disabled={value >= ZOOM_MAX}
        onClick={() => onChange(clampZoom(value + ZOOM_STEP))}
      >
        <IconPlus className="h-4 w-4" />
      </button>
    </div>
  );
}
