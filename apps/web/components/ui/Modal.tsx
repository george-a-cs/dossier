"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconClose } from "@/components/icons";
import { cn } from "@/lib/cn";
import { MOTION_MS, usePresence } from "@/lib/use-presence";
import { IconButton } from "./IconButton";

export function Modal({
  title,
  children,
  footer,
  size = "md",
  open = true,
  onClose,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "preview";
  open?: boolean;
  onClose: () => void;
}) {
  const labelId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const present = usePresence(open, MOTION_MS.overlay);
  const state = open ? "open" : "closed";

  useEffect(() => {
    if (!present) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (open) closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [present, open, onClose]);

  if (!present) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-stretch justify-center p-0 md:items-center md:p-6",
        !open && "pointer-events-none",
      )}
    >
      <button
        type="button"
        aria-label="Close overlay"
        className="ui-backdrop absolute inset-0 bg-[#1b2332]/40"
        data-state={state}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        data-state={state}
        className={cn(
          "ui-modal relative z-10 flex h-full w-full flex-col bg-surface shadow-lg md:h-auto md:max-h-[86vh]",
          size === "md" && "md:max-w-md md:rounded-[16px]",
          size === "lg" && "md:max-w-lg md:rounded-[16px]",
          size === "preview" && "md:max-w-[720px] md:rounded-[16px]",
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 id={labelId} className="m-0 truncate text-base font-semibold">
            {title}
          </h2>
          <IconButton ref={closeRef} label="Close" onClick={onClose}>
            <IconClose className="h-5 w-5" />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3.5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
