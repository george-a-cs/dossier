"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ProfileMenu } from "@/components/auth/ProfileMenu";
import { DossierLogo } from "@/components/DossierLogo";
import { IconBrief, IconFolder, IconHome, IconPlus } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { AuthUser } from "@/lib/types";
import { isActive, NAV } from "./nav";

const ICONS = {
  "/": IconHome,
  "/library": IconFolder,
  "/briefs": IconBrief,
};

export function Sidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      <div className="hidden w-60 shrink-0 md:block" aria-hidden="true" />
      <aside className="fixed inset-y-0 left-0 z-20 hidden h-dvh w-60 flex-col border-r border-line bg-surface md:flex">
        <div className="border-b border-line px-5 pt-6 pb-4">
          <Link href="/" className="inline-flex">
            <DossierLogo />
          </Link>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pt-3" aria-label="Main">
          {NAV.map((item) => {
            const Icon = ICONS[item.href];
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-muted hover:bg-bg hover:text-ink",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto shrink-0 px-4 pb-3">
          <Button
            className="w-full"
            icon={<IconPlus className="h-4 w-4" />}
            onClick={() => router.push("/briefs/new")}
          >
            New brief
          </Button>
        </div>
        <div className="shrink-0 border-t border-line p-3">
          <ProfileMenu user={user} align="up" />
        </div>
      </aside>
    </>
  );
}
