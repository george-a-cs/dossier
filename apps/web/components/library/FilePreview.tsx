"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconChevronDown,
  IconClose,
  IconDownload,
  IconPencil,
  IconTrash,
} from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { IconButton } from "@/components/ui/IconButton";
import { FileIcon } from "@/components/ui/FileIcon";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { deleteDocument, fetchDocumentFile, getChunk, listDocumentChunks } from "@/lib/api";
import { asTerms, CITE_MARK_CLASS, splitHighlight } from "@/lib/cite-highlight";
import { cn } from "@/lib/cn";
import { fileKind } from "@/lib/file-kind";
import { statusCopy } from "@/lib/status";
import type { Chunk, Document } from "@/lib/types";
import { MOTION_MS, useHeld, usePresence } from "@/lib/use-presence";
import { groupPages } from "./pages";
import { DocxPreview } from "./preview/DocxPreview";
import { MarkdownPreview } from "./preview/MarkdownPreview";
import { ImagePreview } from "./preview/ImagePreview";
import { PdfPreview } from "./preview/PdfPreview";
import { PlainPreview } from "./preview/PlainPreview";
import { PreviewLoading } from "./preview/PreviewLoading";
import { PreviewZoom } from "./preview/PreviewZoom";
import { SpreadsheetPreview } from "./preview/SpreadsheetPreview";
import { CategoryBadge } from "./CategoryBadge";
import { PreviewFileRail } from "./PreviewFileRail";
import { PreviewThumbs } from "./PreviewThumbs";

type Mode = "formatted" | "plain";

