"use client";

import { useCallback, useEffect, useState } from "react";
import { listDocuments } from "./api";
import type { Document } from "./types";

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setDocuments(await listDocuments());
    } catch {
      setDocuments([]);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  return { documents, loading, refresh, setDocuments };
}
