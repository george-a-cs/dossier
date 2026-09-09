"use client";

import { useEffect, useRef, useState } from "react";

export const MOTION_MS = {
  overlay: 220,
  popover: 160,
  tooltip: 140,
} as const;

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function usePresence(open: boolean, durationMs: number = MOTION_MS.overlay): boolean {
  const [present, setPresent] = useState(open);
  if (open && !present) {
    setPresent(true);
  }

  useEffect(() => {
    if (open) return;
    const ms = reducedMotion() ? 0 : durationMs;
    const timer = window.setTimeout(() => setPresent(false), ms);
    return () => window.clearTimeout(timer);
  }, [open, durationMs]);

  return present;
}

export function useHeld<T>(value: T | null | undefined): T | null {
  const ref = useRef<T | null>(value ?? null);
  if (value != null) ref.current = value;
  return value ?? ref.current;
}
