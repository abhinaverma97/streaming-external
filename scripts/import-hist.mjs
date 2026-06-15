import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const HIST_FILE = path.join(ROOT, "hist.txt");
const DATA_FILE = path.join(ROOT, ".cache", "user-data.json");
const DATA_DIR = path.join(ROOT, ".cache");

const TMDB_API_KEY = process.env.TMDB_API_KEY || "1070730380f5fee0d87cf0382670b255";
const TMDB_BASE = "https://api.themoviedb.org/3";

const ENTRY_RE = /^(\d+)\.\s+"(.+)"\s+\((\d+)\)\s*-\s*(.+)$/m;
const WATCHLIST_ITEM_RE = /^-\s+"(.+)"\s+\((\d+)\)\s*-\s*(.+)$/;
const SKIP_RE = /rating\s+is\s+irrelevant|i\s+will\s+not\s+watch\s+this|ignore\s+rating/i;

function parseHistText(text) {
  const lines = text.split(/\r?\n/);
  const rated = [];
  const watchlist = [];
  let mode = "rated";

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^USER'S WATCHLIST:/i.test(line)) {
      mode = "watchlist";
      i++;
      continue;
    }

    if (mode === "watchlist") {
      const m = line.match(WATCHLIST_ITEM_RE);
      if (m) {
        watchlist.push({ title: m[1], year: parseInt(m[2], 10), rawType: m[3].trim() });
      }
      i++;
      continue;
    }

    const entryMatch = line.match(ENTRY_RE);
    if (entryMatch) {
      const num = parseInt(entryMatch[1], 10);
      const title = entryMatch[2];
      const year = parseInt(entryMatch[3], 10);
      const rawType = entryMatch[4].trim();
      i++;

      let entryBodyLines = [];
      while (i < lines.length) {
        const next = lines[i];
        if (ENTRY_RE.test(next)) break;
        if (/^USER'S WATCHLIST:/i.test(next)) break;
        entryBodyLines.push(next);
        i++;
      }

      const body = parseEntryBody(entryBodyLines);

      const skip = body.thoughts && SKIP_RE.test(body.thoughts);
      if (skip) {
        console.log(`  [SKIP] #${num} "${title}" — thoughts indicate skip`);
        continue;
      }

      if (body.rating == null) {
        console.log(`  [SKIP] #${num} "${title}" — no valid rating`);
        continue;
      }

      rated.push({
        num,
        title,
        year,
        rawType,
        rating: body.rating,
        thoughts: body.thoughts || "",
      });
      continue;
    }

    i++;
  }

  return { rated, watchlist };
}

const FIELD_PREFIXES = /^(User Rating:|User Thoughts:|TMDB Rating:|Director:|Synopsis:)/;

function parseEntryBody(lines) {
  const entry = { rating: null, thoughts: "" };
  let currentField = null;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (FIELD_PREFIXES.test(trimmed)) {
      const ratingM = trimmed.match(/^User Rating:\s*(\d+)\/5$/);
      if (ratingM) {
        entry.rating = parseInt(ratingM[1], 10);
        currentField = null;
        continue;
      }

      const thoughtsM = trimmed.match(/^User Thoughts:\s*(.*)$/);
      if (thoughtsM) {
        entry.thoughts = thoughtsM[1];
        currentField = "thoughts";
        continue;
      }

      if (/^TMDB Rating:|^Director:|^Synopsis:/i.test(trimmed)) {
        currentField = null;
        continue;
      }
    }

    if (currentField === "thoughts" && trimmed) {
      entry.thoughts = entry.thoughts ? entry.thoughts + " " + trimmed : trimmed;
    }
  }

  entry.thoughts = entry.thoughts.trim();
  return entry;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function searchTmdb(title, year) {
  const url = `${TMDB_BASE}/search/multi?query=${encodeURIComponent(title)}&year=${year}&api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TMDB error ${res.status}: ${res.statusText}`);
  }
  const data = await res.json();
  return data.results || [];
}

function pickBestResult(results, title, year) {
  if (!results.length) return null;

  const exactYear = results.filter(r => {
    const y = r.release_date?.slice(0, 4) || r.first_air_date?.slice(0, 4);
    return y === String(year);
  });
  if (exactYear.length) return exactYear[0];

  if (results.length === 1) return results[0];

  const fuzzy = results.filter(r => {
    const y = r.release_date?.slice(0, 4) || r.first_air_date?.slice(0, 4);
    return y && Math.abs(parseInt(y) - year) <= 1;
  });
  return fuzzy[0] || results[0];
}

