# Dossier UI — implementation plan

A lean, modern workspace for grounded document briefing. The product stays an analyst’s desk: upload a collection, ask from it, and verify the passage. The chrome should get out of the way.

This plan is the contract for the current UI. Implement it; do not invent extra product surface (settings, auth, marketing, dark-mode toggle).

---

## 1. Problem and UX goal

The current three-pane desk is readable but not a product. Navigation is implicit, mobile is stacked columns, briefs vanish on refresh, and files have no preview.

**Job to be done**

1. See whether the dossier is ready (Dashboard).
2. Find and read a source (Library).
3. Ask, save, and reopen a brief (Briefs).

**UX principles**

| Principle | How it shows up |
|---|---|
| One primary action per screen | Dashboard → open Library or New analysis. Library → upload / open file. Briefs → create or open. |
| Recognition over recall | Saved briefs have a title (first question), date, and grounded/refused state. Files show type, status, and size. |
| Progressive disclosure | Preview and delete sit behind an explicit click. Debug retrieval stays behind `NEXT_PUBLIC_DEBUG`. |
| Honest empty states | Empty is designed: one sentence + one action. Never a blank card. |
| Touch first, desktop refined | 44px targets, fullscreen mobile menu, preview as a sheet on small screens. |
| Same component, same behaviour | Buttons, badges, cards, and modals share one API. No one-off styles in pages. |

**Success (usability)**

- New user reaches a sourced brief in under three minutes on desktop or phone.
- File preview opens in one tap; close is obvious (X, overlay, Escape).
- Delete never happens without a confirm modal that names the brief.
- A submitted brief is in the list after refresh (same browser).

---

## 2. Visual language

Inspired by the attached SaaS references: light workspace, white cards, one accent, soft elevation, generous padding. Not paper-editorial. Not a chatbot landing page.

### Tokens

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#F6F7FB` | App canvas |
| `--color-surface` | `#FFFFFF` | Cards, sidebar, preview |
| `--color-ink` | `#1B2332` | Titles, primary text |
| `--color-muted` | `#667085` | Meta, captions |
| `--color-line` | `#E6E8EF` | Hairline borders |
| `--color-primary` | `#4F6BF5` | CTA, active nav, chart |
| `--color-primary-soft` | `#EEF1FF` | Active chip, icon wells |
| `--color-success` | `#12B76A` | Ready / grounded |
| `--color-success-soft` | `#E7F8EF` | Success pills |
| `--color-danger` | `#F04438` | Failed / delete |
| `--color-danger-soft` | `#FEECEB` | Error pills, confirm |
| `--color-warn` | `#F79009` | Ingest in progress |
| `--color-warn-soft` | `#FEF4E6` | Warning pills |
| `--color-highlight` | `#E8EDFF` | Cited passage |
| `--radius-sm` | `8px` | Inputs, chips |
| `--radius-md` | `12px` | Buttons, list rows |
| `--radius-lg` | `16px` | Cards, preview |
| `--radius-pill` | `999px` | Status badges, page pill |
| `--shadow-sm` | `0 1px 2px rgb(16 24 40 / 0.05)` | Rows |
| `--shadow-md` | `0 8px 24px rgb(16 24 40 / 0.08)` | Cards, dropdowns |
| `--shadow-lg` | `0 16px 40px rgb(16 24 40 / 0.12)` | Preview, modal |

**Type:** Inter (400 / 500 / 600 / 700). Page title 28/32, section 16/600, body 14–15, meta 13.

**Icons:** one stroke weight (1.75–2px), 20px in nav, 16px in buttons. No mixed icon sets.

**Motion:** 150–200ms ease-out on hover/open. No decorative animation.

---

## 3. Information architecture

```
AppShell
├── Sidebar (desktop) / MobileMenu (viewport < 768px)
│   ├── Wordmark “dossier”
│   ├── New analysis (primary)
│   ├── Dashboard
│   ├── Library
│   └── Briefs
├── TopBar          page title + optional actions
├── Main            route content
└── Disclaimer      sticky footer copy
```

| Route | Purpose |
|---|---|
| `/` | Dashboard overview |
| `/library` | Collection files, list or grid, preview |
| `/briefs` | Saved analyses |
| `/briefs/new` | New analysis composer |
| `/briefs/[id]` | Open a saved brief (continue or read) |

