"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteBrief as deleteBriefApi,
  deleteBriefTurn as deleteBriefTurnApi,
  getBrief as getBriefApi,
  listBriefs as listBriefsApi,
  putBrief,
} from "./api";
import type { SavedBrief } from "./types";

const LEGACY_KEY = "dossier.briefs.v1";
const listeners = new Set<() => void>();
let migrateOnce: Promise<void> | null = null;

function notify(): void {
  listeners.forEach((listen) => listen());
}

async function migrateLocalBriefs(): Promise<void> {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(LEGACY_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as SavedBrief[];
    if (!Array.isArray(parsed) || !parsed.length) {
      window.localStorage.removeItem(LEGACY_KEY);
      return;
    }
    await Promise.all(parsed.map((brief) => putBrief(brief)));
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* keep the local copy if the import failed */
  }
}

export async function listBriefs(): Promise<SavedBrief[]> {
  return listBriefsApi();
}

export async function getBrief(id: string): Promise<SavedBrief | null> {
  return getBriefApi(id);
}

export async function deleteBrief(id: string): Promise<void> {
  await deleteBriefApi(id);
  notify();
}

export async function deleteBriefTurn(id: string, index: number): Promise<SavedBrief> {
  const saved = await deleteBriefTurnApi(id, index);
  notify();
  return saved;
}

export function notifyBriefsChanged(): void {
  notify();
}

export function useBriefs(): {
  briefs: SavedBrief[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [briefs, setBriefs] = useState<SavedBrief[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setBriefs(await listBriefsApi());
    } catch {
      setBriefs([]);
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      void refresh();
    };
    listeners.add(sync);
    if (!migrateOnce) migrateOnce = migrateLocalBriefs();
    migrateOnce
      .catch(() => undefined)
      .then(refresh)
      .finally(() => setLoading(false));
    return () => {
      listeners.delete(sync);
    };
  }, [refresh]);

  return { briefs, loading, refresh };
}
