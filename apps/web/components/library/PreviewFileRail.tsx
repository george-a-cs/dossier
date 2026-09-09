import { FileIcon } from "@/components/ui/FileIcon";
import { cn } from "@/lib/cn";
import { formatBytes, formatWhen } from "@/lib/format";
import type { Document } from "@/lib/types";
import { CategoryBadge } from "./CategoryBadge";

export function PreviewFileRail({
  documents,
  selectedId,
  onSelect,
  variant = "rail",
  className,
}: {
  documents: Document[];
  selectedId: string;
  onSelect: (doc: Document) => void;
  variant?: "rail" | "sheet";
  className?: string;
}) {
  return (
    <aside
      className={cn(
        variant === "sheet"
          ? "flex min-h-0 flex-1 flex-col overflow-auto px-2 pb-2 text-ink"
          : "hidden min-h-0 flex-col overflow-auto px-3 py-4 lg:flex",
        className,
      )}
    >
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {documents.map((doc) => {
          const selected = doc.id === selectedId;
          return (
            <li key={doc.id}>
              <button
                type="button"
                onClick={() => onSelect(doc)}
                className={cn(
                  "relative w-full cursor-pointer rounded-[14px] px-4 py-3.5 text-left transition-shadow",
                  selected
                    ? "bg-surface shadow-md"
                    : "bg-transparent hover:bg-surface/70",
                )}
              >
                {selected ? (
                  <span className="absolute top-3 bottom-3 left-0 w-1 rounded-full bg-primary" />
                ) : null}
                <span className="flex min-w-0 items-start gap-2.5">
                  <FileIcon filename={doc.filename} mime={doc.mime} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{doc.filename}</span>
                    {doc.category?.trim() ? (
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <CategoryBadge category={doc.category} />
                      </span>
                    ) : null}
                    <span className="mt-1 block truncate text-[13px] text-muted">
                      {formatBytes(doc.byte_size)} · {formatWhen(doc.created_at)}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
