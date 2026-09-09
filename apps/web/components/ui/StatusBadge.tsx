import { statusCopy } from "@/lib/status";
import type { DocumentStatus } from "@/lib/types";
import { Badge, type BadgeTone } from "./Badge";

const TONES: Record<DocumentStatus, BadgeTone> = {
  queued: "neutral",
  parsing: "warn",
  chunking: "warn",
  embedding: "warn",
  ready: "success",
  failed: "danger",
};

export function StatusBadge({
  status,
  errorCode,
}: {
  status: DocumentStatus;
  errorCode?: string | null;
}) {
  const tone = errorCode === "vision_failed" ? "warn" : TONES[status];
  return <Badge tone={tone}>{statusCopy(status, errorCode ?? null)}</Badge>;
}
