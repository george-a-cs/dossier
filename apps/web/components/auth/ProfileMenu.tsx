"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconLogout, IconSettings } from "@/components/icons";
import { initials, roleLabel } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { MOTION_MS, usePresence } from "@/lib/use-presence";
import type { AuthUser } from "@/lib/types";
import { useAuth } from "./AuthProvider";

export function ProfileMenu({
  user,
  align = "up",
  onAction,
}: {
  user: AuthUser;
  align?: "up" | "down";
  onAction?: () => void;
}) {
  const router = useRouter();
  const { logout } = useAuth();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const present = usePresence(open, MOTION_MS.popover);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-3 rounded-[12px] px-2 py-2 text-left transition-colors hover:bg-bg"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground"
          aria-hidden="true"
        >
          {initials(user)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
          <span className="block truncate text-[12px] text-muted">{roleLabel(user.role)}</span>
        </span>
      </button>
      {present ? (
        <div
          id={menuId}
          role="menu"
          data-state={open ? "open" : "closed"}
          className={cn(
            "ui-popover absolute left-0 right-0 z-30 w-full rounded-[12px] border border-line bg-surface p-1.5 shadow-lg",
            align === "up" && "ui-popover-up bottom-[calc(100%+8px)]",
            align === "down" && "top-[calc(100%+8px)]",
            !open && "pointer-events-none",
          )}
        >
          <div className="border-b border-line px-3 py-2">
            <p className="m-0 truncate text-sm font-medium text-ink">{user.name}</p>
            <p className="m-0 truncate text-[12px] text-muted">{user.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            className="mt-1 flex w-full cursor-pointer items-center gap-2 rounded-[10px] px-3 py-2 text-sm text-ink hover:bg-bg"
            onClick={() => {
              setOpen(false);
              onAction?.();
              router.push("/settings");
            }}
          >
            <IconSettings className="h-4 w-4 text-muted" />
            Settings
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full cursor-pointer items-center gap-2 rounded-[10px] px-3 py-2 text-sm text-ink hover:bg-bg"
            onClick={() => {
              setOpen(false);
              onAction?.();
              void logout();
            }}
          >
            <IconLogout className="h-4 w-4 text-muted" />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
