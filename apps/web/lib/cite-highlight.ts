export const CITE_MARK_CLASS = "cite-highlight";

export type HighlightQuery = string | string[] | null | undefined;

export type HighlightPart = {
  text: string;
  hit: boolean;
};

export type CompactHit = {
  start: number;
  end: number;
};

export type TextRun = {
  str: string;
  hasEOL?: boolean;
};

export type RunHit = {
  run: number;
  start: number;
  end: number;
};

export type PageRunHit = RunHit & {
  page: number;
};

export type ImageBox = {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ContainRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Painted image rectangle inside an object-fit: contain box. */
export function objectContainRect(
  naturalW: number,
  naturalH: number,
  boxW: number,
  boxH: number,
): ContainRect {
  if (naturalW < 1 || naturalH < 1 || boxW < 1 || boxH < 1) {
    return { x: 0, y: 0, w: Math.max(boxW, 0), h: Math.max(boxH, 0) };
  }
  const scale = Math.min(boxW / naturalW, boxH / naturalH);
  const w = naturalW * scale;
  const h = naturalH * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

type WalkedChar = {
  index: number;
  char: string;
};

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "then",
  "so",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "from",
  "by",
  "with",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "do",
  "does",
  "did",
  "can",
  "could",
  "should",
  "would",
  "will",
  "may",
  "might",
  "must",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "there",
  "their",
  "any",
  "some",
  "all",
  "each",
  "every",
  "what",
  "which",
  "who",
  "whom",
  "when",
  "where",
  "why",
  "how",
  "about",
  "into",
  "over",
  "after",
  "before",
  "between",
  "related",
  "document",
  "documents",
  "please",
  "tell",
  "show",
  "find",
  "have",
  "has",
  "had",
  "not",
  "yes",
  "just",
  "also",
  "file",
  "files",
  "page",
  "pages",
]);

const KEEP_SHORT = new Set(["mg", "ml", "kg", "mcg", "iu", "iv", "im", "po"]);

function isSpace(ch: string): boolean {
  return /\s/.test(ch);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Walk printable characters, dropping hyphenation at line breaks. */
export function compactWalk(text: string): WalkedChar[] {
  const out: WalkedChar[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "-" && i + 1 < text.length && isSpace(text[i + 1])) continue;
    if (isSpace(ch)) continue;
    out.push({ index: i, char: ch.toLowerCase() });
  }
  return out;
}

