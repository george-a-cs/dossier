"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { DossierLogo } from "@/components/DossierLogo";
import { Disclaimer } from "./Disclaimer";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (pathname === "/login") {
    return children;
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <DossierLogo />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh min-w-0 overflow-x-hidden">
      <Sidebar user={user} />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMenuOpen(true)} />
        <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 md:px-8 md:py-6">
          {children}
        </main>
        <Disclaimer />
      </div>
      <MobileNav user={user} open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
