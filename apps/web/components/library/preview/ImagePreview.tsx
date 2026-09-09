"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getDocumentLayout } from "@/lib/api";
import {
  matchImageBoxes,
  objectContainRect,
  type HighlightQuery,
  type ImageBox,
} from "@/lib/cite-highlight";
import type { OcrBox } from "@/lib/types";

export function ImagePreview({
  documentId,
  data,
  mime,
  filename,
  highlight,
  passage,
  zoom = 100,
}: {
  documentId: string;
  data: ArrayBuffer;
  mime?: string | null;
  filename: string;
  highlight?: HighlightQuery;
  passage?: string | null;
  zoom?: number;
}) {
  const url = useMemo(
    () => URL.createObjectURL(new Blob([data], { type: mime || "application/octet-stream" })),
    [data, mime],
  );
  const hostRef = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<OcrBox[]>([]);
  const [host, setHost] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    getDocumentLayout(documentId)
      .then((next) => {
        if (!cancelled) setBoxes(next);
      })
      .catch(() => {
        if (!cancelled) setBoxes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    const sync = () => setHost({ w: node.clientWidth, h: node.clientHeight });
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, [url]);

  const hits = useMemo(
    () => matchImageBoxes(boxes as ImageBox[], highlight, passage),
    [boxes, highlight, passage],
  );

  const fit = objectContainRect(natural.w, natural.h, host.w, host.h);
  const scale = zoom / 100;
  const width = fit.w * scale;
  const height = fit.h * scale;
  const ready = natural.w > 0 && host.w > 0 && width > 0 && height > 0;

  useEffect(() => {
    if (!hits.length || !ready) return;
    const mark = hostRef.current?.querySelector<HTMLElement>("[data-cite-hl]");
    mark?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [hits, ready, zoom]);

  return (
    <div className="preview-paper relative min-h-0 flex-1 rounded-[16px] bg-surface shadow-lg lg:rounded-[20px]">
      <div ref={hostRef} className="absolute inset-3 overflow-auto lg:inset-6">
        <div
          className="flex items-center justify-center"
          style={
            ready
              ? {
                  minWidth: "100%",
                  minHeight: "100%",
                  width: Math.max(width, host.w),
                  height: Math.max(height, host.h),
                }
              : { minWidth: "100%", minHeight: "100%" }
          }
        >
          <div className="relative" style={ready ? { width, height } : undefined}>
            {/* Blob URL from the authenticated file download. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={filename}
              className={ready ? "block h-full w-full" : "block max-h-full max-w-full"}
              onLoad={(event) => {
                const img = event.currentTarget;
                setNatural({ w: img.naturalWidth, h: img.naturalHeight });
              }}
            />
            {hits.length && ready ? (
              <div className="pointer-events-none absolute inset-0">
                {hits.map((box, index) => (
                  <span
                    key={`${box.x}-${box.y}-${index}`}
                    data-cite-hl={index === 0 ? "" : undefined}
                    className="cite-pdf-hl"
                    style={{
                      left: `${box.x * 100}%`,
                      top: `${box.y * 100}%`,
                      width: `${box.w * 100}%`,
                      height: `${box.h * 100}%`,
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