No settings, users, or subscription pages.

---

## 4. Navigation and mobile

### Desktop sidebar

- Fixed 240px, white, right hairline.
- Active item: soft primary fill, primary label + icon. Inactive: muted.
- “New analysis” is the only solid primary button in the rail.
- Disclaimer stays in the page footer, not the rail.

### Fullscreen mobile menu

- Top bar: wordmark, page title, hamburger (44×44).
- Open: `position: fixed` overlay at `z-50`, white, 100dvh. Body scroll locked.
- Large type (20–22px), 16px vertical padding per row, full-width hit area.
- Same items as the sidebar, plus New analysis at the top.
- Close: X, Escape, or choosing a destination.
- Focus trap while open; return focus to the hamburger on close.

---

## 5. Screens

### 5.1 Dashboard

Overview, not a second library.

**Stat row (4 cards)**

| Card | Source |
|---|---|
| Files | `documents.length` |
| Ready | status `ready` |
| Briefs | saved brief count |
| Grounded | share of saved / queried briefs that were not refused |

Each card: label, large number, one-line hint. Optional small icon well in primary-soft.

**Usage chart**

- Title: “Briefing activity”.
- Last 7 days, counts of saved brief turns (and query events when the API has them).
- SVG area chart: primary stroke, light primary fill. No chart library.
- Empty: “Ask a question to start the week.”

**Activity**

- Combined feed, newest first, cap ~12.
- Document ingested → “filename · Ready / Failed · time”.
- Brief saved → “title · Grounded / Not in dossier · time”.
- Row is a button: files → Library preview, briefs → `/briefs/[id]`.

**Shortcuts**

- If no files: Load seed corpus + Upload.
- If files but no briefs: New analysis.

### 5.2 Library (Drive-like)

Toolbar: search, view toggle (list / grid), Load seed, Upload. Hidden file input + drop on the canvas.

**List**

- Rows: file icon, name, size, status pill, chunk/page meta.
- Hover: lift (`shadow-sm`). Selected / open: 3px primary bar on the left.

**Grid**

- Cards: large type icon, name (2-line clamp), size + status.
- Same click target as list.

**Preview (required on any file click)**

- Overlay, centred card (~min(720px, 92vw)), `shadow-lg`. Mobile: fullscreen sheet.
- Header: filename, status, Close.
- Body: passage text from document chunks, in order. Cited chunk (query `?chunk=`) is `<mark>` and scrolled into view.
- Footer pill: `1 of N` when `page_count` is known; otherwise chunk index.
- Failed files: status copy, no fake preview.

Persist view mode in `localStorage` (`dossier.library.view`).

### 5.3 Briefs

**List (`/briefs`)**

- Header + “New analysis”.
- Cards: title (first question), updated time, “Based on N passages” or “Not in this dossier”, delete (trash).
- Click card body → `/briefs/[id]`.
- Empty: “No briefs yet” + New analysis. Example questions live on the composer, not here.

**Composer (`/briefs/new` and `/briefs/[id]`)**

- Same component. New starts empty; existing hydrates turns.
- Thread: user question, streamed answer, citation chips, session strip (latency · cost · grounded/refused).
- Chip click → `/library?doc={id}&chunk={id}` (preview + highlight).
- Composer disabled until at least one document is `ready`.
- Enter submits; Shift+Enter newline.
- **Auto-save:** on `event: final`, upsert the brief (id = `conversation_id`). Title = first question, truncated.
- Debug drawer unchanged, behind env flag.

**Delete**

- Confirm modal: title “Delete brief?”, body includes the brief title, actions Cancel + Delete (danger).
- Confirm removes it from the store and returns to `/briefs` if the open brief was deleted.

---

## 6. Component system

All primitives live in `components/ui`. Pages compose; they do not restyle buttons.

