"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ProfileMenu } from "@/components/auth/ProfileMenu";
import { DossierLogo } from "@/components/DossierLogo";
import {
  IconBrief,
  IconClose,
  IconFolder,
  IconHome,
  IconPlus,
} from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";
import { MOTION_MS, usePresence } from "@/lib/use-presence";
import type { AuthUser } from "@/lib/types";
import { isActive, NAV } from "./nav";

const ICONS = {
  "/": IconHome,
  "/library": IconFolder,
  "/briefs": IconBrief,
};

export function MobileNav({
  user,
  open,
  onClose,
}: {
  user: AuthUser;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const present = usePresence(open, MOTION_MS.overlay);
  const state = open ? "open" : "closed";

  useEffect(() => {
    if (!present) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
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
        "ui-nav fixed inset-0 z-50 flex flex-col bg-surface md:hidden",
        !open && "pointer-events-none",
      )}
      data-state={state}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <DossierLogo />
        <IconButton label="Close menu" onClick={onClose}>
          <IconClose className="h-6 w-6" />
        </IconButton>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 pt-3" aria-label="Main">
        {NAV.map((item) => {
          const Icon = ICONS[item.href];
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-[14px] px-4 py-3.5 text-[20px] font-medium",
                active ? "bg-primary-soft text-primary" : "text-ink",
              )}
            >
              <Icon className="h-6 w-6" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 pb-3">
        <Button
          className="w-full"
          icon={<IconPlus className="h-4 w-4" />}
          onClick={() => {
            onClose();
            router.push("/briefs/new");
          }}
        >
          New brief
        </Button>
      </div>
      <div className="border-t border-line p-3">
        <ProfileMenu user={user} align="up" onAction={onClose} />
      </div>
    </div>
  );
}
