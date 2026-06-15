import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "bench-results", "playwright");

const METRICS = {};

async function measurePage(browser, url, label) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  try {
    await page.coverage.startCSSCoverage();
  } catch {}
  try {
    await page.coverage.startJSCoverage();
  } catch {}

  const startTime = Date.now();

  await page.goto(url, { waitUntil: "networkidle0", timeout: 20000 });
  const loadTime = Date.now() - startTime;

  const perfTimings = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    if (!nav) return {};
    return {
      domContentLoaded: nav.domContentLoadedEnd,
      loadEventEnd: nav.loadEventEnd,
      domComplete: nav.domComplete,
      domInteractive: nav.domInteractive,
      requestStart: nav.requestStart,
      responseEnd: nav.responseEnd,
      transferSize: nav.transferSize,
      decodedBodySize: nav.decodedBodySize,
      encodedBodySize: nav.encodedBodySize,
    };
  });

  const paintMetrics = await page.evaluate(() => {
    const entries = performance.getEntriesByType("paint");
    const result = {};
    for (const e of entries) result[e.name] = e.startTime;
    return result;
  });

  const resourceBreakdown = await page.evaluate(() => {
    const entries = performance.getEntriesByType("resource");
    const counts = { script: 0, style: 0, image: 0, font: 0, fetch: 0, other: 0 };
    const sizes = { script: 0, style: 0, image: 0, font: 0, fetch: 0, other: 0 };
    for (const e of entries) {
      const type = e.initiatorType;
      if (counts[type] !== undefined) {
        counts[type]++;
        sizes[type] += e.transferSize || 0;
      } else {
        counts.other++;
        sizes.other += e.transferSize || 0;
      }
    }
    return { counts, sizes };
  });

  let cssCoveragePct = 0;
  let jsCoveragePct = 0;
  try {
    const cssCoverage = await page.coverage.stopCSSCoverage();
    const jsCoverage = await page.coverage.stopJSCoverage();

    const totalCSSBytes = cssCoverage.reduce((s, e) => s + (e.text?.length || 0), 0);
    const usedCSSBytes = cssCoverage.reduce((s, e) => s + (e.ranges || []).reduce((rs, r) => rs + (r.end - r.start), 0), 0);
    const totalJSBytes = jsCoverage.reduce((s, e) => s + (e.text?.length || 0), 0);
    const usedJSBytes = jsCoverage.reduce((s, e) => s + (e.ranges || []).reduce((rs, r) => rs + (r.end - r.start), 0), 0);

    cssCoveragePct = totalCSSBytes ? +((usedCSSBytes / totalCSSBytes) * 100).toFixed(1) : 0;
    jsCoveragePct = totalJSBytes ? +((usedJSBytes / totalJSBytes) * 100).toFixed(1) : 0;
  } catch {}

  const metrics = {
    url,
    loadTimeMs: loadTime,
    domContentLoaded: perfTimings.domContentLoaded || null,
    domComplete: perfTimings.domComplete || null,
    domInteractive: perfTimings.domInteractive || null,
    firstPaint: paintMetrics["first-paint"] || null,
    firstContentfulPaint: paintMetrics["first-contentful-paint"] || null,
    transferSize: perfTimings.transferSize || 0,
    decodedBodySize: perfTimings.decodedBodySize || 0,
    encodedBodySize: perfTimings.encodedBodySize || 0,
    resourceCounts: resourceBreakdown.counts,
    resourceSizes: resourceBreakdown.sizes,
    cssCoveragePct,
    jsCoveragePct,
  };

  METRICS[label] = metrics;
  console.log(`[${label}] Loaded in ${loadTime}ms  FCP: ${(metrics.firstContentfulPaint || "N/A")}ms`);

  await context.close();
}

async function main() {
  console.log("=== Playwright Frontend Performance Benchmarks ===\n");

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

  // Warm up
  console.log("Warming up...");
  const warm = await browser.newPage();
  try { await warm.goto(BASE, { timeout: 8000 }); } catch {}
  await warm.close();

  // Measure all pages (no auth needed — single-user app)
  await measurePage(browser, `${BASE}/`, "home");
  await measurePage(browser, `${BASE}/log`, "log");
  await measurePage(browser, `${BASE}/recommend`, "recommend");

  await browser.close();

  // Write results
  const outputPath = path.join(OUT_DIR, "results.json");
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    metrics: METRICS,
  }, null, 2));
  console.log(`\nResults written to ${outputPath}`);

  // Summary
  console.log("\n=== Summary ===");
  console.table(Object.entries(METRICS).map(([page, m]) => ({
    Page: page,
    "Load (ms)": m.loadTimeMs,
    "FCP (ms)": m.firstContentfulPaint?.toFixed(0) || "N/A",
    "DOM Complete (ms)": m.domComplete?.toFixed(0) || "N/A",
    "Transfer (KB)": (m.transferSize / 1024).toFixed(1),
    Scripts: m.resourceCounts.script,
    Images: m.resourceCounts.image,
    "CSS Used": `${m.cssCoveragePct}%`,
    "JS Used": `${m.jsCoveragePct}%`,
  })));
}

main().catch((err) => {
  console.error("Playwright benchmark failed:", err.message);
  process.exit(1);
});
