import type { Citation } from "@/lib/types";

function documentKey(cite: Citation): string {
  return cite.document_id || cite.filename;
}

function mergePages(current: Citation, next: Citation): Citation {
  const starts = [current.page_start, next.page_start].filter(
    (page): page is number => page != null,
  );
  const ends = [
    current.page_end ?? current.page_start,
    next.page_end ?? next.page_start,
  ].filter((page): page is number => page != null);
  return {
    ...current,
    page_start: starts.length ? Math.min(...starts) : current.page_start,
    page_end: ends.length ? Math.max(...ends) : current.page_end,
  };
}

/** One card per file, even when several passages from that file were cited. */
export function uniqueFoundDocuments(citations: Citation[]): Citation[] {
  const byDocument = new Map<string, Citation>();
  for (const cite of citations) {
    const key = documentKey(cite);
    const existing = byDocument.get(key);
    byDocument.set(key, existing ? mergePages(existing, cite) : cite);
  }
  return [...byDocument.values()];
}
