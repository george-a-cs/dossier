"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IconInfo } from "@/components/icons";
import { cn } from "@/lib/cn";
import { MOTION_MS, usePresence } from "@/lib/use-presence";

export function Tooltip({
  content,
  label = "More information",
  children,
  className,
}: {
  content: ReactNode;
  label?: string;
  children?: ReactNode;
  className?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const present = usePresence(open, MOTION_MS.tooltip);

  function hoverable() {
    return window.matchMedia("(hover: hover)").matches;
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => {
        if (hoverable()) setOpen(true);
      }}
      onMouseLeave={() => {
        if (hoverable()) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-bg hover:text-ink"
        onClick={() => {
          if (!hoverable()) setOpen((current) => !current);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget as Node)) {
            setOpen(false);
          }
        }}
      >
        {children ?? <IconInfo className="h-4 w-4" />}
      </button>
      {present ? (
        <span
          id={id}
          role="tooltip"
          data-state={open ? "open" : "closed"}
          className="ui-tooltip absolute top-full left-0 z-50 mt-1.5 w-72 max-w-[min(18rem,calc(100vw-2rem))] rounded-[12px] border border-line bg-surface px-3 py-2.5 text-left text-[13px] leading-5 font-normal text-ink shadow-md"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
