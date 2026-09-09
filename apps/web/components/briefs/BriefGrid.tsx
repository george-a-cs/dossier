import { IconBrief, IconTrash } from "@/components/icons";
import { IconButton } from "@/components/ui/IconButton";
import { formatWhen } from "@/lib/format";
import type { SavedBrief } from "@/lib/types";
import { BriefStatusBadge } from "./BriefStatusBadge";

export function BriefGrid({
  briefs,
  onOpen,
  onDelete,
}: {
  briefs: SavedBrief[];
  onOpen: (brief: SavedBrief) => void;
  onDelete: (brief: SavedBrief) => void;
}) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {briefs.map((brief) => (
        <li key={brief.id} className="min-w-0">
          <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-[16px] bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md sm:p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                <IconBrief className="h-7 w-7" />
              </span>
              <IconButton
                tone="danger"
                label={`Delete ${brief.title}`}
                onClick={() => onDelete(brief)}
              >
                <IconTrash className="h-4 w-4" />
              </IconButton>
            </div>
            <button
              type="button"
              className="flex flex-1 cursor-pointer flex-col items-start gap-2 border-0 bg-transparent p-0 text-left"
              onClick={() => onOpen(brief)}
            >
              <span className="line-clamp-2 break-words text-sm font-semibold">{brief.title}</span>
              <span className="text-[13px] text-muted">
                {formatWhen(brief.updatedAt)} · {brief.turns.length} turn
                {brief.turns.length === 1 ? "" : "s"}
              </span>
              <BriefStatusBadge brief={brief} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
