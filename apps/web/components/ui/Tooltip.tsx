"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
  const tipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
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
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || tipRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  useEffect(() => {
    if (!present) {
      setCoords(null);
      return;
    }
    function place() {
      const root = rootRef.current;
      const tip = tipRef.current;
      if (!root || !tip) return;
      const rect = root.getBoundingClientRect();
      const gap = 8;
      const tipH = tip.offsetHeight;
      const tipW = tip.offsetWidth;
      const above = rect.top >= tipH + gap;
      const top = above ? rect.top - tipH - gap : rect.bottom + gap;
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - tipW - 8);
      setCoords({ top, left });
    }
    const frame = window.requestAnimationFrame(place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [present]);

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
        onFocus={() => {
          if (hoverable()) setOpen(true);
        }}
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget as Node)) {
            setOpen(false);
          }
        }}
      >
        {children ?? <IconInfo className="h-4 w-4" />}
      </button>
      {present
        ? createPortal(
            <span
              ref={tipRef}
              id={id}
              role="tooltip"
              data-state={open ? "open" : "closed"}
              style={{
                position: "fixed",
                top: coords?.top ?? 0,
                left: coords?.left ?? 0,
                visibility: coords ? "visible" : "hidden",
              }}
              className="ui-tooltip z-50 w-72 max-w-[min(18rem,calc(100vw-2rem))] rounded-[12px] border border-line bg-surface px-3 py-2.5 text-left text-[13px] leading-5 font-normal text-ink shadow-md"
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