function imagePassage(text?: string | null): string | null {
  if (!text) return null;
  const stripped = text.replace(/^#\s*Image text\s*/i, "").trim();
  return stripped || text;
}

function textFromBytes(data: ArrayBuffer): string {
  return new TextDecoder("utf-8").decode(data);
}

export function FilePreview({
  documents,
  file: fileProp,
  chunkId,
  query,
  open = true,
  onSelect,
  onClose,
  onDeleted,
  onEdit,
  suspendKeys = false,
}: {
  documents: Document[];
  file: Document | null;
  chunkId?: string | null;
  query?: string | null;
  open?: boolean;
  onSelect: (doc: Document) => void;
  onClose: () => void;
  onDeleted: () => void;
  onEdit?: (doc: Document) => void;
  suspendKeys?: boolean;
}) {
  const file = useHeld(fileProp);
  const present = usePresence(open && fileProp != null, MOTION_MS.overlay);
  const kind = file ? fileKind(file.filename, file.mime) : "file";
  const [mode, setMode] = useState<Mode>("formatted");
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [focus, setFocus] = useState<Chunk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewBusy, setPreviewBusy] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [filesOpen, setFilesOpen] = useState(false);
  const markRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const filesPresent = usePresence(filesOpen, MOTION_MS.overlay);
  const canPickFile = documents.length > 1;

  const pages = useMemo(() => groupPages(chunks), [chunks]);
  const focusText = kind === "image" ? imagePassage(focus?.text) : focus?.text;
  const terms = useMemo(() => asTerms(query, focusText), [query, focusText]);
  const current = pages.find((item) => item.page === page) ?? pages[0] ?? null;
  const onPageCount = useCallback((count: number) => {
    setPageCount(count);
    setPage((value) => Math.min(value, count) || 1);
  }, []);

  useEffect(() => {
    if (!present) return;
    const previous = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    if (open) closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (!open || confirming || suspendKeys) return;
      if (event.key === "Escape") {
        if (filesOpen) {
          setFilesOpen(false);
          return;
        }
        onClose();
      }
      if (kind === "xlsx" || kind === "csv") return;
      if (event.key === "ArrowRight") {
        setPage((value) => Math.min(pageCount, value + 1));
      }
      if (event.key === "ArrowLeft") {
        setPage((value) => Math.max(1, value - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [present, open, onClose, pageCount, confirming, suspendKeys, kind, filesOpen]);

  useEffect(() => {
    if (!open) setFilesOpen(false);
  }, [open]);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setChunks([]);
    setBytes(null);
    setError(null);
    setActionError(null);
    setPage(1);
    setMode("formatted");
    setZoom(100);
    setFilesOpen(false);
    setLoading(true);
    setPreviewBusy(null);
    Promise.allSettled([listDocumentChunks(file.id), fetchDocumentFile(file.id)])
      .then(([chunksResult, fileResult]) => {
        if (cancelled) return;
        if (chunksResult.status === "fulfilled") {
          setChunks(chunksResult.value);
          if (!chunkId) {
            setPage(groupPages(chunksResult.value)[0]?.page ?? 1);
          }
        }
        if (fileResult.status === "fulfilled") {
          setBytes(fileResult.value);
        }
        if (chunksResult.status === "rejected" && fileResult.status === "rejected") {
          const reason = chunksResult.reason;
          setError(reason instanceof Error ? reason.message : "Could not load preview");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file?.id]);

  useEffect(() => {
    if (!chunkId) {
      setFocus(null);
      return;
    }
    getChunk(chunkId)
      .then((chunk) => {
        setFocus(chunk);
        if (chunk.page_start) setPage(chunk.page_start);
      })
      .catch(() => setFocus(null));
  }, [chunkId]);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center" });
  }, [focus?.id, mode]);

  const source = bytes ? textFromBytes(bytes) : "";
  const formatted = mode === "formatted";
  const onPreviewBusy = useCallback((label: string | null) => {
    setPreviewBusy(label);
  }, []);
  const showLoader =
    (loading || Boolean(previewBusy)) && !error && file?.status !== "failed";

  useEffect(() => {
    if (!file || loading || error || file.status === "failed" || !formatted || !bytes) return;
    if (kind === "pdf") setPreviewBusy((label) => label ?? "Opening PDF…");
    if (kind === "docx") setPreviewBusy((label) => label ?? "Opening document…");
    if (kind === "xlsx" || kind === "csv") {
      setPreviewBusy((label) => label ?? "Opening spreadsheet…");
    }
  }, [file, loading, error, formatted, bytes, kind]);

  if (!present || !file) return null;
  const doc = file;

  async function downloadFile() {
    setDownloading(true);
    setActionError(null);
    try {
      const data = bytes ?? (await fetchDocumentFile(doc.id));
      const blob = new Blob([data], { type: doc.mime || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = doc.filename;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  async function removeFile() {
    setDeleting(true);
    setActionError(null);
    try {
      await deleteDocument(doc.id);
      setConfirming(false);
      onDeleted();
    } catch (err) {
      setConfirming(false);
      setActionError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className={cn(
        "preview-dark ui-overlay fixed inset-0 z-50 flex h-dvh max-h-dvh min-w-0 flex-col overflow-hidden",
        !open && "pointer-events-none",
      )}
      data-state={open ? "open" : "closed"}
      role="dialog"
      aria-modal="true"
      aria-label={file.filename}
    >
      <header className="preview-chrome grid min-w-0 shrink-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-1.5 gap-y-2 border-b border-white/10 px-2.5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 lg:flex lg:min-h-14 lg:gap-3 lg:px-5 lg:py-2">
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 lg:flex-1">
          <FileIcon filename={file.filename} mime={file.mime} size="sm" />
          {canPickFile ? (
            <button
              type="button"
              aria-expanded={filesOpen}
              aria-haspopup="dialog"
              onClick={() => setFilesOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-1 rounded-[10px] py-0.5 text-left active:bg-white/10 lg:pointer-events-none"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{file.filename}</span>
                <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[12px] text-muted">
                  <CategoryBadge category={file.category} empty />
                  {file.notes ? (
                    <span className="hidden truncate lg:inline">{file.notes}</span>
                  ) : null}
                </span>
              </span>
              <IconChevronDown className="h-4 w-4 shrink-0 text-muted lg:hidden" />
            </button>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-sm font-semibold">{file.filename}</p>
              <p className="m-0 flex min-w-0 items-center gap-2 text-[12px] text-muted">
                <CategoryBadge category={file.category} empty />
                {file.notes ? (
                  <span className="hidden truncate lg:inline">{file.notes}</span>
                ) : null}
              </p>
            </div>
          )}
        </div>
        <div className="col-start-2 row-start-1 flex items-center lg:hidden">
          {onEdit ? (
            <IconButton label="Edit details" onClick={() => onEdit(file)} className="h-9 w-9">
              <IconPencil className="h-4 w-4" />
            </IconButton>
          ) : null}
          <IconButton
            label="Download"
            disabled={downloading}
            className="h-9 w-9"
            onClick={() => {
              void downloadFile();
            }}
          >
            <IconDownload className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="Delete"
            tone="danger"
            className="h-9 w-9"
            onClick={() => setConfirming(true)}
          >
            <IconTrash className="h-4 w-4" />
          </IconButton>
        </div>
        <IconButton
          ref={closeRef}
          className="col-start-3 row-start-1 h-9 w-9 lg:order-last lg:h-10 lg:w-10"
          label="Close preview"
          onClick={onClose}
        >
          <IconClose className="h-5 w-5" />
        </IconButton>
        <div className="col-span-3 row-start-2 flex min-w-0 items-center justify-between gap-2 px-0.5 lg:contents">
          <SegmentedControl
            className="min-w-0"
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: "formatted", label: "Preview" },
              { value: "plain", label: kind === "image" ? "Extracted" : "Plain" },
            ]}
          />
          <PreviewZoom value={zoom} onChange={setZoom} />
        </div>
        <div className="hidden items-center gap-1 lg:flex">
          {onEdit ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Edit details"
              icon={<IconPencil className="h-4 w-4" />}
              onClick={() => onEdit(file)}
            >
              Details
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            aria-label="Download"
            loading={downloading}
            icon={<IconDownload className="h-4 w-4" />}
            onClick={() => {
              void downloadFile();
            }}
          >
            Download
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Delete"
            className="text-danger hover:bg-danger-soft hover:text-danger"
            icon={<IconTrash className="h-4 w-4" />}
            onClick={() => setConfirming(true)}
          >
            Delete
          </Button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">
        <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(16rem,22%)_minmax(0,1fr)]">
          <PreviewFileRail
            className="preview-chrome"
            documents={documents}
            selectedId={file.id}
            onSelect={onSelect}
          />

          <section className="flex min-h-0 flex-col px-3 pb-3 lg:px-6 lg:pb-6">
          {actionError ? <p className="mb-3 text-sm text-danger">{actionError}</p> : null}
          {file.error_code === "vision_failed" ? (
            <p className="mb-3 text-sm text-warn">
              Visible text was not extracted. The vision host rejected the image
              (usually a missing mmproj on the VL model), and local OCR found nothing.
            </p>
          ) : null}
          {file.status === "failed" ? (
            <p className="text-sm text-danger">{statusCopy(file.status, file.error_code)}</p>
          ) : error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : loading ? null : formatted && kind === "image" && bytes ? (
            <ImagePreview
              documentId={file.id}
              data={bytes}
              mime={file.mime}
              filename={file.filename}
              highlight={terms}
              passage={focusText}
              zoom={zoom}
            />
          ) : formatted && kind === "pdf" && bytes ? (
            <PdfPreview
              data={bytes}
              page={page}
              onPage={setPage}
              onPageCount={onPageCount}
              highlight={terms}
              passage={focus?.text}
              pageHint={focus?.page_start}
              onBusy={onPreviewBusy}
              zoom={zoom}
            />
          ) : formatted && (kind === "xlsx" || kind === "csv") && bytes ? (
            <SpreadsheetPreview
              data={bytes}
              sheet={page}
              onSheet={setPage}
              onSheetCount={onPageCount}
              kind={kind === "csv" ? "csv" : "workbook"}
              onBusy={onPreviewBusy}
              zoom={zoom}
            />
          ) : formatted && kind === "docx" && bytes ? (
            <DocxPreview
              data={bytes}
              page={page}
              onPage={setPage}
              onPageCount={onPageCount}
              filename={file.filename}
              highlight={terms}
              passage={focus?.text}
              onBusy={onPreviewBusy}
              zoom={zoom}
            />
          ) : formatted && kind === "md" && bytes ? (
            <div className="flex min-h-0 flex-1 gap-3 lg:gap-4">
              <div className="preview-paper min-h-0 flex-1 overflow-auto rounded-[16px] bg-surface px-4 py-6 shadow-lg lg:rounded-[20px] lg:px-8 lg:py-10">
                <div style={{ zoom: zoom / 100 }}>
                  <MarkdownPreview
                    source={source}
                    highlight={terms}
                    passage={focus?.text}
                    markRef={markRef}
                  />
                </div>
              </div>
              <PreviewThumbs
                pages={pages}
                current={current?.page ?? page}
                onSelect={setPage}
                highlight={terms}
              />
            </div>
          ) : formatted && kind === "txt" && bytes ? (
            <div className="flex min-h-0 flex-1 gap-3 lg:gap-4">
              <div className="preview-paper min-h-0 flex-1 overflow-auto rounded-[16px] bg-surface px-4 py-6 shadow-lg lg:rounded-[20px] lg:px-8 lg:py-10">
                <p
                  className="m-0 whitespace-pre-wrap text-[15px] leading-7"
                  style={{ zoom: zoom / 100 }}
                >
                  {splitHighlight(source, terms, focus?.text).map((part, index) =>
                    part.hit ? (
                      <mark key={index} ref={markRef} className={CITE_MARK_CLASS}>
                        {part.text}
                      </mark>
                    ) : (
                      part.text
                    ),
                  )}
                </p>
              </div>
              <PreviewThumbs
                pages={pages}
                current={current?.page ?? page}
                onSelect={setPage}
                highlight={terms}
              />
            </div>
          ) : (
            <div className="relative flex min-h-0 flex-1">
              <PlainPreview
                pages={pages}
                page={page}
                onPage={setPage}
                focusId={focus?.id}
                highlight={terms}
                markRef={markRef}
                zoom={zoom}
              />
              <PreviewThumbs
                pages={pages}
                current={current?.page ?? page}
                onSelect={setPage}
                highlight={terms}
              />
              {pages.length ? (
                <p className="preview-page-chip pointer-events-none absolute bottom-3 left-1/2 m-0 -translate-x-1/2 rounded-full bg-surface px-3 py-1 text-[12px] font-medium shadow-md lg:bottom-4 lg:px-4 lg:py-1.5 lg:text-[13px]">
                  {(current ? pages.findIndex((item) => item.page === current.page) + 1 : 1)} of{" "}
                  {pages.length}
                </p>
              ) : null}
            </div>
          )}
        </section>
        </div>
        {showLoader ? (
          <div className="preview-chrome absolute inset-0 z-10 flex bg-bg">
            <PreviewLoading label={previewBusy ?? "Loading file…"} />
          </div>
        ) : null}
        {filesPresent ? (
          <div
            className={cn(
              "absolute inset-0 z-20 lg:hidden",
              !filesOpen && "pointer-events-none",
            )}
          >
            <button
              type="button"
              aria-label="Close files"
              className="ui-backdrop absolute inset-0 bg-[#1b2332]/40"
              data-state={filesOpen ? "open" : "closed"}
              onClick={() => setFilesOpen(false)}
            />
            <div
              role="dialog"
              aria-label="Files"
              data-state={filesOpen ? "open" : "closed"}
              className="preview-paper ui-sheet absolute inset-x-0 bottom-0 flex max-h-[75%] flex-col overflow-hidden rounded-t-[20px] bg-surface pb-[max(0.75rem,env(safe-area-inset-bottom))] text-ink shadow-lg"
            >
              <div className="flex shrink-0 flex-col">
                <span className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" />
                <div className="flex items-center justify-between px-2 pb-1">
                  <p className="m-0 px-3 text-sm font-semibold text-ink">Files</p>
                  <IconButton
                    label="Close files"
                    className="h-9 w-9"
                    onClick={() => setFilesOpen(false)}
                  >
                    <IconClose className="h-5 w-5" />
                  </IconButton>
                </div>
              </div>
              <PreviewFileRail
                variant="sheet"
                documents={documents}
                selectedId={file.id}
                onSelect={(doc) => {
                  setFilesOpen(false);
                  onSelect(doc);
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <ConfirmDeleteModal
        open={confirming}
        title="Delete file?"
        name={file.filename}
        description="This will remove"
        confirming={deleting}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          void removeFile();
        }}
      />
    </div>
  );
}
