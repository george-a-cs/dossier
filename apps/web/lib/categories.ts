export const DOCUMENT_CATEGORIES = [
  "Label",
  "SOP",
  "Guidance",
  "Protocol",
  "Other",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const UNCATEGORIZED = "Uncategorized";

export function categoryLabel(category: string | null | undefined): string {
  const value = category?.trim();
  return value || UNCATEGORIZED;
}

export function usedCategories(documents: { category?: string | null }[]): string[] {
  const found = new Set<string>();
  for (const doc of documents) {
    const value = doc.category?.trim();
    if (value) found.add(value);
  }
  const known = DOCUMENT_CATEGORIES.filter((item) => found.has(item));
  const extra = [...found]
    .filter((item) => !DOCUMENT_CATEGORIES.includes(item as DocumentCategory))
    .sort();
  return [...known, ...extra];
}
