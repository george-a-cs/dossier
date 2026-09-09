"use client";

import { useEffect, useState } from "react";
import type { SavedBrief } from "./types";

const KEY = "dossier.briefs.v1";
const listeners = new Set<() => void>();

function read(): SavedBrief[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedBrief[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(briefs: SavedBrief[]): void {
  window.localStorage.setItem(KEY, JSON.stringify(briefs));
  listeners.forEach((listen) => listen());
}

export function listBriefs(): SavedBrief[] {
  return read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getBrief(id: string): SavedBrief | null {
  return read().find((brief) => brief.id === id) ?? null;
}

export function upsertBrief(next: SavedBrief): SavedBrief {
  const briefs = read().filter((brief) => brief.id !== next.id);
  briefs.push(next);
  write(briefs);
  return next;
}

export function deleteBrief(id: string): void {
  write(read().filter((brief) => brief.id !== id));
}

export function useBriefs(): SavedBrief[] {
  const [briefs, setBriefs] = useState<SavedBrief[]>([]);

  useEffect(() => {
    const sync = () => setBriefs(listBriefs());
    sync();
    listeners.add(sync);
    window.addEventListener("storage", sync);
    return () => {
      listeners.delete(sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return briefs;
}

export function useBrief(id: string | null): SavedBrief | null {
  const briefs = useBriefs();
  if (!id) return null;
  return briefs.find((brief) => brief.id === id) ?? null;
}
