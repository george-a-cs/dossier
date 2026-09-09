import type { CSSProperties } from "react";
import type { CellObject, Range, WorkSheet } from "xlsx";

export type SheetKind = "workbook" | "csv";

export type GridCell = {
  text: string;
  formula?: string;
  style: CSSProperties;
};

export type SheetView = {
  name: string;
  rows: number;
  cols: number;
  cells: (GridCell | null)[][];
  merges: Range[];
  colWidths: number[];
  rowHeights: number[];
};

const MAX_ROWS = 400;
const MAX_COLS = 52;
const MIN_ROWS = 20;
const MIN_COLS = 10;

export function encodeCol(index: number): string {
  let n = index + 1;
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

export function encodeAddr(row: number, col: number): string {
  return `${encodeCol(col)}${row + 1}`;
}

export function excelRgb(value?: string): string | undefined {
  if (!value) return undefined;
  const hex = value.length === 8 ? value.slice(2) : value;
  return /^[0-9A-Fa-f]{6}$/.test(hex) ? `#${hex}` : undefined;
}

export function cellStyle(cell?: CellObject): CSSProperties {
  const style = cell?.s;
  if (!style) return {};
  const horizontal = style.alignment?.horizontal as string | undefined;
  const vertical = style.alignment?.vertical as string | undefined;
  return {
    backgroundColor: excelRgb(style.fill?.fgColor?.rgb) ?? excelRgb(style.fill?.bgColor?.rgb),
    color: excelRgb(style.font?.color?.rgb),
    fontWeight: style.font?.bold ? 600 : undefined,
    fontStyle: style.font?.italic ? "italic" : undefined,
    textDecoration: style.font?.underline ? "underline" : undefined,
    fontSize: style.font?.sz ? `${style.font.sz}pt` : undefined,
    fontFamily: style.font?.name,
    textAlign:
      horizontal === "center" || horizontal === "right" || horizontal === "left"
        ? horizontal
        : undefined,
    verticalAlign:
      vertical === "center" ? "middle" : vertical === "top" || vertical === "bottom" ? vertical : undefined,
    whiteSpace: style.alignment?.wrapText ? "pre-wrap" : "nowrap",
  };
}

export function cellText(cell?: CellObject): string {
  if (!cell) return "";
  if (cell.w != null && String(cell.w).length) return String(cell.w);
  if (cell.v == null) return "";
  if (cell.v instanceof Date) return cell.v.toLocaleString();
  return String(cell.v);
}

export function mergeAt(merges: Range[], row: number, col: number): { rowspan: number; colspan: number } | "skip" | null {
  for (const merge of merges) {
    if (row < merge.s.r || row > merge.e.r || col < merge.s.c || col > merge.e.c) continue;
    if (row === merge.s.r && col === merge.s.c) {
      return { rowspan: merge.e.r - merge.s.r + 1, colspan: merge.e.c - merge.s.c + 1 };
    }
    return "skip";
  }
  return null;
}

export function parseSheet(name: string, sheet: WorkSheet): SheetView {
  const ref = sheet["!ref"] ?? "A1";
  const range = decodeRange(ref);
  const usedRows = Math.min(MAX_ROWS, Math.max(0, range.e.r + 1));
  const usedCols = Math.min(MAX_COLS, Math.max(0, range.e.c + 1));
  const rows = Math.min(MAX_ROWS, Math.max(MIN_ROWS, usedRows + 4));
  const cols = Math.min(MAX_COLS, Math.max(MIN_COLS, usedCols + 2));
  const cells: (GridCell | null)[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));

  for (let row = 0; row < usedRows; row += 1) {
    for (let col = 0; col < usedCols; col += 1) {
      const cell = sheet[encodeAddr(row, col)] as CellObject | undefined;
      if (!cell) continue;
      const style = cellStyle(cell);
      if (!style.textAlign && cell.t === "n") style.textAlign = "right";
      cells[row][col] = {
        text: cellText(cell),
        formula: cell.f ? `=${cell.f}` : undefined,
        style,
      };
    }
  }

  const colInfo = sheet["!cols"] ?? [];
  const rowInfo = sheet["!rows"] ?? [];
  return {
    name,
    rows,
    cols,
    cells,
    merges: (sheet["!merges"] ?? []).filter((merge) => merge.s.r < rows && merge.s.c < cols),
    colWidths: Array.from({ length: cols }, (_, index) => {
      const info = colInfo[index];
      const px = info?.wpx ?? (info?.wch != null ? Math.round(info.wch * 8 + 5) : 72);
      return Math.min(360, Math.max(48, px));
    }),
    rowHeights: Array.from({ length: rows }, (_, index) => {
      const info = rowInfo[index];
      const px = info?.hpx ?? (info?.hpt != null ? Math.round(info.hpt * 1.33) : 22);
      return Math.min(96, Math.max(20, px));
    }),
  };
}

function decodeRange(ref: string): Range {
  const [start, end] = ref.split(":");
  const s = decodeAddr(start);
  const e = decodeAddr(end ?? start);
  return { s, e };
}

function decodeAddr(addr: string): { r: number; c: number } {
  const match = /^([A-Z]+)(\d+)$/i.exec(addr.trim());
  if (!match) return { r: 0, c: 0 };
  const letters = match[1].toUpperCase();
  let col = 0;
  for (let i = 0; i < letters.length; i += 1) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return { r: Number(match[2]) - 1, c: col - 1 };
}
