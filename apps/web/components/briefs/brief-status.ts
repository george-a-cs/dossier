import type { BadgeTone } from "@/components/ui/Badge";
import type { SavedBrief } from "@/lib/types";

export function briefStatus(brief: SavedBrief): { label: string; tone: BadgeTone } {
  const last = brief.turns.at(-1)?.final;
  if (!last) return { label: "In progress", tone: "neutral" };
  if (last.refused) return { label: "Not in this dossier", tone: "danger" };
  const count = last.citations.length;
  return {
    label: `Based on ${count} passage${count === 1 ? "" : "s"}`,
    tone: "success",
  };
}
