import { Badge } from "@/components/ui/Badge";
import { categoryLabel } from "@/lib/categories";

export function CategoryBadge({
  category,
  empty = false,
}: {
  category?: string | null;
  empty?: boolean;
}) {
  if (!category?.trim() && !empty) return null;
  const label = categoryLabel(category);
  return (
    <Badge tone={category?.trim() ? "primary" : "neutral"}>{label}</Badge>
  );
}
