import { cn } from "@/lib/cn";
import {
  CITE_MARK_CLASS,
  snippetAround,
  splitHighlight,
  type HighlightQuery,
} from "@/lib/cite-highlight";
import type { PreviewPage } from "./pages";

export function PreviewThumbs({
  pages,
  current,
  onSelect,
  highlight,
}: {
  pages: PreviewPage[];
  current: number;
  onSelect: (page: number) => void;
  highlight?: HighlightQuery;
}) {
  if (pages.length <= 1) return null;

  return (
    <aside className="hidden min-h-0 w-[5.5rem] shrink-0 flex-col items-center gap-2 overflow-auto py-4 pr-3 md:flex">
      {pages.map((item) => {
        const active = item.page === current;
        const snippet = snippetAround(item.snippet, highlight);
        const parts = splitHighlight(snippet, highlight);
        const cited = parts.some((part) => part.hit);
        return (
          <button
            key={item.page}
            type="button"
            aria-current={active ? "page" : undefined}
            data-cite-thumb={cited ? "" : undefined}
            onClick={() => onSelect(item.page)}
            className={cn(
              "h-24 w-16 shrink-0 cursor-pointer overflow-hidden rounded-[10px] bg-surface p-1.5 text-left shadow-sm",
              active && "ring-2 ring-primary ring-offset-2 ring-offset-bg",
              cited && !active && "ring-1 ring-amber-400",
            )}
          >
            <span className="block h-full overflow-hidden text-[5px] leading-[1.35] text-muted">
              {parts.map((part, index) =>
                part.hit ? (
                  <mark key={index} className={CITE_MARK_CLASS}>
                    {part.text}
                  </mark>
                ) : (
                  part.text
                ),
              )}
            </span>
          </button>
        );
      })}
    </aside>
  );
}
