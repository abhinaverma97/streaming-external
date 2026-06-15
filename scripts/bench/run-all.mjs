import { execSync, spawn } from "child_process";
import path from "path";
import fs from "fs";

const ROOT = process.cwd();
const RESULTS_DIR = path.join(ROOT, "bench-results");

function run(cmd, opts = {}) {
  try {
    execSync(cmd, {
      cwd: ROOT,
      stdio: "inherit",
      timeout: opts.timeout || 300000,
      shell: "powershell.exe",
      env: { ...process.env, ...(opts.env || {}) },
    });
  } catch (e) {
    if (!opts.optional) throw e;
  }
}

async function waitForServer(serverProcess, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server did not start")), timeout);
    serverProcess.stdout.on("data", (d) => {
      const s = d.toString();
      if (s.includes("Ready") || s.includes("started") || s.includes("listening")) {
        setTimeout(() => { clearTimeout(timer); resolve(true); }, 500);
      }
    });
  });
}

function stopServer(server) {
  return new Promise((resolve) => {
    const killTimer = setTimeout(() => {
      try { server.kill("SIGKILL"); } catch {}
      resolve();
    }, 5000);
    server.on("exit", () => { clearTimeout(killTimer); resolve(); });
    try { server.kill("SIGTERM"); } catch { clearTimeout(killTimer); resolve(); }
  });
}

function parsePlaywrightResults() {
  const p = path.join(RESULTS_DIR, "playwright", "results.json");
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}

function fmt(ms) {
  const n = Math.round(ms);
  if (n >= 1000) return (n / 1000).toFixed(1) + "s";
  return n + "ms";
}

function report(totalMs) {
  const o = [];
  o.push("=".repeat(58));
  o.push("  BENCHMARK RESULTS");
  o.push("=".repeat(58));

  const pw = parsePlaywrightResults();
  if (pw?.metrics) {
    o.push("");
    o.push("  Playwright (Page Loads)");
    o.push(`  ${"Page".padEnd(12)} ${"Load".padStart(7)} ${"FCP".padStart(7)} ${"DOM".padStart(7)} ${"Size".padStart(7)}`);
    o.push(`  ${"─".repeat(12)} ${"─".repeat(7)} ${"─".repeat(7)} ${"─".repeat(7)} ${"─".repeat(7)}`);
    for (const [name, m] of Object.entries(pw.metrics)) {
      const size = (m.transferSize / 1024).toFixed(1) + "k";
      o.push(`  ${name.padEnd(12)} ${fmt(m.loadTimeMs).padStart(7)} ${fmt(m.firstContentfulPaint).padStart(7)} ${fmt(m.domComplete).padStart(7)} ${size.padStart(7)}`);
    }
  }

  o.push("");
  o.push(`  Total: ${fmt(totalMs)}`);
  o.push("=".repeat(58));
  return o.join("\n");
}

async function main() {
  const t0 = Date.now();
  console.log("\n  spicy — Benchmarks\n");

  fs.mkdirSync(path.join(RESULTS_DIR, "playwright"), { recursive: true });

  // 1. Build
  console.log("  build");
  run(`npm run build`, { timeout: 180000 });

  // 2. Server
  console.log("  server");
  const sp = path.join(ROOT, ".next", "standalone");
  const server = spawn("powershell.exe", ["-Command", "node server.js"], {
    cwd: sp, stdio: "pipe",
    env: { ...process.env, NODE_ENV: "production", PORT: "3000" },
    shell: false,
  });
  try {
    await waitForServer(server, 60000);
    console.log("  ok");

    // 3. Playwright
    console.log("  browser");
    run(`node scripts/bench/playwright.mjs`, {
      timeout: 120000,
      env: { BASE_URL: "http://localhost:3000" },
    });

    // 4. k6
    console.log("  k6");
    run(`k6 run scripts/bench/k6/api-test.js`, {
      timeout: 120000,
      env: { BASE_URL: "http://localhost:3000" },
      optional: true,
    });
  } finally {
    await stopServer(server);
  }

  console.log(`\n${report(Date.now() - t0)}\n`);
}

main().catch((e) => { console.error("Bench failed:", e); process.exit(1); });