function buildMovieDetails(result) {
  return {
    id: result.id,
    title: result.title || result.name || "",
    poster_path: result.poster_path || null,
    backdrop_path: result.backdrop_path || null,
    overview: result.overview || "",
    media_type: result.media_type || "movie",
  };
}

async function resolveEntry(entry) {
  try {
    const results = await searchTmdb(entry.title, entry.year);
    const best = pickBestResult(results, entry.title, entry.year);
    if (!best) {
      console.log(`  [WARN] #${entry.num} "${entry.title}" (${entry.year}) — no TMDB match`);
      return null;
    }

    const mediaType = best.media_type || "movie";
    const tmdbId = String(best.id);
    const details = buildMovieDetails(best);

    return { tmdbId, mediaType, details, rating: entry.rating, thoughts: entry.thoughts };
  } catch (e) {
    console.log(`  [ERR] #${entry.num} "${entry.title}" — ${e.message}`);
    return null;
  }
}

async function resolveWatchlistItem(item) {
  try {
    const results = await searchTmdb(item.title, item.year);
    const best = pickBestResult(results, item.title, item.year);
    if (!best) {
      console.log(`  [WARN] Watchlist "${item.title}" (${item.year}) — no TMDB match`);
      return null;
    }

    const mediaType = best.media_type || item.rawType.toLowerCase();
    const tmdbId = String(best.id);
    const details = buildMovieDetails(best);

    return { tmdbId, mediaType, details };
  } catch (e) {
    console.log(`  [ERR] Watchlist "${item.title}" — ${e.message}`);
    return null;
  }
}

function loadExistingData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { watchlist: [], progress: [], history: [], ratings: [], settings: {}, recommendations: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return { watchlist: [], progress: [], history: [], ratings: [], settings: {}, recommendations: {} };
  }
}

async function main() {
  console.log("=== Import hist.txt ===\n");

  if (!fs.existsSync(HIST_FILE)) {
    console.error("hist.txt not found at", HIST_FILE);
    process.exit(1);
  }

  const text = fs.readFileSync(HIST_FILE, "utf-8");
  const { rated, watchlist } = parseHistText(text);

  console.log(`Parsed ${rated.length} rated entries, ${watchlist.length} watchlist entries\n`);

  const existing = loadExistingData();
  const existingRatings = new Map(existing.ratings || []);
  const existingWatchlist = new Map(existing.watchlist || []);

  console.log("--- Resolving rated entries via TMDB ---");
  let ratedAdded = 0;
  let ratedFailed = 0;

  for (const entry of rated) {
    process.stdout.write(`  #${entry.num} "${entry.title}" (${entry.year})... `);
    const resolved = await resolveEntry(entry);
    if (!resolved) {
      console.log("FAILED");
      ratedFailed++;
      await sleep(300);
      continue;
    }

    existingRatings.set(resolved.tmdbId, {
      tmdbId: resolved.tmdbId,
      rating: resolved.rating,
      movieDetails: resolved.details,
      ratedAt: Date.now(),
      thoughts: resolved.thoughts,
    });
    console.log(`✓ → tmdbId=${resolved.tmdbId} type=${resolved.mediaType} rating=${resolved.rating}/5`);
    ratedAdded++;
    await sleep(300);
  }

  console.log("\n--- Resolving watchlist entries via TMDB ---");
  let wlAdded = 0;
  let wlFailed = 0;

  for (const item of watchlist) {
    process.stdout.write(`  "${item.title}" (${item.year})... `);
    const resolved = await resolveWatchlistItem(item);
    if (!resolved) {
      console.log("FAILED");
      wlFailed++;
      await sleep(300);
      continue;
    }

    if (!existingWatchlist.has(resolved.tmdbId)) {
      existingWatchlist.set(resolved.tmdbId, {
        tmdbId: resolved.tmdbId,
        mediaType: resolved.mediaType,
        movieDetails: resolved.details,
        addedAt: Date.now(),
      });
    }
    console.log(`✓ → tmdbId=${resolved.tmdbId} type=${resolved.mediaType}`);
    wlAdded++;
    await sleep(300);
  }

  console.log("\n--- Writing user-data.json ---");
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const output = {
    ...existing,
    watchlist: [...existingWatchlist],
    ratings: [...existingRatings],
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(output), "utf-8");

  console.log(`\n=== Summary ===`);
  console.log(`  Rated: ${ratedAdded} added, ${ratedFailed} failed`);
  console.log(`  Watchlist: ${wlAdded} added, ${wlFailed} failed`);
  console.log(`  Total ratings now: ${existingRatings.size}`);
  console.log(`  Total watchlist now: ${existingWatchlist.size}`);
  console.log(`\nDone.`);
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
