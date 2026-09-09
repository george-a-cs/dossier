# Wave 5 — Polish

**Only after Wave 4 is green.** Do not steal time from eval (4.5) or the README (4.6).

---

## Phase 5.1 — Follow-up query rewrite

**Why.** “What about the second one?” needs the previous question.

**In**

- `dossier/generate/rewrite.py` — optional LLM or rule-based rewrite of the latest question given last 4 turns
- Skip rewrite when history is empty
- Prefer a **small** rewrite prompt; if it fails, use the raw question
- Tests: “the second one” + prior “compare dose and contraindication” → rewritten question contains both topics (fake LLM script)

**Skip if.** Time is gone. Verify (2.2) matters more than rewrite.

**Acceptance**

- [x] Rewrite cannot append web instructions or escape the corpus
- [x] Failure path falls back to the raw question

---

## Phase 5.2 — Retrieval debug drawer

**Why.** Quality tool for you and a credibility signal for reviewers.

**In**

- Dev-only toggle (`NEXT_PUBLIC_DEBUG=1` or a discreet “Sources used” disclosure)
- Show retrieved chunks, scores, vector vs FTS vs RRF rank
- Do not show this as the default consumer UI

**Skip if.** Session strip already tells the honesty story and time is short.

**Acceptance**

- [x] Drawer data comes from the `final` event or `/brief` stats, not a second undocumented retrieve
- [x] Off by default in the README happy path

---

## Phase 5.3 — Evidence

**Screenshots (required if you can):**

1. Empty / seed CTA
2. Library after seed (stages or ready)
3. Grounded brief with chips
4. Reader after chip click (highlight)
5. Refusal (“Not in this dossier”)
6. Session strip (latency, cost, grounded)

Store under `docs/screenshots/` with short filenames.

**Video.** Only if Waves 2–4 are solid. 2–3 minutes: compose up, seed, question, cite, refuse, strip. No music, no voiceover script written by an LLM.

**Skip if.** Docs are unfinished. A complete README beats a video of a broken path.

---

## Stop

After 5.3, stop building. Re-read the README aloud. Fix only lies and broken setup.
