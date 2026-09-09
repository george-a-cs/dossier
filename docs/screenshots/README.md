# Screenshots

Intended stills (1440×900 desk):

| File | What it shows |
|---|---|
| `01-empty-seed.png` | Seed CTA, empty briefing |
| `02-library-seeded.png` | Four ready seed documents |
| `03-grounded-brief.png` | Dose answer + citation chips |
| `04-reader-highlight.png` | `mark` on the labelled dose |
| `05-refusal.png` | “Not in this dossier” |
| `06-session-strip.png` | Latency · cost · Grounded/Refused |

This environment could not launch Chromium (`libatk-1.0` missing, no root for `playwright install-deps`). Capture on a machine with a browser:

```bash
# API :8000 and web :3000 already running, seed loaded
npm install playwright
npx playwright install chromium
node scripts/screenshots.mjs
```

No video. The path is faster to judge from stills plus `make test`.
