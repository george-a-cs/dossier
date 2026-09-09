"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconGrid, IconList, IconUpload } from "@/components/icons";
import { Autocomplete } from "@/components/ui/Autocomplete";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterButton, FilterPanel } from "@/components/ui/Filters";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { deleteDocument } from "@/lib/api";
import { UNCATEGORIZED, usedCategories } from "@/lib/categories";
import type { Document } from "@/lib/types";
import { useDocuments } from "@/lib/use-documents";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { EditDocumentModal } from "./EditDocumentModal";
import { FileGrid } from "./FileGrid";
import { FilePreview } from "./FilePreview";
import { FileTable } from "./FileTable";
import { UploadModal } from "./UploadModal";

type ViewMode = "table" | "grid";
const VIEW_KEY = "dossier.library.view";

function readView(): ViewMode {
  if (typeof window === "undefined") return "table";
  return window.localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "table";
}

export function LibraryView() {
  const router = useRouter();
  const params = useSearchParams();
  const { documents, loading, refresh } = useDocuments();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("table");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Document | null>(null);
  const [editing, setEditing] = useState<Document | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [deleting, setDeleting] = useState(false);
  const filtersId = useId();
  const filterCount = (query.trim() ? 1 : 0) + (categoryFilter !== "all" ? 1 : 0);

  useEffect(() => {
    setView(readView());
  }, []);

  const selectedId = params.get("doc");
  const chunkId = params.get("chunk");
  const selected = documents.find((doc) => doc.id === selectedId) ?? null;
  const categories = useMemo(() => usedCategories(documents), [documents]);
  const categoryOptions = useMemo(() => {
    const items = categories.map((item) => ({ value: item, label: item }));
    if (documents.some((doc) => !doc.category?.trim())) {
      items.push({ value: UNCATEGORIZED, label: UNCATEGORIZED });
    }
    return items;
  }, [categories, documents]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((doc) => {
      const category = doc.category?.trim() || UNCATEGORIZED;
      if (categoryFilter !== "all" && category !== categoryFilter) return false;
      if (!q) return true;
      return [doc.filename, doc.category, doc.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [documents, query, categoryFilter]);

  function setMode(next: ViewMode) {
    setView(next);
    window.localStorage.setItem(VIEW_KEY, next);
  }

  function openDoc(id: string, chunk?: string | null) {
    const search = new URLSearchParams();
    search.set("doc", id);
    if (chunk) search.set("chunk", chunk);
    router.replace(`/library?${search.toString()}`);
  }

  function closePreview() {
    router.replace("/library");
  }

  async function removeDocument(doc: Document) {
    setDeleting(true);
    setError(null);
    try {
      await deleteDocument(doc.id);
      if (selectedId === doc.id) closePreview();
      setPending(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  function openUpload(files: File[] = []) {
    setDroppedFiles(files);
    setUploadOpen(true);
    setError(null);
  }

  return (
    <div className="min-w-0">
      <PageHeader
        title="Library"
        count={documents.length}
        countLabel={`${documents.length} document${documents.length === 1 ? "" : "s"}`}
        actions={
          <>
            <FilterButton
              open={filtersOpen}
              activeCount={filterCount}
              controlsId={filtersId}
              onClick={() => setFiltersOpen((current) => !current)}
            />
            <Button
              icon={<IconUpload className="h-4 w-4" />}
              onClick={() => openUpload()}
            >
              Upload file
            </Button>
          </>
        }
      />
      <FilterPanel id={filtersId} open={filtersOpen}>
        <div className="flex w-full min-w-0 flex-col gap-3 sm:max-w-xl sm:flex-row sm:items-center">
          <SearchInput
            className="flex-1"
            placeholder="Search files"
            value={query}
            onChange={setQuery}
          />
          <Autocomplete
            className="w-full shrink-0 sm:w-52"
            value={categoryFilter === "all" ? "" : categoryFilter}
            onChange={(next) => setCategoryFilter(next || "all")}
            options={categoryOptions}
            placeholder="All categories"
            allowClear
            aria-label="Filter by category"
          />
        </div>
        <SegmentedControl
          value={view}
          onChange={setMode}
          options={[
            { value: "table", label: "Table", icon: <IconList className="h-4 w-4" /> },
            { value: "grid", label: "Grid", icon: <IconGrid className="h-4 w-4" /> },
          ]}
        />
      </FilterPanel>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const files = Array.from(event.dataTransfer.files);
          if (files.length) openUpload(files);
        }}
      >
        {loading ? (
          <p className="text-sm text-muted">Loading files…</p>
        ) : !filtered.length ? (
          <EmptyState
            icon={<IconUpload className="h-8 w-8" />}
            title={query || categoryFilter !== "all" ? "No matching files" : "Library is empty"}
            description={
              query || categoryFilter !== "all"
                ? "Try another name or category, or clear the filters."
                : "Drop a PDF, Word, Excel, CSV, Markdown, text, or image file here."
            }
            actions={
              query || categoryFilter !== "all" ? undefined : (
                <Button onClick={() => openUpload()}>Upload file</Button>
              )
            }
          />
        ) : view === "table" ? (
          <FileTable
            documents={filtered}
            selectedId={selectedId}
            onSelect={(doc) => openDoc(doc.id)}
            onEdit={setEditing}
            onDelete={setPending}
          />
        ) : (
          <FileGrid
            documents={filtered}
            selectedId={selectedId}
            onSelect={(doc) => openDoc(doc.id)}
            onEdit={setEditing}
            onDelete={setPending}
          />
        )}
      </div>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <FilePreview
        open={Boolean(selected)}
        documents={documents}
        file={selected}
        chunkId={chunkId}
        onSelect={(doc) => openDoc(doc.id, doc.id === selectedId ? chunkId : null)}
        onClose={closePreview}
        onDeleted={() => {
          closePreview();
          void refresh();
        }}
        onEdit={setEditing}
        suspendKeys={Boolean(editing)}
      />

      <UploadModal
        open={uploadOpen}
        initialFiles={droppedFiles}
        onClose={() => {
          setUploadOpen(false);
          setDroppedFiles([]);
        }}
        onUploaded={refresh}
      />

      <EditDocumentModal
        open={Boolean(editing)}
        document={editing}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />

      <ConfirmDeleteModal
        open={Boolean(pending)}
        title="Delete file?"
        name={pending?.filename ?? ""}
        description="This will remove"
        confirming={deleting}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) void removeDocument(pending);
        }}
      />
    </div>
  );
}
