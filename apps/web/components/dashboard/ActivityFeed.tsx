import Link from "next/link";
import { IconClock } from "@/components/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileIcon } from "@/components/ui/FileIcon";
import { formatWhen } from "@/lib/format";
import type { Document, QueryEvent, SavedBrief } from "@/lib/types";

export type ActivityItem = {
  id: string;
  href: string;
  title: string;
  meta: string;
  at: string;
  kind: "file" | "brief";
};

export function buildActivity(
  documents: Document[],
  briefs: SavedBrief[],
  events: QueryEvent[],
): ActivityItem[] {
  const items: ActivityItem[] = [
    ...documents.map((doc) => ({
      id: `doc-${doc.id}`,
      href: `/library?doc=${encodeURIComponent(doc.id)}`,
      title: doc.filename,
      meta: doc.status === "ready" ? "File ready" : "File ingested",
      at: doc.created_at ?? "",
      kind: "file" as const,
    })),
    ...briefs.map((brief) => ({
      id: `brief-${brief.id}`,
      href: `/briefs/${brief.id}`,
      title: brief.title,
      meta: brief.turns.at(-1)?.final?.refused
        ? "Not in this dossier"
        : "Brief saved",
      at: brief.updatedAt,
      kind: "brief" as const,
    })),
    ...events
      .filter((event) => !briefs.some((brief) => brief.conversationId === event.request_id))
      .map((event) => ({
        id: `event-${event.id}`,
        href: "/briefs",
        title: event.refused ? "Brief refused" : "Brief grounded",
        meta: `${Math.round(event.embed_ms + event.retrieve_ms + event.llm_ms)} ms`,
        at: event.created_at,
        kind: "brief" as const,
      })),
  ];
  return items
    .filter((item) => item.at)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (!items.length) {
    return (
      <EmptyState
        embedded
        icon={<IconClock className="h-8 w-8" />}
        title="No activity yet"
        description="Uploads and briefs will show up here."
      />
    );
  }

  return (
    <ul className="m-0 list-none divide-y divide-line p-0">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="flex items-center gap-3 py-3 text-ink no-underline hover:text-primary"
          >
            <FileIcon filename={item.kind === "file" ? item.title : "brief.md"} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{item.title}</span>
              <span className="mt-0.5 block text-[13px] text-muted">
                {item.meta}
                <span className="sm:hidden"> · {formatWhen(item.at)}</span>
              </span>
            </span>
            <span className="hidden shrink-0 text-[12px] text-muted sm:inline">
              {formatWhen(item.at)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
