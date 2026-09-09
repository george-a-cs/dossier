"use client";

import { useMemo, useState } from "react";
import { IconBrief, IconTrash } from "@/components/icons";
import { IconButton } from "@/components/ui/IconButton";
import { SortHeader, type SortDir } from "@/components/ui/SortHeader";
import { formatWhen } from "@/lib/format";
import type { SavedBrief } from "@/lib/types";
import { briefStatus } from "./brief-status";
import { BriefStatusBadge } from "./BriefStatusBadge";

type SortKey = "title" | "status" | "turns" | "updated";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "turns", label: "Turns" },
  { key: "updated", label: "Updated" },
];

function compare(a: SavedBrief, b: SavedBrief, key: SortKey): number {
  switch (key) {
    case "title":
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    case "status":
      return briefStatus(a).label.localeCompare(briefStatus(b).label, undefined, {
        sensitivity: "base",
      });
    case "turns":
      return a.turns.length - b.turns.length;
    case "updated":
      return a.updatedAt.localeCompare(b.updatedAt);
  }
}

function defaultDir(key: SortKey): SortDir {
  return key === "title" || key === "status" ? "asc" : "desc";
}

export function BriefTable({
  briefs,
  onOpen,
  onDelete,
}: {
  briefs: SavedBrief[];
  onOpen: (brief: SavedBrief) => void;
  onDelete: (brief: SavedBrief) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const factor = sortDir === "asc" ? 1 : -1;
    return [...briefs].sort((a, b) => {
      const result = compare(a, b, sortKey);
      if (result !== 0) return result * factor;
      return a.id.localeCompare(b.id);
    });
  }, [briefs, sortKey, sortDir]);

  function toggle(key: SortKey) {
    if (key === sortKey) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(defaultDir(key));
  }

  return (
    <div className="overflow-x-auto rounded-[16px] bg-surface shadow-sm">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[13px] text-muted">
            {COLUMNS.map((column) => {
              const active = column.key === sortKey;
              return (
                <th
                  key={column.key}
                  className="px-4 py-3 font-medium"
                  aria-sort={
                    active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
                  }
                >
                  <SortHeader
                    label={column.label}
                    active={active}
                    direction={active ? sortDir : defaultDir(column.key)}
                    onClick={() => toggle(column.key)}
                  />
                </th>
              );
            })}
            <th className="px-4 py-3 font-medium">
              <span className="hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((brief) => (
            <tr
              key={brief.id}
              className="cursor-pointer border-b border-line last:border-b-0 hover:bg-bg"
              onClick={() => onOpen(brief)}
            >
              <td className="px-4 py-3">
                <span className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                    <IconBrief className="h-5 w-5" />
                  </span>
                  <span className="font-semibold">{brief.title}</span>
                </span>
              </td>
              <td className="px-4 py-3">
                <BriefStatusBadge brief={brief} />
              </td>
              <td className="px-4 py-3 text-muted">{brief.turns.length}</td>
              <td className="px-4 py-3 text-muted">{formatWhen(brief.updatedAt)}</td>
              <td className="px-2 py-3 text-right">
                <IconButton
                  tone="danger"
                  label={`Delete ${brief.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(brief);
                  }}
                >
                  <IconTrash className="h-4 w-4" />
                </IconButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
