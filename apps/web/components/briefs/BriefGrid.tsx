import { IconBrief, IconEye, IconTrash } from "@/components/icons";
import { Button } from "@/components/ui/Button";
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
    <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 min-[480px]:grid-cols-2 lg:grid-cols-3">
      {briefs.map((brief) => (
        <li key={brief.id} className="min-w-0">
          <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-[16px] bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md sm:p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                <IconBrief className="h-7 w-7" />
              </span>
              <BriefStatusBadge brief={brief} />
            </div>
            <button
              type="button"
              className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-2 border-0 bg-transparent p-0 text-left"
              onClick={() => onOpen(brief)}
            >
              <span
                title={brief.title}
                className="line-clamp-2 w-full min-w-0 break-words text-base font-semibold"
              >
                {brief.title}
              </span>
              <span className="text-[13px] text-muted">
                {formatWhen(brief.updatedAt)} · {brief.turns.length} turn
                {brief.turns.length === 1 ? "" : "s"}
              </span>
            </button>
            <div className="mt-3 flex flex-wrap justify-end gap-2.5">
              <Button
                variant="secondary"
                size="sm"
                className="min-w-0 flex-1 px-2 max-w-28"
                icon={<IconEye className="h-4 w-4" />}
                onClick={() => onOpen(brief)}
              >
                View
              </Button>
              <Button
                variant="dangerSecondary"
                size="sm"
                className="min-w-0 flex-1 px-2 max-w-28"
                icon={<IconTrash className="h-4 w-4" />}
                onClick={() => onDelete(brief)}
              >
                Delete
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
