"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useHeld } from "@/lib/use-presence";

export function ConfirmDeleteModal({
  title,
  name,
  description,
  confirming = false,
  open = true,
  onCancel,
  onConfirm,
}: {
  title: string;
  name: string;
  description: string;
  confirming?: boolean;
  open?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const heldName = useHeld(name || null) ?? name;
  return (
    <Modal
      title={title}
      open={open}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" loading={confirming} onClick={onConfirm}>
            Delete
          </Button>
        </>
      }
    >
      <p className="m-0 text-sm text-muted">
        {description}{" "}
        <span className="font-medium text-ink">“{heldName}”</span>. It cannot be undone.
      </p>
    </Modal>
  );
}
