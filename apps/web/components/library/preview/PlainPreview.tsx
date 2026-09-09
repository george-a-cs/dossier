"use client";

import { useRef, type Ref } from "react";
import { CITE_MARK_CLASS, splitHighlight, type HighlightQuery } from "@/lib/cite-highlight";
import type { Chunk } from "@/lib/types";
import type { PreviewPage } from "../pages";
import { usePagedScroll } from "../usePagedScroll";

export function PlainPreview({
  pages,
  page,
  onPage,
  focusId,
  highlight,
  markRef,
  zoom = 100,
}: {
  pages: PreviewPage[];
  page: number;
  onPage: (page: number) => void;
  focusId?: string | null;
  highlight?: HighlightQuery;
  markRef: Ref<HTMLElement>;
  zoom?: number;
}) {
  const scrollRef = useRef<HTMLElement>(null);
  usePagedScroll(scrollRef, page, onPage, pages.length > 0);

  if (!pages.length) return <p className="text-sm text-muted">Reading document…</p>;

  return (
    <article
      ref={scrollRef}
      className="preview-paper min-h-0 flex-1 overflow-auto rounded-[16px] bg-surface px-4 py-6 shadow-lg lg:rounded-[20px] lg:px-10 lg:py-10"
    >
      <div className="space-y-10 text-[15px] leading-7" style={{ zoom: zoom / 100 }}>
        {pages.map((item) => (
          <section
            key={item.page}
            data-page={item.page}
            className="border-b border-line pb-10 last:border-0 last:pb-0"
          >
            {pages.length > 1 ? (
              <p className="mt-0 mb-4 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                Page {item.page}
              </p>
            ) : null}
            <div className="space-y-5">
              {item.chunks.map((chunk: Chunk) => {
                const highlighted = focusId === chunk.id;
                return (
                  <section key={chunk.id}>
                    {chunk.section_title ? (
                      <h3 className="mt-0 mb-2 text-sm font-semibold text-muted">
                        {chunk.section_title}
                      </h3>
                    ) : null}
                    <p className="m-0 whitespace-pre-wrap">
                      {highlighted
                        ? splitHighlight(chunk.text, highlight, chunk.text).map((part, index) =>
                            part.hit ? (
                              <mark
                                key={index}
                                ref={index === 0 ? markRef : undefined}
                                className={CITE_MARK_CLASS}
                              >
                                {part.text}
                              </mark>
                            ) : (
                              part.text
                            ),
                          )
                        : chunk.text}
                    </p>
                  </section>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
