"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FileIcon } from "@/components/ui/FileIcon";
import { Modal } from "@/components/ui/Modal";
import { updateDocumentMeta } from "@/lib/api";
import { useHeld } from "@/lib/use-presence";
import type { Document } from "@/lib/types";
import { DocumentMetaFields } from "./DocumentMetaFields";

export function EditDocumentModal({
  document,
  open = true,
  onClose,
  onSaved,
}: {
  document: Document | null;
  open?: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const current = useHeld(document);
  const categoryId = useId();
  const notesId = useId();
  const [category, setCategory] = useState(current?.category ?? "");
  const [notes, setNotes] = useState(current?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!current) return;
    setCategory(current.category ?? "");
    setNotes(current.notes ?? "");
    setBusy(false);
    setError(null);
  }, [current]);

  if (!current) return null;
  const doc = current;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updateDocumentMeta(doc.id, {
        category: category || null,
        notes: notes.trim() || null,
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save details");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Document details"
      open={open && Boolean(document)}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy}
            onClick={() => {
              void save();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <p className="mt-0 mb-4 flex min-w-0 items-center gap-2.5 text-sm text-muted">
        <FileIcon filename={doc.filename} mime={doc.mime} size="sm" />
        <span className="truncate">{doc.filename}</span>
      </p>
      <DocumentMetaFields
        categoryId={categoryId}
        notesId={notesId}
        category={category}
        notes={notes}
        onCategory={setCategory}
        onNotes={setNotes}
      />
      {error ? <p className="mt-4 mb-0 text-sm text-danger">{error}</p> : null}
    </Modal>
  );
}
