"use client";

import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions, Util, version, type PDFDocumentProxy } from "pdfjs-dist";
import { cn } from "@/lib/cn";
import { matchPagedRuns, type HighlightQuery } from "@/lib/cite-highlight";
import { usePagedScroll } from "../usePagedScroll";

type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
};

GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

export type NormRect = {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

function isTextItem(item: unknown): item is PdfTextItem {
  return Boolean(item && typeof item === "object" && "str" in item);
}

function itemRect(
  item: PdfTextItem,
  start: number,
  end: number,
  viewport: { transform: number[]; width: number; height: number; scale: number },
): Omit<NormRect, "page"> {
  const tx = Util.transform(viewport.transform, item.transform);
  const fontHeight = Math.hypot(tx[2], tx[3]) || item.height * viewport.scale || 8;
  const width = (item.width || 0) * viewport.scale;
  const length = item.str.length || 1;
  const from = start / length;
  const to = end / length;
  const x = tx[4] + width * from;
  const ascent = fontHeight * 0.85;
  const top = tx[5] - ascent;
  const w = Math.max(width * (to - from), 1);
  const h = fontHeight * 1.2;
  return {
    x: x / viewport.width,
    y: top / viewport.height,
    w: w / viewport.width,
    h: h / viewport.height,
  };
}

function HighlightBoxes({
  rects,
  inflate = false,
}: {
  rects: Omit<NormRect, "page">[];
  inflate?: boolean;
}) {
  return (
    <>
      {rects.map((rect, index) => (
        <span
          key={`${rect.x}-${rect.y}-${index}`}
          data-cite-hl={index === 0 ? "" : undefined}
          className="cite-pdf-hl"
          style={{
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${Math.max(rect.w * 100, inflate ? 10 : 0.4)}%`,
            height: `${Math.max(rect.h * 100, inflate ? 3.5 : 0.4)}%`,
          }}
        />
      ))}
    </>
  );
}

export function PdfPreview({
  data,
  page,
  onPage,
  onPageCount,
  highlight,
  passage,
  pageHint,
  onBusy,
  zoom = 100,
}: {
  data: ArrayBuffer;
  page: number;
  onPage: (page: number) => void;
  onPageCount: (count: number) => void;
  highlight?: HighlightQuery;
  passage?: string | null;
  pageHint?: number | null;
  onBusy?: (label: string | null) => void;
  zoom?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLElement>(null);
  const canvases = useRef(new Map<number, HTMLCanvasElement>());
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [rendered, setRendered] = useState(0);
  const [rects, setRects] = useState<NormRect[]>([]);
  const ready = Boolean(pdf) && rendered >= (pdf?.numPages ?? 1);
  const loadingLabel = !pdf
    ? "Opening PDF…"
    : pdf.numPages > 1
      ? `Loading page ${Math.min(rendered + 1, pdf.numPages)} of ${pdf.numPages}…`
      : "Loading page…";

  usePagedScroll(scrollRef, page, onPage, Boolean(pdf));

  useEffect(() => {
    let cancelled = false;
    setPdf(null);
    setError(null);
    setThumbs([]);
    setRendered(0);
    const task = getDocument({ data: data.slice(0) });
    task.promise
      .then(async (doc) => {
        if (cancelled) return;
        setPdf(doc);
        onPageCount(doc.numPages);
        const urls: string[] = [];
        for (let index = 1; index <= doc.numPages; index += 1) {
          const leaf = await doc.getPage(index);
          const viewport = leaf.getViewport({ scale: 0.18 });
          const canvas = window.document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext("2d");
          if (context) {
            await leaf.render({ canvas, canvasContext: context, viewport }).promise;
            urls.push(canvas.toDataURL("image/png"));
          }
        }
        if (!cancelled) setThumbs(urls);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not open PDF");
      });
    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [data, onPageCount]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    const renders: { cancel: () => void }[] = [];

    void (async () => {
      try {
        for (let index = 1; index <= pdf.numPages; index += 1) {
          if (cancelled) return;
          const canvas = canvases.current.get(index);
          if (!canvas) continue;
          const leaf = await pdf.getPage(index);
          if (cancelled) return;
          const viewport = leaf.getViewport({ scale: 1.35 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext("2d");
          if (!context) continue;
          const render = leaf.render({ canvas, canvasContext: context, viewport });
          renders.push(render);
          try {
            await render.promise;
            if (!cancelled) setRendered(index);
          } catch {
            if (cancelled) return;
          }
        }
      } finally {
        if (!cancelled) setRendered(pdf.numPages);
      }
    })();

    return () => {
      cancelled = true;
      renders.forEach((render) => render.cancel());
    };
  }, [pdf]);

  useEffect(() => {
    const hasHighlight = Array.isArray(highlight)
      ? highlight.some((term) => term.trim())
      : Boolean(highlight?.trim());
    if (!pdf || !hasHighlight) {
      setRects([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const pages: { page: number; runs: PdfTextItem[] }[] = [];
      const viewports = new Map<number, { transform: number[]; width: number; height: number; scale: number }>();
      for (let index = 1; index <= pdf.numPages; index += 1) {
        const leaf = await pdf.getPage(index);
        if (cancelled) return;
        const viewport = leaf.getViewport({ scale: 1 });
        const content = await leaf.getTextContent();
        const runs: PdfTextItem[] = [];
        for (const item of content.items) {
          if (isTextItem(item)) runs.push(item);
        }
        pages.push({ page: index, runs });
        viewports.set(index, {
          transform: [...viewport.transform],
          width: viewport.width,
          height: viewport.height,
          scale: viewport.scale,
        });
      }
      const hits = matchPagedRuns(pages, highlight, passage, pageHint);
      const next: NormRect[] = [];
      for (const hit of hits) {
        const item = pages.find((leaf) => leaf.page === hit.page)?.runs[hit.run];
        const viewport = viewports.get(hit.page);
        if (!item || !viewport) continue;
        next.push({ page: hit.page, ...itemRect(item, hit.start, hit.end, viewport) });
      }
      if (!cancelled) setRects(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, highlight, passage, pageHint]);

  useEffect(() => {
    if (error) {
      onBusy?.(null);
      return;
    }
    onBusy?.(ready ? null : loadingLabel);
    return () => onBusy?.(null);
  }, [error, ready, loadingLabel, onBusy]);

  useEffect(() => {
    if (!rects.length) return;
    const timer = window.setTimeout(() => {
      const mark = scrollRef.current?.querySelector<HTMLElement>("[data-cite-hl]");
      mark?.scrollIntoView({ block: "center", inline: "nearest" });
      const thumb = thumbsRef.current?.querySelector<HTMLElement>("[data-cite-thumb]");
      thumb?.scrollIntoView({ block: "nearest" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [rects, thumbs]);

  if (error) return <p className="text-sm text-danger">{error}</p>;

  const byPage = new Map<number, NormRect[]>();
  for (const rect of rects) {
    const list = byPage.get(rect.page) ?? [];
    list.push(rect);
    byPage.set(rect.page, list);
  }

  return (
    <div className="relative flex min-h-0 flex-1 gap-4">
      <div ref={scrollRef} className={cn("relative min-h-0 flex-1 overflow-auto", !ready && "invisible")}>
        {pdf ? (
          <div className="mx-auto flex flex-col items-center gap-4 py-2" style={{ width: `${zoom}%` }}>
            {Array.from({ length: pdf.numPages }, (_, index) => {
              const number = index + 1;
              return (
                <div key={number} data-page={number} className="flex w-full justify-center">
                  <div className="relative w-full">
                    <canvas
                      ref={(node) => {
                        if (node) canvases.current.set(number, node);
                        else canvases.current.delete(number);
                      }}
                      className="block h-auto w-full rounded-[4px] bg-white shadow-md"
                    />
                    <div className="pointer-events-none absolute inset-0">
                      <HighlightBoxes rects={byPage.get(number) ?? []} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
        {ready && pdf ? (
          <p className="preview-page-chip pointer-events-none sticky bottom-3 left-1/2 m-0 mx-auto w-fit rounded-full bg-surface px-3 py-1 text-[12px] font-medium shadow-md lg:bottom-4 lg:px-4 lg:py-1.5 lg:text-[13px]">
            {page} of {pdf.numPages}
          </p>
        ) : null}
      </div>
      {ready && thumbs.length > 1 ? (
        <aside
          ref={thumbsRef}
          className="hidden min-h-0 w-[5.5rem] shrink-0 flex-col items-center gap-2 overflow-auto py-4 pr-3 md:flex"
        >
          {thumbs.map((src, index) => {
            const number = index + 1;
            const pageRects = byPage.get(number) ?? [];
            return (
              <button
                key={src}
                type="button"
                data-cite-thumb={pageRects.length ? "" : undefined}
                onClick={() => onPage(number)}
                className={cn(
                  "relative overflow-hidden rounded-[10px] bg-surface shadow-sm",
                  number === page && "ring-2 ring-primary ring-offset-2 ring-offset-bg",
                  pageRects.length > 0 && number !== page && "ring-1 ring-amber-400",
                )}
              >
                <span className="relative block w-16">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Page ${number}`} className="block w-16" />
                  <span className="pointer-events-none absolute inset-0">
                    <HighlightBoxes rects={pageRects} inflate />
                  </span>
                </span>
              </button>
            );
          })}
        </aside>
      ) : ready && thumbs.length === 1 && (byPage.get(1)?.length ?? 0) > 0 ? (
        <aside className="hidden min-h-0 w-[5.5rem] shrink-0 flex-col items-center gap-2 overflow-auto py-4 pr-3 md:flex">
          <span className="relative block w-16 overflow-hidden rounded-[10px] bg-surface shadow-sm ring-2 ring-primary ring-offset-2 ring-offset-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbs[0]} alt="Page 1" className="block w-16" />
            <span className="pointer-events-none absolute inset-0">
              <HighlightBoxes rects={byPage.get(1) ?? []} inflate />
            </span>
          </span>
        </aside>
      ) : null}
    </div>
  );
}
