"use client";

import Link from "next/link";
import { DossierLogo } from "@/components/DossierLogo";
import { IconMenu } from "@/components/icons";
import { IconButton } from "@/components/ui/IconButton";

export function TopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4 md:hidden">
      <Link href="/" className="inline-flex">
        <DossierLogo />
      </Link>
      <IconButton className="text-ink" label="Open menu" onClick={onMenu}>
        <IconMenu className="h-7 w-7" />
      </IconButton>
    </header>
  );
}
