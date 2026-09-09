"use client";

import { useEffect, useRef, type Ref } from "react";
import { highlightDom, type HighlightQuery } from "@/lib/cite-highlight";
import { renderMarkdown } from "@/lib/markdown";

export function MarkdownPreview({
  source,
  highlight,
  passage,
  markRef,
}: {
  source: string;
  highlight?: HighlightQuery;
  passage?: string | null;
  markRef?: Ref<HTMLElement | null>;
}) {
  const hostRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const mark = highlightDom(host, highlight, passage);
    if (markRef && typeof markRef !== "function") markRef.current = mark;
    mark?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [source, highlight, passage, markRef]);

  return (
    <article
      ref={hostRef}
      className="md-preview mx-auto max-w-3xl"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }}
    />
  );
}