| Component | Variants / API | Used on |
|---|---|---|
| `Button` | `primary` `secondary` `ghost` `danger`; `sm` `md`; `loading`; left icon | Every CTA |
| `IconButton` | ghost icon, `aria-label` required | Close, menu, delete, view toggle |
| `Card` | `padding` `interactive` | Stats, brief rows, grid tiles |
| `Badge` | `neutral` `primary` `success` `warn` `danger` | Status, grounded |
| `Modal` | title, body, footer, Escape + overlay close, labelled | Preview, delete confirm |
| `Input` / `Textarea` | shared height, focus ring = primary | Search, question |
| `EmptyState` | icon, title, description, actions | All empty screens |
| `PageHeader` | title, description, actions | Every page |
| `FileIcon` | pdf / md / txt / file from mime + name | Library, activity |
| `Spinner` | sm / md | Loading buttons and pages |
| `SegmentedControl` | 2+ options, roving tabindex | List / grid |

**Layout**

- `AppShell`, `Sidebar`, `MobileNav`, `TopBar`, `Disclaimer`.

**Feature folders** (one concern each)

- `components/dashboard/*`
- `components/library/*`
- `components/briefs/*`

**Lib**

| Module | Role |
|---|---|
| `lib/api.ts` | Only network boundary |
| `lib/types.ts` | Shared types |
| `lib/status.ts` | Human ingest copy |
| `lib/format.ts` | Dates, bytes, duration, money |
| `lib/briefs-store.ts` | Saved briefs (local, conversation-keyed) |
| `lib/cn.ts` | Class join |

Do not `fetch` from a component. Do not duplicate button classes.

---

## 7. Data and persistence

**API additions (thin; data already in SQLite)**

| Endpoint | Why |
|---|---|
| Document JSON includes `byte_size`, `created_at` | Library meta |
| `GET /documents/{id}/chunks` | Preview body |
| `GET /collections/{id}/events` | Dashboard activity / chart |

**Briefs** stay in `localStorage` (`dossier.briefs.v1`) keyed by `conversation_id`. The API already stores conversation messages for follow-ups; the UI store keeps the defensible brief (citations, stats, title) so a refresh can reopen the same analysis without a new briefs table.

Auto-save payload: `{ id, title, createdAt, updatedAt, conversationId, turns[] }`.

---

## 8. States, a11y, responsive

**States:** loading skeleton or spinner in the main pane; error inline under the action; empty via `EmptyState`; ingest pills from `statusCopy`.

**A11y**

- Controls are `<button>` / `<a>`, not divs.
- Modals: `role="dialog"`, `aria-modal`, labelled title, focus trap.
- Nav: `aria-current="page"`.
- Preview close: Escape.
- Color is not the only status signal (label + pill).
- `prefers-reduced-motion`: skip transitions.

**Breakpoints**

| | `< 768` | `≥ 768` |
|---|---|---|
| Nav | Fullscreen menu | Sidebar |
| Dashboard | Stats 2×2, chart full | Stats 4-col |
| Library | Grid 2-col; preview sheet | List/grid; centred preview |
| Briefs | Stacked cards | Same, wider measure |

---

## 9. File map

```
plans/UI/ui-plan.md

apps/web/app/
  layout.tsx
  page.tsx                 Dashboard
  library/page.tsx
  briefs/page.tsx
  briefs/new/page.tsx
  briefs/[id]/page.tsx
  globals.css

apps/web/components/
  ui/                      primitives
  layout/                  shell
  dashboard/
  library/
  briefs/
  icons.tsx

apps/web/lib/
  api.ts  types.ts  status.ts  format.ts  briefs-store.ts  cn.ts
```

Removed: three-pane `Desk` / `Panes` / inline `Library` / `Briefing` / `Reader` as the product frame. Citation reading moves into Library preview.

---

## 10. Acceptance

- [ ] Nav is Dashboard, Library, Briefs; active state is obvious.
- [ ] Mobile menu is fullscreen, closable, and does not leave scroll locked.
- [ ] Dashboard shows file counts, a 7-day usage chart, and an activity list.
- [ ] Library list and thumbnail grid both open the same preview.
- [ ] Preview shows chunk text; citation from a brief lands on the marked passage.
- [ ] New analysis auto-saves on final; list shows it after refresh.
- [ ] Opening a brief restores the thread; delete asks for confirm and names the title.
- [ ] Buttons and other primitives are reused; no one-off CTA styles.
- [ ] Disclaimer remains visible.
- [ ] `lib/api.ts` remains the only network boundary.
- [ ] `npx tsc --noEmit` is clean.

**Out of scope:** auth, dark mode, OCR, drag-to-upload folders, server-side brief CRUD, pixel-perfect PDF.js.
