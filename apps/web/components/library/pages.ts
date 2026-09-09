import type { Chunk } from "@/lib/types";

export type PreviewPage = {
  page: number;
  chunks: Chunk[];
  snippet: string;
};

export function groupPages(chunks: Chunk[]): PreviewPage[] {
  if (!chunks.length) return [];
  const groups = new Map<number, Chunk[]>();
  for (const chunk of chunks) {
    const page = chunk.page_start ?? 1;
    const list = groups.get(page) ?? [];
    list.push(chunk);
    groups.set(page, list);
  }
  return [...groups.keys()]
    .sort((a, b) => a - b)
    .map((page) => {
      const items = groups.get(page) ?? [];
      return {
        page,
        chunks: items,
        snippet: items.map((chunk) => chunk.text).join(" ").trim(),
      };
    });
}
