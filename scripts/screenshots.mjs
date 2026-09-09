/**
 * Capture the six Wave 5 stills. Needs a running desk (API :8000, web :3000)
 * and Playwright Chromium with system libs:
 *
 *   npm install playwright
 *   npx playwright install chromium
 *   npx playwright install-deps chromium   # if libatk is missing
 *   node scripts/screenshots.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "screenshots");
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.route("**/collections/default/documents", async (route) => {
  if (route.request().method() === "GET" && page.url().includes("empty=1")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
    return;
  }
  await route.continue();
});

await page.goto("http://127.0.0.1:3000/?empty=1", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Upload file" }).waitFor();
await page.screenshot({ path: join(OUT, "01-empty-seed.png"), fullPage: true });

await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
await page.getByText("label-excerpt.md").waitFor();
await page.screenshot({ path: join(OUT, "02-library-seeded.png"), fullPage: true });

await page.getByRole("button", { name: "What is the recommended dose?" }).click();
await page.getByText("Based on", { timeout: 90_000 }).waitFor();
await page.screenshot({ path: join(OUT, "03-grounded-brief.png"), fullPage: true });

await page.locator("button", { hasText: "label-excerpt" }).first().click();
await page.locator("mark").waitFor();
await page.screenshot({ path: join(OUT, "04-reader-highlight.png"), fullPage: true });

await page.getByRole("button", { name: /CEO/ }).click();
await page.getByText("Not in this dossier", { timeout: 90_000 }).waitFor();
await page.screenshot({ path: join(OUT, "05-refusal.png"), fullPage: true });

const strip = page.getByText(/ms · \$/);
await strip.waitFor();
await strip.scrollIntoViewIfNeeded();
await page.screenshot({ path: join(OUT, "06-session-strip.png"), fullPage: true });

await browser.close();
console.log("wrote", OUT);
