/**
 * scripts/resolve-seed.mjs
 *
 * One-time local tool. Reads hist.txt, resolves every entry to a real TMDB ID,
 * and writes data/seed.json in the exact format store.js load() expects.
 *
 * Run: node scripts/resolve-seed.mjs
 * Commit: data/seed.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const HIST_FILE = path.join(ROOT, "hist.txt");
const OUT_FILE = path.join(ROOT, "data", "seed.json");
const OUT_DIR = path.join(ROOT, "data");

const TMDB_API_KEY = process.env.TMDB_API_KEY || "1070730380f5fee0d87cf0382670b255";
const TMDB_BASE = "https://api.themoviedb.org/3";

// Fixed timestamp — all seed entries share the same ratedAt / addedAt.
// This keeps the Log page order stable and avoids noise in diffs.
const SEED_TS = 1700000000000; // 2023-11-14T22:13:20.000Z

const ENTRY_RE = /^(\d+)\.\s+"(.+)"\s+\((\d+)\)\s*-\s*(.+)$/m;
const WATCHLIST_ITEM_RE = /^-\s+"(.+)"\s+\((\d+)\)\s*-\s*(.+)$/;
const SKIP_RE = /rating\s+is\s+irrelevant|i\s+will\s+not\s+watch\s+this|ignore\s+rating/i;
const FIELD_PREFIXES = /^(User Rating:|User Thoughts:|TMDB Rating:|Director:|Synopsis:)/;

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function parseEntryBody(lines) {
  const entry = { rating: null, thoughts: "" };
  let currentField = null;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (FIELD_PREFIXES.test(t)) {
      const rM = t.match(/^User Rating:\s*(\d+)\/5$/);
      if (rM) { entry.rating = parseInt(rM[1], 10); currentField = null; continue; }
      const thM = t.match(/^User Thoughts:\s*(.*)$/);
      if (thM) { entry.thoughts = thM[1]; currentField = "thoughts"; continue; }
      if (/^TMDB Rating:|^Director:|^Synopsis:/i.test(t)) { currentField = null; continue; }
    }
    if (currentField === "thoughts" && t) {
      entry.thoughts = entry.thoughts ? entry.thoughts + " " + t : t;
    }
  }
  entry.thoughts = entry.thoughts.trim();
  return entry;
}

function parseHistText(text) {
  const lines = text.split(/\r?\n/);
  const rated = [];
  const watchlist = [];
  let mode = "rated";
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^USER'S WATCHLIST:/i.test(line)) { mode = "watchlist"; i++; continue; }
    if (mode === "watchlist") {
      const m = line.match(WATCHLIST_ITEM_RE);
      if (m) watchlist.push({ title: m[1], year: parseInt(m[2], 10), rawType: m[3].trim() });
      i++; continue;
    }
    const em = line.match(ENTRY_RE);
    if (em) {
      const num = parseInt(em[1], 10);
      const title = em[2];
      const year = parseInt(em[3], 10);
      const rawType = em[4].trim();
      i++;
      const bodyLines = [];
      while (i < lines.length) {
        const next = lines[i];
        if (ENTRY_RE.test(next) || /^USER'S WATCHLIST:/i.test(next)) break;
        bodyLines.push(next);
        i++;
      }
      const body = parseEntryBody(bodyLines);
      if (body.thoughts && SKIP_RE.test(body.thoughts)) {
        console.log(`  [SKIP] #${num} "${title}" — skip flag in thoughts`);
        continue;
      }
      if (body.rating == null) {
        console.log(`  [SKIP] #${num} "${title}" — no valid rating`);
        continue;
      }
      rated.push({ num, title, year, rawType, rating: body.rating, thoughts: body.thoughts || "" });
      continue;
    }
    i++;
  }
  return { rated, watchlist };
}

// ---------------------------------------------------------------------------
// TMDB
// ---------------------------------------------------------------------------

async function searchTmdb(title, year) {
  const url = `${TMDB_BASE}/search/multi?query=${encodeURIComponent(title)}&year=${year}&api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return data.results || [];
}

function pickBest(results, year) {
  if (!results.length) return null;
  const exact = results.filter(r => {
    const y = r.release_date?.slice(0, 4) || r.first_air_date?.slice(0, 4);
    return y === String(year);
  });
  if (exact.length) return exact[0];
  if (results.length === 1) return results[0];
  const fuzzy = results.filter(r => {
    const y = r.release_date?.slice(0, 4) || r.first_air_date?.slice(0, 4);
    return y && Math.abs(parseInt(y) - year) <= 1;
  });
  return fuzzy[0] || results[0];
}

function buildDetails(r) {
  return {
    id: r.id,
    title: r.title || r.name || "",
    poster_path: r.poster_path || null,
    backdrop_path: r.backdrop_path || null,
    overview: r.overview || "",
    media_type: r.media_type || "movie",
  };
}

const CONCURRENCY = 5;

async function resolveBatch(items, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(fn));
    for (const r of results) out.push(r.status === "fulfilled" ? r.value : null);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== resolve-seed.mjs ===\n");

  if (!fs.existsSync(HIST_FILE)) {
    console.error("hist.txt not found in project root. Aborting.");
    process.exit(1);
  }

  const text = fs.readFileSync(HIST_FILE, "utf-8");
  const { rated, watchlist } = parseHistText(text);
  console.log(`Parsed: ${rated.length} rated, ${watchlist.length} watchlist\n`);

  // --- Ratings ---
  console.log("--- Resolving ratings ---");
  const ratingsMap = new Map();
  const ratedResolved = await resolveBatch(rated, async (entry) => {
    process.stdout.write(`  #${entry.num} "${entry.title}" (${entry.year})... `);
    try {
      const results = await searchTmdb(entry.title, entry.year);
      const best = pickBest(results, entry.year);
      if (!best) { console.log("NO MATCH"); return null; }
      const tmdbId = String(best.id);
      console.log(`✓ ${tmdbId} [${best.media_type}] "${best.title || best.name}"`);
      return { tmdbId, mediaType: best.media_type || "movie", details: buildDetails(best), rating: entry.rating, thoughts: entry.thoughts };
    } catch (e) {
      console.log(`ERR: ${e.message}`);
      return null;
    }
  });

  let rOk = 0, rFail = 0;
  for (const r of ratedResolved) {
    if (!r) { rFail++; continue; }
    ratingsMap.set(r.tmdbId, {
      tmdbId: r.tmdbId,
      rating: r.rating,
      movieDetails: r.details,
      ratedAt: SEED_TS,
      thoughts: r.thoughts,
    });
    rOk++;
  }

  // --- Watchlist ---
  console.log("\n--- Resolving watchlist ---");
  const watchlistMap = new Map();
  const wlResolved = await resolveBatch(watchlist, async (item) => {
    process.stdout.write(`  "${item.title}" (${item.year})... `);
    try {
      const results = await searchTmdb(item.title, item.year);
      const best = pickBest(results, item.year);
      if (!best) { console.log("NO MATCH"); return null; }
      const tmdbId = String(best.id);
      console.log(`✓ ${tmdbId} [${best.media_type}] "${best.title || best.name}"`);
      return { tmdbId, mediaType: best.media_type || item.rawType.toLowerCase(), details: buildDetails(best) };
    } catch (e) {
      console.log(`ERR: ${e.message}`);
      return null;
    }
  });

  let wOk = 0, wFail = 0;
  for (const r of wlResolved) {
    if (!r) { wFail++; continue; }
    if (!watchlistMap.has(r.tmdbId)) {
      watchlistMap.set(r.tmdbId, {
        tmdbId: r.tmdbId,
        mediaType: r.mediaType,
        movieDetails: r.details,
        addedAt: SEED_TS,
      });
    }
    wOk++;
  }

  // --- Write seed.json ---
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const seed = {
    ratings: [...ratingsMap],
    watchlist: [...watchlistMap],
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(seed, null, 2), "utf-8");

  console.log(`\n=== Done ===`);
  console.log(`  Ratings : ${rOk} resolved, ${rFail} failed`);
  console.log(`  Watchlist: ${wOk} resolved, ${wFail} failed`);
  console.log(`  Written  : data/seed.json`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
