"use client";

import { useMemo, useState } from "react";
import { IconEye, IconPencil, IconTrash } from "@/components/icons";
import { FileIcon } from "@/components/ui/FileIcon";
import { IconButton } from "@/components/ui/IconButton";
import { SortHeader, type SortDir } from "@/components/ui/SortHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { categoryLabel } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { formatBytes, formatWhen } from "@/lib/format";
import { statusCopy } from "@/lib/status";
import type { Document, DocumentStatus } from "@/lib/types";
import { CategoryBadge } from "./CategoryBadge";

type SortKey = "name" | "category" | "status" | "size" | "added";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "category", label: "Category" },
  { key: "status", label: "Status" },
  { key: "size", label: "Size" },
  { key: "added", label: "Added" },
];

const STATUS_ORDER: Record<DocumentStatus, number> = {
  queued: 0,
  parsing: 1,
  chunking: 2,
  embedding: 3,
  ready: 4,
  failed: 5,
};

function compare(a: Document, b: Document, key: SortKey): number {
  switch (key) {
    case "name":
      return a.filename.localeCompare(b.filename, undefined, { sensitivity: "base" });
    case "category":
      return categoryLabel(a.category).localeCompare(categoryLabel(b.category), undefined, {
        sensitivity: "base",
      });
    case "status": {
      const rank = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (rank !== 0) return rank;
      return statusCopy(a.status, a.error_code).localeCompare(
        statusCopy(b.status, b.error_code),
        undefined,
        { sensitivity: "base" },
      );
    }
    case "size":
      return (a.byte_size ?? -1) - (b.byte_size ?? -1);
    case "added":
      return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  }
}

function defaultDir(key: SortKey): SortDir {
  return key === "name" || key === "category" || key === "status" ? "asc" : "desc";
}

export function FileTable({
  documents,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
}: {
  documents: Document[];
  selectedId: string | null;
  onSelect: (doc: Document) => void;
  onEdit: (doc: Document) => void;
  onDelete: (doc: Document) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("added");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const factor = sortDir === "asc" ? 1 : -1;
    return [...documents].sort((a, b) => {
      const result = compare(a, b, sortKey);
      if (result !== 0) return result * factor;
      return a.id.localeCompare(b.id);
    });
  }, [documents, sortKey, sortDir]);

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
      <table className="w-full min-w-[44rem] border-collapse text-sm">
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
          {sorted.map((doc) => {
            const selected = doc.id === selectedId;
            return (
              <tr
                key={doc.id}
                className={cn(
                  "cursor-pointer border-b border-line last:border-b-0 hover:bg-bg",
                  selected && "bg-primary-soft",
                )}
                onClick={() => onSelect(doc)}
              >
                <td className="px-4 py-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <FileIcon filename={doc.filename} mime={doc.mime} />
                    <span className="min-w-0">
                      <button
                        type="button"
                        className="block max-w-full cursor-pointer truncate text-left font-semibold hover:underline"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(doc);
                        }}
                      >
                        {doc.filename}
                      </button>
                      {doc.notes ? (
                        <span className="mt-0.5 block truncate text-[13px] text-muted">
                          {doc.notes}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <CategoryBadge category={doc.category} empty />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={doc.status} errorCode={doc.error_code} />
                </td>
                <td className="px-4 py-3 text-muted">{formatBytes(doc.byte_size)}</td>
                <td className="px-4 py-3 text-muted">{formatWhen(doc.created_at)}</td>
                <td className="px-2 py-3 text-right">
                  <span className="inline-flex items-center justify-end">
                    <IconButton
                      label={`View ${doc.filename}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(doc);
                      }}
                    >
                      <IconEye />
                    </IconButton>
                    <IconButton
                      label={`Edit ${doc.filename}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(doc);
                      }}
                    >
                      <IconPencil />
                    </IconButton>
                    <IconButton
                      tone="danger"
                      label={`Delete ${doc.filename}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(doc);
                      }}
                    >
                      <IconTrash />
                    </IconButton>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
