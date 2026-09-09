"use client";

import { useEffect, useId, useRef, useState } from "react";
import { IconClose, IconUpload } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { FileIcon } from "@/components/ui/FileIcon";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { fileKind, UPLOAD_ACCEPT, UPLOAD_TYPES_LABEL } from "@/lib/file-kind";
import { formatBytes } from "@/lib/format";
import { uploadFiles } from "@/lib/ingest";
import { DocumentMetaFields } from "./DocumentMetaFields";

function acceptedFiles(list: FileList | File[] | null): File[] {
  return Array.from(list ?? []).filter((file) => fileKind(file.name, file.type) !== "file");
}

export function UploadModal({
  open,
  initialFiles = [],
  onClose,
  onUploaded,
}: {
  open: boolean;
  initialFiles?: File[];
  onClose: () => void;
  onUploaded: () => Promise<void> | void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initialRef = useRef(initialFiles);
  initialRef.current = initialFiles;
  const categoryId = useId();
  const notesId = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFiles(initialRef.current);
    setCategory("");
    setNotes("");
    setOver(false);
    setBusy(false);
    setError(null);
  }, [open]);

  function addFiles(next: FileList | File[] | null) {
    const accepted = acceptedFiles(next);
    if (!accepted.length) {
      setError(`Use a ${UPLOAD_TYPES_LABEL} file.`);
      return;
    }
    setError(null);
    setFiles((current) => {
      const names = new Set(current.map((file) => `${file.name}:${file.size}`));
      return [
        ...current,
        ...accepted.filter((file) => !names.has(`${file.name}:${file.size}`)),
      ];
    });
  }

  async function submit() {
    if (!files.length) {
      setError("Choose a file to upload.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await uploadFiles(files, {
        category: category || null,
        notes: notes.trim() || null,
      });
      await onUploaded();
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Upload file"
      size="lg"
      open={open}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy}
            icon={<IconUpload className="h-4 w-4" />}
            onClick={() => {
              void submit();
            }}
          >
            Upload
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <input
          ref={inputRef}
          type="file"
          accept={UPLOAD_ACCEPT}
          hidden
          multiple
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setOver(false);
            addFiles(event.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-[14px] border border-dashed px-4 py-8 text-center transition-colors",
            over
              ? "border-primary bg-primary-50 text-primary"
              : "border-line bg-bg text-muted hover:border-primary/50 hover:bg-primary-50/60",
          )}
        >
          <IconUpload className="h-8 w-8" />
          <span className="text-sm font-medium text-ink">
            Drop files here, or click to choose from your computer
          </span>
          <span className="text-[13px]">
            {UPLOAD_TYPES_LABEL}
          </span>
        </button>

        {files.length ? (
          <ul className="m-0 list-none space-y-2 p-0">
            {files.map((file) => (
              <li
                key={`${file.name}:${file.size}`}
                className="flex items-center gap-3 rounded-[10px] bg-bg px-3 py-2"
              >
                <FileIcon filename={file.name} mime={file.type} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{file.name}</span>
                  <span className="block text-[12px] text-muted">{formatBytes(file.size)}</span>
                </span>
                <IconButton
                  label={`Remove ${file.name}`}
                  onClick={() =>
                    setFiles((current) =>
                      current.filter(
                        (item) => item.name !== file.name || item.size !== file.size,
                      ),
                    )
                  }
                >
                  <IconClose className="h-4 w-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        ) : null}

        <DocumentMetaFields
          categoryId={categoryId}
          notesId={notesId}
          category={category}
          notes={notes}
          onCategory={setCategory}
          onNotes={setNotes}
        />

        {error ? <p className="m-0 text-sm text-danger">{error}</p> : null}
      </div>
    </Modal>
  );
}
