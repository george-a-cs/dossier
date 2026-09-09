"use client";

import { FileIcon } from "@/components/ui/FileIcon";
import type { BriefFinal } from "@/lib/types";

export function debugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEBUG === "1";
}

export function DebugDrawer({
  final,
  asked,
}: {
  final: BriefFinal;
  asked: string;
}) {
  const rows = final.retrieval ?? [];
  if (!debugEnabled() || !rows.length) {
    return null;
  }
  const rewritten = final.rewritten_query && final.rewritten_query !== asked;

  return (
    <details className="mt-2 text-[13px] text-muted">
      <summary className="cursor-pointer">Sources used</summary>
      {rewritten ? (
        <p className="mt-2 mb-1.5">Rewritten: {final.rewritten_query}</p>
      ) : null}
      <ol className="mt-2 mb-0 list-decimal pl-4">
        {rows.map((row) => (
          <li key={row.chunk_id} className="mb-1">
            <span className="inline-flex items-center gap-1.5">
              <FileIcon filename={row.filename} size="sm" />
              {row.filename}
            </span>
            {row.page_start ? ` p.${row.page_start}` : ""} · rrf {row.rrf_rank} (
            {row.rrf_score.toFixed(3)}) · vec {row.vector_rank ?? "—"} · fts{" "}
            {row.fts_rank ?? "—"}
          </li>
        ))}
      </ol>
    </details>
  );
}
