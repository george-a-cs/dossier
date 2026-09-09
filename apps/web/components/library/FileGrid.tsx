import { IconEye, IconPencil, IconTrash } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { FileIcon } from "@/components/ui/FileIcon";
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
    <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 min-[480px]:grid-cols-2 lg:grid-cols-3">
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
                <span className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
                  <CategoryBadge category={doc.category} />
                  <StatusBadge status={doc.status} errorCode={doc.error_code} />
                </span>
              </div>
              <button
                type="button"
                onClick={() => onSelect(doc)}
                className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-2 border-0 bg-transparent p-0 text-left"
              >
                <span
                  title={doc.filename}
                  className="line-clamp-2 w-full min-w-0 break-words text-base font-semibold hover:underline"
                >
                  {doc.filename}
                </span>
                {doc.notes ? (
                  <span className="line-clamp-2 text-[13px] text-muted">{doc.notes}</span>
                ) : null}
                <span className="text-[13px] text-muted">{formatBytes(doc.byte_size)}</span>
              </button>
              <div className="mt-3 flex flex-wrap justify-end gap-2.5">
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-w-0 flex-1 px-2 max-w-28"
                  icon={<IconEye className="h-4 w-4" />}
                  onClick={() => onSelect(doc)}
                >
                  View
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-w-0 flex-1 px-2 max-w-28"
                  icon={<IconPencil className="h-4 w-4" />}
                  onClick={() => onEdit(doc)}
                >
                  Edit
                </Button>
                <Button
                  variant="dangerSecondary"
                  size="sm"
                  className="min-w-0 flex-1 px-2 max-w-28"
                  icon={<IconTrash className="h-4 w-4" />}
                  onClick={() => onDelete(doc)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
