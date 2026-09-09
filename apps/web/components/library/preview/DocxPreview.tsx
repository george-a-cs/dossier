"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { highlightDom, type HighlightQuery } from "@/lib/cite-highlight";
import { usePagedScroll } from "../usePagedScroll";

type Thumb = {
  page: number;
  html: string;
  width: number;
  height: number;
};

const WORD_OPTIONS = {
  className: "docx",
  inWrapper: true,
  breakPages: true,
  ignoreLastRenderedPageBreak: false,
  ignoreWidth: false,
  ignoreHeight: false,
  ignoreFonts: false,
  renderHeaders: true,
  renderFooters: true,
  renderFootnotes: true,
  renderEndnotes: true,
  useBase64URL: true,
  experimental: true,
};

function isLegacyDoc(filename?: string): boolean {
  const lower = (filename ?? "").toLowerCase();
  return lower.endsWith(".doc") && !lower.endsWith(".docx");
}

function pageNodes(host: HTMLElement): HTMLElement[] {
  return [...host.querySelectorAll<HTMLElement>(".docx-wrapper > section")];
}

export function DocxPreview({
  data,
  page,
  onPage,
  onPageCount,
  filename,
  highlight,
  passage,
  onBusy,
  zoom = 100,
}: {
  data: ArrayBuffer;
  page: number;
  onPage: (page: number) => void;
  onPageCount: (count: number) => void;
  filename?: string;
  highlight?: HighlightQuery;
  passage?: string | null;
  onBusy?: (label: string | null) => void;
  zoom?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [error, setError] = useState<string | null>(null);

  usePagedScroll(scrollRef, page, onPage, ready);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    host.replaceChildren();
    setReady(false);
    setThumbs([]);
    setError(null);

    void import("docx-preview")
      .then(({ renderAsync }) =>
        renderAsync(data.slice(0), host, host, WORD_OPTIONS),
      )
      .then(() => {
        if (cancelled) return;
        const pages = pageNodes(host);
        pages.forEach((node, index) => {
          node.setAttribute("data-page", String(index + 1));
        });
        const total = pages.length || 1;
        setCount(total);
        onPageCount(total);
        setReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isLegacyDoc(filename)) {
          setError(
            "This .doc file can’t be shown with Word formatting. Save it as .docx and upload again, or use Download to open it in Word.",
          );
          return;
        }
        setError(err instanceof Error ? err.message : "Could not open Word document");
      });

    return () => {
      cancelled = true;
    };
  }, [data, filename, onPageCount]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !ready) return;
    const mark = highlightDom(host, highlight, passage);
    const pages = pageNodes(host);
    setThumbs(
      pages.map((node, index) => ({
        page: index + 1,
        html: node.outerHTML,
        width: node.offsetWidth || 1,
        height: node.offsetHeight || 1,
      })),
    );
    mark?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [highlight, passage, ready]);

  useEffect(() => {
    const scroll = scrollRef.current;
    const host = hostRef.current;
    if (!scroll || !host || !ready) return;

    function fit() {
      if (!host || !scroll) return;
      const first = host.querySelector<HTMLElement>("section.docx");
      if (!first) return;
      const available = Math.max(160, scroll.clientWidth - 16);
      const width = first.offsetWidth || available;
      const scale = Math.min(1, available / width) * (zoom / 100);
      host.style.transform = `scale(${scale})`;
      host.style.transformOrigin = "top center";
      host.style.width = `${width}px`;
      const parent = host.parentElement;
      if (parent) {
        parent.style.height = `${host.scrollHeight * scale}px`;
        parent.style.width = `${width * scale}px`;
      }
    }

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(scroll);
    return () => observer.disconnect();
  }, [ready, zoom]);

  useEffect(() => {
    onBusy?.(error ? null : ready ? null : "Opening document…");
    return () => onBusy?.(null);
  }, [error, ready, onBusy]);

  if (error) return <p className="text-sm text-danger">{error}</p>;

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <div ref={scrollRef} className={cn("relative min-h-0 flex-1 overflow-auto", !ready && "invisible")}>
        <div className="mx-auto">
          <div ref={hostRef} className="docx-host" />
        </div>
        {ready ? (
          <p className="preview-page-chip pointer-events-none sticky bottom-3 left-1/2 m-0 mx-auto w-fit rounded-full bg-surface px-3 py-1 text-[12px] font-medium shadow-md lg:bottom-4 lg:px-4 lg:py-1.5 lg:text-[13px]">
            {page} of {count}
          </p>
        ) : null}
      </div>
      {thumbs.length > 1 || thumbs.some((item) => item.html.includes("cite-highlight")) ? (
        <aside className="hidden min-h-0 w-[5.5rem] shrink-0 flex-col items-center gap-2 overflow-auto py-4 pr-3 md:flex">
          {thumbs.map((item) => (
            <button
              key={item.page}
              type="button"
              data-cite-thumb={item.html.includes("cite-highlight") ? "" : undefined}
              onClick={() => onPage(item.page)}
              className={cn(
                "overflow-hidden rounded-[10px] bg-white shadow-sm",
                item.page === page && "ring-2 ring-primary ring-offset-2 ring-offset-bg",
                item.html.includes("cite-highlight") &&
                  item.page !== page &&
                  "ring-1 ring-amber-400",
              )}
            >
              <span className="relative block h-24 w-16 overflow-hidden bg-white">
                <span
                  className="pointer-events-none absolute top-0 left-0 origin-top-left"
                  style={{
                    width: item.width,
                    height: item.height,
                    transform: `scale(${64 / item.width})`,
                  }}
                  dangerouslySetInnerHTML={{ __html: item.html }}
                />
              </span>
            </button>
          ))}
        </aside>
      ) : null}
    </div>
  );
}