export function compactChars(text: string): string {
  return compactWalk(text)
    .map((item) => item.char)
    .join("");
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+(?:[.'-][a-z0-9]+)*/g) ?? [];
}

function keepToken(token: string): boolean {
  if (KEEP_SHORT.has(token)) return true;
  if (STOPWORDS.has(token)) return false;
  if (/\d/.test(token)) return token.length >= 1;
  return token.length >= 3;
}

function includesTerm(haystack: string, term: string): boolean {
  return findTermHits(haystack, [term]).length > 0;
}

function ngrams(tokens: string[], size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + size <= tokens.length; i += 1) {
    out.push(tokens.slice(i, i + size).join(" "));
  }
  return out;
}

/** Query words/phrases to paint, preferring phrases that appear in the cited passage. */
export function focusTerms(query: string, passage?: string | null): string[] {
  const tokens = tokenize(query);
  if (!tokens.length) return passage ? fallbackTerms(passage) : [];

  const candidates: string[] = [];
  for (const size of [3, 2]) {
    for (const phrase of ngrams(tokens, size)) {
      const words = phrase.split(" ");
      if (!keepToken(words[0] ?? "") || !keepToken(words[words.length - 1] ?? "")) continue;
      if (passage && !includesTerm(passage, phrase)) continue;
      candidates.push(phrase);
    }
  }
  for (const token of tokens) {
    if (!keepToken(token)) continue;
    if (passage && !includesTerm(passage, token)) continue;
    candidates.push(token);
  }

  const unique = [...new Set(candidates)];
  unique.sort((a, b) => b.length - a.length || a.localeCompare(b));

  const kept: string[] = [];
  for (const term of unique) {
    if (
      kept.some(
        (phrase) =>
          phrase !== term &&
          (phrase.split(/\s+/).includes(term) ||
            phrase.includes(` ${term} `) ||
            phrase.startsWith(`${term} `) ||
            phrase.endsWith(` ${term}`)),
      )
    ) {
      continue;
    }
    kept.push(term);
  }

  if (kept.length) return kept;
  const fromQuery = tokens.filter(keepToken);
  if (fromQuery.length) return fromQuery.slice(0, 4);
  return passage ? fallbackTerms(passage) : [];
}

function fallbackTerms(passage: string): string[] {
  const sentence = passage.split(/(?<=[.?!])\s/)[0] ?? passage;
  return tokenize(sentence).filter(keepToken).slice(0, 3);
}

export function asTerms(query: HighlightQuery, passage?: string | null): string[] {
  if (Array.isArray(query)) return query.filter((term) => term.trim());
  if (query?.trim()) return focusTerms(query, passage);
  if (passage?.trim()) return fallbackTerms(passage);
  return [];
}

export function findCompactMatch(haystack: string, query: string): CompactHit | null {
  const h = compactChars(haystack);
  const q = compactChars(query);
  if (!h || !q) return null;

  const indexOf = (needle: string) => (needle ? h.indexOf(needle) : -1);

  let at = indexOf(q);
  if (at >= 0) return { start: at, end: at + q.length };

  const minLen = Math.min(24, q.length);
  for (let len = q.length - 1; len >= minLen; len -= 1) {
    at = indexOf(q.slice(0, len));
    if (at >= 0) return { start: at, end: at + len };
  }
  return null;
}

export function mapCompactToOriginal(text: string, hit: CompactHit): CompactHit | null {
  const walked = compactWalk(text);
  const from = walked[hit.start];
  const to = walked[hit.end - 1];
  if (!from || !to) return null;
  return { start: from.index, end: to.index + 1 };
}

function findRegexHits(text: string, term: string): CompactHit[] {
  const parts = term
    .trim()
    .split(/\s+/)
    .map(escapeRegExp)
    .filter(Boolean);
  if (!parts.length) return [];
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}])${parts.join("[\\s\\-]+")}(?![\\p{L}\\p{N}])`,
    "giu",
  );
  const hits: CompactHit[] = [];
  let match: RegExpExecArray | null = re.exec(text);
  while (match) {
    hits.push({ start: match.index, end: match.index + match[0].length });
    if (!match[0].length) re.lastIndex += 1;
    match = re.exec(text);
  }
  return hits;
}

function findCompactHits(text: string, term: string): CompactHit[] {
  const walked = compactWalk(text);
  const h = walked.map((item) => item.char).join("");
  const q = compactChars(term);
  if (q.length < 2) return [];
  const hits: CompactHit[] = [];
  let from = 0;
  while (from <= h.length - q.length) {
    const at = h.indexOf(q, from);
    if (at < 0) break;
    const orig = mapCompactToOriginal(text, { start: at, end: at + q.length });
    if (orig) hits.push(orig);
    from = at + q.length;
  }
  return hits;
}

export function findTermHits(haystack: string, terms: string[]): CompactHit[] {
  const hits: CompactHit[] = [];
  for (const term of terms) {
    const found = findRegexHits(haystack, term);
    hits.push(...(found.length ? found : findCompactHits(haystack, term)));
  }
  return mergeHits(hits);
}

export function mergeHits(hits: CompactHit[]): CompactHit[] {
  const sorted = [...hits].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: CompactHit[] = [];
  for (const hit of sorted) {
    const last = out[out.length - 1];
    if (last && hit.start <= last.end) {
      last.end = Math.max(last.end, hit.end);
    } else {
      out.push({ ...hit });
    }
  }
  return out;
}

function locatePassage(text: string, passage: string): CompactHit | null {
  const compact = findCompactMatch(text, passage);
  return compact ? mapCompactToOriginal(text, compact) : null;
}

export function focusedHits(
  haystack: string,
  query: HighlightQuery,
  passage?: string | null,
): CompactHit[] {
  const terms = asTerms(query, passage);
  if (!terms.length) return [];
  const termHits = findTermHits(haystack, terms);
  if (!passage?.trim()) return termHits;
  const window = locatePassage(haystack, passage);
  if (!window) return termHits;
  return termHits.filter((hit) => hit.start < window.end && hit.end > window.start);
}

export function splitHighlight(
  text: string,
  query?: HighlightQuery,
  passage?: string | null,
): HighlightPart[] {
  const hits = focusedHits(text, query, passage);
  if (!hits.length) return [{ text, hit: false }];
  const parts: HighlightPart[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start > cursor) {
      parts.push({ text: text.slice(cursor, hit.start), hit: false });
    }
    parts.push({ text: text.slice(hit.start, hit.end), hit: true });
    cursor = hit.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return parts.filter((part) => part.text);
}

export function snippetAround(
  text: string,
  query: HighlightQuery,
  max = 220,
): string {
  const hits = focusedHits(text, query);
  const hit = hits[0];
  if (!hit) return text.slice(0, max);
  const start = Math.max(0, hit.start - 24);
  return text.slice(start, start + max);
}

function flattenRuns(runs: TextRun[]): { text: string; map: { run: number; offset: number }[] } {
  let text = "";
  const map: { run: number; offset: number }[] = [];
  runs.forEach((run, runIndex) => {
    for (let i = 0; i < run.str.length; i += 1) {
      map.push({ run: runIndex, offset: i });
      text += run.str[i];
    }
  });
  return { text, map };
}

function hitsToRunHits(
  map: { run: number; offset: number }[],
  hits: CompactHit[],
): RunHit[] {
  const spans: RunHit[] = [];
  for (const hit of hits) {
    const lastIndex = Math.min(hit.end, map.length);
    for (let i = hit.start; i < lastIndex; i += 1) {
      const item = map[i];
      if (!item) continue;
      const last = spans[spans.length - 1];
      if (last && last.run === item.run && last.end === item.offset) {
        last.end = item.offset + 1;
      } else {
        spans.push({ run: item.run, start: item.offset, end: item.offset + 1 });
      }
    }
  }
  return spans;
}

export function matchPagedRuns(
  pages: { page: number; runs: TextRun[] }[],
  query?: HighlightQuery,
  passage?: string | null,
  pageHint?: number | null,
): PageRunHit[] {
  const terms = asTerms(query, passage);
  if (!terms.length) return [];

  const perPage = pages.map((leaf) => {
    const { text, map } = flattenRuns(leaf.runs);
    const window = passage?.trim() ? locatePassage(text, passage) : null;
    const hits = window
      ? findTermHits(text, terms).filter((hit) => hit.start < window.end && hit.end > window.start)
      : findTermHits(text, terms);
    return {
      page: leaf.page,
      usedWindow: Boolean(window),
      hits: hitsToRunHits(map, hits),
    };
  });

  const windowed = perPage.filter((leaf) => leaf.usedWindow);
  const chosen = windowed.length
    ? windowed
    : perPage.filter((leaf) => (pageHint ? leaf.page === pageHint : true));

  return chosen.flatMap((leaf) =>
    leaf.hits.map((span) => ({ ...span, page: leaf.page })),
  );
}

export function matchImageBoxes(
  boxes: ImageBox[],
  query?: HighlightQuery,
  passage?: string | null,
): ImageBox[] {
  if (!boxes.length) return [];
  const hits = matchPagedRuns(
    [{ page: 1, runs: boxes.map((box) => ({ str: `${box.text}\n` })) }],
    query,
    passage,
  );
  const indexes = new Set(hits.map((hit) => hit.run));
  const matched = boxes.filter((_, index) => indexes.has(index));
  if (matched.length || !passage?.trim()) return matched;
  const hay = compactChars(passage);
  return boxes.filter((box) => {
    const needle = compactChars(box.text);
    return needle.length >= 3 && hay.includes(needle);
  });
}

export function clearCiteHighlights(root: HTMLElement): void {
  root.querySelectorAll(`mark.${CITE_MARK_CLASS}`).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

function wrapRange(node: Text, start: number, end: number): HTMLElement {
  const marked = start === 0 ? node : node.splitText(start);
  if (end - start < (marked.textContent?.length ?? 0)) {
    marked.splitText(end - start);
  }
  const mark = window.document.createElement("mark");
  mark.className = CITE_MARK_CLASS;
  marked.parentNode?.insertBefore(mark, marked);
  mark.appendChild(marked);
  return mark;
}

export function highlightDom(
  root: HTMLElement,
  query?: HighlightQuery,
  passage?: string | null,
): HTMLElement | null {
  clearCiteHighlights(root);
  const terms = asTerms(query, passage);
  if (!terms.length) return null;

  const walker = window.document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current: Node | null = walker.nextNode();
  while (current) {
    if (current.textContent) nodes.push(current as Text);
    current = walker.nextNode();
  }

  const haystack = nodes.map((node) => node.textContent ?? "").join("");
  const hits = focusedHits(haystack, terms, passage);
  if (!hits.length) return null;

  const byNode = new Map<Text, CompactHit[]>();
  for (const hit of hits) {
    let offset = 0;
    for (const node of nodes) {
      const length = node.textContent?.length ?? 0;
      const from = Math.max(hit.start, offset);
      const to = Math.min(hit.end, offset + length);
      if (from < to) {
        const list = byNode.get(node) ?? [];
        list.push({ start: from - offset, end: to - offset });
        byNode.set(node, list);
      }
      offset += length;
    }
  }

  let earliest: HTMLElement | null = null;
  for (const node of nodes) {
    const ranges = (byNode.get(node) ?? []).sort((a, b) => b.start - a.start);
    ranges.forEach((range, index) => {
      const mark = wrapRange(node, range.start, range.end);
      if (index === ranges.length - 1 && !earliest) earliest = mark;
    });
  }
  return earliest;
}
