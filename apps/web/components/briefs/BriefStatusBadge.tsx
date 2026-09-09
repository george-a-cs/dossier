import { Badge } from "@/components/ui/Badge";
import type { SavedBrief } from "@/lib/types";
import { briefStatus } from "./brief-status";

export function BriefStatusBadge({ brief }: { brief: SavedBrief }) {
  const status = briefStatus(brief);
  return <Badge tone={status.tone}>{status.label}</Badge>;
}
