import { IconChevronRight } from "@/components/icons";
import { FileIcon } from "@/components/ui/FileIcon";
import { FILE_KIND_LABEL, fileKind } from "@/lib/file-kind";
import type { Citation } from "@/lib/types";

function pageLabel(cite: Citation): string {
  if (cite.page_start == null) return "Cited passage";
  if (cite.page_end && cite.page_end !== cite.page_start) {
    return `Pages ${cite.page_start}–${cite.page_end}`;
  }
  return `Page ${cite.page_start}`;
}

export function FoundDocumentCta({
  citation,
  onOpen,
}: {
  citation: Citation;
  onOpen: (cite: Citation) => void;
}) {
  const type = fileKind(citation.filename);

  return (
    <button
      type="button"
      onClick={() => onOpen(citation)}
      className="group flex min-h-[4.5rem] w-full min-w-0 cursor-pointer items-center gap-3 rounded-[16px] bg-primary px-4 py-3.5 text-left text-primary-foreground shadow-md transition-[background-color,box-shadow] hover:bg-primary-600 hover:shadow-lg sm:gap-4 sm:px-5 sm:py-4"
    >
      <span className="inline-flex rounded-[12px] bg-white p-0.5 shadow-sm">
        <FileIcon filename={citation.filename} size="lg" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold tracking-tight">
          {citation.filename}
        </span>
        <span className="mt-1 block text-[13px] text-white/80">
          {FILE_KIND_LABEL[type]} · {pageLabel(citation)}
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-[10px] bg-white/15 px-2.5 py-2 text-sm font-medium group-hover:bg-white/25 sm:px-3">
        <span className="hidden sm:inline">Open</span>
        <IconChevronRight className="h-4 w-4" />
      </span>
    </button>
  );
}
