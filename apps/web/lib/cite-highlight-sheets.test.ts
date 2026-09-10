import assert from "node:assert/strict";
import test from "node:test";
import { matchSheetCells } from "./cite-highlight.ts";

const sheets = [
  {
    name: "Doses",
    cells: [
      ["drug", "dose"],
      ["Widget", "10 mg"],
    ],
  },
  {
    name: "Notes",
    cells: [["cite the label"], ["keep dry"]],
  },
];

test("matchSheetCells highlights the cited dose cell", () => {
  const hits = matchSheetCells(sheets, "10 mg", "# Doses\ndrug\tdose\nWidget\t10 mg");
  assert.deepEqual(hits, [{ sheet: 1, row: 1, col: 1 }]);
});

test("matchSheetCells follows a passage on another sheet", () => {
  const hits = matchSheetCells(sheets, "cite the label", "# Notes\ncite the label");
  assert.deepEqual(hits, [{ sheet: 2, row: 0, col: 0 }]);
});

test("matchSheetCells paints the same keyword on every sheet", () => {
  const book = [
    { name: "Doses", cells: [["10 mg"], ["keep dry"]] },
    { name: "Notes", cells: [["store at 10 mg"]] },
  ];
  const hits = matchSheetCells(book, "10 mg", "# Notes\nstore at 10 mg");
  assert.deepEqual(hits, [
    { sheet: 2, row: 0, col: 0 },
    { sheet: 1, row: 0, col: 0 },
  ]);
});

test("matchSheetCells still paints other sheets when a sheet hint is set", () => {
  const hits = matchSheetCells(sheets, "10 mg", null, 2);
  assert.deepEqual(hits, [{ sheet: 1, row: 1, col: 1 }]);
});
