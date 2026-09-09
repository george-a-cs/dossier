"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import {
  encodeAddr,
  encodeCol,
  mergeAt,
  parseSheet,
  type SheetKind,
  type SheetView,
} from "./spreadsheet";

export function SpreadsheetPreview({
  data,
  sheet,
  onSheet,
  onSheetCount,
  kind = "workbook",
  onBusy,
  zoom = 100,
}: {
  data: ArrayBuffer;
  sheet: number;
  onSheet: (index: number) => void;
  onSheetCount: (count: number) => void;
  kind?: SheetKind;
  onBusy?: (label: string | null) => void;
  zoom?: number;
}) {
  const [sheets, setSheets] = useState<SheetView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState({ row: 0, col: 0 });

  useEffect(() => {
    let cancelled = false;
    import("xlsx")
      .then((XLSX) => {
        const workbook =
          kind === "csv"
            ? XLSX.read(new TextDecoder().decode(data), { type: "string" })
            : XLSX.read(data, {
                type: "array",
                cellStyles: true,
                cellNF: true,
                cellDates: true,
              });
        const parsed = workbook.SheetNames.map((name) => parseSheet(name, workbook.Sheets[name]));
        if (cancelled) return;
        setSheets(parsed);
        onSheetCount(parsed.length);
        setSelected({ row: 0, col: 0 });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not open spreadsheet");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [data, kind, onSheetCount]);

  const current = sheets[sheet - 1] ?? sheets[0];
  useEffect(() => {
    setSelected({ row: 0, col: 0 });
  }, [sheet]);
  const active = current?.cells[selected.row]?.[selected.col] ?? null;
  const address = current ? encodeAddr(selected.row, selected.col) : "A1";

  useEffect(() => {
    if (!current) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "PageDown" && event.ctrlKey) {
        event.preventDefault();
        onSheet(Math.min(sheets.length, sheet + 1));
        return;
      }
      if (event.key === "PageUp" && event.ctrlKey) {
        event.preventDefault();
        onSheet(Math.max(1, sheet - 1));
        return;
      }
      const move =
        event.key === "ArrowDown"
          ? { row: 1, col: 0 }
          : event.key === "ArrowUp"
            ? { row: -1, col: 0 }
            : event.key === "ArrowRight" || event.key === "Tab"
              ? { row: 0, col: event.shiftKey && event.key === "Tab" ? -1 : 1 }
              : event.key === "ArrowLeft"
                ? { row: 0, col: -1 }
                : null;
      if (!move) return;
      event.preventDefault();
      setSelected((value) => ({
        row: Math.min(current.rows - 1, Math.max(0, value.row + move.row)),
        col: Math.min(current.cols - 1, Math.max(0, value.col + move.col)),
      }));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, onSheet, sheet, sheets.length]);

  const display = useMemo(() => {
    if (!active) return "";
    return active.formula ?? active.text;
  }, [active]);

  useEffect(() => {
    onBusy?.(error ? null : current ? null : "Opening spreadsheet…");
    return () => onBusy?.(null);
  }, [error, current, onBusy]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!current) return null;

  return (
    <div className="xls-book flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-md">
      <div className="xls-formula flex shrink-0 items-stretch border-b border-[#d0d0d0] bg-[#f3f3f3]">
        <span className="flex w-14 items-center justify-center border-r border-[#d0d0d0] text-[12px] font-semibold text-[#6b6b6b]">
          fx
        </span>
        <span className="flex w-16 items-center justify-center border-r border-[#d0d0d0] font-mono text-[12px] text-[#333]">
          {address}
        </span>
        <span className="min-w-0 flex-1 truncate px-3 py-1.5 text-[13px] text-[#1a1a1a]">
          {display}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table
          className="xls-grid border-separate border-spacing-0"
          style={{ zoom: zoom / 100 }}
        >
          <thead>
            <tr>
              <th className="xls-corner" />
              {Array.from({ length: current.cols }, (_, col) => (
                <th
                  key={col}
                  className={cn("xls-colhead", selected.col === col && "xls-axis-active")}
                  style={{ width: current.colWidths[col], minWidth: current.colWidths[col] }}
                >
                  {encodeCol(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: current.rows }, (_, row) => (
              <tr key={row} style={{ height: current.rowHeights[row] }}>
                <th className={cn("xls-rowhead", selected.row === row && "xls-axis-active")}>
                  {row + 1}
                </th>
                {Array.from({ length: current.cols }, (_, col) => {
                  const span = mergeAt(current.merges, row, col);
                  if (span === "skip") return null;
                  const cell = current.cells[row][col];
                  const isActive = selected.row === row && selected.col === col;
                  return (
                    <td
                      key={col}
                      rowSpan={span?.rowspan}
                      colSpan={span?.colspan}
                      onClick={() => setSelected({ row, col })}
                      className={cn("xls-cell", isActive && "xls-cell-active")}
                      style={{
                        ...cell?.style,
                        width: current.colWidths[col],
                        minWidth: current.colWidths[col],
                      }}
                    >
                      {cell?.text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="xls-tabs flex shrink-0 items-end gap-1 overflow-x-auto border-t border-[#d0d0d0] bg-[#f3f3f3] px-2 pt-1 pb-0">
        {sheets.map((item, index) => {
          const number = index + 1;
          const activeSheet = number === sheet;
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => onSheet(number)}
              className={cn("xls-tab", activeSheet && "xls-tab-active")}
            >
              {item.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
