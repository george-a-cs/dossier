import { IconPencil, IconTrash } from "@/components/icons";
import { FileIcon } from "@/components/ui/FileIcon";
import { IconButton } from "@/components/ui/IconButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Document } from "@/lib/types";
import { CategoryBadge } from "./CategoryBadge";

export function FileGrid({
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
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      {documents.map((doc) => {
        const selected = doc.id === selectedId;
        return (
          <li key={doc.id} className="min-w-0">
            <div
              className={cn(
                "flex h-full min-w-0 flex-col overflow-hidden rounded-[16px] bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md sm:p-4",
                selected && "ring-2 ring-primary",
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <FileIcon filename={doc.filename} mime={doc.mime} size="lg" />
                <div className="flex shrink-0 items-center">
                  <IconButton
                    label={`Edit ${doc.filename}`}
                    onClick={() => onEdit(doc)}
                  >
                    <IconPencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    tone="danger"
                    label={`Delete ${doc.filename}`}
                    onClick={() => onDelete(doc)}
                  >
                    <IconTrash className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelect(doc)}
                className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-2 border-0 bg-transparent p-0 text-left"
              >
                <span className="line-clamp-2 break-words text-sm font-semibold">{doc.filename}</span>
                {doc.notes ? (
                  <span className="line-clamp-2 text-[13px] text-muted">{doc.notes}</span>
                ) : null}
                <span className="text-[13px] text-muted">{formatBytes(doc.byte_size)}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <CategoryBadge category={doc.category} />
                  <StatusBadge status={doc.status} errorCode={doc.error_code} />
                </span>
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
